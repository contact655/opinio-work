import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA, type MemberState } from "@/lib/constants/companyMembers";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { notify } from "@/lib/notify/email";
import { ambassadorRequestTemplate } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/mypage/ambassador-self-register
 * Body: { company_id: string; role_title?: string }
 *
 * 本人が「在籍している会社で話を聞かれてもよい」を **ONにする**。
 *
 * ★2026-08-24 に**会社の事前承認を廃止した**（柴さんの判断・LinkedIn と同じ形）。
 *   ONにした時点で企業ページと /people に出る。
 *
 * ── なぜ承認をやめたか（実測 2026-08-24 / 本番）────────────────────────────
 *   `approved_at` が入っている行は **0件**。掲載中4件のうち3件は**管理者が0人の会社**で、
 *   企業が承認した実績は一度も無い。有効な管理者がいる企業は **79社中7社**しかなく、
 *   残り72社では承認できる人が存在しない＝申請しても永久に確認待ちになっていた。
 *   `/people` の注記も既に「OPINIO は在籍確認を行っていません」と書いており、
 *   「承認するまで公開されません」という説明と食い違っていた。
 *
 * ⚠️★**なりすましは3つで受ける。1つでも外すと成立しなくなる。**
 *   ① 在籍として申告している会社にしか作れない（RLS `member_self_apply` の EXISTS）
 *   ② 企業はいつでも非掲載にできる（`/biz/members` の公開トグル）
 *   ③ 画面に「本人の申告です。OPINIO は在籍確認をしていません」と出す
 *
 * ⚠️ `/api/biz/ambassador/self-register` は流用できない。
 *    あちらは `getTenantContext()` 必須の**企業管理者専用**（自社に自分を登録する導線）。
 *
 * ⚠️★**INSERT はセッションクライアントで行う。** admin クライアントを使うと
 *    RLS（`member_self_apply`）が素通りし、
 *    「他人の行を作れない」「他社の行を作れない」「is_public を立てられない」の
 *    保証が**アプリのコードだけ**に載ってしまう。DB 側を効かせたままにする。
 *    ⚠️ 下のチェックは「わかりやすいエラーを返す」ためのもので、**security boundary ではない**。
 *       境界は RLS。ここを消しても安全性は変わらないが、消すと 403 しか返らなくなる。
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { company_id?: string; role_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = (body.company_id ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const roleTitle = (body.role_title ?? "").trim();
  if (roleTitle.length > 100) {
    return NextResponse.json({ error: "INVALID_ROLE_TITLE", message: "役職は100文字以内で入力してください。" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: owUser, error: owErr } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  /* ⚠️ error を握り潰さない。ここが黙って null になると「ユーザーが居ない」と誤判定する */
  if (owErr) {
    console.error("[ambassador self-register] ow_users:", owErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ── 在籍しているか（わかりやすいエラーのため。境界は RLS 側）──────────────
     ⚠️ 条件は RLS の `member_self_apply` と同じにすること。
        片方だけ緩めると「画面では出せるのに 403」になる。 */
  const { data: exp, error: expErr } = await admin
    .from("ow_experiences")
    .select("id")
    .eq("user_id", owUser.id)
    .eq("company_id", companyId)
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  if (expErr) {
    console.error("[ambassador self-register] ow_experiences:", expErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!exp) {
    return NextResponse.json(
      { error: "NOT_CURRENT_MEMBER", message: "この企業に在籍中の職歴が登録されていません。" },
      { status: 403 },
    );
  }

  /* 既に行があるか。UNIQUE (company_id, user_id) があるので二重申請は作れない。
     ⚠️ 409 の理由を状態ごとに分けて返す。「すでに申請済み」と「すでに公開中」は
        利用者にとって別のことで、同じ文言だと何が起きているか分からない。 */
  const { data: existing, error: exErr } = await admin
    .from("ow_company_members")
    .select("id, display_consent, is_public, created_via")
    .eq("company_id", companyId)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (exErr) {
    console.error("[ambassador self-register] existing:", exErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "ALREADY_EXISTS", id: existing.id, is_public: existing.is_public, display_consent: existing.display_consent },
      { status: 409 },
    );
  }

  /* ★セッションクライアントで INSERT する（RLS を効かせるため）。
     ⚠️ `is_public` は **true 固定**。ここも body から取らないこと。
        利用者が決めるのは「ONにするかどうか」で、値そのものではない。
     ⚠️ `consent_at` は本人が**最後に同意した**時刻。取り下げても消さない
        （`guard_member_consent` / 2026-08-24）。`pending_user` と `paused` の判別に使う。 */
  const { data: created, error } = await supabase
    .from("ow_company_members")
    .insert({
      company_id: companyId,
      user_id: owUser.id,
      display_consent: true,
      consent_at: new Date().toISOString(),
      is_public: true,
      created_via: MEMBER_CREATED_VIA.SELF,
      role_title: roleTitle || null,
    })
    .select("id")
    .single();

  if (error) {
    /* ⚠️ 42501 は RLS が止めた場合。上のチェックを通ってここに来るのは、
          チェックと RLS の条件がズレたときなので**ログに残す**。 */
    console.error("[ambassador self-register] insert:", error.code, error.message);
    if (error.code === "23505") {
      return NextResponse.json({ error: "ALREADY_EXISTS" }, { status: 409 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ⚠️ **必ず捨てる。** 即掲載になったので、捨てないと最大60秒このひとが出ない。 */
  revalidateCompanyAmbassadors(companyId);

  /* ★申請が来たことを知らせる（2026-08-23）。
     ⚠️ **メール送信で API を失敗させない。** 行は既に作れているので、
        送信に失敗しても 201 を返す。失敗はログに残す。
     ⚠️ 宛先と「運営に回ったか」は `getCompanyNotificationTarget` の**同じ判定**から出す。
        掲載中79社のうち77社は企業側に宛先が無く、その場合は運営に届く。
     ⚠️ 取引通知なので opt-out 列は要らない（週次のリマインドとは別物）。 */
  await sendRequestNotice(companyId, owUser.id);
  /* ⚠️ 状態名を文字列で直書きしない。`MemberState` で縛っておくと、
        改名したときに tsc が落ちて気づける。
     ⚠️ 2026-08-24 に `pending_company` から変更。**もう承認待ちにはならない。** */
  const state: MemberState = "listed";
  return NextResponse.json({ ok: true, id: created.id, state }, { status: 201 });
}

/**
 * 掲載が始まったことを企業（宛先が無ければ運営）に知らせる。
 *
 * ⚠️★**承認を求めるメールではない**（2026-08-24 に文面ごと変えた）。
 *    企業がすることは「外したい場合に外す」だけ。承認を促す文面のままにすると、
 *    誰も押さない承認を待たせることになる。
 *
 * ⚠️ **送信可否・宛先の判定はこの関数の中に置く**（CLAUDE.md の既存方針）。
 *    呼び出し側に条件を書くと、経路が増えたときに片方だけ忘れる。
 * ⚠️ **例外を外へ投げない。** 送信の失敗で申請そのものを失敗させない。
 */
async function sendRequestNotice(companyId: string, owUserId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: company }, { data: user }] = await Promise.all([
      admin.from("ow_companies").select("name, brand_name").eq("id", companyId).maybeSingle(),
      admin.from("ow_users").select("name").eq("id", owUserId).maybeSingle(),
    ]);

    const target = await getCompanyNotificationTarget(companyId, "ambassador-request");
    if (target.to.length === 0) {
      console.error("[ambassador self-register] 宛先が0件（運営フォールバックも効いていない）", companyId);
      return;
    }

    const appliedAt = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    for (const to of target.to) {
      await notify(
        ambassadorRequestTemplate({
          to,
          companyName: company?.brand_name ?? company?.name ?? "（企業名不明）",
          applicantName: user?.name ?? "（氏名不明）",
          appliedAt,
          /* ⚠️ 印はフォールバックと同じ判定から出す */
          viaOps: target.viaOps,
        }),
      );
    }
  } catch (e) {
    /* ⚠️ ここで throw しない。201 を返すことのほうが大事。 */
    console.error("[ambassador self-register] 通知の送信に失敗:", e);
  }
}

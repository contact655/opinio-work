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
 * 本人が「在籍している会社で話を聞かれてもよい」と**申請**する。
 * **公開はしない。** 企業側が `/biz/members` で承認（is_public → true）するまで
 * 企業ページにも /people にも出ない。
 *
 * ── なぜ承認を挟むか ────────────────────────────────────────────────────────
 * `ow_experiences` の在籍は**自己申告**。即公開にすると、誰でも
 * 「セールスフォース在籍」と書いて企業ページに実名・顔写真・/u/ リンクつきで並べられる。
 * いままで安全だったのは**企業の招待でしか行を作れなかった**からで、
 * この入口はその保証を外す変更にあたる。
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
     ⚠️ `is_public` は **false 固定**。ここを body から取らないこと。
        取ると「本人が承認を飛ばして公開できる」ようになる（RLS が止めるが、
        画面には 403 しか返らず、直したつもりで壊れたままになる）。
     ⚠️ `consent_at` は本人が同意した時刻。企業の承認時刻は `updated_at` で足りるので
        列は増やしていない（2026-08-23 の判断）。 */
  const { data: created, error } = await supabase
    .from("ow_company_members")
    .insert({
      company_id: companyId,
      user_id: owUser.id,
      display_consent: true,
      consent_at: new Date().toISOString(),
      is_public: false,
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

  /* 申請中は表示されないが、**必ず捨てる**。「表示に出ない操作は呼ばなくてよい」を
     例外にすると、どの経路が呼ぶのかが人によって変わって漏れる。 */
  revalidateCompanyAmbassadors(companyId);

  /* ★申請が来たことを知らせる（2026-08-23）。
     ⚠️ **メール送信で API を失敗させない。** 行は既に作れているので、
        送信に失敗しても 201 を返す。失敗はログに残す。
     ⚠️ 宛先と「運営に回ったか」は `getCompanyNotificationTarget` の**同じ判定**から出す。
        掲載中79社のうち77社は企業側に宛先が無く、その場合は運営に届く。
     ⚠️ 取引通知なので opt-out 列は要らない（週次のリマインドとは別物）。 */
  await sendRequestNotice(companyId, owUser.id);
  /* ⚠️ 状態名を文字列で直書きしない。`MemberState` で縛っておくと、
        改名したときに tsc が落ちて気づける（`pending_self` → `pending_user` の改名時に
        ここが取り残されかけた）。 */
  const state: MemberState = "pending_company";
  return NextResponse.json({ ok: true, id: created.id, state }, { status: 201 });
}

/**
 * 申請が来たことを企業（宛先が無ければ運営）に知らせる。
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

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA } from "@/lib/constants/companyMembers";
import { NextRequest, NextResponse } from "next/server";

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

  return NextResponse.json({ ok: true, id: created.id, state: "pending_company" }, { status: 201 });
}

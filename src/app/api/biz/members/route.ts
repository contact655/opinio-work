import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { addExistingUserToCompany } from "./_lib";

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: string; permission?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  const permission = body.permission;
  if (permission !== "admin" && permission !== "member") {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return NextResponse.json({ error: "Company context not found" }, { status: 403 });
  }
  const { companyId, allMemberships } = ctx;

  // actorAdmin 確認: allMemberships から直接取得 (追加 DB クエリなし)
  const actorMembership = allMemberships.find((m) => m.companyId === companyId);
  if (actorMembership?.permission !== "admin") {
    return NextResponse.json({ error: "メンバー追加は管理者のみ可能です" }, { status: 403 });
  }

  /* ⚠️ admin クライアントで引く。2026-08-06 に authenticated から
        ow_users.email の SELECT 権限を剥がしたため、session では読めない。
        ここは「招待したい相手が既に登録済みか」を email で照合する処理で、
        自分以外の行を引く必要がある。 */
  const { data: targetUser } = await createAdminClient()
    .from("ow_users")
    .select("id, name, email")
    .eq("email", email)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "招待メールを送信しました。相手がまだ登録していない場合は /biz/members/invite から招待してください" },
      { status: 200 }
    );
  }

  const result = await addExistingUserToCompany({ supabase, targetUser, companyId, permission });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, member: result.member }, { status: 201 });
}

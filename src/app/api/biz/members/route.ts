import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwUserId, getCompanyId } from "@/lib/business/company";
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
  if (!email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  const permission = body.permission;
  if (permission !== "admin" && permission !== "member") {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }

  const [actorOwUserId, companyId] = await Promise.all([
    getOwUserId(supabase, user.id),
    getCompanyId(supabase, user.id),
  ]);

  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 403 });
  }

  const { data: actorAdmin } = await supabase
    .from("ow_company_admins")
    .select("permission")
    .eq("user_id", actorOwUserId ?? "")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (actorAdmin?.permission !== "admin") {
    return NextResponse.json({ error: "メンバー追加は管理者のみ可能です" }, { status: 403 });
  }

  const { data: targetUser } = await supabase
    .from("ow_users")
    .select("id, name, email")
    .eq("email", email)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json(
      { error: "このメールアドレスのユーザーはまだ Opinio に登録されていません" },
      { status: 404 }
    );
  }

  const result = await addExistingUserToCompany({ supabase, targetUser, companyId, permission });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, member: result.member }, { status: 201 });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwUserId, getCompanyId } from "@/lib/business/company";

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

  // バリデーション
  const email = (body.email ?? "").trim();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  const permission = body.permission;
  if (permission !== "admin" && permission !== "member") {
    return NextResponse.json({ error: "権限が不正です" }, { status: 400 });
  }

  // actor の ow_users.id と company_id を取得
  const [actorOwUserId, companyId] = await Promise.all([
    getOwUserId(supabase, user.id),
    getCompanyId(supabase, user.id),
  ]);

  if (!companyId) {
    return NextResponse.json({ error: "Company not found" }, { status: 403 });
  }

  // actor が admin かチェック
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

  // ow_users で email 検索
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

  // すでにメンバーかチェック
  const { data: existing } = await supabase
    .from("ow_company_admins")
    .select("id, is_active")
    .eq("user_id", targetUser.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing) {
    if (existing.is_active) {
      return NextResponse.json({ error: "このユーザーはすでにメンバーです" }, { status: 409 });
    }

    // 無効化済み → 再有効化 + permission 更新
    const { error } = await supabase
      .from("ow_company_admins")
      .update({ is_active: true, permission })
      .eq("id", existing.id);

    if (error) {
      console.error("[members POST reactivate]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      member: { id: existing.id, name: targetUser.name, email: targetUser.email, permission },
    }, { status: 201 });
  }

  // 新規 INSERT
  const { data: newRow, error: insertErr } = await supabase
    .from("ow_company_admins")
    .insert({
      user_id: targetUser.id,
      company_id: companyId,
      permission,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr || !newRow) {
    console.error("[members POST insert]", insertErr?.message);
    return NextResponse.json({ error: insertErr?.message ?? "Failed" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    member: { id: newRow.id, name: targetUser.name, email: targetUser.email, permission },
  }, { status: 201 });
}

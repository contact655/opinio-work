import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestTemplate } from "@/lib/notify/templates";

/**
 * POST /api/biz/join-request
 *
 * 既存企業への参加リクエスト。
 * 認証済みユーザーが同名企業の重複登録を試みた際に呼ばれる。
 * 対象企業のアクティブAdmin全員にメール通知する。
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { company_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = (body.company_id ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id が必要です" }, { status: 400 });
  }

  const admin = createAdminClient();

  // リクエスト者の情報を取得
  const { data: requester } = await admin
    .from("ow_users")
    .select("id, name, email")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!requester) {
    return NextResponse.json({ error: "ユーザー情報が見つかりません" }, { status: 404 });
  }

  // 対象企業を確認
  const { data: company } = await admin
    .from("ow_companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "企業が見つかりません" }, { status: 404 });
  }

  // 既にメンバーでないか確認
  const { data: existing } = await admin
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", requester.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "すでにこの企業のメンバーです" }, { status: 409 });
  }

  // 対象企業のアクティブAdmin一覧を取得
  const { data: adminMembers } = await admin
    .from("ow_company_admins")
    .select("user_id, ow_users(name, email)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("permission", "admin");

  const adminList = (adminMembers ?? []).flatMap((m) => {
    const u = m.ow_users as { name: string; email: string } | null;
    return u?.email ? [{ name: u.name ?? "管理者", email: u.email }] : [];
  });

  if (adminList.length === 0) {
    // Admin が見つからない場合はOPINIO運営へ転送
    adminList.push({ name: "OPINIO運営", email: process.env.ADMIN_EMAIL ?? "contact@opinio.co.jp" });
  }

  // 各Adminへメール送信（best-effort）
  const results = await Promise.allSettled(
    adminList.map((a) =>
      sendEmail(
        joinRequestTemplate({
          to: a.email,
          adminName: a.name,
          companyName: company.name,
          companyId: company.id,
          requesterName: requester.name ?? user.email ?? "不明",
          requesterEmail: requester.email ?? user.email ?? "",
        })
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  console.info(`[join-request] sent=${sent}/${adminList.length} for company=${company.id}`);

  return NextResponse.json({ success: true, notified: sent });
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestTemplate } from "@/lib/notify/templates";

/**
 * POST /api/biz/join-request
 *
 * 既存企業への参加リクエスト。
 * - 管理者ゼロ（OPINIO側で先行登録済み）の場合 → 即時承認して admin に追加、auto_approved: true を返す
 * - 管理者あり → 既存 admin 全員にメール通知
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
    const u = (m.ow_users as unknown) as { name: string; email: string } | null;
    return u?.email ? [{ name: u.name ?? "管理者", email: u.email }] : [];
  });

  // ── 管理者ゼロ = OPINIO側先行登録済み企業 → 即時承認 ──────────────────────
  if (adminList.length === 0) {
    const { error: insertError } = await admin
      .from("ow_company_admins")
      .insert({
        company_id: companyId,
        user_id: requester.id,
        permission: "admin",
        is_active: true,
      });

    if (insertError) {
      console.error("[join-request] auto-approve failed", insertError);
      return NextResponse.json({ error: "自動承認に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
    }

    // ow_user_roles にも tenant_id を登録（biz dashboard のテナント解決に必要）
    await admin.from("ow_user_roles").upsert({
      user_id: requester.id,
      role: "company_admin",
      tenant_id: companyId,
    }, { onConflict: "user_id,role,tenant_id" });

    console.info(`[join-request] auto-approved user=${requester.id} for company=${companyId}`);
    return NextResponse.json({ success: true, auto_approved: true });
  }

  // ── 管理者あり → 既存 admin にメール通知 ──────────────────────────────────
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

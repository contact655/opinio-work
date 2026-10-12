import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireCompanyAction, permissionDeniedResponse } from "@/lib/auth/permissions";
import { mutateOne } from "@/lib/supabase/mutate";

/**
 * PUT /api/biz/company/notification-emails — 企業への通知先（`ow_companies.notification_emails`）を**即時保存**する。
 *
 * ★2026-10-12 に企業ページ（/biz/company の設定タブ）から「メンバーと権限」へ移した（柴さんの指示）。
 *   それまでは企業ページの下書き（draft_data）に入り、「変更を公開する」を押すまで効かなかった
 *   ——求職者に見せるものではないのに、公開の操作に巻き込まれていた。
 *
 * ⚠️★空配列は「既定の宛先（管理者全員）に戻す」＝ null で保存する（`lib/notify/recipients.ts` の解決順①）。
 * ⚠️ 保存形式は今までどおり text[]（メールアドレスの配列）。user_id では持たない（recipients.ts の注記）。
 * ⚠️ セッションのクライアントで書く（`ow_companies` の UPDATE は列単位 GRANT。この列は authenticated に配ってある）。
 */
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_EMAILS = 20;

export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { emails?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });
  try { requireCompanyAction(ctx.allMemberships, ctx.companyId, "notifications.manage"); } catch { return permissionDeniedResponse(); }

  if (!Array.isArray(body.emails) || !body.emails.every((e) => typeof e === "string")) {
    return NextResponse.json({ error: "emails は文字列の配列で送ってください。" }, { status: 400 });
  }
  /* 大文字小文字を無視して重複を落とす（同じ人を2回選べないように） */
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of body.emails as string[]) {
    const e = raw.trim();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) return NextResponse.json({ error: `メールアドレスの形式が正しくありません: ${e}` }, { status: 400 });
    const k = e.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    emails.push(e);
  }
  if (emails.length > MAX_EMAILS) {
    return NextResponse.json({ error: `通知先は${MAX_EMAILS}件までです。` }, { status: 400 });
  }

  const res = await mutateOne(
    supabase.from("ow_companies")
      .update({ notification_emails: emails.length > 0 ? emails : null })
      .eq("id", ctx.companyId),
    "notification_emails 保存",
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, emails });
}

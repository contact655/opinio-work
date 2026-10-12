import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getSlackSettingsView, saveSlackSettings } from "@/lib/notify/slack";

export const dynamic = "force-dynamic";

/**
 * ★Slack 通知の設定（2026-10-12）。**会社の管理者だけ**（表は RLS ポリシー0本・GRANT なしで、
 *   ブラウザからは読めない。ここで管理者かを確かめて admin クライアントで読み書きする）。
 * ⚠️ Webhook の URL はブラウザに返さない（末尾だけ）。
 */
async function requireAdmin() {
  const ctx = await getTenantContext();
  if (!ctx) return { error: NextResponse.json({ error: "ログインしてください。" }, { status: 401 }) } as const;
  if (ctx.currentPermission !== "admin") {
    return { error: NextResponse.json({ error: "Slack 通知の設定は管理者だけができます。" }, { status: 403 }) } as const;
  }
  return { ctx } as const;
}

export async function GET() {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  const view = await getSlackSettingsView(a.ctx.tenantId);
  if (!view) return NextResponse.json({ error: "設定を読み込めませんでした。" }, { status: 500 });
  return NextResponse.json(view);
}

export async function PUT(req: NextRequest) {
  const a = await requireAdmin();
  if ("error" in a) return a.error;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "形式が正しくありません。" }, { status: 400 }); }
  const bool = (v: unknown) => v === true;
  /* webhookUrl: 送られてこなければ触らない ／ null なら消す ／ 文字列なら差し替える */
  const webhookUrl = b.webhookUrl === undefined ? undefined : b.webhookUrl === null ? null : String(b.webhookUrl);
  const r = await saveSlackSettings(a.ctx.tenantId, a.ctx.currentOwnId, {
    webhookUrl,
    notifyReply: bool(b.notifyReply), notifyMeeting: bool(b.notifyMeeting), notifyApplication: bool(b.notifyApplication),
    includeCandidateName: bool(b.includeCandidateName),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(await getSlackSettingsView(a.ctx.tenantId));
}

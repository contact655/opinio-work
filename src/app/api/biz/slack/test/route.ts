import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { sendSlackTest } from "@/lib/notify/slack";
import { checkRateLimit } from "@/lib/rateLimit";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** POST /api/biz/slack/test — テスト送信（管理者だけ。2026-10-12） */
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 10, windowSec: 600, prefix: "slack-test" });
  if (!allowed) return NextResponse.json({ error: "続けて送りすぎています。少し時間をおいてください。" }, { status: 429 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  if (!can(ctx.currentPermission, "integrations.manage")) return NextResponse.json({ error: "Slack 通知の設定は管理者だけができます。" }, { status: 403 });
  const r = await sendSlackTest(ctx.tenantId);
  return NextResponse.json(r, { status: r.ok ? 200 : (r.status === 400 || r.status === 500 ? r.status : 502) });
}

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getSchedulingUrl, setSchedulingUrl } from "@/lib/meetings/server";

export const dynamic = "force-dynamic";

/** 自分（いまの会社の担当者）の日程調整リンク。⚠️ サーバーからは URL を取りにいかない */
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ url: await getSchedulingUrl(ctx.tenantId, ctx.currentOwnId) });
}

export async function PUT(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = await setSchedulingUrl(ctx.tenantId, ctx.currentOwnId, b?.url ?? null);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, url: r.data.url });
}

import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getSavedSearchForViewer, markSavedSearchViewed } from "@/lib/business/savedSearchServer";

export const dynamic = "force-dynamic";

/**
 * ★その条件で一覧を開いた（前回見た日時を今にする。担当者ごと。2026-10-10 / 段3）。
 * ⚠️ 見られる条件（自分のもの・共有）だけ。見られないものは 404。
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await getSavedSearchForViewer({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, id: params.id });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ok = await markSavedSearchViewed(s.id, ctx.currentOwnId);
  if (!ok) return NextResponse.json({ error: "記録できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

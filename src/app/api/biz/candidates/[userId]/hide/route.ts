import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ★候補者の「見送り」（一覧から外す）を付ける・外す（2026-10-13 / 柴さんの指示）。会社の担当者で共有。
 * ⚠️★形は ★（`star/route.ts`）と同じ。セッションのクライアントで書く（RLS: `ow_candidate_hidden`）。admin で書かない。
 * ⚠️★候補者本人には何も届かない（通知・メール・本人の画面のどれにも出さない）。企業の内部情報。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.notes")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  if (!UUID_RE.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await createClient().from("ow_candidate_hidden")
    .upsert({ company_id: ctx.tenantId, candidate_user_id: params.userId, hidden_by: ctx.currentOwnId }, { onConflict: "company_id,candidate_user_id", ignoreDuplicates: true });
  if (error) {
    console.error("[candidates/hide] POST:", error.message);
    return NextResponse.json({ error: "見送りにできませんでした" }, { status: error.code === "42501" ? 403 : 500 });
  }
  return NextResponse.json({ ok: true, hidden: true });
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.notes")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  if (!UUID_RE.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await createClient().from("ow_candidate_hidden")
    .delete().eq("company_id", ctx.tenantId).eq("candidate_user_id", params.userId);
  if (error) {
    console.error("[candidates/hide] DELETE:", error.message);
    return NextResponse.json({ error: "見送りを解除できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, hidden: false });
}

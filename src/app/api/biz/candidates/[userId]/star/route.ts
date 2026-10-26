import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { canUseCandidateSearch } from "@/lib/business/scoutGate";

export const dynamic = "force-dynamic";

/**
 * ★候補者の「★」（気になる）を付ける・外す（2026-10-12 / 柴さんの指示）。会社の管理者で共有。
 * ⚠️★セッションのクライアントで書く（RLS: その会社の現役の管理者だけ。`ow_candidate_stars`）。admin で書かない。
 * ⚠️ 候補者本人には通知しない。誰がいつ付けたか（starred_by / created_at）は表に残る。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.notes")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  /* ★候補者を探すと同じ条件（審査済み・プラン）。2026-10-26 */
  if (!canUseCandidateSearch(ctx)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!UUID_RE.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await createClient().from("ow_candidate_stars")
    .upsert({ company_id: ctx.tenantId, candidate_user_id: params.userId, starred_by: ctx.currentOwnId }, { onConflict: "company_id,candidate_user_id", ignoreDuplicates: true });
  if (error) {
    console.error("[candidates/star] POST:", error.message);
    return NextResponse.json({ error: "保存できませんでした" }, { status: error.code === "42501" ? 403 : 500 });
  }
  return NextResponse.json({ ok: true, starred: true });
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.notes")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  /* ★候補者を探すと同じ条件（審査済み・プラン）。2026-10-26 */
  if (!canUseCandidateSearch(ctx)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!UUID_RE.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await createClient().from("ow_candidate_stars")
    .delete().eq("company_id", ctx.tenantId).eq("candidate_user_id", params.userId);
  if (error) {
    console.error("[candidates/star] DELETE:", error.message);
    return NextResponse.json({ error: "外せませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, starred: false });
}

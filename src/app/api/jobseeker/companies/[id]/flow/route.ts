import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyFlowCached } from "@/lib/companyFlow/server";
import { hasAnyFlowItem, toFlowSummary } from "@/lib/companyFlow/compute";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/jobseeker/companies/[id]/flow — 企業ページ「人の流れ」（2026-10-27 / 柴さんの決定）
 *
 * ⚠️★ログインしている人には内訳まで、ログインしていない人には件数だけ（toFlowSummary）を返す。
 *    ページの HTML（ISR）は件数だけを持ち、内訳はここから取る（ページで認証を読まないため）。
 * ⚠️ 返すのは集計（compute.ts の CompanyFlow）だけ。個人の行・user_id・個別の期間は含まない。
 * ⚠️ ページが見える会社（公開中・検証用でない）だけ。それ以外は flow: null。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: co, error } = await createAdminClient()
    .from("ow_companies").select("id, is_published, is_test").eq("id", params.id).maybeSingle();
  if (error) { console.error("[companies/flow] company:", error.message); return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 }); }
  const headers = { "Cache-Control": "private, no-store" };
  if (!co || co.is_published !== true || co.is_test === true) return NextResponse.json({ authenticated: false, flow: null }, { headers });

  const { data: { user } } = await createClient().auth.getUser();
  const flow = await getCompanyFlowCached(params.id);
  if (!hasAnyFlowItem(flow)) return NextResponse.json({ authenticated: !!user, flow: null }, { headers });
  return NextResponse.json({ authenticated: !!user, flow: user ? flow : toFlowSummary(flow!) }, { headers });
}

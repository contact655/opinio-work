import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { getSelectionHistory } from "@/lib/business/selectionHistory";
import { candidateHeaderMeta } from "@/lib/conversations/companyThread";

export const dynamic = "force-dynamic";

/**
 * ★選考管理の右側（2026-10-11）。候補者1人ぶんの「上の段の2行目」と「この会社とのこれまで」。
 * ⚠️ 自社のものだけ（getTenantContext の会社）。同じアカウントだけ（selectionHistory.ts の注記）。
 * ⚠️ 2行目は伏せた社名を出さない関数（candidateHeaderMeta）。
 */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const history = await getSelectionHistory(ctx.tenantId, params.userId);
  if (history === null) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  /* ⚠️★自社と1件も関わりの無い人には何も返さない（id を変えて叩けば誰の経歴の要約でも取れる形にしない） */
  if (history.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await candidateHeaderMeta(params.userId);
  return NextResponse.json({ meta, history });
}

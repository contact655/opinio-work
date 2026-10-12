import { can } from "@/lib/auth/roles";
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { listSentApproaches } from "@/lib/approaches/server";
import { markCompanyThreadRead } from "@/lib/conversations/companyThread";

export const dynamic = "force-dynamic";

/**
 * ★自社が送ったメッセージ1件の会話を既読にする（2026-10-13 / 柴さんの指示。候補者を探すの右欄）。
 *   右欄はやり取りを `?read=0`（既読を付けない）で読み、担当者が**メッセージ欄で入力欄にフォーカス・スクロール・送信**したときだけここを呼ぶ。
 *   表示されただけでは既読にしない（段3で J/K で流すと全員に既読が付くため）。
 * ⚠️ 自社の1件かどうかは GET と同じ（`listSentApproaches` から選ぶ）。他社・存在しない id は 404。
 * ⚠️ 既読の条件は /biz/messages と同じ（`markCompanyThreadRead`。参加者のときだけ）。参加していなければ ok: false（エラーにしない）。
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "messages.use")) return NextResponse.json({ error: "この操作の権限がありません。", code: "permission_denied" }, { status: 403 });
  const list = await listSentApproaches(ctx.tenantId);
  if (!list) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const r = list.find((x) => x.id === params.id);
  if (!r || !r.conversationId) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const ok = await markCompanyThreadRead(r.conversationId, { tenantId: ctx.tenantId, currentOwnId: ctx.currentOwnId });
  return NextResponse.json({ ok });
}

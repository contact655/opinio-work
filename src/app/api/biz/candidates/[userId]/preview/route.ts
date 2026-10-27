import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/roles";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUseCandidateSearch } from "@/lib/business/scoutGate";
import { getSelectionHistory } from "@/lib/business/selectionHistory";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1）。候補者1人ぶん。
 *
 * ★2026-10-13 に軽くした（柴さんの指示）。それまでは1人分のために `loadCompanyCandidates` を丸ごと呼び、
 *    合うところの材料まで取り直していた（1人あたり約30本）。
 *    いまは**一覧が持っている Candidate をそのまま右欄に渡し**、ここは一覧に無いもの（この会社との接点）だけを返す。
 *    ⚠️ 未読・合うところ・メッセージの状態は一覧の `loadCompanyCandidates` が持つ。ここで取り直さない。
 *    ⚠️ プロフィールの中身は `renderCandidateProfile`（/u/[id] と同じ判定）が別に取る。
 * ⚠️ 返すのは**自社の記録だけ**。`getSelectionHistory` は admin クライアントで読むので RLS は効かない。
 *    5本の取得すべてが `company_id = ctx.tenantId` で絞っている（応募は `ow_jobs.company_id`）。⚠️ この絞り込みを外さないこと。
 * ★所属の確認は2重（2026-10-13 / 柴さんの指示）:
 *    ① `getTenantContext()` … ログインしていなければ null（401）。tenantId は**本人の所属の中から**決まる
 *       （クッキーの会社が所属に無ければ null）。他社の担当者が叩いても、tenantId はその人の会社になる
 *    ② `auth_company_can(company_id, 'view')` … ★の表の読み取りと同じ判定を、本人のセッションで DB に聞く
 * ⚠️ 見せてよいかの判定は一覧（`can_send_scout`）。ゲートは /biz/candidates のページと同じ。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(ctx.currentPermission, "candidates.viewProfile")) return NextResponse.json({ error: "この操作の権限がありません。" }, { status: 403 });
  if (!canUseCandidateSearch(ctx)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!UUID_RE.test(params.userId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  /* ② 所属をセッションで確かめる。⚠️ 失敗・false は 403（fail-closed） */
  const { data: canView, error: canErr } = await createClient().rpc("auth_company_can", { p_company_id: ctx.tenantId, p_action: "view" });
  if (canErr) console.error("[candidates/preview] auth_company_can:", canErr.message);
  if (canView !== true) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  /* ★この会社との接点（2026-10-12）。選考管理の「この会社とのこれまで」と同じ関数。自社のものだけ */
  const history = await getSelectionHistory(ctx.tenantId, params.userId);
  return NextResponse.json({
    /* ★最新1件＋ほかの件数。⚠️ 送ったメッセージと返信は右欄のメッセージのタブに出すので、ここでは数えない（二重にしない）。
          取れなければ null（行を出さない） */
    contacts: (() => {
      if (!history) return null;
      const rows = history.filter((h) => h.kind !== "approach_sent" && h.kind !== "approach_reply");
      if (rows.length === 0) return null;
      return { latest: { at: rows[0].at, title: rows[0].title }, more: rows.length - 1 };
    })(),
  });
}

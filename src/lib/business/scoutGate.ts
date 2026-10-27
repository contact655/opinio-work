import { canUse, type PlanType } from "@/lib/constants/plans";

/* ⚠️★★旧スカウト（ow_scouts）は 2026-10-08 に廃止した。ここで「スカウト」と呼ぶのは
      企業から最初のメッセージを送る機能（/biz/messages・ow_company_approaches）と候補者検索のこと。 */

/**
 * ★スカウト機能（候補者を探す・候補者にメッセージを送る）の利用許可の状態（2026-10-28 / 柴さんの判断）。
 *   none      … 未申請（許可の行も、未対応の依頼も無い。却下されたあともここに戻る）
 *   requested … 申請中（未対応の依頼がある）
 *   granted   … 利用可
 *   revoked   … 取り消し（もう一度依頼できる）
 * ⚠️ 正は ow_company_scout_access / ow_scout_access_requests（運営専用）。読むのは lib/business/scoutAccess.ts だけ。
 * ⚠️★2026-10-28 まで、この判定は `is_approved`（運営の承認）を見ていた（`isCompanyReviewed`）。
 *    承認は公開の条件から外したので、こちらに移した。**`is_approved` に戻さないこと。**
 * ⚠️ 純粋関数。ブラウザからも読む（文言のため）。
 */
export type ScoutAccessState = "none" | "requested" | "granted" | "revoked";

export type ScoutGateContext = { scoutAccess: ScoutAccessState; isSuspended: boolean };

/** スカウト機能を使ってよいか。**画面と API の両方がここを呼ぶ**（片方だけ直すと画面では探せるのに送信だけ 403 になる） */
export function hasScoutAccess(ctx: ScoutGateContext): boolean {
  return ctx.scoutAccess === "granted" && !ctx.isSuspended;
}

/** 停止中の企業に出す文言（DB の guard_company_approval と同じ文） */
export const COMPANY_SUSPENDED_MESSAGE = "このページは運営により停止されています";

/** 使えないときの1行。⚠️ 経路ごとに書き分けないこと */
export function scoutBlockedMessage(ctx: ScoutGateContext): string {
  if (ctx.isSuspended) return `${COMPANY_SUSPENDED_MESSAGE}。停止中はスカウト機能を使えません。`;
  if (ctx.scoutAccess === "requested") return "スカウト機能の利用を依頼しています。運営が確認してメールでお知らせします。";
  return "スカウト機能は、運営が利用を許可した企業でお使いいただけます。";
}

/** スカウト機能の説明（使えない企業に出す） */
export const SCOUT_FEATURE_DESCRIPTION =
  "スカウト機能を使うと、OPINIO に登録している候補者を条件で探し、理由を添えてメッセージを送れます。相手が返信すると、そのままメッセージでやり取りが始まります。利用は企業ごとに運営が許可しています。";

/**
 * ★候補者を探す（一覧・プレビュー・☆・非表示・保存した条件）を使ってよいか。
 *   スカウト機能が使えて（停止中でない）、プランが取れていて `candidateSearch` が使えること。
 *   ⚠️★ページ（/biz/candidates）とプレビューの API と同じ条件。**API ごとに書き写さないこと。**
 */
export function canUseCandidateSearch(ctx: ScoutGateContext & { planType: PlanType | null }): boolean {
  return hasScoutAccess(ctx) && ctx.planType !== null && canUse(ctx.planType, "candidateSearch");
}

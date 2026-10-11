/**
 * ★求人の状態（画面の呼び方）を1か所で決める（2026-10-12 / 柴さんの判断）。**純粋関数。**
 *
 * 即時公開にしたので「運営確認中」は無くし、「非公開」も「停止」に一本化した。画面の状態は3つ:
 *   下書き ／ 公開中 ／ 停止中（自社で停止・運営が停止）
 *
 * ── DB の値との対応（⚠️ DB の値は増やしていない）──────────────────────────
 *   draft                         → 下書き
 *   published                     → 公開中
 *   private かつ stopped_at が空   → 停止中（自社で停止）     … ⋯メニュー「再開する」（公開判定を通れば即時公開）
 *   private かつ stopped_at あり   → 停止中（運営が停止）     … ⋯メニュー「再開を依頼する」
 *   pending_review                → 停止中（運営が停止・再開を依頼済み） … 運営の確認待ち（タブは「停止中」）
 *   rejected（旧「差し戻し」）      → 停止中（運営が停止）     … 2026-10-12 から作らない
 * ⚠️ 企業側から pending_review になる経路は「運営が停止した求人の再開依頼」だけ（禁止表現は公開をブロックする）。
 * ⚠️ 画面で status から文言を組み直さないこと。必ずこの関数を通す（企業の求人管理・編集画面・ホーム・運営画面）。
 */

export type JobState = "draft" | "published" | "stopped_self" | "stopped_ops" | "reopen_requested";
export type JobStateTab = "published" | "draft" | "stopped";

export function jobState(j: { status: string | null | undefined; stoppedAt?: string | null }): JobState {
  switch (j.status) {
    case "published": return "published";
    case "pending_review": return "reopen_requested";
    case "rejected": return "stopped_ops";
    case "private": return j.stoppedAt ? "stopped_ops" : "stopped_self";
    default: return "draft";
  }
}

export function jobStateTab(s: JobState): JobStateTab {
  return s === "published" ? "published" : s === "draft" ? "draft" : "stopped";
}

/** 企業の画面（求人管理・編集画面）の呼び方 */
export const JOB_STATE_LABEL: Record<JobState, string> = {
  draft: "下書き",
  published: "公開中",
  stopped_self: "停止中（自社で停止）",
  stopped_ops: "停止中（運営が停止）",
  reopen_requested: "停止中（運営が停止・再開を依頼済み）",
};

/** 運営の画面（/admin）の呼び方 */
export const JOB_STATE_ADMIN_LABEL: Record<JobState, string> = {
  draft: "下書き",
  published: "公開中",
  stopped_self: "停止中（自社）",
  stopped_ops: "停止中（運営）",
  reopen_requested: "再開依頼",
};

export const JOB_TAB_LABEL: Record<JobStateTab | "all", string> = {
  all: "すべて",
  published: "公開中",
  draft: "下書き",
  stopped: "停止中",
};
export const JOB_TABS: readonly (JobStateTab | "all")[] = ["all", "published", "draft", "stopped"];
export const isJobTab = (v: unknown): v is JobStateTab | "all" => typeof v === "string" && (JOB_TABS as readonly string[]).includes(v);

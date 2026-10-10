/**
 * ★社内メモと候補者の社内の状態（2026-10-10 / 声かけまわり 段5）。画面・API・DB が同じ値を見る。
 * ⚠️ stage は DB の CHECK（ow_candidate_tracking.stage）と揃える。
 */
export const CANDIDATE_NOTE_MAX = 1000;
export const CANDIDATE_STAGES = {
  interested: "気になる",
  approached: "声かけ済み",
  meeting: "面談",
  screening: "選考中",
  declined_internal: "見送り（社内）",
} as const;
export type CandidateStage = keyof typeof CANDIDATE_STAGES;
export function isCandidateStage(v: unknown): v is CandidateStage {
  return typeof v === "string" && v in CANDIDATE_STAGES;
}
/** 企業の退会の操作をした日から、メモと状態を消すまでの日数。⚠️ DB 関数 purge_withdrawn_company_candidate_notes() と同じ値 */
export const CANDIDATE_NOTES_PURGE_DAYS = 30;
/** ⚠️ 文言は柴さんの指示どおり。言い換えない */
export const CANDIDATE_NOTES_NOTICE =
  "貴社の担当者だけが見られます。ご本人から開示を求められた場合は開示の対象になることがあります。事実と評価を分けて、本人に見られても困らない書き方をしてください";

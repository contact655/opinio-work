/**
 * カジュアル面談の状態 —— **求職者向けの語彙**。
 *
 * ⚠️★**企業向け（`lib/business/mockMeetings.ts` の `MeetingStatus`）と別物。混ぜないこと。**
 *    企業は「自社が次に何をするか」で読み、求職者は「自分に何が起きたか」で読む。
 *    例: `company_contacted` は企業側では「連絡済み」だが、本人には「企業から連絡あり」。
 *
 * ⚠️★**`scheduling` を落とさないこと。** DB の CHECK は**6値**だが、
 *    アプリ側の `MeetingStatus` は**5値**（`scheduling` は "merged into scheduled" として
 *    型から外されている。`mockMeetings.ts:3`）。**DB にだけ残っている値**なので、
 *    ここで拾わないと「未知の状態」に落ちる。
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」が片側だけ欠けている状態。
 *      直すのは別タスク。ここでは**DB の6値すべてに名前を与えて**受け切る。）
 *
 *      CHECK: pending / company_contacted / scheduling / scheduled / completed / declined
 */
export const CASUAL_MEETING_STATUSES = [
  "pending",
  "company_contacted",
  "scheduling",
  "scheduled",
  "completed",
  "declined",
] as const;

export type CasualMeetingStatus = (typeof CASUAL_MEETING_STATUSES)[number];

/** 求職者に見せる短いラベル。⚠️ 企業側の語をそのまま流用しない */
export const CASUAL_MEETING_STATUS_LABEL: Record<CasualMeetingStatus, string> = {
  pending:           "企業の返答待ち",
  company_contacted: "企業から連絡あり",
  scheduling:        "日程調整中",
  scheduled:         "面談予定",
  completed:         "面談済み",
  declined:          "見送り",
};

/**
 * 進捗バーの段。⚠️ 求人応募の5段（応募→書類選考→1次面接→最終面接→内定）とは**別**。
 *    カジュアル面談は選考ではないので、選考の段を当てはめない。
 */
export const CASUAL_MEETING_STEPS = ["申込", "日程調整", "面談"] as const;

/**
 * 状態 → 到達した段の番号。**`-1` はバーごと出さない**（見送り）。
 *
 * ⚠️ `scheduled` を 2（面談）に置いているのは「**予定が決まった**」の意味。
 *    実施済みかどうかは `completed` が持つ。
 */
export const CASUAL_MEETING_STATUS_TO_STEP: Record<CasualMeetingStatus, number> = {
  pending:            0,
  company_contacted:  1,
  scheduling:         1,
  scheduled:          2,
  completed:          2,
  declined:          -1,
};

export function isCasualMeetingStatus(v: string): v is CasualMeetingStatus {
  return (CASUAL_MEETING_STATUSES as readonly string[]).includes(v);
}

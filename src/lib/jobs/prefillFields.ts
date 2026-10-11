/**
 * ★求人票の貼り付けから下書きを作る（段階3 / 2026-10-11）——下書きに入る項目の一覧。
 *
 * ⚠️ クライアント（JobEditForm の確認パネル）からもサーバー（lib/jobs/prefill.ts）からも読む。
 *    **DB や server-only のものを import しないこと。**
 * ⚠️★下書きの値は「確認して入れる」を押すまでフォームに入れない（＝公開の条件にも数えない・保存もしない）。
 *    自動で入れる経路を作らないこと（柴さんの指示）。
 * ⚠️ 職種（マスタから選ぶ）は下書きに入れない。人が選ぶ。
 */

import type { LaborTerms } from "./laborTerms";

/** サーバーが返す下書き。⚠️ 入っていない項目はキーごと無い（空文字で埋めない） */
export type JobPrefillDraft = Partial<{
  title: string;
  descriptionMarkdown: string;
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  location: string;
  remoteWorkStatus: string;
  workHours: string;
  holidays: string;
  probationPeriod: string;
  requiredSkills: string[];
  preferredSkills: string[];
  selectionSteps: string[];
  labor: Partial<LaborTerms>;
}>;

/** 確認パネルに並べる順と名前。⚠️ key は JobPrefillDraft のキー（labor は1つにまとめて出す） */
export const PREFILL_FIELD_LABELS: { key: Exclude<keyof JobPrefillDraft, "labor">; label: string }[] = [
  { key: "title", label: "求人タイトル" },
  { key: "descriptionMarkdown", label: "仕事内容" },
  { key: "employmentType", label: "雇用形態" },
  { key: "salaryMin", label: "給与（下限・万円）" },
  { key: "salaryMax", label: "給与（上限・万円）" },
  { key: "location", label: "勤務地" },
  { key: "remoteWorkStatus", label: "勤務形態" },
  { key: "workHours", label: "始業・終業時刻" },
  { key: "holidays", label: "休日・休暇" },
  { key: "probationPeriod", label: "試用期間" },
  { key: "requiredSkills", label: "必須スキル" },
  { key: "preferredSkills", label: "歓迎スキル" },
  { key: "selectionSteps", label: "選考フロー" },
];

/** 貼り付けられる文字数の上限 */
export const JOB_PREFILL_MAX_CHARS = 15000;
/** 1企業1日の上限（柴さんの指示） */
export const JOB_PREFILL_DAILY_LIMIT = 20;

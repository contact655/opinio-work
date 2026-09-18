/**
 * 「在籍していない人として報告」の語彙（2026-09-18 / B7）。
 *
 * ── なぜ報告なのか ──────────────────────────────────────────────────────────
 * 2026-09-18 まで、企業は `/biz/employees` の「非表示」で自社ページから人を
 * **直接消せた**（`ow_company_hidden_experiences` に企業が書いていた）。これは
 * **本人の申告を企業が黙って取り消せる**形で、画面に出している
 * 「本人の申告です。OPINIO は在籍確認を行っていません」という説明と噛み合わない。
 * → 企業からは**報告**を受け取り、**外すかどうかは運営が判断する**。
 *
 * ⚠️★**選択肢が決まっている値なので3層を揃える**（CLAUDE.md）。
 *    UI（`/biz/employees` の報告フォーム）／ API（`POST /api/biz/member-reports`）／
 *    DB の CHECK（`ow_company_member_reports_reason_check`）。
 *    **値を足す日は3つとも同じコミットで広げること。**
 */

export const MEMBER_REPORT_REASONS = [
  {
    value: "never_employed",
    label: "在籍したことがない",
    desc: "この会社に在籍した記録がありません",
  },
  {
    value: "left",
    label: "すでに退職している",
    desc: "在籍していましたが、現在は在籍していません",
  },
] as const;

export type MemberReportReason = (typeof MEMBER_REPORT_REASONS)[number]["value"];

/** API の許容値。⚠️ 呼び出し側に配列を書き写さないこと */
export const VALID_MEMBER_REPORT_REASONS = new Set<string>(
  MEMBER_REPORT_REASONS.map((r) => r.value),
);

/** 表示用のラベル。⚠️ 未知の値は null（生値を画面に出さない） */
export function memberReportReasonLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return MEMBER_REPORT_REASONS.find((r) => r.value === value)?.label ?? null;
}

/**
 * 補足（`note`）の上限。
 * ⚠️ 濃度の制約なので **UI と API の2層**で持つ（DB に CHECK は張らない。CLAUDE.md
 *    「濃度は自動的に3層の対象にはならない」）。**定数は1つ。画面に直書きしない。**
 */
export const MEMBER_REPORT_NOTE_MAX = 500;

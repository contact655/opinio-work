/**
 * ★カジュアル面談の申込で本人が選ぶ「希望する面談形式」（2026-10-18 に1か所へ集めた）。
 *   申込フォーム（CasualMeetingForm）と企業側の表示（選考管理）が同じ定数を見る。
 * ⚠️ それまで企業側は DB の値（any / zoom など）をそのまま出しており、「any」と表示されていた。
 * ⚠️ 会話の日程調整の形式（`meetings.ts` の MEETING_FORMATS: online / onsite）とは別物。混ぜないこと。
 */
export const CASUAL_MEETING_FORMAT_OPTIONS = [
  { value: "any", label: "どちらでも構わない" },
  { value: "zoom", label: "Zoom" },
  { value: "meet", label: "Google Meet" },
  { value: "in_person_office", label: "対面（企業オフィス）" },
  { value: "in_person_cafe", label: "対面（カフェ等）" },
] as const;
export type CasualMeetingFormat = (typeof CASUAL_MEETING_FORMAT_OPTIONS)[number]["value"];

/** 表示名。知らない値は null（生の値を画面に出さない） */
export function casualMeetingFormatLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return CASUAL_MEETING_FORMAT_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

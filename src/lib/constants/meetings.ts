/**
 * ★会話の日程調整（2026-10-10 / 声かけまわり 段4）。画面・API・DB が同じ値を見る。
 * ⚠️ DB の CHECK（ow_meetings.duration_minutes / format、ow_company_admins.scheduling_url）と揃えること。
 */
export const MAX_MEETING_SLOTS = 3;
export const MEETING_SLOT_STEP_MINUTES = 15;
export const MEETING_DURATIONS = [30, 60] as const;
export type MeetingDuration = (typeof MEETING_DURATIONS)[number];
export const MEETING_FORMATS = { online: "オンライン", onsite: "対面" } as const;
export type MeetingFormat = keyof typeof MEETING_FORMATS;
export const SCHEDULING_URL_MAX = 2048;

export type MeetingSlotsPayload = {
  slots: string[];
  format: MeetingFormat;
  duration: MeetingDuration;
  /** 同席する人（企業の担当者の名前。送った時点のもの） */
  attendees: string[];
  status: "open" | "confirmed" | "canceled";
  chosenIndex?: number;
  meetingId?: string;
};
export type SchedulingLinkPayload = { url: string; domain: string };

export function isMeetingFormat(v: unknown): v is MeetingFormat {
  return typeof v === "string" && v in MEETING_FORMATS;
}
export function isMeetingDuration(v: unknown): v is MeetingDuration {
  return typeof v === "number" && (MEETING_DURATIONS as readonly number[]).includes(v);
}

/**
 * 候補日として受け付けるか。未来・15分単位（秒は0）。
 * ⚠️ 日本時間は UTC との差が整数時間なので、分の判定は UTC のままでよい。
 */
export function slotError(iso: string, now = new Date()): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "日時の形式が正しくありません";
  if (d.getTime() <= now.getTime()) return "過去の日時は選べません";
  if (d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0 || d.getUTCMinutes() % MEETING_SLOT_STEP_MINUTES !== 0) {
    return `時刻は${MEETING_SLOT_STEP_MINUTES}分単位で選んでください`;
  }
  return null;
}

/** 日程調整リンク。https のみ・2048字まで。⚠️ サーバーから取りにいかない（形だけ見る） */
export function parseSchedulingUrl(raw: unknown): { ok: true; url: string; domain: string } | { ok: false; error: string } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: false, error: "URL を入れてください" };
  if (s.length > SCHEDULING_URL_MAX) return { ok: false, error: `URL は${SCHEDULING_URL_MAX}字までです` };
  let u: URL;
  try { u = new URL(s); } catch { return { ok: false, error: "URL の形式が正しくありません" }; }
  if (u.protocol !== "https:" || /\s/.test(s)) return { ok: false, error: "https:// で始まる URL を入れてください" };
  return { ok: true, url: u.toString(), domain: u.hostname };
}

/** 「10月12日(土) 14:00」（日本時間） */
export function formatMeetingDateTime(iso: string): string {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.month}月${parts.day}日(${parts.weekday}) ${parts.hour}:${parts.minute}`;
}

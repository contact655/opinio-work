/**
 * ★面談の .ics（iCalendar）を作る（2026-10-10 / 段4）。メールに添付する。
 * ⚠️ 時刻は UTC（末尾 Z）で書く。受け取った側のカレンダーが自分の時間帯で表示する。
 * ⚠️ 本文に会話の内容を入れない（件名・時間・形式・会話へのリンクだけ）。
 */
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
/** RFC 5545 のエスケープ */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildMeetingIcs(params: {
  meetingId: string;
  startsAt: string;
  durationMinutes: number;
  summary: string;
  description: string;
  url: string;
  /** 取り消しのときは CANCEL（受け取った側のカレンダーから消える） */
  method?: "REQUEST" | "CANCEL";
  sequence?: number;
}): string {
  const start = new Date(params.startsAt);
  const end = new Date(start.getTime() + params.durationMinutes * 60 * 1000);
  const method = params.method ?? "REQUEST";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OPINIO//meetings//JA",
    "CALSCALE:GREGORIAN",
    `METHOD:${method === "CANCEL" ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:meeting-${params.meetingId}@opinio.jp`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SEQUENCE:${params.sequence ?? 0}`,
    `SUMMARY:${esc(params.summary)}`,
    `DESCRIPTION:${esc(params.description)}`,
    `URL:${params.url}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * ★送ったメッセージの中身（送った人・送った日時・求人・送った理由・本文）。2026-10-11 に /biz/messages のカードから切り出した。
 *   /biz/messages の「返事待ち」のカードと、候補者を探すの右欄（「送った内容を見る」）が**同じ部品**を使う。
 * ⚠️ 見送り（declined_at）は持たない・出さない。
 */
export function SentApproachDetail({ senderName, sentAt, jobTitle, reason, body, footer, style }: {
  senderName: string | null;
  sentAt: string;
  jobTitle: string | null;
  reason: string;
  body: string | null;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(sentAt));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  const when = `${v("year")}年${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")}`;
  return (
    <div data-state="approach-detail" style={{ padding: "12px 14px", background: "var(--bg-tint, #f6f7f9)", borderRadius: 8, fontSize: 13, lineHeight: 1.8, color: "var(--ink)", minWidth: 0, ...style }}>
      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
        {[senderName ? `送った人：${senderName}` : null, `送った日時：${when}`, jobTitle ? `求人：${jobTitle}` : null].filter(Boolean).join("・")}
      </div>
      <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12, marginTop: 6 }}>送った理由</div>
      <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reason}</p>
      {body && (
        <>
          <div style={{ fontWeight: 700, color: "var(--ink-soft)", fontSize: 12, marginTop: 10 }}>本文</div>
          <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{body}</p>
        </>
      )}
      {footer}
    </div>
  );
}

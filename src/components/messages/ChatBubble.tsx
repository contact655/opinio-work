import type { ReactNode } from "react";

/**
 * ★メッセージの吹き出し（2026-10-11 / 柴さんの指示。LinkedIn のメッセージと同じ左右の並び）。
 *   /biz/messages の右側（返事待ち・返信後・興味あり）と /biz/messages/[id] が**同じ部品**を使う。
 *   自社が送ったもの … 右寄せ・薄い青 ／ 相手 … 左寄せ・白（枠線つき）
 *   各吹き出しの上に「柴久人・10月11日 22:13」を灰色で小さく。⚠️ 状態の言葉はここに出さない
 */
export function chatTime(iso: string): string {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")}`;
}

/** 「10月12日」（日本時間）。日付の区切りと「ここからやり取りが始まりました」に使う */
export function chatDay(iso: string): string {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  return `${v("month")}月${v("day")}日`;
}

/** 日付の区切りの比較用（日本時間の年月日） */
export function chatDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function ChatBubble({ mine, sender, at, children, plain = false, avatar }: {
  mine: boolean;
  sender: string;
  at: string;
  children: ReactNode;
  /** 枠を付けずに中身だけ置く（面談の日程カードなど、自分で枠を持つもの） */
  plain?: boolean;
  /** ★相手側の吹き出しの横に出す頭文字（24px の丸。2026-10-12 / 候補者を探すの右欄）。渡さなければ出さない。自分側には出さない */
  avatar?: string;
}) {
  const bubble = (
    <div data-state={mine ? "bubble-mine" : "bubble-theirs"} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", gap: 4, minWidth: 0, flex: avatar && !mine ? 1 : undefined }}>
      <span data-state="bubble-meta" style={{ fontSize: 11.5, color: "var(--ink-mute)", padding: "0 4px" }}>{sender}・{chatTime(at)}</span>
      {plain ? children : (
        <div style={{
          maxWidth: "min(80%, 560px)", padding: "10px 14px", fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          color: "var(--ink)",
          background: mine ? "var(--royal-50)" : "#fff",
          border: mine ? "1px solid var(--royal-100)" : "1px solid var(--line)",
          borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        }}>{children}</div>
      )}
    </div>
  );
  if (!avatar || mine) return bubble;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 0 }}>
      <span aria-hidden="true" data-state="bubble-avatar" style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--line-soft)", color: "var(--ink-soft)",
        fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{avatar}</span>
      {bubble}
    </div>
  );
}

/** 中央の灰色の案内（提案から始まった会話の最初の一文・返信が来たところ・返事待ちの状態） */
export function ChatNotice({ children, state }: { children: ReactNode; state?: string }) {
  return <div data-state={state} style={{ textAlign: "center", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7, margin: "4px 0" }}>{children}</div>;
}

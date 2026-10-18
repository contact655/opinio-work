"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { type CompanyApproachStatus } from "@/lib/constants/companyApproaches";

/**
 * ★送ったメッセージを吹き出しで出す（2026-10-11 / 柴さんの指示）。
 *   候補者を探すの右欄（名前の段のすぐ下）と、/biz/messages のカードを開いたときが**同じ部品**を使う。
 *
 *   1行目（灰色）「柴久人が10月11日 22:13に送信」
 *   本文（吹き出し）… 送った理由と本文。4行を超えたら4行で切り、「続きを読む」でその場で開く
 *   最終行（灰色）  … 返信待ち「返信を待っています」（期限は無いので残り日数は出さない。2026-10-18）
 *                     返信あり … 返信の冒頭（2行まで）と「メッセージを開く」
 * ⚠️「送った人」「送った理由」のラベルを出さない。状態をバッジにしない（灰色の文字）。
 * ⚠️ 見送られたかどうかは出さない（状態は `companyApproachStatus`。見送りも「返信を待っています」のまま）。
 */
export function ApproachBubble({ senderName, sentAt, jobTitle, reason, body, status, reply, footer, style }: {
  senderName: string | null;
  sentAt: string;
  jobTitle?: string | null;
  reason: string;
  body: string | null;
  status: CompanyApproachStatus;
  /** 返信があるとき。excerpt が null なら冒頭は出さず「メッセージを開く」だけ */
  reply?: { excerpt: string | null; href: string } | null;
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  const ps = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(sentAt));
  const v = (t: string) => ps.find((x) => x.type === t)?.value ?? "";
  const when = `${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")}`;
  const text = [reason, body].filter((s) => !!s && s.trim()).join("\n\n");

  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  const gray: CSSProperties = { fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 };
  return (
    <div data-state="approach-bubble" data-approach-status={status} style={{ minWidth: 0, ...style }}>
      <div data-state="approach-sent-line" style={gray}>
        {senderName ? `${senderName}が` : ""}{when}に送信{jobTitle ? `・求人：${jobTitle}` : ""}
      </div>
      <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--royal-50)", borderLeft: "3px solid var(--royal-100)", borderRadius: 10 }}>
        <p ref={ref} data-state="approach-bubble-text" style={{
          margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }),
        }}>{text}</p>
        {(overflows || expanded) && (
          <button type="button" onClick={() => setExpanded((x) => !x)} data-state="approach-bubble-more" aria-expanded={expanded}
            style={{ marginTop: 4, background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit" }}>
            {expanded ? "閉じる" : "続きを読む"}
          </button>
        )}
      </div>
      {status === "accepted" ? (
        <div data-state="approach-reply" style={{ marginTop: 8 }}>
          {reply?.excerpt && (
            <p style={{ ...gray, margin: 0, color: "var(--ink-soft)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              返信：{reply.excerpt}
            </p>
          )}
          {reply?.href && (
            <Link href={reply.href} data-state="approach-open-thread" style={{ display: "inline-block", marginTop: 4, fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
              メッセージを開く →
            </Link>
          )}
        </div>
      ) : null /* ★返信待ちは何も出さない（2026-10-18 / 柴さんの指示。「返信を待っています」の行は外した） */}
      {footer}
    </div>
  );
}

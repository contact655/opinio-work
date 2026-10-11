"use client";

import Link from "next/link";
import { approachResendNotice, APPROACH_UNAVAILABLE_MESSAGE } from "@/lib/constants/companyApproaches";
import type { RecentApproach } from "@/lib/approaches/server";

const jst = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
const part = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
function formatJaMonthDay(iso: string): string { const ps = jst(iso); return `${part(ps, "month")}月${part(ps, "day")}日`; }

/**
 * ★企業から候補者へ「メッセージを送る」入口（2026-10-09。2026-10-11 に「メッセージ」へ名前を揃えた）。
 *   候補者検索のカード・右のプレビュー・/u/[id] で共通。
 *
 * | 状態 | 出すもの |
 * |---|---|
 * | 送れる | 「メッセージを送る」（→ /biz/messages/new） |
 * | 返事待ち | 「返事待ち（◯月◯日に送信）」＋「送った内容を見る」 |
 * | 返信あり | 「メッセージを開く」（→ 会話） |
 * | 30日を過ぎた | 「◯年◯月◯日から送れます」（ボタンなし） |
 * | 送れない | ボタンなし・`APPROACH_UNAVAILABLE_MESSAGE` の1文。⚠️★**理由ごとに分けない**（同じ文言・同じ見た目） |
 *
 * ⚠️ 文言と行き先は送信の API と同じ `approachResendNotice`。⚠️ 見送りは区別しない（企業には伝えない）。
 * ⚠️★画面の言葉に「スカウト」「リクエスト」「受け入れ」を使わない。
 */
export function ApproachButton({
  candidateUserId,
  sent = null,
  eligible = false,
  compact = false,
  hideSender = false,
}: {
  candidateUserId: string;
  /** ★この企業の誰かが180日以内に送っていれば、その記録。あれば送れない */
  sent?: RecentApproach | null;
  /** ★送れるか（`can_send_company_approach()`）。false で送り済みでもなければ、送れない一文を出す */
  eligible?: boolean;
  /** 候補者検索のカード用（小さめ） */
  compact?: boolean;
  /** ★「◯◯さんが◯月◯日に送りました」の行を出さない（右のプレビューは見出しの下に同じ行があるため） */
  hideSender?: boolean;
}) {
  if (sent) {
    const n = approachResendNotice(sent);
    const who = sent.senderName ? `${sent.senderName}さん` : "担当者";
    const actionLink = n.action && (
      <Link href={n.action.href} data-state="approach-resend-action" onClick={(e) => e.stopPropagation()}
        className={compact ? "btn-fixed-size" : "tap-min-h"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: compact ? "5px 12px" : "8px 16px", borderRadius: 8,
          ...(sent.state === "accepted"
            ? { border: "none", background: "var(--royal)", color: "#fff" }
            : { border: "1px solid var(--line)", background: "#fff", color: "var(--royal)" }),
          fontSize: compact ? 12 : 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", alignSelf: "flex-start",
        }}>
        {n.action.label}
      </Link>
    );
    return (
      <span data-state="approach-sent" data-approach-state={sent.state}
        style={{ display: "inline-flex", flexDirection: "column", gap: compact ? 4 : 6, maxWidth: "100%", minWidth: 0 }}>
        {!compact && !hideSender && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "normal" }}>
            {who}が{formatJaMonthDay(sent.sentAt)}にメッセージを送りました。
          </span>
        )}
        {/* ★状態の1行（返事待ち（◯月◯日に送信）／◯年◯月◯日から送れます）。返信ありはボタンだけ */}
        {sent.state !== "accepted" && (
          <span data-state="approach-resend-message" title={n.message}
            style={{ fontSize: compact ? 11.5 : 12.5, fontWeight: 600, color: "var(--ink-mute)", lineHeight: 1.6, whiteSpace: "normal" }}>
            {n.label}
          </span>
        )}
        {actionLink}
      </span>
    );
  }

  if (!eligible) {
    return (
      <span data-state="approach-unavailable" style={{ fontSize: compact ? 11.5 : 12.5, color: "var(--ink-mute)", lineHeight: 1.6, whiteSpace: "normal" }}>
        {APPROACH_UNAVAILABLE_MESSAGE}
      </span>
    );
  }

  return (
    <Link
      href={`/biz/messages/new?candidate=${encodeURIComponent(candidateUserId)}`}
      data-state="approach-button"
      onClick={(e) => e.stopPropagation()}
      className="tap-min-h"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: compact ? "6px 12px" : "9px 18px", borderRadius: 8,
        border: "none", background: "var(--royal)", color: "#fff",
        fontSize: compact ? 12 : 13, fontWeight: 700, fontFamily: "inherit",
        textDecoration: "none", whiteSpace: "nowrap",
      }}
    >
      メッセージを送る
    </Link>
  );
}

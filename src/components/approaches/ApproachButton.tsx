"use client";

import Link from "next/link";
import { approachResendNotice } from "@/lib/constants/companyApproaches";
import type { RecentApproach } from "@/lib/approaches/server";

const jst = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
const part = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
function formatJaMonthDay(iso: string): string { const ps = jst(iso); return `${part(ps, "month")}月${part(ps, "day")}日`; }

/**
 * ★企業からの「声かけ」の入口（2026-10-09）。候補者検索のカード・右のプレビュー・/u/[id] で共通。
 *
 * ⚠️★2026-10-10（候補者探し 段4）から、押すと「声かけを書く」ページ（/biz/approaches/new）へ**同じタブ**で移る。
 *    それまでの小窓は外した（書く場所を1つにする。枠・見え方・注意を右の列に出すため）。
 * ⚠️★**出す・出さないは呼び出し側（サーバー）が決める。** 送れない相手には、このボタン自体を描かない（理由も出さない）。
 * ⚠️ `sent` があるときは「声かけ済み」を出す（180日間は再送できない。これは企業自身の事実なので出してよい）。
 * ⚠️★画面の言葉に「スカウト」を使わない。
 */
export function ApproachButton({
  candidateUserId,
  sent = null,
  compact = false,
  hideSender = false,
}: {
  candidateUserId: string;
  /** ★この企業の誰かが180日以内に声をかけていれば、その記録（2026-10-10 / 段5 重複防止）。あれば押せない */
  sent?: RecentApproach | null;
  /** 候補者検索のカード用（小さめ） */
  compact?: boolean;
  /** ★「◯◯さんが◯月◯日に送りました」の行を出さない（右のプレビューは見出しの下に同じ行があるため。2026-10-11） */
  hideSender?: boolean;
}) {
  if (sent) {
    /* ★送り済みの案内は状態で分ける（2026-10-11 / 柴さんの指示）。文言と行き先は送信の API と同じ
          `approachResendNotice` ——返事待ち「送った内容を見る」／返信あり「メッセージを開く」（★会話へ）／
          30日経過「◯年◯月◯日から、もう一度送れます」。⚠️ 見送りは区別しない（企業には伝えない） */
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
        {/* ★「◯◯さんが◯月◯日に送りました」。⚠️ カード（名前の下に「リクエスト済み（◯◯さん・10/3）」がある）と
              右のプレビュー（見出しの下に同じ行がある）では出さない。同じことを2回書かない（2026-10-11） */}
        {!compact && !hideSender && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6, whiteSpace: "normal" }}>
            {who}が{formatJaMonthDay(sent.sentAt)}にメッセージリクエストを送りました。
          </span>
        )}
        <span data-state="approach-resend-message" title={`${who}が${formatJaMonthDay(sent.sentAt)}にメッセージリクエストを送信済み`}
          style={{ fontSize: compact ? 11.5 : 12.5, color: "var(--ink-mute)", lineHeight: 1.6, whiteSpace: "normal" }}>
          {n.message}
        </span>
        {actionLink}
      </span>
    );
  }

  return (
    <Link
      href={`/biz/approaches/new?candidate=${encodeURIComponent(candidateUserId)}`}
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
      メッセージリクエストを送る
    </Link>
  );
}

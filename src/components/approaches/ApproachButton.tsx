"use client";

import Link from "next/link";
import { COMPANY_APPROACH_STATUS_LABELS } from "@/lib/constants/companyApproaches";
import type { RecentApproach } from "@/lib/approaches/server";

const jst = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
const part = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
function formatJaMonthDay(iso: string): string { const ps = jst(iso); return `${part(ps, "month")}月${part(ps, "day")}日`; }
function formatJaDate(iso: string): string { const ps = jst(iso); return `${part(ps, "year")}年${part(ps, "month")}月${part(ps, "day")}日`; }

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
}: {
  candidateUserId: string;
  /** ★この企業の誰かが180日以内に声をかけていれば、その記録（2026-10-10 / 段5 重複防止）。あれば押せない */
  sent?: RecentApproach | null;
  /** 候補者検索のカード用（小さめ） */
  compact?: boolean;
}) {
  const done = !!sent;

  if (done) {
    return (
      <span
        data-state="approach-sent"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: compact ? "6px 12px" : "9px 16px", borderRadius: 8,
          border: "1px solid var(--line)", background: "#fff",
          color: "var(--ink-mute)", fontSize: compact ? 12 : 13, fontWeight: 700, whiteSpace: "nowrap",
        }}
      >
        {sent ? (
          /* ★誰が・いつ・いまどうなっているか・いつから再び送れるか。⚠️ 見送られたものも「承認待ち」（企業には伝えない） */
          <span style={{ display: "flex", flexDirection: "column", gap: 2, whiteSpace: "normal", fontWeight: 600, lineHeight: 1.5 }}>
            <span style={{ color: "var(--ink-soft)" }}>
              {sent.senderName ? `${sent.senderName}さん` : "担当者"}が{formatJaMonthDay(sent.sentAt)}に声かけ済み（{COMPANY_APPROACH_STATUS_LABELS[sent.state]}）
            </span>
            <span style={{ fontWeight: 500 }}>再び送れる日：{formatJaDate(sent.resendAt)}</span>
          </span>
        ) : "声かけ済み"}
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
      話を聞いてみたい
    </Link>
  );
}

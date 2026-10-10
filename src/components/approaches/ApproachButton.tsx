"use client";

import { useEffect, useState } from "react";
import {
  APPROACH_BODY_MAX,
  APPROACH_REASON_MAX,
  APPROACH_REASON_MIN,
  COMPANY_APPROACH_STATUS_LABELS,
} from "@/lib/constants/companyApproaches";
import type { RecentApproach } from "@/lib/approaches/server";

const jst = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
const part = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
function formatJaMonthDay(iso: string): string { const ps = jst(iso); return `${part(ps, "month")}月${part(ps, "day")}日`; }
function formatJaDate(iso: string): string { const ps = jst(iso); return `${part(ps, "year")}年${part(ps, "month")}月${part(ps, "day")}日`; }

/**
 * ★企業からの「声かけ」の入口（2026-10-09）。候補者検索のカードと /u/[id] で共通。
 *
 * ⚠️★**出す・出さないは呼び出し側（サーバー）が決める。** 送れない相手には、このボタン自体を描かない
 *    （理由も出さない）。描いたうえで押したら止まる形にしないこと。
 * ⚠️ `sentAt` があるときは「声かけ済み」を出す（180日間は再送できない。これは企業自身の事実なので出してよい）。
 * ⚠️★画面の言葉に「スカウト」を使わない。
 * ⚠️ 何が相手に届くかを送る前に書く（理由と本文は承認前でも全文が相手に見える）。
 */
export function ApproachButton({
  candidateUserId,
  candidateName,
  sent = null,
  compact = false,
}: {
  candidateUserId: string;
  candidateName: string;
  /** ★この企業の誰かが180日以内に声をかけていれば、その記録（2026-10-10 / 段5 重複防止）。あれば押せない */
  sent?: RecentApproach | null;
  /** 候補者検索のカード用（小さめ） */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNow, setSentNow] = useState(false);

  const done = sentNow || !!sent;
  const reasonLen = reason.trim().length;
  const reasonOk = reasonLen >= APPROACH_REASON_MIN && reasonLen <= APPROACH_REASON_MAX;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !sending) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sending]);

  async function send() {
    if (!reasonOk || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/biz/approaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateUserId, reason, body: body.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        /* ⚠️ サーバーの文言をそのまま出す（相手に関わる理由は返ってこない） */
        setError(data?.error ?? "送信に失敗しました。もう一度お試しください。");
        return;
      }
      setSentNow(true);
      setOpen(false);
    } catch {
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  }

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
    <>
      <button
        type="button"
        data-state="approach-button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); setError(null); }}
        className="tap-min-h"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: compact ? "6px 12px" : "9px 18px", borderRadius: 8,
          border: "none", background: "var(--royal)", color: "#fff",
          fontSize: compact ? 12 : 13, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        話を聞いてみたい
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approach-title"
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && !sending) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 560, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h2 id="approach-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {candidateName} さんに声をかける
            </h2>
            <p style={{ margin: "8px 0 14px", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              理由とメッセージは、相手が承認する前から全文が届きます。相手が承認すると、企業とのメッセージとしてやり取りを始められます。
              承認されなかった場合も、そのことはお知らせしません。
            </p>

            <label htmlFor="approach-reason" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
              この方に声をかけたい理由<span style={{ color: "var(--error)", marginLeft: 4 }}>必須</span>
            </label>
            <textarea
              id="approach-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={APPROACH_REASON_MAX}
              rows={3}
              autoFocus
              disabled={sending}
              placeholder="経歴のどこに惹かれたのか、具体的に書いてください"
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1.5px solid var(--line)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, color: "var(--ink)", resize: "vertical" }}
            />
            <div style={{ fontSize: 12, fontWeight: 500, color: reasonLen > 0 && reasonLen < APPROACH_REASON_MIN ? "var(--warm-ink)" : "var(--ink-mute)", marginTop: 4 }}>
              {reasonLen} / {APPROACH_REASON_MAX}（{APPROACH_REASON_MIN}文字以上）
            </div>

            <label htmlFor="approach-body" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "14px 0 6px" }}>
              メッセージ<span style={{ color: "var(--ink-mute)", fontWeight: 500, marginLeft: 4 }}>任意</span>
            </label>
            <textarea
              id="approach-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={APPROACH_BODY_MAX}
              rows={5}
              disabled={sending}
              placeholder="自己紹介や、話したいことを書いてください"
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1.5px solid var(--line)", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7, color: "var(--ink)", resize: "vertical" }}
            />
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4 }}>{body.length} / {APPROACH_BODY_MAX}</div>

            {error && (
              <p data-state="approach-error" role="alert" style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setOpen(false)} disabled={sending} style={{
                padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff",
                color: "var(--ink-soft)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: sending ? "default" : "pointer",
              }}>やめる</button>
              <button type="button" onClick={() => { void send(); }} disabled={sending || !reasonOk} style={{
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: sending || !reasonOk ? "var(--line)" : "var(--royal)",
                color: sending || !reasonOk ? "var(--ink-mute)" : "#fff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: sending || !reasonOk ? "default" : "pointer",
              }}>{sending ? "送信中…" : "声をかける"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

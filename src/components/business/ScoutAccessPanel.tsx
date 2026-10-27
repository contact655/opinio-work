"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SCOUT_FEATURE_DESCRIPTION, COMPANY_SUSPENDED_MESSAGE, type ScoutAccessState } from "@/lib/business/scoutGate";

/**
 * ★スカウト機能が使えない企業に出す案内と「スカウト機能の利用を依頼する」（2026-10-28 / 柴さんの判断）。
 *   /biz/candidates の入口で出す。状態の正は lib/business/scoutAccess.ts（ページが読んで渡す）。
 * ⚠️ 依頼中は二重に依頼できない（ボタンを出さない。API も 409）。
 * ⚠️ 停止中は依頼させない（先に企業ページの停止の解除）。
 */
export function ScoutAccessPanel(props: {
  state: ScoutAccessState;
  isSuspended: boolean;
  requestedAt: string | null;
  lastDeclinedReason: string | null;
  revokeReason: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(props.state === "requested");

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/biz/scout-access/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) { setError(j.error ?? "依頼できませんでした。時間をおいてもう一度お試しください。"); return; }
      setRequested(true);
      router.refresh();
    } catch {
      setError("依頼できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : null);

  return (
    <div data-state={props.isSuspended ? "scout-suspended" : requested ? "scout-requested" : props.state === "revoked" ? "scout-revoked" : "scout-none"}
      style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--line)", padding: "40px 32px", maxWidth: 560, margin: "48px auto", boxSizing: "border-box" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 12px" }}>スカウト機能</h2>
      <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 20px" }}>{SCOUT_FEATURE_DESCRIPTION}</p>

      {props.isSuspended ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>{COMPANY_SUSPENDED_MESSAGE}</p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 16px" }}>停止中はスカウト機能を使えず、利用の依頼もできません。</p>
          <Link href="/biz/company" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)" }}>企業ページの編集画面を開く →</Link>
        </>
      ) : requested ? (
        <p data-state="scout-request-pending" style={{ fontSize: 14, color: "var(--ink)", margin: 0, lineHeight: 1.8 }}>
          <strong>依頼中</strong>{fmt(props.requestedAt) ? `（${fmt(props.requestedAt)} に依頼）` : ""}。運営が確認して、メールでお知らせします。
        </p>
      ) : (
        <>
          {props.state === "revoked" && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 12px" }}>
              スカウト機能の利用は取り消されています。{props.revokeReason ? `理由：${props.revokeReason}` : ""}
            </p>
          )}
          {props.state === "none" && props.lastDeclinedReason && (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: "0 0 12px" }}>前回の依頼は見送りました。理由：{props.lastDeclinedReason}</p>
          )}
          <label htmlFor="scout-request-message" style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>運営への一言（任意）</label>
          <textarea id="scout-request-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3}
            placeholder="採用したい職種や、使い始めたい時期など"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          {error && <p role="alert" style={{ fontSize: 13, color: "var(--error)", margin: "8px 0 0" }}>{error}</p>}
          <button type="button" onClick={send} disabled={sending} className="btn-fixed-size"
            style={{ marginTop: 14, minHeight: 44, padding: "0 20px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}>
            {sending ? "送信中…" : "スカウト機能の利用を依頼する"}
          </button>
        </>
      )}
    </div>
  );
}

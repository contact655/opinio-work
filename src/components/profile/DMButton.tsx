"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MAX_MESSAGE_REQUEST_LENGTH } from "@/lib/constants/messages";

type Props = {
  targetUserId: string;
  targetName: string;
  targetAvatarUrl?: string | null;
  /**
   * ボタンの文言。既定は「〇〇 にDMを送る」。
   * ⚠️ `/u/[id]` のヘッダーは `label="メッセージ"` を渡す（2026-08-23）。
   *    CTA 群をメタ行の下へ移したとき、氏名入りだと行が長くなりすぎたため。
   *    氏名は同じカードの見出しに大きく出ているので、繰り返す必要が無い。
   */
  label?: string;
};

/**
 * ★DM の入口。2026-10-09 に「メッセージのお願い」へ作り替えた（段階3）。
 *
 * 押すと `GET /api/dm/start` で相手とのあいだの段を聞き、
 *   - 承認済み・自分が送ったお願い … その会話を開く
 *   - これから送る             … この画面の上で本文を書いて送る（`POST /api/dm/start`）
 *   - 送れない（止まった・上限・相手からのお願いが届いている） … **ボタンの横に文言を出す**
 *
 * ⚠️★**止まったときに会話一覧へ移らないこと。** 2026-10-09 までは、403 でも黙って
 *    `/mypage/conversations` へ移っていた（何が起きたか分からない）。
 * ⚠️★**空の会話を作らない。** 本文が無ければ送らない（以前は押しただけで空の会話ができた）。
 * ⚠️ 文言はサーバーが返したものをそのまま出す。相手に関わる理由は返ってこない。
 */
export function DMButton({ targetUserId, targetName, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; requestsLink?: boolean } | null>(null);
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const router = useRouter();

  const toAuth = () =>
    router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);

  async function handleClick() {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/dm/start?targetUserId=${targetUserId}`);
      if (res.status === 401) { toAuth(); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setNotice({ text: data?.error ?? "現在メッセージを送れません" });
        return;
      }
      if (data.action === "open" && data.conversationId) {
        router.push(`/mypage/conversations?open=${data.conversationId}`);
        return;
      }
      if (data.action === "compose") {
        setComposing(true);
        setSendError(null);
        return;
      }
      setNotice({ text: data.message ?? "現在メッセージを送れません", requestsLink: data.action === "incoming" });
    } catch {
      setNotice({ text: "エラーが発生しました。もう一度お試しください" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/dm/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, message: text }),
      });
      if (res.status === 401) { toAuth(); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.conversationId) {
        /* ⚠️ 止まったときは移らない。理由をここに出す */
        setSendError(data?.error ?? "送信に失敗しました。もう一度お試しください");
        return;
      }
      router.push(`/mypage/conversations?open=${data.conversationId}`);
    } catch {
      setSendError("送信に失敗しました。もう一度お試しください");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!composing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !sending) setComposing(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing, sending]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: 8,
          border: "1.5px solid var(--royal-100)",
          background: loading ? "var(--line)" : "var(--royal-50)",
          color: loading ? "var(--ink-mute)" : "var(--royal)",
          fontSize: 13, fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          flexShrink: 0, whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {loading ? "準備中..." : (label ?? `${targetName} にDMを送る`)}
      </button>
      {notice && (
        <span data-state="dm-notice" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {notice.text}
          {notice.requestsLink && (
            <>{" "}<Link href="/mypage/conversations#requests" style={{ color: "var(--royal)", fontWeight: 700 }}>リクエストを見る →</Link></>
          )}
        </span>
      )}

      {composing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dm-request-title"
          onClick={(e) => { if (e.target === e.currentTarget && !sending) setComposing(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h2 id="dm-request-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {targetName} さんにメッセージリクエストを送る
            </h2>
            {/* ★何が起きるかを先に言う。送ったあとで気づく形にしない */}
            <p style={{ margin: "8px 0 12px", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              相手が受け入れると、続きのやりとりができます。受け入れられるまでは、この1通だけが届きます。
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_MESSAGE_REQUEST_LENGTH}
              rows={6}
              autoFocus
              disabled={sending}
              aria-label="最初のメッセージ"
              placeholder="自己紹介と、話したいことを書いてください"
              style={{
                width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8,
                border: "1.5px solid var(--line)", fontFamily: "inherit", fontSize: 14,
                lineHeight: 1.7, color: "var(--ink)", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                {body.length} / {MAX_MESSAGE_REQUEST_LENGTH}
              </span>
            </div>
            {sendError && (
              <p data-state="dm-send-error" role="alert" style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{sendError}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setComposing(false)} disabled={sending} style={{
                padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff",
                color: "var(--ink-soft)", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                cursor: sending ? "default" : "pointer",
              }}>やめる</button>
              <button type="button" onClick={() => { void handleSend(); }} disabled={sending || !body.trim()} style={{
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: sending || !body.trim() ? "var(--line)" : "var(--royal)",
                color: sending || !body.trim() ? "var(--ink-mute)" : "#fff",
                fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                cursor: sending || !body.trim() ? "default" : "pointer",
              }}>{sending ? "送信中…" : "リクエストを送る"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

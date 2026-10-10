"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MEETING_FORMATS, formatMeetingDateTime,
  type MeetingSlotsPayload, type SchedulingLinkPayload,
} from "@/lib/constants/meetings";

/**
 * ★会話の中の「候補日」と「日程調整リンク」（2026-10-10 / 段4）。企業・求職者の両方の会話画面で使う。
 *
 * - 候補日: 求職者は1つ選ぶと確定（ほかの候補は押せなくなる）。企業は取り消せる（相手に通知が届く）。
 * - リンク: ⚠️ `rel="noopener noreferrer nofollow"`。ドメイン名を見せる。サーバーからは URL を取りにいかない。
 */
export function MeetingMessageCard({
  side, conversationId, messageId, kind, payload, onChanged,
}: {
  side: "company" | "candidate";
  conversationId: string;
  messageId: string;
  kind: "meeting_slots" | "scheduling_link";
  payload: unknown;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (kind === "scheduling_link") {
    const p = payload as SchedulingLinkPayload | null;
    if (!p?.url) return null;
    return (
      <div data-state="scheduling-link" style={card}>
        <div style={title}>日程調整リンク</div>
        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow"
          style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none", wordBreak: "break-all" }}>
          {p.domain} で日程を選ぶ →
        </a>
        <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 4 }}>外部のサイト（{p.domain}）が開きます</div>
      </div>
    );
  }

  const p = payload as MeetingSlotsPayload | null;
  if (!p?.slots) return null;
  const now = Date.now();

  const post = async (url: string, body?: unknown) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "うまくいきませんでした");
      onChanged?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = p.status === "confirmed" ? "日時が決まりました" : p.status === "canceled" ? "取り消されました" : side === "candidate" ? "ご都合のよい日時を1つ選んでください" : "相手の返事を待っています";

  return (
    <div data-state={`meeting-slots-${p.status}`} style={card}>
      <div style={title}>面談の候補日</div>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
        {MEETING_FORMATS[p.format]}・{p.duration}分{p.attendees?.length ? `・同席：${p.attendees.join("、")}` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {p.slots.map((s, i) => {
          const chosen = p.status === "confirmed" && p.chosenIndex === i;
          const canChoose = side === "candidate" && p.status === "open" && new Date(s).getTime() > now;
          return (
            <div key={s} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
              border: `1px solid ${chosen ? "var(--royal)" : "var(--line)"}`, background: chosen ? "var(--royal-50)" : "#fff",
              opacity: p.status === "canceled" || (p.status === "confirmed" && !chosen) ? 0.55 : 1,
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: chosen ? 700 : 600, color: "var(--ink)" }}>
                {formatMeetingDateTime(s)}{chosen && "（決定）"}
              </span>
              {side === "candidate" && p.status === "open" && (
                <button type="button" disabled={!canChoose || busy} className="tap-min-h"
                  onClick={() => { if (confirm(`${formatMeetingDateTime(s)} で決めます。よろしいですか？`)) void post(`/api/conversations/${conversationId}/meeting-slots/${messageId}/choose`, { index: i }); }}
                  style={{ fontSize: 12, fontWeight: 700, fontFamily: "inherit", padding: "6px 12px", borderRadius: 8, border: "none",
                    background: canChoose ? "var(--royal)" : "var(--line)", color: canChoose ? "#fff" : "var(--ink-mute)", cursor: canChoose ? "pointer" : "default" }}>
                  この日時にする
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: p.status === "confirmed" ? "var(--success-ink)" : "var(--ink-mute)" }}>{statusLabel}</span>
        {side === "company" && p.status !== "canceled" && (
          <button type="button" disabled={busy} className="tap-min-h"
            onClick={() => { if (confirm(p.status === "confirmed" ? "決まった面談を取り消します。相手に通知が届きます。よろしいですか？" : "候補日を取り消します。相手に通知が届きます。よろしいですか？")) void post(`/api/biz/conversations/${conversationId}/meeting-slots/${messageId}/cancel`); }}
            style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer" }}>
            取り消す
          </button>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6 }}>{error}</div>}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", maxWidth: 420, width: "100%", color: "var(--ink)" };
const title: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 4 };

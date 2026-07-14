"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Scout = {
  id: string;
  companyId: string;
  companyName: string;
  companyGradient: string | null;
  companyLetter: string | null;
  jobId: string | null;
  jobTitle: string | null;
  message: string;
  status: string;
  sentAt: string;
  conversationId: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  sent:       { label: "未返答",   color: "var(--royal)",   bg: "var(--royal-50)",    border: "var(--royal-100)" },
  read:       { label: "既読",     color: "var(--ink-soft)", bg: "var(--bg-tint)",    border: "var(--line)" },
  interested: { label: "興味あり", color: "var(--success)",  bg: "var(--success-soft)", border: "#6EE7B7" },
  declined:   { label: "辞退",     color: "var(--ink-mute)", bg: "#F1F5F9",           border: "var(--line)" },
};

function ReplyPanel({ scout, onDone }: { scout: Scout; onDone: (action: string, convId: string | null) => void }) {
  const [action, setAction] = useState<"interested" | "declined" | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    if (!action) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobseeker/scouts/${scout.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "送信に失敗しました"); return; }
      onDone(action, data.conversationId ?? null);
      if (action === "interested" && data.conversationId) {
        router.push(`/mypage/conversations?open=${data.conversationId}`);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--line-soft)", paddingTop: 16 }}>
      {!action ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setAction("interested")}
            style={{
              padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: "var(--royal)", color: "#fff", border: "none",
            }}
          >
            話を聞きたい ✓
          </button>
          <button
            onClick={() => setAction("declined")}
            style={{
              padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)",
            }}
          >
            今回は見送る
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: action === "interested" ? "var(--royal)" : "var(--ink-soft)" }}>
            {action === "interested" ? "「話を聞きたい」を送信します" : "「今回は見送る」を送信します"}
          </div>
          <textarea
            placeholder={action === "interested"
              ? "ひと言添えることができます（任意）。例: 現在の職種や転職検討状況など"
              : "理由を添えることができます（任意）"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={3}
            style={{
              width: "100%", borderRadius: 8, border: "1px solid var(--line)",
              padding: "10px 12px", fontSize: 13, resize: "vertical",
              fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box",
            }}
          />
          {error && <p style={{ fontSize: 12, color: "var(--error)", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={submit}
              disabled={sending}
              style={{
                padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: action === "interested" ? "var(--royal)" : "var(--ink-soft)",
                color: "#fff", border: "none", opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? "送信中…" : "送信する"}
            </button>
            <button
              onClick={() => { setAction(null); setMessage(""); setError(null); }}
              disabled={sending}
              style={{
                padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: "#fff", color: "var(--ink-mute)", border: "1px solid var(--line)",
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoutsClient({ scouts: initial }: { scouts: Scout[] }) {
  const [scouts, setScouts] = useState<Scout[]>(initial);

  const handleDone = (scoutId: string, action: string, convId: string | null) => {
    setScouts((prev) => prev.map((s) => s.id === scoutId
      ? { ...s, status: action, conversationId: convId ?? s.conversationId }
      : s
    ));
  };

  if (scouts.length === 0) {
    return (
      <div style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        padding: "48px 32px", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          スカウトはまだ届いていません
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          プロフィールを充実させると、スカウトが届きやすくなります。
        </p>
        <Link
          href="/profile/edit"
          style={{
            display: "inline-block", marginTop: 20,
            background: "var(--royal)", color: "#fff",
            padding: "10px 24px", borderRadius: 8,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          プロフィールを編集する
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {scouts.map((s) => {
        const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.sent;
        const isPending = s.status === "sent" || s.status === "read";

        return (
          <div key={s.id} style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
            padding: "24px 28px",
            borderLeft: `3px solid ${isPending ? "var(--royal)" : st.color}`,
          }}>
            {/* Company header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: s.companyGradient ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: "#fff",
              }}>
                {s.companyLetter ?? s.companyName[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{s.companyName}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                    background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                  }}>
                    {st.label}
                  </span>
                </div>
                {s.jobTitle && (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                    求人: {s.jobTitle}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                {new Date(s.sentAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
              </div>
            </div>

            {/* Message */}
            <div style={{
              fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8,
              whiteSpace: "pre-wrap", padding: "14px 16px",
              background: "var(--bg-tint)", borderRadius: 8,
              marginBottom: 16,
            }}>
              {s.message}
            </div>

            {/* Links row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Link
                href={`/companies/${s.companyId}`}
                style={{
                  fontSize: 12, padding: "7px 16px", borderRadius: 7,
                  border: "1px solid var(--line)", color: "var(--ink-soft)",
                  textDecoration: "none", fontWeight: 500,
                }}
              >
                企業を見る
              </Link>
              {s.jobId && (
                <Link
                  href={`/jobs/${s.jobId}`}
                  style={{
                    fontSize: 12, padding: "7px 16px", borderRadius: 7,
                    border: "1px solid var(--line)", color: "var(--ink-soft)",
                    textDecoration: "none", fontWeight: 500,
                  }}
                >
                  求人を見る
                </Link>
              )}
              {s.conversationId && (
                <Link
                  href={`/mypage/conversations?open=${s.conversationId}`}
                  style={{
                    fontSize: 12, padding: "7px 16px", borderRadius: 7,
                    background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                    color: "var(--royal)", textDecoration: "none", fontWeight: 600,
                    marginLeft: "auto",
                  }}
                >
                  会話を見る →
                </Link>
              )}
            </div>

            {/* Reply panel (only for pending scouts) */}
            {isPending && (
              <ReplyPanel
                scout={s}
                onDone={(action, convId) => handleDone(s.id, action, convId)}
              />
            )}

            {/* Post-reply message */}
            {s.status === "declined" && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--line-soft)", paddingTop: 12, fontSize: 12, color: "var(--ink-mute)" }}>
                このスカウトは見送り済みです。
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

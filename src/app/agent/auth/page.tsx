"use client";

import { useState } from "react";

export default function AgentAuthPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("メールアドレスを入力してください"); return; }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/agent/auth/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "エラーが発生しました。もう一度お試しください。");
      return;
    }

    setSuccess(true);
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
          padding: "40px 36px",
          width: "100%",
          maxWidth: 420,
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #002366, #3B5FD9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>

        <h1
          style={{
            margin: "0 0 6px",
            fontSize: 20,
            fontWeight: 800,
            color: "#0F172A",
            fontFamily: "'Noto Serif JP', serif",
          }}
        >
          エージェントポータル
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
          登録されているメールアドレスにログインリンクをお送りします。
        </p>

        {success ? (
          <div
            style={{
              padding: "20px", background: "#ECFDF5",
              border: "1px solid #A7F3D0", borderRadius: 10,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#059669", marginBottom: 6 }}>
              メールを送信しました
            </div>
            <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.6 }}>
              <strong>{email}</strong> にログインリンクを送りました。<br />
              メールボックスをご確認ください。
            </div>
            <button
              onClick={() => { setSuccess(false); setEmail(""); }}
              style={{
                marginTop: 16, background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#059669", textDecoration: "underline",
              }}
            >
              別のアドレスで試す
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: "10px 14px", background: "#FEE2E2",
                  border: "1px solid #FECACA", borderRadius: 8,
                  fontSize: 13, color: "#DC2626",
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block", fontSize: 12, fontWeight: 600,
                  color: "#475569", marginBottom: 6, letterSpacing: "0.03em",
                }}
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@agency.co.jp"
                required
                autoFocus
                style={{
                  width: "100%", padding: "11px 14px",
                  border: "1px solid #E2E8F0", borderRadius: 8,
                  fontSize: 14, color: "#0F172A",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  outline: "none", boxSizing: "border-box" as const,
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", padding: "12px",
                background: "linear-gradient(135deg, #002366, #3B5FD9)",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "送信中..." : "ログインリンクを送信"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

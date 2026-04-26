"use client";

import { useState } from "react";

/**
 * Fix 18: Step-up conversion (newsletter + social follow)
 * Soft commitment for users not yet ready to register.
 */
export function NewsletterSocial() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("ok");
        setMessage("登録ありがとうございます。週1回お届けします。");
        setEmail("");
      } else {
        const j = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(j?.error || "登録に失敗しました。時間をおいて再度お試しください。");
      }
    } catch {
      setStatus("error");
      setMessage("登録に失敗しました。時間をおいて再度お試しください。");
    }
  };

  return (
    <section style={{ background: "#fafaf7", paddingTop: 56, paddingBottom: 56, borderTop: "0.5px solid #e8e4dc", borderBottom: "0.5px solid #e8e4dc" }}>
      <div className="max-w-4xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Newsletter */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1D9E75", letterSpacing: "0.05em", marginBottom: 8 }}>
              NEWSLETTER
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 10, letterSpacing: "-0.01em" }}>
              まずはメールで読んでみる
            </h2>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 16 }}>
              週1回、IT/SaaS転職の記事をお届けします。<br />
              いつでも解除可。営業メールは送りません。
            </p>
            <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="email"
                required
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1, minWidth: 200,
                  padding: "12px 14px",
                  fontSize: 14,
                  borderRadius: 10,
                  border: "1.5px solid #e5e7eb",
                  outline: "none",
                  background: "#fff",
                }}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                style={{
                  padding: "12px 20px",
                  fontSize: 14, fontWeight: 600,
                  background: "#1D9E75", color: "#fff",
                  border: "none", borderRadius: 10,
                  cursor: status === "loading" ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {status === "loading" ? "登録中..." : "登録する"}
              </button>
            </form>
            {message && (
              <p style={{ marginTop: 10, fontSize: 12, color: status === "ok" ? "#15803d" : "#991b1b" }}>
                {message}
              </p>
            )}
          </div>

          {/* Social */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#1D9E75", letterSpacing: "0.05em", marginBottom: 8 }}>
              FOLLOW US
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 10, letterSpacing: "-0.01em" }}>
              SNSでも発信しています
            </h2>
            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, marginBottom: 16 }}>
              企業取材の裏側・キャリアの考え方を、X / noteで発信中です。
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a
                href="https://x.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 10,
                  background: "#fff", border: "0.5px solid #e5e7eb",
                  fontSize: 13, fontWeight: 600, color: "#0f172a",
                  textDecoration: "none",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X (Twitter) をフォロー
              </a>
              <a
                href="https://note.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 10,
                  background: "#fff", border: "0.5px solid #e5e7eb",
                  fontSize: 13, fontWeight: 600, color: "#41c9b4",
                  textDecoration: "none",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                note を読む
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

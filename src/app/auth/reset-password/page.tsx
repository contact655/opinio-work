"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (resetError) {
      setError("送信に失敗しました。メールアドレスを確認してください。");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      background: "var(--bg-tint)",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--royal)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--royal)" }}>
              OPINIO
            </span>
          </Link>
        </div>

        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "var(--shadow-sm)",
        }}>
          {done ? (
            /* ── 送信完了 ── */
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                メールを送信しました
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85, marginBottom: 28 }}>
                <strong style={{ color: "var(--ink)" }}>{email}</strong> に<br />
                パスワード再設定用のリンクを送りました。<br />
                メールが届かない場合はスパムフォルダをご確認ください。
              </p>
              <Link
                href="/auth"
                style={{
                  display: "block",
                  padding: "12px 20px",
                  background: "var(--royal)",
                  color: "#fff",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ログイン画面に戻る
              </Link>
            </div>
          ) : (
            /* ── 入力フォーム ── */
            <>
              <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                パスワードをリセット
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 28 }}>
                登録済みのメールアドレスを入力してください。<br />
                パスワード再設定リンクをお送りします。
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="reset-email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                    メールアドレス
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    autoComplete="email"
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      fontFamily: "inherit",
                      fontSize: 14,
                      color: "var(--ink)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--line)")}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: "10px 14px",
                    background: "var(--error-soft)",
                    border: "1px solid #FCA5A5",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--error)",
                    marginBottom: 16,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    background: loading || !email.trim() ? "var(--line)" : "var(--royal)",
                    color: loading || !email.trim() ? "var(--ink-mute)" : "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {loading ? "送信中..." : "リセットリンクを送信"}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/auth" style={{ fontSize: 12, color: "var(--ink-mute)", textDecoration: "none" }}>
            ← ログイン画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

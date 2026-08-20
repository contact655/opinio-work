"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  // セッションが確立されているか確認
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // セッションなし → リセットリンクが無効
        router.replace("/auth/reset-password");
      } else {
        setSessionReady(true);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      /* ⚠️ **失敗の理由をひとまとめにしない**（2026-08-20）。
            以前は何が起きても「リンクの有効期限が切れている可能性があります」と出していた。
            実際に多いのは**同じパスワードを入れた**ケースで、そのとき利用者は
            リンクのせいだと思って**もう一度メールを送り直し、また同じ失敗を繰り返す**。
            原因と違う案内は、直せる人まで詰まらせる。
         ⚠️ 判定は `code` を優先し、無いときだけ本文で見る。
            Supabase の code は `same_password` / `weak_password` /
            `session_not_found` / `over_request_rate_limit`。 */
      const code = (updateError as { code?: string }).code ?? "";
      const msg = updateError.message ?? "";
      if (code === "same_password" || /different password|same.*password/i.test(msg)) {
        setError("いま設定されているパスワードと同じです。別のパスワードを入力してください。");
      } else if (code === "weak_password" || /weak|strength/i.test(msg)) {
        setError("パスワードが簡単すぎます。文字の種類を増やすか、長くしてください。");
      } else if (code === "over_request_rate_limit" || /rate limit|too many/i.test(msg)) {
        setError("試行が多すぎます。少し時間をおいてからもう一度お試しください。");
      } else if (
        code === "session_not_found" || code === "otp_expired" ||
        /session|expired|invalid/i.test(msg)
      ) {
        setError("リンクの有効期限が切れています。お手数ですが、もう一度パスワード再設定をやり直してください。");
      } else {
        /* ⚠️ 分からないものは**分からないと出す**。原因を決めつけない。
              原因はコンソールに残す（利用者には見せない）。 */
        console.error("[update-password] 想定外の失敗:", code, msg);
        setError("更新できませんでした。しばらく待ってからもう一度お試しください。");
      }
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);

    // 2秒後にログイン画面へ
    setTimeout(() => router.push("/auth"), 2000);
  };

  if (!sessionReady) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-tint)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid var(--royal-100)",
          borderTopColor: "var(--royal)",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--success-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                パスワードを更新しました
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85 }}>
                新しいパスワードでログインできます。<br />
                ログイン画面に移動します…
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                新しいパスワードを設定
              </h1>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.7 }}>
                8文字以上のパスワードを入力してください。
              </p>

              <form onSubmit={handleSubmit}>
                {/* 新パスワード */}
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="update-password-new" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                    新しいパスワード
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="update-password-new"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="new-password"
                      placeholder="8文字以上"
                      aria-describedby="update-password-strength"
                      style={{
                        width: "100%",
                        padding: "12px 44px 12px 14px",
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
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--ink-mute)", padding: 0, lineHeight: 1,
                      }}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password.length > 0 && (
                    <div
                      id="update-password-strength"
                      role="status"
                      aria-live="polite"
                      aria-label={`パスワード強度: ${password.length >= 12 ? "強い" : password.length >= 8 ? "普通" : "弱い"}`}
                      style={{ display: "flex", gap: 4, marginTop: 6 }}
                    >
                      {[1, 2, 3].map((level) => (
                        <div key={level} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: password.length >= level * 4
                            ? level === 1 ? "#f59e0b" : level === 2 ? "#3b82f6" : "var(--success)"
                            : "var(--line)",
                          transition: "background 0.2s",
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                {/* 確認 */}
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="update-password-confirm" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                    パスワードを確認
                  </label>
                  <input
                    id="update-password-confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="もう一度入力"
                    aria-describedby={confirmPassword && confirmPassword !== password ? "update-password-mismatch" : undefined}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      border: `1px solid ${confirmPassword && confirmPassword !== password ? "var(--error)" : "var(--line)"}`,
                      borderRadius: 10,
                      fontFamily: "inherit",
                      fontSize: 14,
                      color: "var(--ink)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--royal)")}
                    onBlur={(e) => (e.target.style.borderColor = confirmPassword && confirmPassword !== password ? "var(--error)" : "var(--line)")}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p id="update-password-mismatch" role="alert" style={{ fontSize: 12, color: "var(--error)", fontWeight: 600, marginTop: 4 }}>パスワードが一致しません</p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    style={{
                      padding: "10px 14px",
                      background: "var(--error-soft)",
                      border: "1px solid #FCA5A5",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--error)",
                      marginBottom: 16,
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirmPassword}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    background: (loading || password.length < 8 || password !== confirmPassword) ? "var(--line)" : "var(--royal)",
                    color: (loading || password.length < 8 || password !== confirmPassword) ? "var(--ink-mute)" : "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontFamily: "inherit",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: (loading || password.length < 8 || password !== confirmPassword) ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {loading ? "更新中..." : "パスワードを更新"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

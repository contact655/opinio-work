"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmRedirectTo, safeNext } from "@/lib/auth/redirects";
import { AUTH_ERROR_DISPLAY, toAuthErrorCode, type AuthErrorCode } from "@/lib/constants/authErrors";

// ─── SVG Components ─────────────────────────────────────────────────────────
const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ⑥ Real-time password strength indicator
function PwStrength({ password }: { password: string }) {
  if (password.length === 0) return null;
  const checks = [
    { label: "8文字以上", ok: password.length >= 8 },
    { label: "英字を含む", ok: /[a-zA-Z]/.test(password) },
    { label: "数字を含む", ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const barColor = score === 3 ? "var(--success)" : score === 2 ? "#F59E0B" : "var(--error)";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 99,
              background: i <= score ? barColor : "var(--line)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
        {checks.map(({ label, ok }) => (
          <span
            key={label}
            style={{
              fontSize: 12, fontWeight: 600,
              color: ok ? "var(--success)" : "var(--ink-mute)",
              display: "flex", alignItems: "center", gap: 3,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>{ok ? "✓" : "○"}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Left brand panel ────────────────────────────────────────────────────────

// ─── Inner auth logic (needs useSearchParams so wrapped in Suspense) ─────────
function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "";
  const nextUrl = safeNext(rawNext, "/");

  // 認証リンクから弾かれて戻ってきた人は「登録できていない」のではなく
  // 「ログインすれば済む」ことが多い。mode の明示指定が無ければログインタブで迎える。
  const urlErrorCode = toAuthErrorCode(searchParams.get("error"));
  const [mode, setMode] = useState<"signup" | "login">(
    searchParams.get("mode") === "login" || (urlErrorCode && !searchParams.get("mode"))
      ? "login"
      : "signup"
  );

  /*
    ⚠️ URL 由来のエラーとフォーム由来のエラーを**別の state で持つ**こと。
       2026-08-13 まで両方を1つの `error` に入れていたため、直後の
       `useEffect(..., [mode])` がマウント時にも走って setError("") で消しており、
       `/auth?error=...` で戻っても**画面には何も出なかった**。
       文言は用意されていたのに一度も表示されていない状態だった。
  */
  const [authErrorCode, setAuthErrorCode] = useState<AuthErrorCode | null>(urlErrorCode);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace(nextUrl && nextUrl !== "/" ? nextUrl : "/companies");
    });
  }, [nextUrl, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [resendMessage, setResendMessage] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError("");
    setLoading(false);
    if (mode === "login") emailRef.current?.focus();
  }, [mode]);

  const handleGoogleAuth = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
  };

  // ④ Removed termsChecked — implicit consent via submit button label
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAuthErrorCode(null);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() || email.split("@")[0] },
          emailRedirectTo: confirmRedirectTo(location.origin, nextUrl),
        },
      });

      if (signUpError) {
        const msg = typeof signUpError.message === "string" ? signUpError.message : "";
        if (msg.includes("already registered") || msg.includes("already exists")) {
          setError("このメールアドレスはすでに登録済みです。ログインタブをお試しください。");
        } else if (msg.toLowerCase().includes("password")) {
          setError("パスワードは8文字以上で入力してください。");
        } else if (msg) {
          setError(msg);
        } else {
          setError("登録に失敗しました。しばらく待ってから再度お試しください。");
        }
        setLoading(false);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setError("このメールアドレスはすでに登録済みです。ログインタブをお試しください。");
        setLoading(false);
        return;
      }

      if (data.session) {
        await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "candidate" }),
        }).catch(() => {});
        const dest = nextUrl || "/companies";
        router.push(`/onboarding?next=${encodeURIComponent(dest)}`);
        return;
      }

      setDone(true);
      setLoading(false);
    } catch {
      setError("登録に失敗しました。しばらく待ってから再度お試しください。");
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setAuthErrorCode(null);

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      /*
        ⚠️ 未確認を「メールアドレスまたはパスワードが違います」に混ぜないこと。
           パスワードは合っているのに直しようのない文言を出すことになり、
           利用者は正しい対処（確認メールを開く／再送する）に辿り着けない。
      */
      if (loginError.code === "email_not_confirmed") {
        setAuthErrorCode("email_not_confirmed");
        setLoading(false);
        return;
      }
      setError(
        loginError.message.includes("Invalid login") || loginError.message.includes("invalid_credentials")
          ? "メールアドレスまたはパスワードが正しくありません。"
          : loginError.message
      );
      setLoading(false);
      return;
    }

    router.push(nextUrl === "/" ? "/companies" : nextUrl);
    router.refresh();
  };

  /**
   * 確認メールの再送。
   *
   * ⚠️ すでに確認済みのアドレスに再送すると Supabase はエラーを返す。
   *    そこを「送信しました」に丸めないこと。確認は済んでいてログインすればよい、
   *    という**利用者が取るべき次の行動**が消えてしまう。
   */
  const handleResend = async () => {
    if (!email) {
      setResendState("failed");
      setResendMessage("メールアドレスを入力してから再送してください。");
      return;
    }
    setResendState("sending");
    setResendMessage("");

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmRedirectTo(location.origin, nextUrl) },
    });

    if (resendError) {
      console.error("[auth] resend failed:", resendError.code, resendError.message);
      setResendState("failed");
      setResendMessage(
        "再送できませんでした。すでに確認が完了している可能性があります。ログインをお試しください。"
      );
      return;
    }

    setResendState("sent");
    setResendMessage(`${email} に確認メールを再送しました。`);
  };

  const handleMagicLink = async () => {
    if (!email) { setError("メールアドレスを入力してください"); return; }
    setLoading(true);
    setError("");
    setAuthErrorCode(null);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: confirmRedirectTo(location.origin, nextUrl || "/companies"),
      },
    });
    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }
    setMagicLinkSent(true);
    setLoading(false);
  };

  // ── Email confirmation sent state ──
  if (done) {
    return (
      <div className="min-h-screen flex items-start justify-center">
        <div style={s.formSide}>
          <div style={s.formWrap}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: "50%", background: "var(--success-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                確認メールを送りました
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
                <strong>{email}</strong> に確認メールを送信しました。<br />
                メール内のリンクをクリックして登録を完了してください。
              </p>
              <button
                type="button"
                onClick={() => { setDone(false); setMode("login"); }}
                style={{ ...s.submitBtn, width: "auto", padding: "10px 28px" }}
              >
                ログインへ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // ① 2-column grid — Tailwind handles breakpoints (no inline gridTemplateColumns override)
    <div className="min-h-screen flex items-start justify-center">
      {/* form */}
      <div style={s.formSide}>
        {/* Mobile logo */}
        <div className="flex md:hidden" style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
          <a
            href="/"
            style={{
              fontFamily: "Inter,sans-serif", fontWeight: 800, fontSize: 20,
              letterSpacing: "-0.02em", color: "var(--royal)", textDecoration: "none",
            }}
          >
            OPINIO
          </a>
        </div>

        {/* ⑧ 企業担当者向けリンク — 右上固定 */}
        <a href="/biz/auth" style={{
          position: "fixed", top: 16, right: 20, zIndex: 50,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 99,
          fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, textDecoration: "none",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          whiteSpace: "nowrap",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
          採用担当者・企業の方はこちら
        </a>

        <div style={s.formWrap}>
          {/* ⑦ Mode tabs — active tab is solid royal blue */}
          <div style={s.modeTabs}>
            {(["signup", "login"] as const).map((m) => (
              <button
                key={m}
                type="button"
                style={{ ...s.modeTab, ...(mode === m ? s.modeTabActive : {}) }}
                onClick={() => setMode(m)}
              >
                {m === "signup" ? "新規登録" : "ログイン"}
              </button>
            ))}
          </div>

          {/* 認証リンク由来のエラー。フォームのエラーとは別枠で、対処法まで出す */}
          {authErrorCode && (
            <div style={s.authErrorBox} role="alert">
              <p style={s.authErrorTitle}>{AUTH_ERROR_DISPLAY[authErrorCode].title}</p>
              <p style={s.authErrorBody}>{AUTH_ERROR_DISPLAY[authErrorCode].body}</p>

              {AUTH_ERROR_DISPLAY[authErrorCode].showResend && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendState === "sending"}
                      style={s.authErrorBtn}
                    >
                      {resendState === "sending" ? "送信中..." : "確認メールを再送する"}
                    </button>
                    {mode === "signup" && (
                      <button type="button" onClick={() => setMode("login")} style={s.authErrorBtnGhost}>
                        ログインへ
                      </button>
                    )}
                  </div>
                  {resendState !== "idle" && resendMessage && (
                    <p
                      style={{
                        ...s.authErrorBody,
                        marginTop: 10,
                        color: resendState === "sent" ? "var(--success)" : "var(--error)",
                      }}
                    >
                      {resendMessage}
                    </p>
                  )}
                  {resendState === "idle" && !email && (
                    <p style={{ ...s.authErrorBody, marginTop: 8 }}>
                      再送するには、下のメールアドレス欄に登録したアドレスを入力してください。
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div style={s.errorBox} role="alert">
              {typeof error === "string" ? error : JSON.stringify(error)}
            </div>
          )}

          {/* ── SIGNUP ── */}
          {mode === "signup" && (
            <>
              {/* ② Google button — primary, prominent, with 推奨 badge */}
              <button type="button" style={s.oauthBtn} onClick={handleGoogleAuth}>
                <GoogleLogo />
                <span style={{ flex: 1, textAlign: "left" }}>Googleで続ける</span>
                <span
                  style={{
                    padding: "2px 8px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                    border: "1px solid var(--royal-100)",
                    whiteSpace: "nowrap",
                  }}
                >
                  推奨
                </span>
              </button>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, textAlign: "center", margin: "6px 0 0" }}>
                ワンクリックで完了。パスワード不要。
              </p>

              {/* ⑤ ORセパレーター — ピルスタイル */}
              <div style={{ display: "flex", alignItems: "center", margin: "16px 0", gap: 10 }}>
                <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", padding: "3px 10px", background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 100 }}>
                  または メールアドレスで登録
                </span>
                <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
              </div>

              <form onSubmit={handleSignup}>
                {/* ③ フィールド順序変更: メール → パスワード → お名前（optional） */}
                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="signup-email">
                    メールアドレス <span style={s.required}>*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    style={s.input}
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    enterKeyHint="next"
                  />
                </div>

                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="signup-password">
                    パスワード <span style={s.required}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      style={{ ...s.input, paddingRight: 48 }}
                      placeholder="8文字以上"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      enterKeyHint="next"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={s.eyeBtn}
                      aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {/* ⑦ Password strength indicator */}
                  <PwStrength password={password} />
                </div>

                {/* ③ お名前は最後（省略可） */}
                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="signup-name">
                    お名前
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>省略可</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    style={s.input}
                    placeholder="山田 太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    enterKeyHint="done"
                  />
                  <p style={s.hint}>本名でもニックネームでもOK。後から変更できます。</p>
                </div>


                <button
                  type="submit"
                  style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "登録中..." : "無料で登録する"}
                </button>

                <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, textAlign: "center", lineHeight: 1.8, marginTop: 12 }}>
                  登録することで{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>
                    利用規約
                  </a>
                  {" "}および{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>
                    プライバシーポリシー
                  </a>
                  {" "}に同意したものとみなします。
                </p>
                {/*
                  スカウトの初期値の告知。
                  ⚠️ 2026-08-04 に ow_profiles.scout_enabled の既定を true にしたため必須。
                     既定でオンにする以上、登録時点で知らせないと「黙って設定された」ことになる。
                     既定値を false に戻すことがあれば、この一文も同時に消すこと。
                */}
                <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, textAlign: "center", lineHeight: 1.8, marginTop: 6 }}>
                  登録すると、企業からのスカウトを受け取る設定になります。プロフィール編集の「公開設定」からいつでもオフにできます。
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, textAlign: "center", lineHeight: 1.8, marginTop: 6, padding: "8px 12px", background: "var(--bg-tint)", borderRadius: 8, border: "1px solid var(--line-soft)" }}>
                  当社は、お預かりした情報を匿名化・統計化した上で、職種別の待遇水準等として公表することがあります（
                  <a href="/terms#統計的利用" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink-mute)", textDecoration: "underline" }}>
                    利用規約 第13条の4
                  </a>
                  ）。統計利用の停止をご希望の場合は、お問い合わせ窓口までご連絡ください。
                </p>
              </form>
            </>
          )}

          {/* ── LOGIN ── */}
          {mode === "login" && (
            <>
              {magicLinkSent ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                    ログインリンクを送りました
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
                    <strong>{email}</strong> にメールを送信しました。<br />
                    リンクをクリックしてログインしてください。
                  </p>
                  <button type="button" onClick={() => setMagicLinkSent(false)} style={{ ...s.submitBtn, width: "auto", padding: "10px 28px", background: "var(--bg-tint)", color: "var(--ink)", boxShadow: "none", border: "1px solid var(--line)" }}>
                    戻る
                  </button>
                </div>
              ) : (
              <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={s.formTitle}>おかえりなさい。</h1>
                <p style={s.formSubtitle}>メールアドレスとパスワードでログインしてください。</p>
              </div>

              {/* ② Google button */}
              <button type="button" style={s.oauthBtn} onClick={handleGoogleAuth}>
                <GoogleLogo />
                <span style={{ flex: 1, textAlign: "left" }}>Googleでログイン</span>
                <span
                  style={{
                    padding: "2px 8px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    fontSize: 12, fontWeight: 700,
                    border: "1px solid var(--royal-100)",
                    whiteSpace: "nowrap",
                  }}
                >
                  推奨
                </span>
              </button>

              {/* ⑤ ORセパレーター — ピルスタイル */}
              <div style={{ display: "flex", alignItems: "center", margin: "16px 0", gap: 10 }}>
                <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", padding: "3px 10px", background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 100 }}>
                  または メールで続ける
                </span>
                <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
              </div>

              <form onSubmit={handleLogin}>
                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="login-email">メールアドレス</label>
                  <input
                    ref={emailRef}
                    id="login-email"
                    type="email"
                    inputMode="email"
                    style={s.input}
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    enterKeyHint="next"
                  />
                </div>

                <div style={s.formGroup}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ ...s.label, marginBottom: 0 }} htmlFor="login-password">
                      パスワード
                    </label>
                    <a href="/auth/reset-password" style={{ fontSize: 12, color: "var(--royal)", fontWeight: 500 }}>
                      お忘れですか？
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      style={{ ...s.input, paddingRight: 48 }}
                      placeholder="パスワード"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      enterKeyHint="done"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={s.eyeBtn}
                      aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "ログイン中..." : "ログイン"}
                </button>
              </form>

              {/* マジックリンク */}
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, marginBottom: 10 }}>
                  パスワードを設定していない方・お忘れの方
                </p>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading}
                  style={{ background: "none", border: "1.5px solid var(--royal-100)", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, color: "var(--royal)", cursor: "pointer", fontFamily: "inherit", width: "100%" }}
                >
                  📧 メールでログインリンクを受け取る
                </button>
              </div>

              </>
              )}
            </>
          )}

          {/* Switch mode link */}
          <div style={s.switchRow}>
            {mode === "signup" ? "すでにアカウントをお持ちの方は" : "アカウントをお持ちでない方は"}
            <button
              type="button"
              style={s.switchLink}
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "ログイン" : "新規登録"}
            </button>
          </div>
        </div>

        {/* Trust strip */}
        <div style={{ maxWidth: 420, margin: "0 auto", width: "100%", padding: "20px 0 8px" }}>
          <div style={{
            display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap",
            fontSize: 12, color: "var(--ink-mute)", fontWeight: 600,
          }}>
            {["✓ 完全無料", "✓ 営業電話なし", "✓ メール登録のみ"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* ⑨ Minimal footer — copyright + legal links only */}
        <div style={{ textAlign: "center", padding: "24px 0 20px", fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
          <a href="/terms" style={{ color: "var(--ink-mute)", textDecoration: "none", marginRight: 16 }}>利用規約</a>
          <a href="/privacy" style={{ color: "var(--ink-mute)", textDecoration: "none", marginRight: 16 }}>プライバシーポリシー</a>
          <span>© 2026 Opinio Inc.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  formSide: {
    padding: "72px 28px 0",
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    minHeight: "100vh",
    overflowY: "auto",
  } as React.CSSProperties,

  formWrap: {
    maxWidth: 420,
    margin: "0 auto",
    width: "100%",
    flex: 1,
  } as React.CSSProperties,

  // ⑦ Mode tabs — active is solid royal
  modeTabs: {
    display: "flex",
    background: "var(--bg-tint)",
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
    border: "1px solid var(--line)",
  } as React.CSSProperties,

  modeTab: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    borderRadius: 7,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ink-mute)",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  modeTabActive: {
    background: "var(--royal)",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
  } as React.CSSProperties,

  errorBox: {
    background: "var(--error-soft)",
    border: "1px solid #FECACA",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 14,
    color: "var(--error)",
    marginBottom: 20,
    lineHeight: 1.6,
  } as React.CSSProperties,

  // 認証リンク由来のエラー。フォームの errorBox より情報量が多いので別スタイル。
  authErrorBox: {
    background: "var(--error-soft)",
    border: "1px solid #FECACA",
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 20,
  } as React.CSSProperties,

  authErrorTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--error)",
    margin: "0 0 6px",
    lineHeight: 1.6,
  } as React.CSSProperties,

  authErrorBody: {
    fontSize: 13,
    color: "var(--ink-soft)",
    margin: 0,
    lineHeight: 1.8,
  } as React.CSSProperties,

  authErrorBtn: {
    padding: "8px 16px",
    background: "var(--royal)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  authErrorBtnGhost: {
    padding: "8px 16px",
    background: "#fff",
    color: "var(--royal)",
    border: "1.5px solid var(--royal-100)",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  formTitle: {
    fontFamily: "var(--font-noto-serif)",
    fontWeight: 700,
    fontSize: 26,
    color: "var(--ink)",
    marginBottom: 8,
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  formSubtitle: {
    fontSize: 14,
    color: "var(--ink-soft)",
    lineHeight: 1.7,
  } as React.CSSProperties,

  // ⑥ Google button — taller padding + stronger shadow
  oauthBtn: {
    width: "100%",
    padding: "16px 18px",
    background: "#fff",
    color: "var(--ink)",
    border: "1.5px solid #dadce0",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 3px 10px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.07)",
    transition: "box-shadow 0.2s",
  } as React.CSSProperties,

  formGroup: {
    marginBottom: 18,
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ink)",
    marginBottom: 6,
  } as React.CSSProperties,

  required: {
    color: "var(--error)",
    marginLeft: 2,
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid var(--line)",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 15,
    color: "var(--ink)",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s,box-shadow 0.2s",
  } as React.CSSProperties,

  eyeBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--ink-mute)",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: 4,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties,

  hint: {
    fontSize: 12,
    color: "var(--ink-mute)",
    marginTop: 5,
    lineHeight: 1.6,
  } as React.CSSProperties,

  submitBtn: {
    width: "100%",
    padding: "14px",
    background: "var(--royal)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
    boxShadow: "0 4px 14px rgba(0,35,102,0.22)",
    transition: "all 0.2s",
  } as React.CSSProperties,

  switchRow: {
    textAlign: "center" as const,
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid var(--line)",
    fontSize: 12,
    color: "var(--ink-mute)",
  },

  // ⑩ SwitchRow → ピルボタンスタイル（/biz/auth と統一）
  switchLink: {
    background: "var(--royal-50)",
    border: "1.5px solid var(--royal-100)",
    color: "var(--royal)",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    padding: "4px 12px",
    borderRadius: 100,
    marginLeft: 8,
  } as React.CSSProperties,
} as const;

// ─── Page export ─────────────────────────────────────────────────────────────
export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fff" }} />}>
      <AuthPageInner />
    </Suspense>
  );
}

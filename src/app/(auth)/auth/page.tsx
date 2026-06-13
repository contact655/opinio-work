"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
              fontSize: 10, fontWeight: 600,
              color: ok ? "var(--success)" : "var(--ink-mute)",
              display: "flex", alignItems: "center", gap: 3,
            }}
          >
            <span style={{ fontSize: 11 }}>{ok ? "✓" : "○"}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ⑩ Social proof strip shown near form
function SocialProofStrip() {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        marginTop: 20, padding: "12px 16px",
        background: "var(--bg-tint)", borderRadius: 10,
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex" }}>
        {[
          { init: "柴", bg: "linear-gradient(135deg,#002366,#3B5FD9)" },
          { init: "生", bg: "linear-gradient(135deg,#059669,#047857)" },
          { init: "木", bg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              width: 26, height: 26, borderRadius: "50%",
              background: m.bg, border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#fff",
              marginLeft: i === 0 ? 0 : -8, flexShrink: 0,
            }}
          >
            {m.init}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>
        <strong style={{ color: "var(--ink)" }}>96名+</strong> のIT/SaaSプロが利用中
      </p>
    </div>
  );
}

// ─── Brand feature list ──────────────────────────────────────────────────────
const BRAND_FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "現役社員にカジュアル面談を申し込める",
    desc: "気になる企業に直接、30分の対話リクエストを送れます",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8" />
      </svg>
    ),
    title: "編集部が直接取材した企業情報",
    desc: "他では読めない、第三者視点の企業インタビュー記事",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
    title: "IT/SaaS業界 特化の求人 30件+",
    desc: "外資・国内SaaSのポジションに、先輩OBからコメント付き",
  },
];

// ─── Left brand panel ────────────────────────────────────────────────────────
function BrandSide() {
  return (
    <div
      style={{
        background: "linear-gradient(155deg,#001233 0%,var(--royal) 50%,#3B5FD9 80%,#5B21B6 100%)",
        color: "#fff",
        padding: "44px 48px",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Decorative overlay */}
      <div
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 10% 90%,rgba(255,255,255,0.04) 0%,transparent 60%)," +
            "radial-gradient(circle at 85% 15%,rgba(91,33,182,0.35) 0%,transparent 50%)",
        }}
      />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Logo */}
        <a
          href="/"
          style={{
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 24,
            letterSpacing: "-0.02em", color: "#fff", textDecoration: "none",
          }}
        >
          OPINIO
        </a>

        {/* Main content */}
        <div style={{ margin: "auto 0" }}>
          <h2
            style={{
              fontFamily: "var(--font-noto-serif)", fontWeight: 500, fontSize: 38,
              lineHeight: 1.5, letterSpacing: "0.03em", marginBottom: 20, color: "#fff",
            }}
          >
            対話の、<br />産業を作る。
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.9, opacity: 0.88, maxWidth: 380, marginBottom: 40, color: "#fff" }}>
            IT/SaaS業界の先輩に話を聞き、自分のキャリアを<br />
            一緒に考える場所。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 380 }}>
            {BRAND_FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { value: "96名+", label: "IT/SaaS人材登録" },
              { value: "30件+", label: "公開求人" },
              { value: "16件", label: "取材記事" },
            ].map(({ value, label }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10, padding: "12px 10px", textAlign: "center",
                }}
              >
                <div style={{ fontFamily: "Inter,sans-serif", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 4, fontWeight: 500 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Social proof avatars */}
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex" }}>
              {[
                { init: "柴", bg: "linear-gradient(135deg,#002366,#3B5FD9)" },
                { init: "生", bg: "linear-gradient(135deg,#059669,#047857)" },
                { init: "木", bg: "linear-gradient(135deg,#7C3AED,#6D28D9)" },
                { init: "山", bg: "linear-gradient(135deg,#D97706,#B45309)" },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: m.bg, border: "2.5px solid rgba(255,255,255,0.8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff",
                    marginLeft: i === 0 ? 0 : -10, flexShrink: 0,
                  }}
                >
                  {m.init}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.5 }}>
              <strong style={{ fontWeight: 700 }}>96名+</strong> のIT/SaaSプロが<br />すでに利用中
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div style={{ fontSize: 11, opacity: 0.45, marginTop: "auto", paddingTop: 16 }}>
          © 2026 Opinio, Inc.
          {" · "}
          <a href="/terms" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>利用規約</a>
          {" · "}
          <a href="/privacy" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}>プライバシー</a>
        </div>
      </div>
    </div>
  );
}

// ─── Inner auth logic (needs useSearchParams so wrapped in Suspense) ─────────
function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "";
  const nextUrl = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [mode, setMode] = useState<"signup" | "login">(
    searchParams.get("mode") === "login" ? "login" : "signup"
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) router.replace(nextUrl || "/");
    });
  }, [nextUrl, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() || email.split("@")[0] },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered") || signUpError.message.includes("already exists")) {
        setError("このメールアドレスはすでに登録済みです。ログインタブをお試しください。");
      } else if (signUpError.message.toLowerCase().includes("password")) {
        setError("パスワードは8文字以上で入力してください。");
      } else {
        setError(signUpError.message);
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
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
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

  // ── Email confirmation sent state ──
  if (done) {
    return (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="hidden md:block">
          <BrandSide />
        </div>
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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Left: brand panel (hidden on mobile) */}
      <div className="hidden md:block">
        <BrandSide />
      </div>

      {/* Right: form */}
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

        {/* ⑤ Mobile benefit chips */}
        <div className="flex md:hidden" style={{ gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {["完全無料", "先輩に相談できる", "登録はメールのみ"].map((t) => (
            <span
              key={t}
              style={{
                padding: "4px 10px", borderRadius: 100,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                fontSize: 11, fontWeight: 600, color: "var(--royal)",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t}
            </span>
          ))}
        </div>

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

          {error && (
            <div style={s.errorBox} role="alert">
              {error}
            </div>
          )}

          {/* ── SIGNUP ── */}
          {mode === "signup" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={s.formTitle}>はじめまして。</h1>
                <p style={s.formSubtitle}>
                  IT/SaaS業界のキャリア情報に、<strong>無料</strong>でアクセスできます。
                </p>
              </div>

              {/* ② Google button — primary, prominent, with 推奨 badge */}
              <button type="button" style={s.oauthBtn} onClick={handleGoogleAuth}>
                <GoogleLogo />
                <span style={{ flex: 1, textAlign: "left" }}>Googleで続ける</span>
                <span
                  style={{
                    padding: "2px 8px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                    border: "1px solid var(--royal-100)",
                    whiteSpace: "nowrap",
                  }}
                >
                  推奨
                </span>
              </button>
              <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", margin: "6px 0 0" }}>
                ワンクリックで完了。パスワード不要。
              </p>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, whiteSpace: "nowrap" }}>
                  または メールアドレスで登録
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>

              <form onSubmit={handleSignup}>
                {/* ③ Name — optional */}
                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="signup-name">
                    お名前
                    <span style={{ fontSize: 10, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>省略可</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    style={s.input}
                    placeholder="山田 太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    enterKeyHint="next"
                  />
                  <p style={s.hint}>本名でもニックネームでもOK。後から変更できます。</p>
                </div>

                <div style={s.formGroup}>
                  <label style={s.label} htmlFor="signup-email">
                    メールアドレス <span style={s.required}>*</span>
                  </label>
                  {/* ⑧ inputMode for mobile keyboard */}
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
                  {/* ⑥ Password strength indicator */}
                  <PwStrength password={password} />
                </div>

                <button
                  type="submit"
                  style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "登録中..." : "無料で登録する"}
                </button>

                {/* ④ Implicit consent text (no checkbox) */}
                <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.8, marginTop: 12 }}>
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
              </form>

              {/* ⑩ Social proof */}
              <SocialProofStrip />
            </>
          )}

          {/* ── LOGIN ── */}
          {mode === "login" && (
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
                    fontSize: 10, fontWeight: 700,
                    border: "1px solid var(--royal-100)",
                    whiteSpace: "nowrap",
                  }}
                >
                  推奨
                </span>
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500, whiteSpace: "nowrap" }}>
                  または メールで続ける
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
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

              {/* ⑩ Social proof */}
              <SocialProofStrip />
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

        {/* ⑨ Minimal footer — copyright + legal links only */}
        <div style={{ textAlign: "center", padding: "24px 0 20px", fontSize: 11, color: "var(--ink-mute)" }}>
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
    padding: "32px 28px 0",
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

  // ② Google button — white with shadow, prominent, larger than before
  oauthBtn: {
    width: "100%",
    padding: "14px 18px",
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
    boxShadow: "0 2px 8px rgba(0,0,0,0.08),0 1px 3px rgba(0,0,0,0.06)",
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
    fontSize: 11,
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
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid var(--line-soft)",
    fontSize: 14,
    color: "var(--ink-soft)",
  },

  switchLink: {
    color: "var(--royal)",
    fontWeight: 600,
    marginLeft: 6,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
    textDecoration: "underline",
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

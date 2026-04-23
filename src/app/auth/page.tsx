"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Google ロゴ SVG ───────────────────────────────────────
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// ─── アイコン ───────────────────────────────────────────────
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

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";

  const [mode, setMode] = useState<"signup" | "login">(
    searchParams.get("mode") === "login" ? "login" : "signup"
  );

  // フォーム状態
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false); // サインアップ完了（確認メール送信）

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // モード切替時にフォームをリセット
  useEffect(() => {
    setError("");
    setLoading(false);
    if (mode === "signup") nameRef.current?.focus();
    else emailRef.current?.focus();
  }, [mode]);

  // ─── Google OAuth ────────────────────────────────────────
  const handleGoogleAuth = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
  };

  // ─── サインアップ ────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsChecked) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // name は raw_user_meta_data に入り、migration 032 のトリガーが ow_users に書き込む
        data: { name: name.trim() || email.split("@")[0] },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered") ||
          signUpError.message.includes("already exists")) {
        setError("このメールアドレスはすでに登録済みです。ログインタブをお試しください。");
      } else if (signUpError.message.toLowerCase().includes("password")) {
        setError("パスワードは8文字以上で入力してください。");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    // identities が空 = 既存ユーザー（メール確認前の再登録）
    if (data.user?.identities?.length === 0) {
      setError("このメールアドレスはすでに登録済みです。ログインタブをお試しください。");
      setLoading(false);
      return;
    }

    // メール確認不要の場合（Supabase の設定による）はそのままリダイレクト
    if (data.session) {
      router.push(nextUrl === "/" ? "/companies" : nextUrl);
      return;
    }

    // メール確認が必要な場合
    setDone(true);
    setLoading(false);
  };

  // ─── ログイン ────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(
        loginError.message.includes("Invalid login") ||
        loginError.message.includes("invalid_credentials")
          ? "メールアドレスまたはパスワードが正しくありません。"
          : loginError.message
      );
      setLoading(false);
      return;
    }

    router.push(nextUrl === "/" ? "/companies" : nextUrl);
    router.refresh();
  };

  // ─── 確認メール送信完了 ──────────────────────────────────
  if (done) {
    return (
      <div style={styles.layout}>
        <BrandSide />
        <div style={styles.formSide}>
          <div style={styles.formWrap}>
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "#ECFDF5",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 22, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                確認メールを送りました
              </h2>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.9, marginBottom: 28 }}>
                <strong>{email}</strong> に確認メールを送信しました。<br />
                メール内のリンクをクリックして登録を完了してください。
              </p>
              <button
                onClick={() => { setDone(false); setMode("login"); }}
                style={{ ...styles.submitBtn, width: "auto", padding: "10px 28px" }}
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
    <div style={styles.layout}>
      {/* ── 左：ブランディング ── */}
      <BrandSide />

      {/* ── 右：フォーム ── */}
      <div style={styles.formSide}>
        <div style={styles.formWrap}>

          {/* モード切替タブ */}
          <div style={styles.modeTabs}>
            <button
              style={{ ...styles.modeTab, ...(mode === "signup" ? styles.modeTabActive : {}) }}
              onClick={() => setMode("signup")}
            >
              新規登録
            </button>
            <button
              style={{ ...styles.modeTab, ...(mode === "login" ? styles.modeTabActive : {}) }}
              onClick={() => setMode("login")}
            >
              ログイン
            </button>
          </div>

          {/* エラー表示 */}
          {error && (
            <div style={styles.errorBox} role="alert">{error}</div>
          )}

          {/* ─ サインアップ ─ */}
          {mode === "signup" && (
            <>
              <div style={styles.formHead}>
                <h1 style={styles.formTitle}>はじめまして。</h1>
                <p style={styles.formSubtitle}>
                  メールアドレスで無料で登録いただけます。<br />
                  登録後、プロフィールの詳細を設定できます。
                </p>
              </div>

              {/* Google OAuth */}
              <button type="button" style={styles.oauthBtn} onClick={handleGoogleAuth}>
                <GoogleLogo />
                Googleで登録する
              </button>

              <div style={styles.divider}><span>OR</span></div>

              <form onSubmit={handleSignup}>
                {/* お名前 */}
                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="signup-name">
                    お名前<span style={styles.required}>*</span>
                  </label>
                  <input
                    ref={nameRef}
                    id="signup-name"
                    type="text"
                    style={styles.input}
                    placeholder="山田 太郎"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                  <p style={styles.hint}>本名でもニックネームでもOK。後から変更できます。</p>
                </div>

                {/* メールアドレス */}
                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="signup-email">
                    メールアドレス<span style={styles.required}>*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    style={styles.input}
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {/* パスワード */}
                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="signup-password">
                    パスワード<span style={styles.required}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      style={{ ...styles.input, paddingRight: 48 }}
                      placeholder="8文字以上"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={styles.eyeBtn}
                      aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <p style={styles.hint}>8文字以上。英数字を組み合わせてください。</p>
                </div>

                {/* 利用規約 */}
                <label style={styles.termsRow}>
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={e => setTermsChecked(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: "#002366", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
                  />
                  <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                    <a href="/terms" target="_blank" style={styles.termLink}>利用規約</a>および
                    <a href="/privacy" target="_blank" style={styles.termLink}>プライバシーポリシー</a>に同意します
                  </span>
                </label>

                <button
                  type="submit"
                  style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "登録中..." : "無料で登録する"}
                </button>
              </form>

              <div style={styles.switchRow}>
                すでにアカウントをお持ちの方は
                <button style={styles.switchLink} onClick={() => setMode("login")}>
                  ログイン
                </button>
              </div>
            </>
          )}

          {/* ─ ログイン ─ */}
          {mode === "login" && (
            <>
              <div style={styles.formHead}>
                <h1 style={styles.formTitle}>おかえりなさい。</h1>
                <p style={styles.formSubtitle}>
                  メールアドレスとパスワードでログインしてください。
                </p>
              </div>

              {/* Google OAuth */}
              <button type="button" style={styles.oauthBtn} onClick={handleGoogleAuth}>
                <GoogleLogo />
                Googleでログインする
              </button>

              <div style={styles.divider}><span>OR</span></div>

              <form onSubmit={handleLogin}>
                {/* メールアドレス */}
                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="login-email">メールアドレス</label>
                  <input
                    ref={emailRef}
                    id="login-email"
                    type="email"
                    style={styles.input}
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {/* パスワード */}
                <div style={styles.formGroup}>
                  <label style={styles.label} htmlFor="login-password">パスワード</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      style={{ ...styles.input, paddingRight: 48 }}
                      placeholder="パスワード"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={styles.eyeBtn}
                      aria-label={showPassword ? "パスワードを非表示" : "パスワードを表示"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  <div style={{ textAlign: "right", marginTop: 6 }}>
                    <a href="/auth/reset-password" style={{ fontSize: 12, color: "#002366", fontWeight: 500 }}>
                      パスワードをお忘れですか？
                    </a>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{ ...styles.submitBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}
                  disabled={loading}
                >
                  {loading ? "ログイン中..." : "ログイン"}
                </button>
              </form>

              <div style={styles.switchRow}>
                アカウントをお持ちでない方は
                <button style={styles.switchLink} onClick={() => setMode("signup")}>
                  新規登録
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── 左ブランディングパネル ──────────────────────────────────
function BrandSide() {
  return (
    <div style={styles.brandSide}>
      <a href="/" style={styles.brandLogo}>Opinio</a>

      <div style={styles.brandMain}>
        <h2 style={styles.brandTitle}>
          対話の、<br />産業を作る。
        </h2>
        <p style={styles.brandSubtitle}>
          IT/SaaS業界の先輩に話を聞き、自分のキャリアを<br />
          一緒に考える場所。Opinio編集部が直接取材した、<br />
          リアルな企業の声と出会えます。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 440 }}>
          {BRAND_FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.title}</div>
                <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.6 }}>
        © 2026 Opinio, Inc. · 「対話の産業を作る」
      </div>
    </div>
  );
}

const BRAND_FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "数年先を歩く先輩に話を聞ける",
    desc: "審査通過したメンターが、30分の対話を提供",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8" />
      </svg>
    ),
    title: "編集部が直接取材した企業情報",
    desc: "他では読めない、第三者視点の企業インタビュー",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
    title: "自然言語で直感的に探せる",
    desc: "「PdMからCPOになった人」のように、文章で検索",
  },
];

// ─── スタイル（モックの CSS 変数を JS オブジェクトで再現）───
const styles = {
  layout: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
  } as React.CSSProperties,

  brandSide: {
    background: "linear-gradient(135deg, #002366 0%, #3B5FD9 60%, #5B21B6 100%)",
    color: "#fff",
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  } as React.CSSProperties,

  brandLogo: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: 26,
    letterSpacing: "-0.02em",
    color: "#fff",
    textDecoration: "none",
  } as React.CSSProperties,

  brandMain: {
    margin: "auto 0",
  } as React.CSSProperties,

  brandTitle: {
    fontFamily: "'Noto Serif JP', serif",
    fontWeight: 500,
    fontSize: 38,
    lineHeight: 1.5,
    letterSpacing: "0.03em",
    marginBottom: 20,
    color: "#fff",
  } as React.CSSProperties,

  brandSubtitle: {
    fontSize: 15,
    lineHeight: 1.9,
    opacity: 0.9,
    maxWidth: 440,
    marginBottom: 40,
    color: "#fff",
  } as React.CSSProperties,

  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  formSide: {
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    background: "#fff",
  } as React.CSSProperties,

  formWrap: {
    maxWidth: 420,
    margin: "0 auto",
    width: "100%",
  } as React.CSSProperties,

  modeTabs: {
    display: "flex",
    background: "#F8FAFC",
    borderRadius: 10,
    padding: 4,
    marginBottom: 36,
    border: "1px solid #E2E8F0",
  } as React.CSSProperties,

  modeTab: {
    flex: 1,
    padding: "10px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,

  modeTabActive: {
    background: "#fff",
    color: "#002366",
    boxShadow: "0 2px 6px rgba(15,23,42,0.08)",
  } as React.CSSProperties,

  errorBox: {
    background: "#FEE2E2",
    border: "1px solid #FECACA",
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 13,
    color: "#DC2626",
    marginBottom: 20,
    lineHeight: 1.6,
  } as React.CSSProperties,

  formHead: {
    marginBottom: 32,
  } as React.CSSProperties,

  formTitle: {
    fontFamily: "'Noto Serif JP', serif",
    fontWeight: 700,
    fontSize: 28,
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  formSubtitle: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.8,
  } as React.CSSProperties,

  oauthBtn: {
    width: "100%",
    padding: "12px",
    background: "#fff",
    color: "#0F172A",
    border: "1.5px solid #E2E8F0",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
    transition: "all 0.2s",
  } as React.CSSProperties,

  divider: {
    display: "flex",
    alignItems: "center",
    margin: "20px 0",
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    gap: 12,
    // ─ 線は ::before/::after が使えないので親に border-image trick は諦め JS で再現
  } as React.CSSProperties,

  formGroup: {
    marginBottom: 20,
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#0F172A",
    marginBottom: 8,
  } as React.CSSProperties,

  required: {
    color: "#DC2626",
    marginLeft: 2,
  } as React.CSSProperties,

  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #E2E8F0",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 14,
    color: "#0F172A",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  } as React.CSSProperties,

  eyeBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94A3B8",
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
    color: "#94A3B8",
    marginTop: 6,
    lineHeight: 1.6,
  } as React.CSSProperties,

  termsRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    cursor: "pointer",
  } as React.CSSProperties,

  termLink: {
    color: "#002366",
    textDecoration: "underline",
    fontWeight: 500,
  } as React.CSSProperties,

  submitBtn: {
    width: "100%",
    padding: "14px",
    background: "#002366",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
    boxShadow: "0 4px 14px rgba(0,35,102,0.2)",
    transition: "all 0.2s",
  } as React.CSSProperties,

  switchRow: {
    textAlign: "center" as const,
    marginTop: 28,
    paddingTop: 24,
    borderTop: "1px solid #E2E8F0",
    fontSize: 13,
    color: "#475569",
  },

  switchLink: {
    color: "#002366",
    fontWeight: 600,
    marginLeft: 6,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    textDecoration: "underline",
  } as React.CSSProperties,
} as const;

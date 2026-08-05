"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login";

type PendingCompany = {
  name: string;
  industry: string;
  employeeCount: string;
  genres: string[];
};
const PENDING_COMPANY_KEY = "opinio_biz_pending_company";

const INVITE_TOKEN_KEY = "opinio_biz_invite_token";
const INVITED_EMAIL_KEY = "opinio_biz_invited_email";
const INVITED_COMPANY_NAME_KEY = "opinio_biz_invited_company_name";

type InviteContext = {
  token: string;
  email: string;
  companyName: string;
};


const INDUSTRY_OPTIONS = [
  "IT / SaaS",
  "コンサルティング",
  "金融 / FinTech",
  "製造業",
  "小売 / EC",
  "メディア",
  "医療 / ヘルスケア",
  "その他",
];

const EMPLOYEE_COUNT_OPTIONS = [
  "1-10名",
  "11-50名",
  "51-100名",
  "101-300名",
  "301-1,000名",
  "1,001名以上",
];

export default function BizAuthPage() {
  return (
    <Suspense fallback={null}>
      <BizAuthInner />
    </Suspense>
  );
}

function BizAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/biz/dashboard";
  const modeParam = searchParams.get("mode");
  const isInviteContext = searchParams.get("context") === "invite";
  const companyFromUrl = searchParams.get("company") ?? "";

  // 招待コンテキストのみ signup を初期表示。通常はログインのみ
  const [mode, setMode] = useState<Mode>(isInviteContext ? "signup" : "login");
  const [checkingSession, setCheckingSession] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; email: string } | null>(null);

  function handleSetMode(m: Mode) {
    setMode(m);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", m);
    router.replace(`/biz/auth?${params.toString()}`, { scroll: false });
  }
  const [prefillEmail, setPrefillEmail] = useState("");
  const [pendingCompany, setPendingCompany] = useState<PendingCompany | null>(null);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);
  const [loggedInCompanyName] = useState("");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_COMPANY_KEY);
      if (stored) {
        const parsed: PendingCompany = JSON.parse(stored);
        setPendingCompany(parsed);
        setMode("login");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isInviteContext) return;
    try {
      const token = sessionStorage.getItem(INVITE_TOKEN_KEY) ?? "";
      const email = sessionStorage.getItem(INVITED_EMAIL_KEY) ?? "";
      const companyName = sessionStorage.getItem(INVITED_COMPANY_NAME_KEY) ?? "";
      if (token && email) {
        setInviteContext({ token, email, companyName });
        if (modeParam === "login") setMode("login");
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInviteContext]);

  function handleSwitchToLogin(email?: string) {
    try {
      const stored = sessionStorage.getItem(PENDING_COMPANY_KEY);
      if (stored) setPendingCompany(JSON.parse(stored));
    } catch { /* ignore */ }
    if (email) setPrefillEmail(email);
    setMode("login");
  }

  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    const fallback = setTimeout(() => {
      if (!settled) setCheckingSession(false);
    }, 800);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      settled = true;
      clearTimeout(fallback);
      if (!session) {
        setCheckingSession(false);
        return;
      }
      const { data: memberships } = await supabase
        .from("ow_company_admins")
        .select("id")
        .limit(1);
      if ((memberships?.length ?? 0) > 0) {
        router.replace(next);
        return;
      }
      // ログイン済み・企業未登録 → 挨拶カードを表示
      const user = session.user;
      const displayName =
        user.user_metadata?.name ??
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "あなた";
      setLoggedInUser({ name: displayName, email: user.email ?? "" });
      setCheckingSession(false);
    });
    return () => clearTimeout(fallback);
  }, [next, router]);

  if (checkingSession) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans JP', -apple-system, sans-serif", background: "#fff",
      }}>
        <div style={{ textAlign: "center", color: "var(--ink-mute)", fontSize: 14 }}>
          <div style={{
            width: 32, height: 32, border: "3px solid var(--line)", borderTopColor: "var(--royal)",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          確認中...
        </div>
      </div>
    );
  }

  if (loggedInUser) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans JP', -apple-system, sans-serif", background: "#fff", padding: "24px",
      }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          {/* ロゴ */}
          <div style={{ marginBottom: 32 }}>
            <a href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 36, height: 36, background: "var(--royal)", borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, fontFamily: "Inter, sans-serif" }}>O</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--royal)", letterSpacing: "-0.5px" }}>OPINIO</span>
            </a>
          </div>

          {/* 挨拶カード */}
          <div style={{
            background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
            border: "1.5px solid var(--royal-100)",
            borderRadius: 16, padding: "36px 32px", marginBottom: 20,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>👋</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px" }}>
              {loggedInUser.name}さん、こんにちは！
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 4px" }}>
              {loggedInUser.email}
            </p>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 24px" }}>
              このアカウントで企業登録を進めます。
            </p>
            <button
              type="button"
              onClick={async () => {
                const name = companyFromUrl || loggedInCompanyName;
                if (name.trim()) {
                  try {
                    sessionStorage.setItem(PENDING_COMPANY_KEY, JSON.stringify({ name: name.trim() }));
                  } catch { /* ignore */ }
                  // user_metadata にも保存（サーバー側で確実に読めるように）
                  try {
                    const supabase = createClient();
                    await supabase.auth.updateUser({ data: { pending_company: name.trim() } });
                  } catch { /* ignore */ }
                }
                router.push("/biz/companies/add/new");
              }}
              style={{
                width: "100%", padding: "14px", background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.01em",
                boxShadow: "0 4px 16px rgba(0,35,102,0.25)",
              }}
            >
              企業情報を入力する →
            </button>
          </div>

          <p style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            別のアカウントで登録する場合は{" "}
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                setLoggedInUser(null);
              }}
              style={{
                background: "none", border: "none", color: "var(--royal)", fontSize: 12,
                cursor: "pointer", textDecoration: "underline", padding: 0,
              }}
            >
              ログアウト
            </button>
            {" "}してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="biz-auth-layout"
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @media (max-width: 1000px) {
          .biz-auth-layout { grid-template-columns: 1fr !important; }
          .biz-brand-side {
            position: static !important;
            height: auto !important;
            min-height: 320px !important;
            padding: 28px 24px !important;
          }
          .biz-brand-title { font-size: 26px !important; margin-bottom: 10px !important; }
          .biz-brand-subtitle { font-size: 12px !important; margin-bottom: 16px !important; }
          .biz-features-grid { gap: 8px !important; }
          .biz-feature-card { padding: 10px 12px !important; }
          .biz-feature-icon { width: 24px !important; height: 24px !important; margin-bottom: 6px !important; }
          .biz-feature-title { font-size: 12px !important; }
          .biz-feature-desc { font-size: 10px !important; }
          .biz-brand-stats { display: none !important; }
          .biz-brand-foot { display: none !important; }
          .biz-form-side {
            position: static !important;
            height: auto !important;
            padding: 28px 20px 100px !important;
          }
          .biz-to-jobseeker { top: 14px !important; right: 14px !important; }
          .biz-mobile-cta { display: flex !important; }
        }
        @media (min-width: 1001px) {
          .biz-mobile-cta { display: none !important; }
        }
        @media (max-width: 500px) {
          .biz-features-grid { grid-template-columns: 1fr !important; }
          .biz-form-row { grid-template-columns: 1fr !important; }
        }
        @keyframes bizSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>


      <FormSide
        mode={mode}
        setMode={handleSetMode}
        prefillEmail={prefillEmail}
        pendingCompany={pendingCompany}
        onSwitchToLogin={handleSwitchToLogin}
        next={next}
        router={router}
        inviteContext={inviteContext}
      />
    </div>
  );
}

// ── ブランドパネル（左） ─────────────────────────────────────────────────────

// ── フォームサイド ─────────────────────────────────────────────────────────
type FormSideProps = {
  mode: Mode;
  setMode: (m: Mode) => void;
  prefillEmail: string;
  pendingCompany: PendingCompany | null;
  onSwitchToLogin: (email?: string) => void;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function FormSide({ mode, setMode, prefillEmail, pendingCompany, onSwitchToLogin, next, router, inviteContext }: FormSideProps) {
  return (
    <div
      className="biz-form-side"
      style={{
        padding: "56px 48px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        background: "#fff",
        position: "sticky",
        top: 0,
        height: "100vh",
        alignSelf: "start",
        overflowX: "hidden",
        overflowY: "auto",
        scrollbarGutter: "stable",
        minWidth: 0,
      }}
    >
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%" }}>
        {/* ⑨ 求職者リンク — visible on all screens */}
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <a href="/" style={{ fontSize: 11, color: "var(--ink-mute)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            求職者の方はこちら →
          </a>
        </div>
        {/* 招待コンテキストのみタブを表示。通常はログインのみ */}
        {inviteContext && <ModeTabBar mode={mode} onChange={setMode} />}
        {inviteContext && mode === "signup" ? (
          <SignupForm onSwitchToLogin={onSwitchToLogin} next={next} router={router} inviteContext={inviteContext} />
        ) : (
          <LoginForm
            onSwitchToSignup={() => setMode("signup")}
            prefillEmail={prefillEmail}
            pendingCompany={pendingCompany}
            next={next}
            router={router}
            inviteContext={inviteContext}
          />
        )}
      </div>

      {/* ⑨ Minimal footer */}
      <div style={{ textAlign: "center", padding: "24px 0 12px", fontSize: 11, color: "var(--ink-mute)", marginTop: "auto" }}>
        <a href="/terms/business" style={{ color: "var(--ink-mute)", textDecoration: "none", marginRight: 16 }}>利用規約（掲載企業）</a>
        <a href="/privacy" style={{ color: "var(--ink-mute)", textDecoration: "none", marginRight: 16 }}>プライバシーポリシー</a>
        <span>© 2026 Opinio Inc.</span>
      </div>
    </div>
  );
}

// ── ⑤ モード切替タブ — active = solid royal ──────────────────────────────
function ModeTabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{
      display: "flex",
      background: "var(--bg-tint)",
      borderRadius: 10, padding: 4, marginBottom: 28,
      border: "1px solid var(--line)",
    }}>
      {(["signup", "login"] as Mode[]).map((m) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              flex: 1, padding: "10px",
              background: isActive ? "var(--royal)" : "transparent",
              border: "none", borderRadius: 8,
              fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              color: isActive ? "#fff" : "var(--ink-mute)",
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: isActive ? "0 2px 8px rgba(0,35,102,0.25)" : "none",
            }}
          >
            {m === "signup" ? "新規登録（無料）" : "ログイン"}
          </button>
        );
      })}
    </div>
  );
}

// ── ⑨ パスワード強度インジケーター ─────────────────────────────────────────
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
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i <= score ? barColor : "var(--line)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
        {checks.map(({ label, ok }) => (
          <span key={label} style={{
            fontSize: 10, fontWeight: 600,
            color: ok ? "var(--success)" : "var(--ink-mute)",
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <span>{ok ? "✓" : "○"}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── ① サインアップフォーム（2ステップ） ─────────────────────────────────────
type SignupFormProps = {
  onSwitchToLogin: (email?: string) => void;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function SignupForm({ onSwitchToLogin, next, router, inviteContext }: SignupFormProps) {
  const isInviteMode = inviteContext !== null;
  const isMockMode = process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true";

  // ① 2-step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [email, setEmail] = useState(inviteContext?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedFee, setAgreedFee] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExistingNotice, setShowExistingNotice] = useState(false);
  const [existingCompany, setExistingCompany] = useState<{ id: string; name: string; adminCount: number } | null>(null);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);


  // ② Google OAuth
  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&biz=1`,
      },
    });
  }

  // ① Step 1 → Step 2
  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }

    // Invite mode: skip step 2 (no company info needed)
    if (isInviteMode) {
      handleInviteSubmit();
    } else {
      setStep(2);
    }
  }

  // Invite mode submit (single step)
  async function handleInviteSubmit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: contactName } },
      });
      if (authError) {
        if (authError.message.includes("already registered") || authError.message.includes("User already registered")) {
          onSwitchToLogin(email);
          return;
        }
        setError(authError.message);
        return;
      }
      if (inviteContext) {
        try {
          const acceptRes = await fetch("/api/biz/members/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invitation_token: inviteContext.token }),
          });
          if (!acceptRes.ok) {
            const errData = await acceptRes.json();
            setError(errData.error ?? "招待の受諾に失敗しました。招待リンクから再度お試しください。");
            return;
          }
        } catch {
          setError("招待の受諾処理中にエラーが発生しました。");
          return;
        }
        try {
          sessionStorage.removeItem(INVITE_TOKEN_KEY);
          sessionStorage.removeItem(INVITED_EMAIL_KEY);
          sessionStorage.removeItem(INVITED_COMPANY_NAME_KEY);
        } catch { /* ignore */ }
        window.location.replace("/biz/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  // ① Step 2 submit
  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isMockMode) {
        alert("モックモード: アカウントを作成しました（実際の登録は行われません）");
        router.push(next);
        return;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: {
          name: contactName,
          pending_company: companyName,
          pending_industry: industry || null,
          agreed_terms_business: agreedTerms,
          agreed_fee_pct15: agreedFee,
          agreed_terms_version: "2026-07",
        } },
      });

      if (authError) {
        if (
          authError.message.includes("already registered") ||
          authError.message.includes("User already registered") ||
          authError.message.toLowerCase().includes("database error")
        ) {
          setShowExistingNotice(true);
          try {
            const pending: PendingCompany = { name: companyName, industry, employeeCount, genres: [] };
            sessionStorage.setItem(PENDING_COMPANY_KEY, JSON.stringify(pending));
          } catch { /* ignore */ }
          return;
        }
        setError(authError.message);
        return;
      }

      // signUp 完了後は /biz/companies/add/new へ遷移（会社名は user_metadata.pending_company からプリフィル）
      window.location.replace("/biz/companies/add/new");
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRequest() {
    if (!existingCompany) return;
    setJoinRequestLoading(true);
    try {
      await fetch("/api/biz/join-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: existingCompany.id }),
      });
      setJoinRequestSent(true);
    } catch {
      // best-effort
      setJoinRequestSent(true);
    } finally {
      setJoinRequestLoading(false);
    }
  }

  // ─── 重複企業が見つかったとき ──────────────────────────────────────────────
  if (existingCompany) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={titleStyle}>この企業はすでに登録されています</h2>
          <p style={subtitleStyle}>
            「{existingCompany.name}」はすでに OPINIO に登録されています。<br />
            既存の管理者に参加リクエストを送りましょう。
          </p>
        </div>

        <div style={{
          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          borderRadius: 12, padding: "20px 24px", marginBottom: 20,
        }}>
          <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "var(--royal)" }}>
            {existingCompany.name}
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
            管理者 {existingCompany.adminCount} 名が登録済み
          </p>
        </div>

        {joinRequestSent ? (
          <div style={{
            background: "var(--success-soft)", border: "1px solid #A7F3D0",
            borderRadius: 10, padding: "16px 20px", textAlign: "center",
          }}>
            <p style={{ fontWeight: 700, color: "var(--success)", margin: "0 0 4px" }}>
              ✓ 参加リクエストを送りました
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
              管理者から招待メールが届くまでお待ちください。
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleJoinRequest}
              disabled={joinRequestLoading}
              style={{ ...submitBtnStyle, opacity: joinRequestLoading ? 0.7 : 1 }}
            >
              {joinRequestLoading ? "送信中..." : "参加リクエストを送る"}
            </button>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", textAlign: "center", marginTop: 10 }}>
              管理者に「参加したい」というメールが届きます。
            </p>
            <button
              type="button"
              onClick={() => setExistingCompany(null)}
              style={{
                display: "block", width: "100%", marginTop: 8,
                background: "none", border: "1px solid var(--line)",
                borderRadius: 8, padding: "10px 0", fontSize: 13,
                color: "var(--ink-soft)", cursor: "pointer",
              }}
            >
              ← 会社名を修正する
            </button>
          </>
        )}
      </div>
    );
  }

  // ─── INVITE MODE: single-step form ──────────────────────────────────────
  if (isInviteMode) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h2 style={titleStyle}>参加する。</h2>
          <p style={subtitleStyle}>
            招待されたアカウントとして OPINIO に参加します。<br />
            お名前とパスワードを設定してください。
          </p>
        </div>

        {inviteContext?.companyName && <InviteBanner companyName={inviteContext.companyName} />}

        {error && <ErrorBox message={error} />}

        <form onSubmit={handleStep1Next} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="お名前" required htmlFor="inv-name" />
            <input id="inv-name" type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
              placeholder="山田 太郎" style={inputStyle} autoComplete="name"
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="メールアドレス（招待先）" required htmlFor="inv-email" />
            <input id="inv-email" type="email" value={email} readOnly
              style={{ ...inputStyle, background: "var(--bg-tint)", color: "var(--ink-soft)", cursor: "not-allowed" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="パスワード" required htmlFor="inv-password" />
            <div style={{ position: "relative" }}>
              <input id="inv-password" type={showPassword ? "text" : "password"} required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上" style={{ ...inputStyle, paddingRight: 42 }} autoComplete="new-password"
                onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
            <PwStrength password={password} />
          </div>
          <button type="submit" disabled={loading} style={{ ...submitBtnStyle, opacity: loading ? 0.7 : 1 }}>
            {loading ? "登録中..." : "チームに参加する"}
          </button>
          <ImplicitConsent />
        </form>

        <SwitchRow label="すでにアカウントをお持ちの方は" action="ログイン" onClick={() => onSwitchToLogin()} />
      </div>
    );
  }

  // ─── NORMAL SIGNUP: step 1 ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <div>
        {/* Step indicator */}
        <StepIndicator current={1} total={2} />

        <div style={{ marginBottom: 24 }}>
          <h2 style={titleStyle}>採用を、今日から。</h2>
          <p style={subtitleStyle}>
            アカウント情報を入力してください。<br />
            <strong>掲載費用は無料</strong>、入社まで一切請求なし。
          </p>
        </div>

        {error && <ErrorBox message={error} />}


        {/* ② Google OAuth — primary, prominent */}
        <button type="button" onClick={handleGoogleSignup} style={googleBtnStyle}>
          <GoogleLogo />
          <span style={{ flex: 1, textAlign: "left" }}>Googleで登録</span>
          <span style={{
            padding: "2px 8px", borderRadius: 100,
            background: "var(--royal-50)", color: "var(--royal)",
            fontSize: 10, fontWeight: 700, border: "1px solid var(--royal-100)",
            whiteSpace: "nowrap",
          }}>推奨</span>
        </button>
        {/* ③ G Suite バッジ — 緑ピルに変更 */}
        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 0" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700, color: "var(--success)",
            padding: "2px 10px", borderRadius: 100,
            background: "var(--success-soft)", border: "1px solid #A7F3D0",
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            G Suite / Google Workspace も対応
          </span>
        </div>

        {/* ⑥ OR divider — pill style */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: 10 }}>
          <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
          <span style={{
            fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap",
            padding: "3px 10px", background: "var(--bg-tint)",
            border: "1px solid var(--line)", borderRadius: 100,
          }}>
            またはメールで登録
          </span>
          <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
        </div>

        <form onSubmit={handleStep1Next} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel label="お名前" required htmlFor="biz-s1-name" />
            <input id="biz-s1-name" type="text" required value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="山田 太郎"
              style={inputStyle} autoComplete="name"
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="メールアドレス" required htmlFor="biz-s1-email" />
            <input id="biz-s1-email" type="email" inputMode="email" required value={email}
              onChange={(e) => { setEmail(e.target.value); setShowExistingNotice(false); }}
              placeholder="your@email.com"
              style={inputStyle} autoComplete="email"
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
          </div>

          <div style={{ marginBottom: 4 }}>
            <FieldLabel label="パスワード" required htmlFor="biz-s1-password" />
            <div style={{ position: "relative" }}>
              <input id="biz-s1-password" type={showPassword ? "text" : "password"} required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上" style={{ ...inputStyle, paddingRight: 42 }}
                autoComplete="new-password"
                onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
              <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>
            {/* ⑨ Password strength indicator */}
            <PwStrength password={password} />
          </div>

          {/* ⑦ Trust micro-strip above submit */}
          <div style={{ marginTop: 20, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" as const }}>
            {["掲載費¥0", "入社まで請求なし", "即日公開"].map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--ink-mute)", fontWeight: 600 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </span>
            ))}
          </div>
          <button type="submit" style={{ ...submitBtnStyle }}>
            次のステップへ →
          </button>
          <ImplicitConsent />
        </form>

        <SwitchRow label="すでにアカウントをお持ちの方は" action="ログイン" onClick={() => onSwitchToLogin()} />
        <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", marginTop: 4 }}>
          求職者アカウントをお持ちの方も、そのままログインできます。
        </p>

        {/* ⑩ Mobile sticky CTA */}
        <MobileStickyBar label="次のステップへ →" formId="biz-s1-form" />
      </div>
    );
  }

  // ─── NORMAL SIGNUP: step 2 ──────────────────────────────────────────────
  return (
    <div>
      {/* Step indicator */}
      <StepIndicator current={2} total={2} />

      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => { setStep(1); setError(null); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "none", border: "none", color: "var(--royal)",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            cursor: "pointer", padding: "0 0 12px",
          }}
        >
          ← 戻る
        </button>
        <h2 style={titleStyle}>あなたの所属企業を教えてください</h2>
        <p style={subtitleStyle}>すでに OPINIO に登録されている企業の方は、管理者に招待を依頼してください。</p>
      </div>

      {error && <ErrorBox message={error} />}

      {showExistingNotice && (
        <ExistingUserNotice
          email={email}
          onSwitchToLogin={onSwitchToLogin}
          onChangeEmail={() => { setShowExistingNotice(false); setStep(1); setEmail(""); }}
        />
      )}

      <form onSubmit={handleStep2Submit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="企業名" required htmlFor="biz-s2-company" />
          <input id="biz-s2-company" type="text" required value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="株式会社〇〇" style={inputStyle} autoComplete="organization"
            onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
        </div>

        {/* 業種＋従業員数 — 任意項目 */}
        <div className="biz-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <FieldLabel label="業種" htmlFor="biz-s2-industry" />
            <select id="biz-s2-industry" value={industry}
              onChange={(e) => setIndustry(e.target.value)} style={selectStyle}
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)}>
              <option value="">任意</option>
              {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel label="従業員数" htmlFor="biz-s2-emp" />
            <select id="biz-s2-emp" value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)} style={selectStyle}
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)}>
              <option value="">任意</option>
              {EMPLOYEE_COUNT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="部署・役職" htmlFor="biz-s2-title" />
          <input id="biz-s2-title" type="text" value={contactTitle}
            onChange={(e) => setContactTitle(e.target.value)}
            placeholder="例：人事部 採用マネージャー（任意）" style={inputStyle} autoComplete="organization-title"
            onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
        </div>

        {/* ④ Simplified unified account notice (⑦) */}
        <SimplifiedAccountNotice />

        {/* 成果報酬の開示 + 同意チェックボックス */}
        <FeeDisclosure />

        <ConsentCheckbox
          id="biz-agree-terms"
          checked={agreedTerms}
          onChange={setAgreedTerms}
          label={
            <>
              <a href="/terms/business" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>企業向け利用規約</a>
              {" "}および{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>プライバシーポリシー</a>
              に同意します
            </>
          }
        />

        <ConsentCheckbox
          id="biz-agree-fee"
          checked={agreedFee}
          onChange={setAgreedFee}
          label="成果報酬（成約時に採用者の理論年収の15%）が発生することを理解し、同意します"
        />

        <button
          type="submit"
          disabled={loading || !agreedTerms || !agreedFee}
          style={{
            ...submitBtnStyle,
            marginTop: 16,
            opacity: loading || !agreedTerms || !agreedFee ? 0.45 : 1,
            cursor: loading || !agreedTerms || !agreedFee ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "登録中..." : "企業アカウントを開設する →"}
        </button>
      </form>

      <SwitchRow label="すでにアカウントをお持ちの方は" action="ログイン" onClick={() => onSwitchToLogin()} />
    </div>
  );
}

// ── ログインフォーム ─────────────────────────────────────────────────────────
type LoginFormProps = {
  onSwitchToSignup?: () => void;
  prefillEmail: string;
  pendingCompany: PendingCompany | null;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function LoginForm({ prefillEmail, pendingCompany, next, router, inviteContext }: LoginFormProps) {
  const isMockMode = process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true";

  const [email, setEmail] = useState(inviteContext?.email || prefillEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&biz=1` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isMockMode) {
        alert("モックモード: ログインしました（実際の認証は行われません）");
        router.push(next);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError("メールアドレスまたはパスワードが間違っています");
        return;
      }

      const inviteToken = inviteContext?.token ?? (() => {
        try { return sessionStorage.getItem(INVITE_TOKEN_KEY) ?? ""; } catch { return ""; }
      })();

      if (inviteToken) {
        try {
          const acceptRes = await fetch("/api/biz/members/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invitation_token: inviteToken }),
          });
          if (!acceptRes.ok) {
            const errData = await acceptRes.json();
            setError(errData.error ?? "招待の受諾に失敗しました。招待リンクから再度お試しください。");
            return;
          }
        } catch {
          setError("招待の受諾処理中にエラーが発生しました。");
          return;
        }
        try {
          sessionStorage.removeItem(INVITE_TOKEN_KEY);
          sessionStorage.removeItem(INVITED_EMAIL_KEY);
          sessionStorage.removeItem(INVITED_COMPANY_NAME_KEY);
        } catch { /* ignore */ }
        window.location.replace("/biz/dashboard");
        return;
      }

      let stored: PendingCompany | null = pendingCompany;
      if (!stored) {
        try {
          const raw = sessionStorage.getItem(PENDING_COMPANY_KEY);
          if (raw) stored = JSON.parse(raw);
        } catch { /* ignore */ }
      }

      if (stored) {
        try {
          await fetch("/api/biz/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: stored.name, industry: stored.industry || null, genres: stored.genres ?? [] }),
          });
        } catch { /* 企業作成失敗はログのみ */ }
        try { sessionStorage.removeItem(PENDING_COMPANY_KEY); } catch { /* ignore */ }
        window.location.replace(next || "/biz/dashboard");
        return;
      }

      router.replace(next);
    } catch {
      setError("ログインに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={titleStyle}>おかえりなさい。</h2>
        <p style={subtitleStyle}>メールアドレスとパスワードでログインしてください。</p>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 6 }}>求職者アカウントをお持ちの方も同じメール・パスワードでログインできます。</p>
      </div>

      {inviteContext && <InviteBanner companyName={inviteContext.companyName || "企業"} subtitle={`ログインすると自動的にチームに参加します。（${inviteContext.email}）`} />}
      {pendingCompany && <PendingBanner companyName={pendingCompany.name} />}

      {error && <ErrorBox message={error} />}

      {/* ② Google button — TOP, prominent */}
      <button type="button" onClick={handleGoogleLogin} style={googleBtnStyle}>
        <GoogleLogo />
        <span style={{ flex: 1, textAlign: "left" }}>Googleでログイン</span>
        <span style={{
          padding: "2px 8px", borderRadius: 100,
          background: "var(--royal-50)", color: "var(--royal)",
          fontSize: 10, fontWeight: 700, border: "1px solid var(--royal-100)",
          whiteSpace: "nowrap",
        }}>推奨</span>
      </button>

      <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: 10 }}>
        <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
        <span style={{
          fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap",
          padding: "3px 10px", background: "var(--bg-tint)",
          border: "1px solid var(--line)", borderRadius: 100,
        }}>または</span>
        <div style={{ flex: 1, height: 1.5, background: "var(--line)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="メールアドレス" htmlFor="biz-login-email" />
          <input id="biz-login-email" type="email" inputMode="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            autoComplete="email" style={inputStyle}
            onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
        </div>

        <div style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <FieldLabel label="パスワード" htmlFor="biz-login-password" />
            <a href="/auth/reset-password" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}>
              お忘れですか？
            </a>
          </div>
          <div style={{ position: "relative" }}>
            <input id="biz-login-password" type={showPassword ? "text" : "password"} required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード" autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 42 }}
              onFocus={(e) => applyFocusStyle(e.currentTarget)} onBlur={(e) => removeFocusStyle(e.currentTarget)} />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ ...submitBtnStyle, marginTop: 20, opacity: loading ? 0.7 : 1 }}>
          {loading
            ? (pendingCompany ? "企業を作成中..." : "ログイン中...")
            : (pendingCompany ? "ログインして企業を作成" : "ログイン")}
        </button>
      </form>

      <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-mute)", marginTop: 20 }}>
        アカウントをお持ちでない方は{" "}
        <a
          href="/auth?next=/biz/companies/add/new"
          style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}
        >
          無料会員登録はこちら →
        </a>
      </div>
    </div>
  );
}

// ── 共通 UI パーツ ─────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.37-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const STEP_LABELS = ["アカウント情報", "企業情報"];

// ③ ステップインジケーター — 番号付き円形ステップ
function StepIndicator({ current, total }: { current: number; total: number }) {
  const trackItems: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const stepNum = i + 1;
    const isDone = stepNum < current;
    const isActive = stepNum === current;
    trackItems.push(
      <div key={`c-${i}`} style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: isDone ? "var(--success)" : isActive ? "var(--royal)" : "var(--line)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800,
        color: isDone || isActive ? "#fff" : "var(--ink-mute)",
        boxShadow: isActive ? "0 0 0 4px var(--royal-50)" : "none",
        transition: "all 0.3s",
      }}>
        {isDone ? "✓" : stepNum}
      </div>
    );
    if (i < total - 1) {
      trackItems.push(
        <div key={`l-${i}`} style={{
          flex: 1, height: 2, borderRadius: 99,
          background: isDone ? "var(--success)" : "var(--line)",
          transition: "background 0.3s",
        }} />
      );
    }
  }
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {trackItems}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {STEP_LABELS.slice(0, total).map((label, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < current;
          const isActive = stepNum === current;
          return (
            <span key={label} style={{
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--royal)" : isDone ? "var(--success)" : "var(--ink-mute)",
            }}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function InviteBanner({ companyName, subtitle }: { companyName: string; subtitle?: string }) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "12px 14px",
      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      borderRadius: 9, marginBottom: 16, animation: "bizSlideIn 0.3s ease-out",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: "var(--royal)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)", fontWeight: 700, display: "block", marginBottom: 2 }}>
          {companyName} から招待されています
        </strong>
        {subtitle || `登録後、自動的に ${companyName} のチームに参加します。`}
      </div>
    </div>
  );
}

function PendingBanner({ companyName }: { companyName: string }) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "12px 14px",
      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      borderRadius: 9, marginBottom: 16, animation: "bizSlideIn 0.3s ease-out",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: "var(--royal)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)", fontWeight: 700, display: "block", marginBottom: 2 }}>
          ログインして「{companyName}」を作成します
        </strong>
        ログインすると、入力済みの企業情報で企業アカウントを作成します。
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" aria-live="polite" style={{
      fontSize: 12, color: "var(--error)",
      padding: "10px 14px", background: "var(--error-soft)",
      borderRadius: 9, marginBottom: 14,
      border: "1px solid #FECACA", lineHeight: 1.6,
    }}>
      {message}
    </div>
  );
}

// ⑦ Simplified unified account notice — one concise line
function SimplifiedAccountNotice() {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "10px 14px",
      background: "var(--bg-tint)", border: "1px solid var(--line)",
      borderRadius: 9, marginBottom: 4,
    }}>
      <div style={{
        width: 22, height: 22, background: "var(--royal-50)", color: "var(--royal)",
        borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
        既に個人アカウントをお持ちの方は、同じメールでビジネスアカウントとしてもご利用いただけます。
      </p>
    </div>
  );
}

type ExistingUserNoticeProps = {
  email: string;
  onSwitchToLogin: (email?: string) => void;
  onChangeEmail: () => void;
};

function ExistingUserNotice({ email, onSwitchToLogin, onChangeEmail }: ExistingUserNoticeProps) {
  return (
    <div style={{
      display: "flex", gap: 10, padding: "14px 16px",
      background: "var(--royal-50)", border: "1px solid var(--royal-100)",
      borderRadius: 10, marginBottom: 14, animation: "bizSlideIn 0.3s ease-out",
    }}>
      <div style={{
        width: 28, height: 28, background: "var(--royal)", color: "#fff",
        borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 4 }}>
          このメールアドレスはすでに登録されています
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 10 }}>
          <strong style={{ color: "var(--ink)" }}>{email}</strong> はすでに登録済みです。
          ログインして企業情報を追加できます。
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button type="button" onClick={() => onSwitchToLogin(email)} style={{
            padding: "7px 12px", background: "var(--royal)", color: "#fff",
            border: "none", borderRadius: 6, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            ログインへ切り替え
          </button>
          <button type="button" onClick={onChangeEmail} style={{
            padding: "7px 12px", background: "transparent", color: "var(--ink-soft)",
            border: "1px solid var(--line)", borderRadius: 6, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>
            メールを変更
          </button>
        </div>
      </div>
    </div>
  );
}

// 成果報酬の開示ボックス
function FeeDisclosure() {
  return (
    <div style={{
      marginTop: 18,
      borderRadius: 10,
      border: "1.5px solid #FCD34D",
      background: "var(--warm-soft)",
      padding: "14px 16px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        成果報酬について（重要）
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#78350F", lineHeight: 1.9 }}>
        <li>成約（採用決定）が確認できた時点でのみ課金されます</li>
        <li>採用者の<strong>理論年収の 15%</strong> を成果報酬としてご請求します</li>
      </ul>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#92400E", lineHeight: 1.7 }}>
        <strong>「理論年収」とは</strong>、月給・賞与・各種手当を含む、採用者が年間に受け取る想定総額を指します。掲載費・候補者閲覧費は一切かかりません。
      </p>
    </div>
  );
}

// 同意チェックボックス
function ConsentCheckbox({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        marginTop: 12, cursor: "pointer",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1.5px solid ${checked ? "var(--royal)" : "var(--line)"}`,
        background: checked ? "var(--royal-50)" : "#fff",
        transition: "border-color .15s, background .15s",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: "var(--royal)", flexShrink: 0, width: 15, height: 15 }}
      />
      <span style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.7 }}>
        {label}
      </span>
    </label>
  );
}

// ⑥ Implicit consent — no checkbox
function ImplicitConsent() {
  return (
    <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.8, marginTop: 12 }}>
      登録することで{" "}
      <a href="/terms/business" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>利用規約（掲載企業向け）</a>
      {" "}および{" "}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>プライバシーポリシー</a>
      {" "}に同意したものとみなします。
    </p>
  );
}

function SwitchRow({ label, action, onClick }: { label: string; action: string; onClick: () => void }) {
  return (
    <div style={{
      textAlign: "center", marginTop: 20, paddingTop: 16,
      borderTop: "1px solid var(--line)",
    }}>
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{label}</span>
      {" "}
      <button type="button" onClick={onClick} style={{
        background: "var(--royal-50)", border: "1.5px solid var(--royal-100)",
        color: "var(--royal)", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit", fontSize: 12,
        padding: "4px 12px", borderRadius: 100,
      }}>
        {action} →
      </button>
    </div>
  );
}

function FieldLabel({ label, required, htmlFor }: { label: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 6,
    }}>
      {label}
      {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
    </label>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} title={visible ? "非表示" : "表示"} style={{
      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
      color: "var(--ink-mute)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", padding: 0,
    }}>
      {visible ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

// ⑩ Mobile sticky CTA bar
function MobileStickyBar({ label, formId }: { label: string; formId?: string }) {
  return (
    <div
      className="biz-mobile-cta"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--line)",
        zIndex: 50,
      }}
    >
      <button
        type="submit"
        form={formId}
        style={{ ...submitBtnStyle, width: "100%" }}
      >
        {label}
      </button>
    </div>
  );
}

// ── スタイル定数 ─────────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-noto-serif)", fontWeight: 700, fontSize: 24,
  color: "var(--ink)", marginBottom: 6, letterSpacing: "0.02em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8,
};

// ④ Google button — prominent, slightly larger
const googleBtnStyle: React.CSSProperties = {
  width: "100%", padding: "15px 18px",
  background: "#fff", color: "var(--ink)",
  border: "1.5px solid #dadce0", borderRadius: 10,
  fontFamily: "inherit", fontSize: 15, fontWeight: 600,
  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
  boxShadow: "0 3px 10px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.07)",
  transition: "box-shadow 0.2s",
};

// ⑧ Submit button with updated style
const submitBtnStyle: React.CSSProperties = {
  width: "100%", padding: "14px",
  background: "var(--royal)", color: "#fff",
  border: "none", borderRadius: 10,
  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
  cursor: "pointer", transition: "all 0.2s",
  boxShadow: "0 4px 14px rgba(0,35,102,0.2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px",
  border: "1.5px solid var(--line)", borderRadius: 9,
  fontFamily: "inherit", fontSize: 13,
  color: "var(--ink)", background: "#fff",
  transition: "all 0.15s", outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none", cursor: "pointer", paddingRight: 32,
  minWidth: 0,
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};


function applyFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--royal)";
  el.style.boxShadow = "0 0 0 3px var(--royal-50)";
}

function removeFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--line)";
  el.style.boxShadow = "none";
}

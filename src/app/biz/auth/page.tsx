"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GenreChipSelector, { type Genre } from "@/components/ui/GenreChipSelector";

type Mode = "signup" | "login";

// sessionStorage に一時保存する「登録フロー引き継ぎ企業情報」の型
type PendingCompany = {
  name: string;
  industry: string;
  employeeCount: string;
  genres: string[];  // slug 配列（PR-β Phase 4 で追加）
};
const PENDING_COMPANY_KEY = "opinio_biz_pending_company";

// 招待フロー用 sessionStorage キー (AcceptInviteClient と同じ値を使う)
const INVITE_TOKEN_KEY = "opinio_biz_invite_token";
const INVITED_EMAIL_KEY = "opinio_biz_invited_email";
const INVITED_COMPANY_NAME_KEY = "opinio_biz_invited_company_name";

// 招待コンテキスト（AcceptInviteClient から引き継がれる）
type InviteContext = {
  token: string;
  email: string;
  companyName: string;
};

const PERSONAL_DOMAINS = ["gmail.com", "yahoo.co.jp", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];

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
  // context=invite の場合、招待フロー専用モードで動作する
  const isInviteContext = searchParams.get("context") === "invite";

  const [mode, setMode] = useState<Mode>(modeParam === "login" ? "login" : "signup");

  // Phase 1: メアド重複時にサインアップ→ログインへ切り替える際の引き継ぎ状態
  const [prefillEmail, setPrefillEmail] = useState("");
  const [pendingCompany, setPendingCompany] = useState<PendingCompany | null>(null);

  // Phase 6-7: 招待フロー context
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);

  // Phase 1: ページマウント時に sessionStorage の残留データを確認
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_COMPANY_KEY);
      if (stored) {
        const parsed: PendingCompany = JSON.parse(stored);
        setPendingCompany(parsed);
        // 未ログイン状態で pending が残っている場合はログインタブへ誘導
        setMode("login");
      }
    } catch {
      // ignore
    }
  }, []);

  // Phase 6-7: context=invite の場合に sessionStorage から招待情報を読み込む
  useEffect(() => {
    if (!isInviteContext) return;
    try {
      const token = sessionStorage.getItem(INVITE_TOKEN_KEY) ?? "";
      const email = sessionStorage.getItem(INVITED_EMAIL_KEY) ?? "";
      const companyName = sessionStorage.getItem(INVITED_COMPANY_NAME_KEY) ?? "";
      if (token && email) {
        setInviteContext({ token, email, companyName });
        // ログインモードで来た場合は login タブを開く
        if (modeParam === "login") setMode("login");
      }
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInviteContext]);

  // Phase 1: サインアップ→ログイン切り替えハンドラー（企業情報を sessionStorage に保存済み前提）
  function handleSwitchToLogin(email?: string) {
    try {
      const stored = sessionStorage.getItem(PENDING_COMPANY_KEY);
      if (stored) setPendingCompany(JSON.parse(stored));
    } catch {
      // ignore
    }
    if (email) setPrefillEmail(email);
    setMode("login");
  }

  // Phase 5: ログイン済みチェック — 企業所属の有無でリダイレクト先を分岐
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      // 企業所属確認（RLS により自分の所属のみ返る）
      const { data: memberships } = await supabase
        .from("ow_company_admins")
        .select("id")
        .limit(1);
      if ((memberships?.length ?? 0) > 0) {
        router.replace(next);
      } else {
        router.replace("/biz/companies/add/new");
      }
    });
  }, [next, router]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
    }}>
      <style>{`
        @media (max-width: 1000px) {
          .biz-auth-layout { grid-template-columns: 1fr !important; }
          .biz-brand-side {
            position: static !important;  /* undo sticky on mobile (single-column layout) */
            height: auto !important;
            min-height: 360px !important;
            padding: 28px 24px !important;
          }
          .biz-brand-title { font-size: 28px !important; margin-bottom: 12px !important; }
          .biz-brand-subtitle { font-size: 12px !important; margin-bottom: 20px !important; }
          .biz-features-grid { gap: 8px !important; }
          .biz-feature-card { padding: 10px 12px !important; }
          .biz-feature-icon { width: 24px !important; height: 24px !important; margin-bottom: 6px !important; }
          .biz-feature-title { font-size: 12px !important; }
          .biz-feature-desc { font-size: 10px !important; }
          .biz-brand-foot { display: none !important; }
          .biz-form-side {
            position: static !important;  /* undo sticky on mobile */
            height: auto !important;
            padding: 28px 20px !important;
          }
          .biz-to-jobseeker { top: 14px !important; right: 14px !important; }
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
      <BrandPanel inviteCompanyName={inviteContext?.companyName ?? null} />
      <FormSide
        mode={mode}
        setMode={setMode}
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

// ── ブランドパネル（左） ────────────────────────────────────────────
function BrandPanel({ inviteCompanyName }: { inviteCompanyName: string | null }) {
  return (
    <div
      className="biz-brand-side"
      style={{
        background: "linear-gradient(135deg, #001A4D 0%, var(--royal) 40%, #3B5FD9 100%)",
        color: "#fff",
        padding: "44px 56px",
        display: "flex",
        flexDirection: "column",
        position: "sticky",  // decouple from right-pane height: always 100vh
        top: 0,
        height: "100vh",
        alignSelf: "start",  // grid: don't stretch to row height
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* 背景グロー */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(255,255,255,0.08) 0%, transparent 45%),
          radial-gradient(circle at 85% 85%, rgba(255,255,255,0.06) 0%, transparent 45%)
        `,
        pointerEvents: "none",
      }} />

      {/* 求職者リンク */}
      <a
        href="/"
        className="biz-to-jobseeker"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          padding: "7px 12px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.85)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
          zIndex: 1,
        }}
      >
        求職者の方はこちら →
      </a>

      {/* ロゴ */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "-0.02em",
          color: "#fff",
        }}>OPINIO</span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          padding: "3px 8px",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 4,
          textTransform: "uppercase" as const,
        }}>BUSINESS</span>
      </div>

      {/* メインコンテンツ */}
      <div style={{ margin: "auto 0", position: "relative" }}>
        <h1
          className="biz-brand-title"
          style={{
            fontFamily: "var(--font-noto-serif)",
            fontWeight: 500,
            fontSize: 46,
            lineHeight: 1.35,
            letterSpacing: "0.02em",
            marginBottom: 18,
            color: "#fff",
          }}
        >
          {inviteCompanyName
            ? <>{inviteCompanyName}<br />への参加。</>
            : <>スカウトしない、<br />採用を。</>
          }
        </h1>
        <p
          className="biz-brand-subtitle"
          style={{
            fontSize: 14,
            lineHeight: 1.9,
            color: "rgba(255,255,255,0.9)",
            maxWidth: 460,
            marginBottom: 36,
          }}
        >
          {inviteCompanyName ? (
            <>
              招待されたメンバーとして OPINIO を始めましょう。<br />
              <span style={{ opacity: 0.8, fontSize: 13 }}>
                ※ 招待されたメールアドレスと同じアドレスでご登録ください。
              </span>
            </>
          ) : (
            <>
              OPINIOは、企業と個人が対等に対話する場所。<br />
              <strong style={{ color: "#fff", fontWeight: 600 }}>スカウトを送らなくても、本当にフィットする人材が来る採用</strong>を実現します。<br />
              まずは企業情報を登録して、OPINIOの世界を体験してください。<br /><br />
              <span style={{ opacity: 0.8, fontSize: 13 }}>※ 既に個人アカウントをお持ちの方も、同じメールでご利用いただけます。</span>
            </>
          )}
        </p>

        {/* 4特徴カード（招待モードでは非表示） */}
        {!inviteCompanyName && <div
          className="biz-features-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            maxWidth: 500,
          }}
        >
          {[
            {
              title: "スカウト不要",
              desc: "本人から直接コンタクトが来ます。採用担当者の業務時間を奪いません。",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4L12 14.01 9 11.01" />
                </svg>
              ),
            },
            {
              title: "マッチ候補者の可視化",
              desc: "求人条件にフィットしそうな登録ユーザーが、一覧で見えます。",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              ),
            },
            {
              title: "自然言語検索",
              desc: "「大企業開拓の営業」で検索した人にも、エンタープライズセールス求人が届く。",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              ),
            },
            {
              title: "編集部が取材",
              desc: "OPINIO編集部が第三者視点で御社を取材。深い記事が対話のきっかけに。",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              ),
            },
          ].map((card) => (
            <div
              key={card.title}
              className="biz-feature-card"
              style={{
                padding: "14px 16px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
              }}
            >
              <div
                className="biz-feature-icon"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                {card.icon}
              </div>
              <div className="biz-feature-title" style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#fff" }}>
                {card.title}
              </div>
              <div className="biz-feature-desc" style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>}
      </div>

      {/* フッター */}
      <div
        className="biz-brand-foot"
        style={{ marginTop: "auto", fontSize: 11, color: "rgba(255,255,255,0.55)", paddingTop: 32 }}
      >
        © 2026 OPINIO · 企業向け採用プラットフォーム
      </div>
    </div>
  );
}

// ── フォームサイド（右） ──────────────────────────────────────────
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
        padding: "64px 48px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        background: "#fff",
        position: "sticky",   // mirror BrandPanel: decouple from grid row height
        top: 0,
        height: "100vh",      // always exactly 100vh — grid row stays at 100vh; no page scrollbar
        alignSelf: "start",
        overflowX: "hidden",
        overflowY: "auto",
        scrollbarGutter: "stable",   // reserve scrollbar space even when hidden → no layout shift
        minWidth: 0,
      }}
    >
      <div style={{ maxWidth: 440, margin: "0 auto", width: "100%" }}>
        <ModeTabBar mode={mode} onChange={setMode} />
        {mode === "signup" ? (
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
    </div>
  );
}

// ── モード切替タブ ────────────────────────────────────────────────
function ModeTabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{
      display: "flex",
      background: "var(--bg-tint)",
      borderRadius: 10,
      padding: 4,
      marginBottom: 28,
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
              flex: 1,
              padding: "9px",
              background: isActive ? "#fff" : "transparent",
              border: "none",
              borderRadius: 8,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? "var(--royal)" : "var(--ink-soft)",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: isActive ? "0 2px 6px rgba(15,23,42,0.08)" : "none",
            }}
          >
            {m === "signup" ? "新規登録（無料）" : "ログイン"}
          </button>
        );
      })}
    </div>
  );
}

// ── サインアップフォーム ──────────────────────────────────────────
type SignupFormProps = {
  onSwitchToLogin: (email?: string) => void;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function SignupForm({ onSwitchToLogin, next, router, inviteContext }: SignupFormProps) {
  const isInviteMode = inviteContext !== null;
  const isMockMode = process.env.NEXT_PUBLIC_BIZ_MOCK_MODE === "true";

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [genres, setGenres] = useState<string[]>([]);

  // ow_genres をクライアントサイドで取得（全体が "use client" のため useEffect パターンを採用）
  const [availableGenres, setAvailableGenres] = useState<Genre[]>([]);
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ow_genres")
      .select("slug, name, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setAvailableGenres((data ?? []) as any[]));
  }, []);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  // 招待モードではメアドをプリフィル（編集不可）
  const [email, setEmail] = useState(inviteContext?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExistingNotice, setShowExistingNotice] = useState(false);

  const isPersonalDomain = useCallback((addr: string) => {
    const domain = addr.split("@")[1]?.toLowerCase();
    return domain ? PERSONAL_DOMAINS.includes(domain) : false;
  }, []);

  const handleEmailBlur = useCallback(() => {
    // blur 時の重複チェックは不要（submit 時に Supabase が検出）
  }, []);

  const handleEmailChange = useCallback((val: string) => {
    setEmail(val);
    setShowExistingNotice(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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

      // 1. Supabase Auth signUp（ow_users トリガーで自動作成）
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: contactName },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered") || authError.message.includes("User already registered")) {
          if (isInviteMode) {
            // 招待モード: 既存メアド → ログインタブへ（inviteContext は state で保持）
            onSwitchToLogin(email);
          } else {
            // 通常モード: "既存ユーザー" 通知を表示し、企業情報を sessionStorage に退避してログインへ誘導
            setShowExistingNotice(true);
            try {
              const pending: PendingCompany = { name: companyName, industry, employeeCount, genres };
              sessionStorage.setItem(PENDING_COMPANY_KEY, JSON.stringify(pending));
            } catch {
              // sessionStorage 書き込み失敗は無視（プライベートモード等）
            }
          }
          return;
        }
        setError(authError.message);
        return;
      }

      // 2a. 招待モード: 招待トークンを自動受諾して dashboard へ
      if (isInviteMode && inviteContext) {
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
        return;
      }

      // 2b. 通常モード: ow_companies + ow_company_admins 登録
      const res = await fetch("/api/company/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          industry,
          employee_count: employeeCount,
          department: contactTitle,
          role_title: contactTitle,
          genres,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "企業情報の登録に失敗しました。もう一度お試しください。");
        return;
      }

      // 新規登録時は会社が inline で作成済みのため、next を尊重してリダイレクト。
      // window.location.replace でフルページリロード → App Router クライアントキャッシュを
      // バイパスし NoTenantPage のチラ見えを防ぐ。replace で auth ページを履歴から除去。
      window.location.replace(next || "/biz/dashboard");
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const showPersonalWarning = email.includes("@") && isPersonalDomain(email);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 700,
          fontSize: 24,
          color: "var(--ink)",
          marginBottom: 6,
          letterSpacing: "0.02em",
        }}>{isInviteMode ? "参加する。" : "始める。"}</h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          {isInviteMode ? (
            <>招待されたアカウントとして OPINIO に参加します。<br />お名前とパスワードを設定してください。</>
          ) : (
            <>企業情報を登録し、OPINIOで人材との対話を始めましょう。<br />
            登録後、すぐに企業情報の編集やカジュアル面談の受信が可能です。</>
          )}
        </p>
      </div>

      {/* 招待モード: 招待元企業バナー */}
      {isInviteMode && inviteContext?.companyName && (
        <div style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "var(--royal-50)",
          border: "1px solid var(--royal-100)",
          borderRadius: 9,
          marginBottom: 16,
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
              {inviteContext.companyName} から招待されています
            </strong>
            登録後、自動的に {inviteContext.companyName} のチームに参加します。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* 企業名・業種・従業員数: 招待モードでは非表示 */}
        {!isInviteMode && (
          <>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="企業名" required htmlFor="biz-signup-company-name" />
              <input
                id="biz-signup-company-name"
                type="text"
                required
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="株式会社〇〇"
                style={inputStyle}
                onFocus={(e) => applyFocusStyle(e.currentTarget)}
                onBlur={(e) => removeFocusStyle(e.currentTarget)}
              />
            </div>
            <div
              className="biz-form-row"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}
            >
              <div>
                <FieldLabel label="業種" required htmlFor="biz-signup-industry" />
                <select
                  id="biz-signup-industry"
                  required
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  style={selectStyle}
                  onFocus={(e) => applyFocusStyle(e.currentTarget)}
                  onBlur={(e) => removeFocusStyle(e.currentTarget)}
                >
                  <option value="">選択してください</option>
                  {INDUSTRY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel label="従業員数" required htmlFor="biz-signup-employee-count" />
                <select
                  id="biz-signup-employee-count"
                  required
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  style={selectStyle}
                  onFocus={(e) => applyFocusStyle(e.currentTarget)}
                  onBlur={(e) => removeFocusStyle(e.currentTarget)}
                >
                  <option value="">選択してください</option>
                  {EMPLOYEE_COUNT_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 企業ジャンル（任意）*/}
            <div style={{ marginBottom: 16 }}>
              <FieldLabel label="企業ジャンル" />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
                該当するジャンルを選択してください（任意・複数選択可）。
              </div>
              {/* ロード完了後にチップ群が現れる（方式X: チップ取得前は非表示） */}
              {availableGenres.length > 0 && (
                <GenreChipSelector
                  genres={availableGenres}
                  selected={genres}
                  onChange={setGenres}
                />
              )}
            </div>
          </>
        )}

        {/* 担当者名 */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel label="ご担当者のお名前" required htmlFor="biz-contact-name" />
          <input
            id="biz-contact-name"
            type="text"
            required
            value={contactName}
            autoComplete="name"
            onChange={(e) => setContactName(e.target.value)}
            placeholder="山田 太郎"
            style={inputStyle}
            onFocus={(e) => applyFocusStyle(e.currentTarget)}
            onBlur={(e) => removeFocusStyle(e.currentTarget)}
          />
          <div style={hintStyle}>採用担当者・人事担当者の方の氏名をご入力ください。</div>
        </div>

        {/* 部署・役職 */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel label="部署・役職" required htmlFor="biz-contact-title" />
          <input
            id="biz-contact-title"
            type="text"
            required
            value={contactTitle}
            autoComplete="organization-title"
            onChange={(e) => setContactTitle(e.target.value)}
            placeholder="例：人事部 採用マネージャー"
            style={inputStyle}
            onFocus={(e) => applyFocusStyle(e.currentTarget)}
            onBlur={(e) => removeFocusStyle(e.currentTarget)}
          />
        </div>

        {/* 企業メールアドレス: 招待モードではプリフィル＋readOnly */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel label={isInviteMode ? "メールアドレス（招待先）" : "企業メールアドレス"} required htmlFor="biz-signup-email" />
          <input
            id="biz-signup-email"
            type="email"
            required
            readOnly={isInviteMode}
            value={email}
            autoComplete="email"
            onChange={(e) => !isInviteMode && handleEmailChange(e.target.value)}
            onBlur={!isInviteMode ? handleEmailBlur : undefined}
            placeholder="yamada@your-company.co.jp"
            aria-describedby="biz-signup-email-hint"
            style={{
              ...inputStyle,
              ...(isInviteMode ? { background: "var(--bg-tint)", color: "var(--ink-soft)", cursor: "not-allowed" } : {}),
            }}
            onFocus={(e) => !isInviteMode && applyFocusStyle(e.currentTarget)}
          />
          {showPersonalWarning && (
            <div id="biz-signup-email-hint" role="alert" style={{ ...hintStyle, color: "var(--warm)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>企業ドメインのメールアドレスをご入力ください（gmail・yahoo等の個人アドレスはご利用いただけません）
            </div>
          )}
          {!showPersonalWarning && (
            <div id="biz-signup-email-hint" style={hintStyle}>企業ドメインのメールアドレスをご入力ください。</div>
          )}
          {showExistingNotice && (
            <ExistingUserNotice
              email={email}
              onSwitchToLogin={onSwitchToLogin}
              onChangeEmail={() => {
                setEmail("");
                setShowExistingNotice(false);
              }}
            />
          )}
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel label="パスワード" required htmlFor="biz-signup-password" />
          <div style={{ position: "relative" }}>
            <input
              id="biz-signup-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              aria-describedby="biz-signup-password-hint"
              style={{ ...inputStyle, paddingRight: 42 }}
              onFocus={(e) => applyFocusStyle(e.currentTarget)}
              onBlur={(e) => removeFocusStyle(e.currentTarget)}
            />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
          <div id="biz-signup-password-hint" style={hintStyle}>8文字以上。英数字を組み合わせてください。</div>
        </div>

        {/* unified-account-notice: 招待モードでは不要 */}
        {!isInviteMode && <UnifiedAccountNotice />}

        {/* 利用規約 */}
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          marginTop: 12,
          fontSize: 11,
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          marginBottom: 8,
        }}>
          <input
            type="checkbox"
            id="biz-signup-terms"
            required
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{
              width: 16,
              height: 16,
              accentColor: "var(--royal)",
              flexShrink: 0,
              marginTop: 1,
              cursor: "pointer",
            }}
          />
          <label htmlFor="biz-signup-terms">
            <a href="#" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 500 }}>利用規約</a>、
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 500 }}>プライバシーポリシー</a>に同意します
          </label>
        </div>

        {/* エラー */}
        {error && (
          <div role="alert" aria-live="polite" style={{
            fontSize: 12,
            color: "var(--error)",
            padding: "8px 12px",
            background: "var(--error-soft)",
            borderRadius: 8,
            marginBottom: 8,
            marginTop: 4,
          }}>
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 13,
            background: "var(--royal)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            transition: "all 0.2s",
            marginTop: 8,
            boxShadow: "0 4px 14px rgba(0,35,102,0.2)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>

      {/* モード切替フッター */}
      <div style={{
        textAlign: "center",
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--line)",
        fontSize: 12,
        color: "var(--ink-soft)",
      }}>
        すでにアカウントをお持ちの方は
        <button
          type="button"
          onClick={() => onSwitchToLogin()}
          style={{
            background: "none",
            border: "none",
            color: "var(--royal)",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            marginLeft: 6,
            padding: 0,
          }}
        >
          ログイン
        </button>
      </div>
    </div>
  );
}

// ── ログインフォーム ──────────────────────────────────────────────
type LoginFormProps = {
  onSwitchToSignup: () => void;
  prefillEmail: string;
  pendingCompany: PendingCompany | null;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

// ── Google ロゴ SVG ──────────────────────────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.16C6.51 42.62 14.62 48 24 48z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.16C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.75l7.97-6.16z"/>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.16C12.43 13.72 17.74 9.5 24 9.5z"/>
    </svg>
  );
}

function LoginForm({ onSwitchToSignup, prefillEmail, pendingCompany, next, router, inviteContext }: LoginFormProps) {
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

      // Phase 7: ログイン成功後 — 招待トークンがあれば自動受諾（最優先）
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

      // Phase 2: 招待なし — sessionStorage に pending company があれば企業を作成してからリダイレクト
      let stored: PendingCompany | null = pendingCompany;
      if (!stored) {
        try {
          const raw = sessionStorage.getItem(PENDING_COMPANY_KEY);
          if (raw) stored = JSON.parse(raw);
        } catch {
          // ignore
        }
      }

      if (stored) {
        // 企業作成（/api/biz/companies は認証済みユーザー前提）
        try {
          await fetch("/api/biz/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: stored.name,
              industry: stored.industry || null,
              genres: stored.genres ?? [],
            }),
          });
        } catch {
          // 企業作成失敗はログのみ — ダッシュボードで再試行できる
        }
        try {
          sessionStorage.removeItem(PENDING_COMPANY_KEY);
        } catch {
          // ignore
        }
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
        <h2 style={{
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 700,
          fontSize: 24,
          color: "var(--ink)",
          marginBottom: 6,
          letterSpacing: "0.02em",
        }}>おかえりなさい。</h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          企業メールアドレスとパスワードでログインしてください。
        </p>
      </div>

      {/* Phase 7: invite バナー（招待フロー専用） */}
      {inviteContext && (
        <div style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "var(--royal-50)",
          border: "1px solid var(--royal-100)",
          borderRadius: 9,
          marginBottom: 16,
          animation: "bizSlideIn 0.3s ease-out",
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
              {inviteContext.companyName || "企業"} への招待
            </strong>
            ログインすると、自動的にチームに参加します。
            招待先のメールアドレス（{inviteContext.email}）でログインしてください。
          </div>
        </div>
      )}

      {/* Phase 2: pending company バナー */}
      {pendingCompany && (
        <div style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px",
          background: "var(--royal-50)",
          border: "1px solid var(--royal-100)",
          borderRadius: 9,
          marginBottom: 16,
          animation: "bizSlideIn 0.3s ease-out",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "var(--royal)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--ink)", fontWeight: 700, display: "block", marginBottom: 2 }}>
              ログインして「{pendingCompany.name}」を作成します
            </strong>
            このメールアドレスはすでに OPINIO に登録されています。
            ログインすると、入力済みの企業情報で企業アカウントを作成します。
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* メール */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel label="企業メールアドレス" htmlFor="biz-login-email" />
          <input
            id="biz-login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="yamada@your-company.co.jp"
            autoComplete="email"
            style={inputStyle}
            onFocus={(e) => applyFocusStyle(e.currentTarget)}
            onBlur={(e) => removeFocusStyle(e.currentTarget)}
          />
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: 8 }}>
          <FieldLabel label="パスワード" htmlFor="biz-login-password" />
          <div style={{ position: "relative" }}>
            <input
              id="biz-login-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 42 }}
              onFocus={(e) => applyFocusStyle(e.currentTarget)}
              onBlur={(e) => removeFocusStyle(e.currentTarget)}
            />
            <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>

        {/* パスワード忘れ */}
        <div style={{ textAlign: "right", marginBottom: 12 }}>
          <a href="/auth/reset-password" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}>
            パスワードをお忘れですか？
          </a>
        </div>

        {/* エラー */}
        {error && (
          <div role="alert" aria-live="polite" style={{
            fontSize: 12,
            color: "var(--error)",
            padding: "8px 12px",
            background: "var(--error-soft)",
            borderRadius: 8,
            marginBottom: 8,
          }}>
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 13,
            background: "var(--royal)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            transition: "all 0.2s",
            marginTop: 8,
            boxShadow: "0 4px 14px rgba(0,35,102,0.2)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? (pendingCompany ? "企業を作成中..." : "ログイン中...")
            : (pendingCompany ? "ログインして企業を作成" : "ログイン")}
        </button>
      </form>

      {/* Google OAuth */}
      <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>または</span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <button
        type="button"
        onClick={handleGoogleLogin}
        style={{
          width: "100%",
          padding: "11px 16px",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: "inherit",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--ink)",
          cursor: "pointer",
          transition: "all 0.15s",
          marginBottom: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
      >
        <GoogleLogo />
        Google でログイン
      </button>

      {/* モード切替フッター */}
      <div style={{
        textAlign: "center",
        marginTop: 24,
        paddingTop: 20,
        borderTop: "1px solid var(--line)",
        fontSize: 12,
        color: "var(--ink-soft)",
      }}>
        アカウントをお持ちでない方は
        <button
          type="button"
          onClick={onSwitchToSignup}
          style={{
            background: "none",
            border: "none",
            color: "var(--royal)",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 12,
            marginLeft: 6,
            padding: 0,
          }}
        >
          新規登録（無料）
        </button>
      </div>
    </div>
  );
}

// ── 共通 UI パーツ ────────────────────────────────────────────────

function UnifiedAccountNotice() {
  return (
    <div style={{
      display: "flex",
      gap: 10,
      padding: "12px 14px",
      background: "var(--bg-tint)",
      border: "1px solid var(--line)",
      borderRadius: 9,
      marginTop: 14,
      marginBottom: 4,
    }}>
      <div style={{
        width: 26,
        height: 26,
        background: "var(--royal-50)",
        color: "var(--royal)",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      </div>
      <div style={{ flex: 1, fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)", fontWeight: 700 }}>OPINIOアカウントは1つ。</strong>
        あなたのキャリア情報（プロフィール・職歴）は、企業担当者としての情報と共通で管理されます。
        採用候補者からは「採用担当者のキャリア」として見られるため、
        <strong style={{ color: "var(--ink)", fontWeight: 700 }}>信頼の基盤</strong>になります。
      </div>
    </div>
  );
}

type ExistingUserNoticeProps = {
  email: string;
  onSwitchToLogin: () => void;
  onChangeEmail: () => void;
};

function ExistingUserNotice({ email, onSwitchToLogin, onChangeEmail }: ExistingUserNoticeProps) {
  return (
    <div style={{
      display: "flex",
      gap: 10,
      padding: "14px 16px",
      background: "var(--royal-50)",
      border: "1px solid var(--royal-100)",
      borderRadius: 10,
      marginTop: 10,
      animation: "bizSlideIn 0.3s ease-out",
    }}>
      <div style={{
        width: 28,
        height: 28,
        background: "var(--royal)",
        color: "#fff",
        borderRadius: 7,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 4 }}>
          このメールアドレスはすでに登録されています
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 10 }}>
          <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{email}</strong> はすでに
          OPINIO アカウントに紐付いています。ログインして企業情報を追加できます。
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button
            type="button"
            onClick={() => onSwitchToLogin()}
            style={{
              padding: "7px 12px",
              background: "var(--royal)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ログインへ切り替え
          </button>
          <button
            type="button"
            onClick={onChangeEmail}
            style={{
              padding: "7px 12px",
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            別のメールを入力
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, required, htmlFor }: { label: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      color: "var(--ink)",
      marginBottom: 6,
    }}>
      {label}
      {required && <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>}
    </label>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? "非表示" : "表示"}
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--ink-mute)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "none",
        background: "transparent",
        padding: 0,
      }}
    >
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

// ── スタイルヘルパー ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: "1.5px solid var(--line)",
  borderRadius: 9,
  fontFamily: "inherit",
  fontSize: 13,
  color: "var(--ink)",
  background: "#fff",
  transition: "all 0.15s",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
  paddingRight: 32,
  minWidth: 0,  // override browser default min-size based on option text
  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--ink-mute)",
  marginTop: 4,
  lineHeight: 1.6,
};

function applyFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--royal)";
  el.style.boxShadow = "0 0 0 3px var(--royal-50)";
}

function removeFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--line)";
  el.style.boxShadow = "none";
}

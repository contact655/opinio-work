"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmRedirectTo } from "@/lib/auth/redirects";

type Mode = "signup" | "login";

const PENDING_COMPANY_KEY = "opinio_biz_pending_company";

const INVITE_TOKEN_KEY = "opinio_biz_invite_token";
const INVITED_EMAIL_KEY = "opinio_biz_invited_email";
const INVITED_COMPANY_NAME_KEY = "opinio_biz_invited_company_name";

type InviteContext = {
  token: string;
  email: string;
  companyName: string;
};





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
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);
  const [loggedInCompanyName] = useState("");
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
  onSwitchToLogin: (email?: string) => void;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function FormSide({ mode, setMode, prefillEmail, onSwitchToLogin, next, router, inviteContext }: FormSideProps) {
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
          <SignupForm onSwitchToLogin={onSwitchToLogin} inviteContext={inviteContext} />
        ) : (
          <LoginForm
            onSwitchToSignup={() => setMode("signup")}
            prefillEmail={prefillEmail}
            next={next}
            router={router}
            inviteContext={inviteContext}
          />
        )}
      </div>

      {/* ⑨ Minimal footer */}
      <div style={{ textAlign: "center", padding: "24px 0 12px", fontSize: 11, color: "var(--ink-mute)", marginTop: "auto" }}>
        <a href="/terms/listing" style={{ color: "var(--ink-mute)", textDecoration: "none", marginRight: 16 }}>掲載利用規約</a>
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
  /* ⚠️ **null を受けない。** このフォームは招待の受諾専用で、FormSide が
        `inviteContext &&` で絞ってから描画する。null 許容に戻すと
        「常に true の分岐」が復活する。 */
  inviteContext: InviteContext;
};

function SignupForm({ onSwitchToLogin, inviteContext }: SignupFormProps) {
  /* ⚠️ ここにあった step / 企業名 / 業種 / 従業員数 / 規約同意の state は
        2026-08-25 に削除した（step 2 ごと到達不能だったため）。
        企業作成に要る入力は `/biz/companies/add/new` が持っている。 */
  const [email] = useState(inviteContext.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [contactName, setContactName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingCompany, setExistingCompany] = useState<{ id: string; name: string; adminCount: number } | null>(null);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [joinRequestLoading, setJoinRequestLoading] = useState(false);
  /*
    メール確認が有効な環境では signUp はセッションを返さない。
    そのまま次の画面へ飛ばすと、担当者は「登録できたのに何も操作できない画面」に着く。
    ⚠️ /biz/companies/add/new は BizLayout の MEMBERSHIP_EXEMPT なので
       未ログインでも 200 で描画される。ログインへ弾かれもせず、
       プリフィルだけが空の会社作成フォームが出る（最も分かりにくい壊れ方）。
    セッションが無いときはここで止め、確認メールを開いてもらう。
  */
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);


  // ② Google OAuth
  /* 送信。⚠️ このフォームは**招待の受諾専用**（SignupForm は inviteContext が
        非 null のときだけ描画される）。分岐は要らない。 */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    handleInviteSubmit();
  }

  // Invite mode submit (single step)
  async function handleInviteSubmit() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      /*
        ⚠️ 着地先を /biz/dashboard にしないこと。
           確認メールを開いた時点では招待をまだ受諾していないので企業に所属しておらず、
           BizLayout が /biz/companies/add へ飛ばす。招待元に参加すべき人が
           「新しい会社を作る」画面に着き、重複企業を作ってしまう。
           招待受諾ページに戻せば、そこで受諾まで完結する
           （このページは MEMBERSHIP_EXEMPT かつ token だけで動くので、
            sessionStorage が無い別ブラウザで開いても通る）。
      */
      const inviteNext = inviteContext
        ? `/biz/auth/accept-invite?token=${encodeURIComponent(inviteContext.token)}`
        : "/biz/dashboard";
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: contactName },
          emailRedirectTo: confirmRedirectTo(location.origin, inviteNext),
        },
      });
      if (authError) {
        if (authError.message.includes("already registered") || authError.message.includes("User already registered")) {
          onSwitchToLogin(email);
          return;
        }
        setError(authError.message);
        return;
      }
      /*
        ⚠️ 「メール列挙の防止」が有効だと、登録済みアドレスでもエラーにならず
           identities が空のダミー user が返る。ここを拾わないと
           「確認メールを送りました」と嘘をつくことになる（メールは届かない）。
      */
      if (data.user?.identities?.length === 0) {
        onSwitchToLogin(email);
        return;
      }
      if (!data.session) {
        // セッションが無いので /api/biz/members/accept は 401 になる。呼ばずに待たせる。
        setConfirmSentTo(email);
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

  // ─── 確認メール送信済み（メール確認が有効な環境） ──────────────────────────
  if (confirmSentTo) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: "var(--success-soft)",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)"
            strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={titleStyle}>確認メールを送りました</h2>
        <p style={{ ...subtitleStyle, marginBottom: 28 }}>
          <strong style={{ color: "var(--ink)" }}>{confirmSentTo}</strong> に確認メールを送信しました。<br />
          メール内のリンクを開くと、
          招待の受諾に進めます。
        </p>
        <button
          type="button"
          onClick={() => { setConfirmSentTo(null); onSwitchToLogin(confirmSentTo); }}
          style={{ ...submitBtnStyle, width: "auto", padding: "10px 28px" }}
        >
          ログインへ
        </button>
      </div>
    );
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
  /* ⚠️ **このフォームは招待の受諾専用。** SignupForm は `inviteContext` が非 null の
        ときだけ描画される（page.tsx の FormSide を参照）。
     ⚠️ **企業作成のフォームをここに戻さないこと。**
        企業作成は `/biz/companies/add/new` に一本化してある（6c5e45ca / 2026-07-23）。
        以前はここに通常の新規登録（step 1 → step 2 で企業名・業種・従業員数）があり
        企業を作っていたが、同コミットで新規登録タブを閉じた時点で**到達不能になっていた**。
        気づかれないまま2回改修された（eef1d8c3 / fee3994d）ので 2026-08-25 に削除した。 */
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={titleStyle}>参加する。</h2>
        <p style={subtitleStyle}>
          招待されたアカウントとして OPINIO に参加します。<br />
          お名前とパスワードを設定してください。
        </p>
      </div>

      {inviteContext.companyName && <InviteBanner companyName={inviteContext.companyName} />}

      {error && <ErrorBox message={error} />}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
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

// ── ログインフォーム ─────────────────────────────────────────────────────────
type LoginFormProps = {
  onSwitchToSignup?: () => void;
  prefillEmail: string;
  next: string;
  router: ReturnType<typeof useRouter>;
  inviteContext: InviteContext | null;
};

function LoginForm({ prefillEmail, next, router, inviteContext }: LoginFormProps) {
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

      /* ⚠️ ここにあった「ログイン後に企業を作る」経路は 2026-08-25 に削除した。
            書き込み元だった step 2（新規登録の企業情報フォーム）が
            6c5e45ca（2026-07-23）以降**到達不能**で、この分岐にも入らなかった。
         ⚠️ `PENDING_COMPANY_KEY` 自体は残っている。ログイン済み画面のボタンが
            会社名を書いて `/biz/companies/add/new` へ送り、あちらがプリフィルに使う。
            **企業を作るのは add/new だけ。ここでは作らない。** */
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
            ? "ログイン中..."
            : "ログイン"}
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

// ③ ステップインジケーター — 番号付き円形ステップ
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
/*
 * 掲載サービスの料金の案内。
 *
 * ⚠️ **2026-08-23 に「成果報酬について（重要）／理論年収の15%」から差し替えた。**
 *    掲載サービスの成功報酬は 2026-08-21 の規約改定で廃止済み
 *    （/terms/listing 第4条2項・第6条3項）。**古い記載を戻さないこと。**
 *
 * ⚠️ **金額は `PAID_PLAN_MONTHLY_FEE` から出す。ここに数字を書かない。**
 *    LP（/business の料金セクション）と同じ内容にしてある。片方だけ直さないこと。
 */
// 同意チェックボックス
// ⑥ Implicit consent — no checkbox
function ImplicitConsent() {
  return (
    <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.8, marginTop: 12 }}>
      登録することで{" "}
      <a href="/terms/listing" target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", textDecoration: "underline" }}>掲載利用規約</a>
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


function applyFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--royal)";
  el.style.boxShadow = "0 0 0 3px var(--royal-50)";
}

function removeFocusStyle(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  el.style.borderColor = "var(--line)";
  el.style.boxShadow = "none";
}

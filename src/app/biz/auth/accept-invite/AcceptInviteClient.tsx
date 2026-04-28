"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props =
  | { state: "invalid" | "expired" }
  | { state: "unauthenticated"; token: string; invitedEmail: string; companyName: string }
  | { state: "ready"; token: string; companyName: string }
  | { state: "mismatch"; invitedEmail: string; loggedInEmail: string; token: string };

export function AcceptInviteClient(props: Props) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-tint)",
      fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid var(--line)",
        boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #001A4D 0%, #002366 60%, #3B5FD9 100%)",
          padding: "28px 32px",
          color: "#fff",
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}>
            Opinio <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              padding: "2px 7px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 4,
              textTransform: "uppercase",
              verticalAlign: "middle",
            }}>BUSINESS</span>
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, marginTop: 6 }}>チームへの招待</div>
        </div>

        {/* Body */}
        <div style={{ padding: "32px" }}>
          {props.state === "invalid" && <InvalidState />}
          {props.state === "expired" && <ExpiredState />}
          {props.state === "unauthenticated" && (
            <UnauthenticatedState
              token={props.token}
              invitedEmail={props.invitedEmail}
              companyName={props.companyName}
            />
          )}
          {props.state === "ready" && (
            <ReadyState token={props.token} companyName={props.companyName} />
          )}
          {props.state === "mismatch" && (
            <MismatchState
              invitedEmail={props.invitedEmail}
              loggedInEmail={props.loggedInEmail}
              token={props.token}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Invalid / Expired ──────────────────────────────────────────────

function InvalidState() {
  return (
    <div>
      <StatusIcon type="error" />
      <h1 style={headingStyle}>招待リンクが無効です</h1>
      <p style={bodyStyle}>
        この招待リンクは存在しないか、すでに使用済みです。
        招待者に再送を依頼してください。
      </p>
      <a href="/biz/auth" style={secondaryLinkStyle}>ログインページへ</a>
    </div>
  );
}

function ExpiredState() {
  return (
    <div>
      <StatusIcon type="warning" />
      <h1 style={headingStyle}>招待リンクの有効期限が切れています</h1>
      <p style={bodyStyle}>
        招待リンクは発行から 7 日間有効です。
        招待者に新しいリンクの送付を依頼してください。
      </p>
      <a href="/biz/auth" style={secondaryLinkStyle}>ログインページへ</a>
    </div>
  );
}

// ── Unauthenticated ────────────────────────────────────────────────

function UnauthenticatedState({
  token,
  invitedEmail,
  companyName,
}: {
  token: string;
  invitedEmail: string;
  companyName: string;
}) {
  const encodedNext = encodeURIComponent(`/biz/auth/accept-invite?token=${token}`);
  const loginHref = `/biz/auth?mode=login&next=${encodedNext}`;
  const signupHref = `/biz/auth?next=${encodedNext}`;

  return (
    <div>
      <StatusIcon type="invite" />
      <h1 style={headingStyle}>{companyName} から招待されています</h1>
      <p style={bodyStyle}>
        <strong style={{ color: "var(--ink)" }}>{invitedEmail}</strong> 宛の招待です。
        受諾するには、このメールアドレスでログインまたは新規登録してください。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        <a href={loginHref} style={primaryButtonStyle}>
          ログインして受諾
        </a>
        <a href={signupHref} style={secondaryButtonStyle}>
          新規登録して受諾
        </a>
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 16, lineHeight: 1.7 }}>
        ※ 登録・ログイン後、自動的にこのページに戻ります。
      </p>
    </div>
  );
}

// ── Ready ─────────────────────────────────────────────────────────

function ReadyState({ token, companyName }: { token: string; companyName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/biz/members/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_token: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "受諾処理に失敗しました");
        return;
      }
      window.location.href = data.redirectTo ?? "/biz/dashboard";
    } catch {
      setError("エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <StatusIcon type="ready" />
      <h1 style={headingStyle}>{companyName} に参加しますか？</h1>
      <p style={bodyStyle}>
        招待を受諾すると、{companyName} の管理チームに参加できます。
        ダッシュボードから企業情報の編集や求人管理が行えるようになります。
      </p>

      {error && (
        <div style={{
          fontSize: 12,
          color: "var(--error)",
          padding: "10px 14px",
          background: "var(--error-soft)",
          borderRadius: 8,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={loading}
        style={{
          ...primaryButtonStyle,
          display: "block",
          width: "100%",
          border: "none",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
        } as React.CSSProperties}
      >
        {loading ? "処理中..." : "参加を受諾する"}
      </button>

      <a href="/biz/dashboard" style={{ ...secondaryLinkStyle, display: "block", textAlign: "center", marginTop: 16 }}>
        キャンセル
      </a>
    </div>
  );
}

// ── Mismatch ───────────────────────────────────────────────────────

function MismatchState({
  invitedEmail,
  loggedInEmail,
  token,
}: {
  invitedEmail: string;
  loggedInEmail: string;
  token: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const encodedNext = encodeURIComponent(`/biz/auth/accept-invite?token=${token}`);
    window.location.href = `/biz/auth?mode=login&next=${encodedNext}`;
  }

  return (
    <div>
      <StatusIcon type="warning" />
      <h1 style={headingStyle}>メールアドレスが一致しません</h1>
      <p style={bodyStyle}>
        この招待は <strong style={{ color: "var(--ink)" }}>{invitedEmail}</strong> 宛ですが、
        現在 <strong style={{ color: "var(--ink)" }}>{loggedInEmail}</strong> でログイン中です。
      </p>
      <p style={{ ...bodyStyle, marginTop: 8 }}>
        招待されたメールアドレスでログインし直してください。
      </p>

      <button
        onClick={handleSignOut}
        disabled={loading}
        style={{
          ...primaryButtonStyle,
          display: "block",
          width: "100%",
          border: "none",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
          marginTop: 24,
        } as React.CSSProperties}
      >
        {loading ? "ログアウト中..." : "ログアウトして別のアカウントでログイン"}
      </button>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────

function StatusIcon({ type }: { type: "error" | "warning" | "invite" | "ready" }) {
  const configs = {
    error: { bg: "var(--error-soft)", color: "var(--error)" },
    warning: { bg: "var(--warm-soft)", color: "var(--warm)" },
    invite: { bg: "var(--royal-50)", color: "var(--royal)" },
    ready: { bg: "var(--success-soft)", color: "var(--success)" },
  };
  const { bg, color } = configs[type];

  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 12,
      background: bg,
      color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    }}>
      {type === "error" && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )}
      {type === "warning" && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
      {type === "invite" && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}
      {type === "ready" && (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4L12 14.01 9 11.01" />
        </svg>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: "'Noto Serif JP', serif",
  fontWeight: 700,
  fontSize: 20,
  color: "var(--ink)",
  marginBottom: 12,
  lineHeight: 1.4,
  letterSpacing: "0.01em",
};

const bodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--ink-soft)",
  lineHeight: 1.8,
  margin: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  padding: "13px",
  background: "var(--royal)",
  color: "#fff",
  borderRadius: 10,
  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
  fontSize: 14,
  fontWeight: 700,
  textAlign: "center",
  textDecoration: "none",
  boxShadow: "0 4px 14px rgba(0,35,102,0.2)",
  transition: "opacity 0.15s",
  boxSizing: "border-box",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  padding: "13px",
  background: "#fff",
  color: "var(--royal)",
  border: "1.5px solid var(--royal)",
  borderRadius: 10,
  fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
  fontSize: 14,
  fontWeight: 600,
  textAlign: "center",
  textDecoration: "none",
  transition: "opacity 0.15s",
  boxSizing: "border-box",
};

const secondaryLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--royal)",
  textDecoration: "none",
  fontWeight: 500,
};

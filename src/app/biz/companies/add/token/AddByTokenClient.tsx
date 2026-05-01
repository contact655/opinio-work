"use client";

import { useState } from "react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(s: string): boolean {
  return UUID_RE.test(s.trim());
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: "招待コードの形式が正しくありません",
  LOGIN_REQUIRED: "再度ログインしてください",
  EMAIL_MISMATCH: "ログイン中のメールアドレスが招待先と一致しません",
  TOKEN_NOT_FOUND_OR_USED: "招待コードが見つからないか、既に使用済みです",
  ALREADY_MEMBER: "既にこの会社のメンバーです",
  TOKEN_EXPIRED: "招待コードの有効期限が切れています",
};

export function AddByTokenClient() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = token.trim();
    if (!isValidUUID(trimmed)) {
      setError("招待コードの形式が正しくありません（UUID 形式で入力してください）");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/biz/members/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_token: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data.code as string | undefined;
        setError(
          (code && ERROR_MESSAGES[code]) ?? data.error ?? "受諾処理に失敗しました"
        );
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
    <div style={{ maxWidth: "var(--max-w-form)", margin: "0 auto", padding: "48px 24px" }}>
      {/* 戻るリンク */}
      <a
        href="/biz/companies/add"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
          marginBottom: 32,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        追加方法を選ぶ
      </a>

      {/* アイコン */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--royal-50)", color: "var(--royal)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: "var(--font-noto-serif)",
        fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 8,
      }}>
        招待コードを入力
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
        管理者から受け取った招待コード（UUID 形式）を貼り付けてください。
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
          招待コード
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          spellCheck={false}
          autoComplete="off"
          style={{
            display: "block", width: "100%", padding: "11px 14px",
            fontSize: 13, fontFamily: "'Inter', monospace",
            border: `1.5px solid ${error ? "var(--error)" : "var(--line)"}`,
            borderRadius: 8, outline: "none",
            color: "var(--ink)", background: "#fff",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
        />

        {error && (
          <div style={{
            marginTop: 10, fontSize: 12, color: "var(--error)",
            padding: "9px 12px", background: "var(--error-soft)",
            borderRadius: 6, lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || token.trim() === ""}
          style={{
            display: "block", width: "100%", marginTop: 20,
            padding: "13px",
            background: loading || token.trim() === "" ? "var(--ink-mute)" : "var(--royal)",
            color: "#fff",
            border: "none", borderRadius: 10,
            fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
            fontSize: 14, fontWeight: 700,
            cursor: loading || token.trim() === "" ? "not-allowed" : "pointer",
            transition: "background 0.15s, opacity 0.15s",
            boxShadow: loading || token.trim() === "" ? "none" : "0 4px 14px rgba(0,35,102,0.2)",
            boxSizing: "border-box",
          } as React.CSSProperties}
        >
          {loading ? "参加処理中..." : "参加する"}
        </button>

        <a
          href="/biz/companies/add"
          style={{
            display: "block", textAlign: "center", marginTop: 14,
            fontSize: 13, color: "var(--ink-mute)", textDecoration: "none",
          }}
        >
          キャンセル
        </a>
      </form>
    </div>
  );
}

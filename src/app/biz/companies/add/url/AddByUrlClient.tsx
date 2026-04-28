"use client";

import { useState } from "react";
import { isValidUUID } from "../token/AddByTokenClient";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: "招待コードの形式が正しくありません",
  LOGIN_REQUIRED: "再度ログインしてください",
  EMAIL_MISMATCH: "ログイン中のメールアドレスが招待先と一致しません",
  TOKEN_NOT_FOUND_OR_USED: "招待コードが見つからないか、既に使用済みです",
  ALREADY_MEMBER: "既にこの会社のメンバーです",
  TOKEN_EXPIRED: "招待コードの有効期限が切れています",
};

function extractToken(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

export function AddByUrlClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = extractToken(url);
    if (!token) {
      setError("有効な招待 URL ではありません（https:// から始まる完全な URL を貼り付けてください）");
      return;
    }
    if (!isValidUUID(token)) {
      setError("URL 内の招待コードの形式が正しくありません");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/biz/members/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_token: token }),
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
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px" }}>
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
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>

      <h1 style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 22, fontWeight: 700,
        color: "var(--ink)", marginBottom: 8,
      }}>
        招待 URL を貼り付け
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 32, lineHeight: 1.7 }}>
        メール等で受け取った招待 URL をそのまま貼り付けてください。
        URL から招待コードを自動で取り出します。
      </p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
          招待 URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://opinio.work/biz/auth/accept-invite?token=..."
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
          disabled={loading || url.trim() === ""}
          style={{
            display: "block", width: "100%", marginTop: 20,
            padding: "13px",
            background: loading || url.trim() === "" ? "var(--ink-mute)" : "var(--royal)",
            color: "#fff",
            border: "none", borderRadius: 10,
            fontFamily: "'Noto Sans JP', -apple-system, sans-serif",
            fontSize: 14, fontWeight: 700,
            cursor: loading || url.trim() === "" ? "not-allowed" : "pointer",
            transition: "background 0.15s, opacity 0.15s",
            boxShadow: loading || url.trim() === "" ? "none" : "0 4px 14px rgba(0,35,102,0.2)",
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

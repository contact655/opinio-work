"use client";

import { useState } from "react";
import Link from "next/link";

type Role = "candidate" | "biz";
type Result = { email: string; ok: boolean; error?: string };

export default function AdminInvitePage() {
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<Role>("candidate");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [summary, setSummary] = useState<{ succeeded: number; failed: number } | null>(null);
  const [error, setError] = useState("");

  const emailList = emailsText
    .split(/[\n,]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailList.length === 0) { setError("メールアドレスを1件以上入力してください"); return; }
    if (emailList.length > 50) { setError("一度に招待できるのは50件までです"); return; }

    setLoading(true);
    setError("");
    setResults(null);
    setSummary(null);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: emailList, role, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      setResults(data.results);
      setSummary({ succeeded: data.succeeded, failed: data.failed });
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", fontSize: 14,
    border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#fff", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/admin" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>← 管理TOP</Link>
        <span style={{ color: "#e2e8f0" }}>|</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>ユーザー招待</h1>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
          background: "#DC2626", color: "#fff", letterSpacing: "0.08em",
        }}>ADMIN</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Role */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
            招待するロール
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {(["candidate", "biz"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: `1.5px solid ${role === r ? "#002366" : "#e2e8f0"}`,
                  background: role === r ? "#eff3fc" : "#fff",
                  color: role === r ? "#002366" : "#64748b",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {r === "candidate" ? "👤 求職者" : "🏢 企業担当者（biz）"}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
            {role === "candidate"
              ? "求職者として招待。/auth/callback へリダイレクトされます。"
              : "企業担当者として招待。/biz/auth/callback へリダイレクトされます。"}
          </p>
        </div>

        {/* Emails */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="invite-emails" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
            招待先メールアドレス
            <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 8 }}>（1行1件 または カンマ区切り、最大50件）</span>
          </label>
          <textarea
            id="invite-emails"
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
            rows={6}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          {emailList.length > 0 && (
            <p style={{ fontSize: 12, color: "#3B5FD9", marginTop: 4 }}>
              ✓ {emailList.length} 件のアドレスを検出
            </p>
          )}
        </div>

        {/* Custom message */}
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="invite-message" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
            招待メッセージ
            <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 8 }}>（省略可 — Supabase の招待メールに加えて追加で送信）</span>
          </label>
          <textarea
            id="invite-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="はじめまして。OPINIO 運営の○○です。このたびご招待しますので、ぜひご登録ください。"
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || emailList.length === 0}
          style={{
            padding: "12px 32px", fontSize: 14, fontWeight: 700,
            background: loading || emailList.length === 0 ? "#e2e8f0" : "#002366",
            color: loading || emailList.length === 0 ? "#94a3b8" : "#fff",
            border: "none", borderRadius: 10, cursor: loading || emailList.length === 0 ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "招待中…" : `${emailList.length} 件を招待する`}
        </button>
      </form>

      {/* Results */}
      {summary && (
        <div style={{ marginTop: 32 }}>
          <div style={{
            padding: "14px 20px", borderRadius: 10, marginBottom: 16,
            background: summary.failed === 0 ? "#ecfdf5" : "#fffbeb",
            border: `1px solid ${summary.failed === 0 ? "#a7f3d0" : "#fde68a"}`,
          }}>
            <span style={{ fontWeight: 700, color: summary.failed === 0 ? "#059669" : "#d97706", display: "flex", alignItems: "center", gap: 6 }}>
              {summary.failed === 0
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              }送信完了: {summary.succeeded} 件成功 / {summary.failed} 件失敗
            </span>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            {results?.map((r, i) => (
              <div key={r.email} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", fontSize: 13,
                borderTop: i > 0 ? "1px solid #f1f5f9" : "none",
              }}>
                <span style={{ fontSize: 14 }}>{r.ok ? "✓" : "✗"}</span>
                <span style={{ flex: 1, fontFamily: "monospace", color: "#0f172a" }}>{r.email}</span>
                {r.error && <span style={{ color: "#dc2626", fontSize: 12 }}>{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

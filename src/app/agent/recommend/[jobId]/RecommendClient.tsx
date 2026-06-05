"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  jobId: string;
  jobTitle: string;
  companyName: string;
  agencyName: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  fontSize: 14,
  color: "#0F172A",
  fontFamily: "'Noto Sans JP', sans-serif",
  outline: "none",
  boxSizing: "border-box" as const,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

export function RecommendClient({ jobId, jobTitle, companyName, agencyName }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("候補者氏名を入力してください"); return; }
    if (!email.trim()) { setError("メールアドレスを入力してください"); return; }
    if (!reason.trim()) { setError("推薦理由を入力してください"); return; }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/agent/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        reason: reason.trim(),
        memo: memo.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "送信に失敗しました。もう一度お試しください。");
      return;
    }

    setSuccess(true);
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px" }}>
      {/* Back link */}
      <Link
        href="/agent/dashboard"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "#475569", textDecoration: "none",
          marginBottom: 24,
        }}
      >
        ← ダッシュボードに戻る
      </Link>

      {/* Job info card */}
      <div style={{
        background: "#EFF3FC", border: "1px solid #DCE5F7",
        borderRadius: 12, padding: "16px 20px", marginBottom: 28,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#3B5FD9", letterSpacing: "0.08em", marginBottom: 4 }}>
          推薦先
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--royal)" }}>{jobTitle}</div>
        <div style={{ fontSize: 13, color: "#3B5FD9", marginTop: 2 }}>{companyName}</div>
      </div>

      {success ? (
        <div style={{
          background: "#ECFDF5", border: "1px solid #A7F3D0",
          borderRadius: 14, padding: "40px 32px", textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--success)", marginBottom: 8, fontFamily: "'Noto Serif JP', serif" }}>
            推薦しました！
          </div>
          <div style={{ fontSize: 13, color: "#065F46", lineHeight: 1.7, marginBottom: 24 }}>
            <strong>{name}</strong> さんの推薦を受け付けました。<br />
            企業担当者が確認次第、ご連絡いたします。
          </div>
          <Link
            href="/agent/dashboard"
            style={{
              display: "inline-block", padding: "11px 28px",
              background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
              color: "#fff", textDecoration: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 14,
            }}
          >
            ダッシュボードに戻る
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{
            margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#0F172A",
            fontFamily: "'Noto Serif JP', serif",
          }}>
            候補者を推薦
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
            {agencyName} より推薦
          </p>

          {error && (
            <div style={{
              padding: "10px 14px", background: "#FEE2E2",
              border: "1px solid #FECACA", borderRadius: 8,
              fontSize: 13, color: "#DC2626",
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>候補者氏名 <span style={{ color: "#DC2626" }}>*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>メールアドレス <span style={{ color: "#DC2626" }}>*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="taro@example.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>電話番号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>推薦理由 <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="候補者の強みや、この求人に適している理由を記載してください..."
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={labelStyle}>メモ（社内向け）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="経歴の補足、条件面の確認事項など..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "推薦中..." : "推薦する"}
          </button>
        </form>
      )}
    </div>
  );
}

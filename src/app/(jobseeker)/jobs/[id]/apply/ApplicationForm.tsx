"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  jobTitle: string;
  companyName: string;
  companyGradient: string;
  companyInitial: string;
  authName: string;
  authEmail: string;
};

export default function ApplicationForm({
  jobId,
  jobTitle,
  companyName,
  companyGradient,
  companyInitial,
  authName,
  authEmail,
}: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, phone: phone || undefined, message: message || undefined }),
    });

    if (res.status === 409) {
      setError("この求人にはすでに応募しています。");
      setIsSubmitting(false);
      return;
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "応募に失敗しました。しばらく経ってからお試しください。");
      setIsSubmitting(false);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 16, padding: "48px 40px", textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64,
          background: "linear-gradient(135deg, var(--success), #10B981)",
          borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 20px",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          応募が完了しました
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 32 }}>
          {companyName}の採用担当者があなたの応募を確認します。<br />
          選考状況は「マイページ」の「応募管理」からご確認いただけます。
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/mypage/applications")}
            style={{
              padding: "11px 24px",
              background: "linear-gradient(135deg, var(--royal), var(--accent))",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            応募状況を確認する
          </button>
          <button
            onClick={() => router.push("/jobs")}
            style={{
              padding: "11px 24px",
              background: "#fff", color: "var(--ink)",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            求人を探す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "flex-start" }}>
      {/* Main form */}
      <form onSubmit={handleSubmit}>
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "32px 36px", marginBottom: 16,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-noto-serif)', fontSize: 20, fontWeight: 700,
            color: "var(--ink)", marginBottom: 6,
          }}>
            応募フォーム
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28, lineHeight: 1.8 }}>
            以下の情報を確認・入力して応募を完了してください。
          </p>

          {/* Name — readonly */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
              お名前
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>プロフィールから自動取得</span>
            </div>
            <input
              type="text"
              value={authName}
              readOnly
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontFamily: "inherit", fontSize: 13, color: "var(--ink-soft)",
                background: "var(--bg-tint)", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Email — readonly */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
              メールアドレス
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>認証メールから自動取得</span>
            </div>
            <input
              type="email"
              value={authEmail}
              readOnly
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontFamily: "inherit", fontSize: 13, color: "var(--ink-soft)",
                background: "var(--bg-tint)", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Phone — optional */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
              電話番号
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>任意</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-0000-0000"
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
                background: "#fff", outline: "none", transition: "border-color 0.15s",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Message — optional */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
              志望動機・メッセージ
              <span style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>任意</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`${companyName}に応募した理由や、自己PRをご記入ください。`}
              rows={6}
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontFamily: "inherit", fontSize: 13, color: "var(--ink)",
                background: "#fff", outline: "none", resize: "vertical",
                transition: "border-color 0.15s", lineHeight: 1.7,
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
              {message.length} 文字
            </div>
          </div>

          {error && (
            <div style={{
              padding: "12px 16px", background: "var(--error-soft)",
              border: "1px solid #FECACA", borderRadius: 8,
              fontSize: 13, color: "var(--error)", marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%", padding: "14px 0",
              background: isSubmitting
                ? "var(--line)"
                : "linear-gradient(135deg, var(--royal), var(--accent))",
              color: isSubmitting ? "var(--ink-mute)" : "#fff",
              border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {isSubmitting ? "送信中..." : "この求人に応募する"}
          </button>

          <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            応募後、採用担当者からメールにて連絡が届きます。
          </p>
        </div>
      </form>

      {/* Sidebar: job summary */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "20px", position: "sticky", top: 80,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: companyGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0,
          }}>
            {companyInitial}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2 }}>{companyName}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{jobTitle}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
            名前・メールは自動入力されます
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
            応募後に取り消しできます（マイページから）
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
            選考状況はマイページで確認できます
          </div>
        </div>
      </div>

      <style>{`
        input:focus, textarea:focus {
          border-color: var(--royal) !important;
          box-shadow: 0 0 0 3px var(--royal-50) !important;
        }
        @media (max-width: 860px) {
          form ~ div { display: none; }
        }
      `}</style>
    </div>
  );
}

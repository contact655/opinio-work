"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitConsultationRequest } from "./_actions/submitConsultation";

const CONSULTANTS: Record<string, { name: string }> = {
  shibasan: { name: "柴 久人" },
};

const TIME_PREFS = [
  "平日 午前（9:00〜12:00）",
  "平日 午後（12:00〜18:00）",
  "平日 夜（18:00〜21:00）",
  "土日 午前",
  "土日 午後",
];

export default function CareerConsultationApplyPage() {
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const consultantSlug = searchParams?.get("consultant") ?? "shibasan";
  const consultant = CONSULTANTS[consultantSlug] ?? CONSULTANTS.shibasan;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [timePref, setTimePref] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleTime(t: string) {
    setTimePref(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("お名前とメールアドレスは必須です。");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await submitConsultationRequest({
        consultantName: consultant.name,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        timePref,
      });
      if (result.ok) {
        setDone(true);
      } else {
        setError("送信に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#fff" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--success-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-serif)", marginBottom: 12 }}>
            申し込みを受け付けました
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 28 }}>
            担当アドバイザーより、入力いただいたメールアドレスに3営業日以内にご連絡いたします。
          </p>
          <Link href="/career-consultation" style={{
            display: "inline-block", padding: "10px 28px", borderRadius: 8,
            background: "var(--royal)", color: "#fff",
            fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}>
            キャリア相談トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Back link */}
        <Link href="/career-consultation" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, color: "var(--ink-soft)", textDecoration: "none", marginBottom: 28,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          キャリア相談に戻る
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-serif)", marginBottom: 6 }}>
          日程を確認する
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 28 }}>
          担当アドバイザー: <strong style={{ color: "var(--ink)" }}>{consultant.name}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              お名前 <span style={{ color: "var(--error)", marginLeft: 4 }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: 田中 翔太"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 8,
                border: "1.5px solid var(--line)", fontSize: 14,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              メールアドレス <span style={{ color: "var(--error)", marginLeft: 4 }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="例: tanaka@example.com"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 8,
                border: "1.5px solid var(--line)", fontSize: 14,
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Time preference */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
              ご都合の良い時間帯（複数選択可）
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TIME_PREFS.map(t => (
                <label key={t} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                  border: `1.5px solid ${timePref.includes(t) ? "var(--royal)" : "var(--line)"}`,
                  background: timePref.includes(t) ? "var(--royal-50)" : "#fff",
                  fontSize: 13, color: timePref.includes(t) ? "var(--royal)" : "var(--ink-soft)",
                  fontWeight: timePref.includes(t) ? 600 : 400,
                  transition: "all 0.12s",
                }}>
                  <input
                    type="checkbox"
                    checked={timePref.includes(t)}
                    onChange={() => toggleTime(t)}
                    style={{ display: "none" }}
                  />
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${timePref.includes(t) ? "var(--royal)" : "var(--line)"}`,
                    background: timePref.includes(t) ? "var(--royal)" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {timePref.includes(t) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <polyline points="2 6 5 9 10 3"/>
                      </svg>
                    )}
                  </div>
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              相談したいこと（任意）
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="例: 外資系SaaSへの転職を検討しています。現職のスキルがどう活かせるか聞きたいです。"
              rows={4}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 8,
                border: "1.5px solid var(--line)", fontSize: 13,
                outline: "none", resize: "vertical", boxSizing: "border-box",
                lineHeight: 1.7,
              }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", color: "var(--error)", fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "14px 24px", borderRadius: 10,
              background: isPending ? "var(--ink-mute)" : "var(--royal)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              border: "none", cursor: isPending ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {isPending ? "送信中..." : "申し込む"}
          </button>

          <p style={{ fontSize: 11, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.7 }}>
            送信後、3営業日以内にご登録のメールアドレスへご連絡します。
          </p>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

type Intent = "info_gathering" | "good_opportunity" | "within_6" | "within_3";
type Format = "any" | "zoom" | "meet" | "in_person_office" | "in_person_cafe";

const INTENT_OPTIONS: { value: Intent; label: string; desc: string }[] = [
  { value: "info_gathering",  label: "情報収集中",            desc: "まだ転職を決めておらず、情報を集めている段階" },
  { value: "good_opportunity", label: "良い機会があれば検討", desc: "積極的ではないが、良い出会いがあれば前向きに" },
  { value: "within_6",        label: "半年以内に転職したい",  desc: "6ヶ月以内の転職を視野に入れて活動中" },
  { value: "within_3",        label: "3ヶ月以内に転職したい", desc: "すでに本格的に転職活動中" },
];

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: "any",             label: "どちらでも構わない" },
  { value: "zoom",            label: "Zoom" },
  { value: "meet",            label: "Google Meet" },
  { value: "in_person_office", label: "対面（企業オフィス）" },
  { value: "in_person_cafe",  label: "対面（カフェ等）" },
];

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ companyName, contactEmail }: { companyName: string; contactEmail: string }) {
  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 16, padding: "56px 48px", textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--success-soft)", color: "var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", fontSize: 28,
        }}>
          ✓
        </div>
        <h1 style={{
          fontFamily: 'var(--font-noto-serif)', fontSize: 22,
          fontWeight: 600, color: "var(--ink)", marginBottom: 12,
        }}>
          申し込みを受け付けました
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 8 }}>
          <strong style={{ color: "var(--ink)" }}>{companyName}</strong> へのカジュアル面談申し込みが完了しました。
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 32 }}>
          通常 <strong>3営業日以内</strong> に、<strong>{contactEmail}</strong> 宛てに企業から連絡が来ます。
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/mypage"
            style={{
              padding: "10px 24px", background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            マイページで確認する →
          </Link>
          <Link
            href="/companies"
            style={{
              padding: "10px 24px", background: "#fff", color: "var(--ink-soft)",
              border: "1px solid var(--line)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            企業一覧に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export default function CasualMeetingForm({
  companyId,
  companyName,
  companyInitial,
  companyGradient,
  authEmail,
}: {
  companyId: string;
  companyName: string;
  companyInitial: string;
  companyGradient: string;
  authEmail: string;
}) {
  const [shareProfile, setShareProfile] = useState(true);
  const [intent, setIntent] = useState<Intent>("info_gathering");
  const [interestReason, setInterestReason] = useState("");
  const [questions, setQuestions] = useState("");
  const [contactEmail, setContactEmail] = useState(authEmail);
  const [preferredFormat, setPreferredFormat] = useState<Format>("any");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitted) return;
    if (!contactEmail || !contactEmail.includes("@")) {
      setError("有効なメールアドレスを入力してください");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/casual-meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          contact_email: contactEmail,
          share_profile: shareProfile,
          intent,
          interest_reason: interestReason || null,
          questions: questions || null,
          preferred_format: preferredFormat,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "申し込みに失敗しました。もう一度お試しください。");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SuccessScreen companyName={companyName} contactEmail={contactEmail} />;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", fontSize: 14,
    border: "1px solid var(--line)", borderRadius: 8,
    background: "#fff", color: "var(--ink)", outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600,
    color: "var(--ink)", marginBottom: 8,
  };
  const sectionStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--line)",
    borderRadius: 14, padding: "24px 28px", marginBottom: 16,
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-noto-serif)', fontSize: 15,
    fontWeight: 600, color: "var(--ink)", marginBottom: 6,
  };
  const sectionDescStyle: React.CSSProperties = {
    fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/companies/${companyId}`}
          style={{ fontSize: 12, color: "var(--ink-mute)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          ← {companyName}
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-noto-serif)', fontSize: 24,
          fontWeight: 600, color: "var(--ink)", marginBottom: 6,
        }}>
          カジュアル面談を申し込む
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          まずは気軽に、企業の方とオンラインで30分お話ししませんか？<br />
          選考前の段階でも OK。<strong>転職を決めていなくても大丈夫です。</strong>
        </p>
      </div>

      {/* Target company card */}
      <div style={{
        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
        borderRadius: 12, padding: "16px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: companyGradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, fontWeight: 700,
        }}>
          {companyInitial}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--royal)", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "Inter, sans-serif", marginBottom: 3 }}>
            申し込み先
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
            {companyName}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
            このフォームの内容は<strong>直接企業の採用担当に届きます</strong>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Section 1: Profile share */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Opinioプロフィールを企業に共有</h2>
          <p style={sectionDescStyle}>
            あなたのプロフィール情報が企業側に共有されます。企業側が事前にあなたのキャリアを確認できるため、<strong>面談当日の対話がスムーズ</strong>になります。
          </p>
          <label style={{
            display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer",
            padding: "14px 16px",
            background: shareProfile ? "var(--royal-50)" : "var(--bg-tint)",
            border: `1px solid ${shareProfile ? "var(--royal-100)" : "var(--line)"}`,
            borderRadius: 10,
          }}>
            <input
              type="checkbox"
              checked={shareProfile}
              onChange={(e) => setShareProfile(e.target.checked)}
              style={{ marginTop: 2, accentColor: "var(--royal)", width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
              <strong>Opinioプロフィールを企業に共有する</strong>（推奨）<br />
              <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                チェックを外すと、プロフィールは共有されず、下記の入力内容のみが企業に届きます。
              </span>
            </span>
          </label>
        </section>

        {/* Section 2: Intent */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>いまの転職意向</h2>
          <p style={sectionDescStyle}>
            企業の採用担当が面談前の参考にします。正直にお答えください。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {INTENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${intent === opt.value ? "var(--royal)" : "var(--line)"}`,
                  background: intent === opt.value ? "var(--royal-50)" : "#fff",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="intent"
                  value={opt.value}
                  checked={intent === opt.value}
                  onChange={() => setIntent(opt.value)}
                  style={{ marginTop: 3, accentColor: "var(--royal)", flexShrink: 0 }}
                />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 2 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                    {opt.desc}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Section 3: Interest reason + questions */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>興味を持ったきっかけ・聞きたいこと</h2>
          <p style={sectionDescStyle}>
            企業に興味を持った理由や、面談で聞きたいことを自由に書いてください。<br />
            どちらも任意ですが、書いていただくと面談がより充実します。
          </p>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              興味を持ったきっかけ
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 8 }}>任意</span>
            </label>
            <textarea
              value={interestReason}
              onChange={(e) => setInterestReason(e.target.value)}
              rows={4}
              placeholder="例：Opinio掲載の取材記事を読んで、職域を超える文化に興味を持ちました。"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </div>
          <div>
            <label style={labelStyle}>
              面談で聞きたいこと
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 8 }}>任意</span>
            </label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              rows={5}
              placeholder={"例：\n- 会社の雰囲気や働き方のリアルを知りたい\n- このポジションで活躍している方の特徴\n- 今後の事業展開について"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
            />
          </div>
        </section>

        {/* Section 4: Contact info */}
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>連絡先</h2>
          <p style={sectionDescStyle}>
            日程調整や事前資料の送付に使用します。
          </p>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              メールアドレス
              <span style={{ fontSize: 11, color: "var(--error)", marginLeft: 6 }}>必須</span>
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
              企業からの連絡先として使われます。
            </div>
          </div>
          <div>
            <label style={labelStyle}>
              希望する面談形式
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400, marginLeft: 8 }}>任意</span>
            </label>
            <select
              value={preferredFormat}
              onChange={(e) => setPreferredFormat(e.target.value as Format)}
              style={inputStyle}
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Notice */}
        <div style={{
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          borderRadius: 10, padding: "16px 18px", marginBottom: 20, fontSize: 12,
          color: "var(--ink-soft)", lineHeight: 1.9,
        }}>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            申し込み前にご確認ください
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>このフォームは<strong>企業の採用担当に直接届きます</strong>（Opinioは介在しません）。</li>
            <li>カジュアル面談は<strong>選考ではありません</strong>。相互理解のための対話です。</li>
            <li>通常<strong>3営業日以内</strong>に企業から連絡が来ますが、遅れる場合もあります。</li>
            <li>企業側の判断で、面談を見送る場合もあります。</li>
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "var(--error-soft)", border: "1px solid #FECACA",
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
            fontSize: 13, color: "var(--error)",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{
          background: "linear-gradient(135deg, var(--royal) 0%, #1E40AF 100%)",
          borderRadius: 14, padding: "28px 32px", textAlign: "center",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.15)", borderRadius: 100,
            padding: "5px 14px", fontSize: 11, color: "#fff",
            fontWeight: 600, letterSpacing: "0.06em", marginBottom: 14,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            3営業日以内に企業から連絡が来ます
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6, fontFamily: 'var(--font-noto-serif)' }}>
            まずは、気軽に話してみましょう。
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 20, lineHeight: 1.7 }}>
            転職を決めていなくても、大丈夫です。
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "14px 24px",
              background: submitting ? "rgba(255,255,255,0.3)" : "#fff",
              color: submitting ? "rgba(255,255,255,0.7)" : "var(--royal)",
              border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {submitting ? "送信中..." : "カジュアル面談を申し込む"}
          </button>
        </div>

      </form>
    </div>
  );
}

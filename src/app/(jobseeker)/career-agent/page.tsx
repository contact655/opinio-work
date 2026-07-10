"use client";

import { useState } from "react";
import Link from "next/link";

const TIMELINE_OPTIONS = [
  "すぐにでも転職したい（1ヶ月以内）",
  "3ヶ月以内に転職したい",
  "半年以内に転職したい",
  "1年以内に転職したい",
  "良い機会があれば転職したい",
  "まずは情報収集したい",
];

const STEPS = [
  { num: "01", title: "無料相談を申し込む", desc: "フォームから申し込むと、2営業日以内に担当者からご連絡します。" },
  { num: "02", title: "オンライン面談（30分）", desc: "現状のキャリアや転職の軸をヒアリング。希望に合った求人を一緒に探します。" },
  { num: "03", title: "OBOG・先輩から情報収集", desc: "気になる企業の先輩社員に直接話を聞いて、入社後のギャップをなくします。" },
  { num: "04", title: "選考サポート〜内定", desc: "書類・面接の準備から内定交渉まで、一貫してサポートします。" },
];

const FEATURES = [
  {
    icon: "🎯",
    title: "IT/SaaS・スタートアップ特化",
    desc: "外資系IT・国内SaaS・成長スタートアップに絞った求人のみ。業界に精通したエージェントが担当します。",
  },
  {
    icon: "👥",
    title: "OBOGネットワークで内側を知る",
    desc: "気になる企業の先輩社員に直接相談できるのはOPINIOだけ。入社前に「本当のこと」を確認できます。",
  },
  {
    icon: "📝",
    title: "取材記事で企業を深く理解",
    desc: "編集部が直接取材した企業インタビュー記事を読んで、企業文化・組織の実態を事前に把握できます。",
  },
  {
    icon: "🔕",
    title: "スカウトなし・営業電話なし",
    desc: "一方的なスカウトや電話営業は一切しません。あなたのペースで転職活動を進められます。",
  },
];

export default function CareerAgentPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [timeline, setTimeline] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/career-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, current, timeline, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(155deg, #001233 0%, #002366 50%, #1a3569 100%)",
        color: "#fff",
        padding: "80px 24px 72px",
        textAlign: "center",
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
          marginBottom: 20,
        }}>
          OPINIO Career Agent
        </p>
        <h1 className="ca-hero-title" style={{
          fontSize: 36, fontWeight: 900, letterSpacing: "-0.03em",
          lineHeight: 1.25, margin: "0 0 20px",
          fontFamily: "'Noto Serif JP', serif", color: "#fff",
        }}>
          IT/SaaS業界への転職を、<br />
          先輩の声と一緒に決める。
        </h1>
        <p style={{
          fontSize: 16, color: "rgba(255,255,255,0.75)",
          lineHeight: 1.8, maxWidth: 520, margin: "0 auto 36px",
        }}>
          外資系IT・国内SaaS・スタートアップに特化したキャリアエージェント。<br />
          OBOGネットワークと取材記事で、入社前に「本当のこと」を知ってから動けます。
        </p>
        <a href="#form" style={{
          display: "inline-block",
          padding: "16px 40px",
          background: "#F59E0B",
          color: "#fff",
          borderRadius: 10,
          fontSize: 16,
          fontWeight: 800,
          textDecoration: "none",
          letterSpacing: "0.02em",
          boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
        }}>
          無料でキャリア相談する →
        </a>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 14 }}>
          完全無料・営業電話なし・2営業日以内にご連絡
        </p>
      </section>

      {/* ── Features ── */}
      <section style={{ background: "#fff", padding: "72px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--royal)", marginBottom: 12 }}>
            WHY OPINIO
          </p>
          <h2 style={{
            textAlign: "center", fontSize: 26, fontWeight: 800,
            color: "var(--ink)", marginBottom: 48, letterSpacing: "-0.02em",
          }}>
            他のエージェントとの違い
          </h2>
          <div className="ca-features-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24,
          }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                padding: "28px 28px",
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "#fff",
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.75, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Steps ── */}
      <section style={{ background: "var(--bg-tint)", padding: "72px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--royal)", marginBottom: 12 }}>
            HOW IT WORKS
          </p>
          <h2 style={{
            textAlign: "center", fontSize: 26, fontWeight: 800,
            color: "var(--ink)", marginBottom: 48, letterSpacing: "-0.02em",
          }}>
            相談から内定まで
          </h2>
          <div className="ca-steps-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20,
          }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{ padding: "24px 20px" }}>
                <div className="ca-step-num">{s.num}</div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px" }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form section ── */}
      <section id="form" style={{ background: "#fff", padding: "80px 24px 96px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--royal)", marginBottom: 12 }}>
            FREE CONSULTATION
          </p>
          <h2 style={{
            textAlign: "center", fontSize: 26, fontWeight: 800,
            color: "var(--ink)", marginBottom: 8, letterSpacing: "-0.02em",
          }}>
            無料キャリア相談を申し込む
          </h2>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--ink-soft)", marginBottom: 48 }}>
            2営業日以内に担当者よりオンライン面談（30分）のご連絡をします
          </p>

          <div className="ca-main-layout" style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>

            {/* Form */}
            <div className="ca-form-col" style={{ flex: 1, maxWidth: 560 }}>
              {status === "done" ? (
                <div style={{
                  background: "var(--success-soft)",
                  border: "1px solid #6ee7b7",
                  borderRadius: 12,
                  padding: "40px 32px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
                    お申し込みありがとうございます
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                    ご入力いただいたメールアドレスに確認メールをお送りしました。<br />
                    2営業日以内に担当者よりご連絡いたします。
                  </p>
                  <Link href="/" style={{
                    display: "inline-block", marginTop: 24,
                    fontSize: 14, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
                  }}>
                    ← トップページへ戻る
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label className="ca-label">
                      お名前<span className="ca-required">*</span>
                    </label>
                    <input
                      className="ca-input"
                      type="text"
                      placeholder="山田 太郎"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="ca-label">
                      メールアドレス<span className="ca-required">*</span>
                    </label>
                    <input
                      className="ca-input"
                      type="email"
                      placeholder="taro@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="ca-label">
                      現職（会社名・職種）<span className="ca-required">*</span>
                    </label>
                    <input
                      className="ca-input"
                      type="text"
                      placeholder="例：株式会社〇〇 / 営業職"
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="ca-label">
                      転職希望時期<span className="ca-required">*</span>
                    </label>
                    <select
                      className="ca-input"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      required
                    >
                      <option value="">選択してください</option>
                      {TIMELINE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="ca-label">相談したいこと（任意）</label>
                    <textarea
                      className="ca-input"
                      placeholder="転職の軸、気になる企業、悩んでいること、など自由にお書きください"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      style={{ resize: "vertical" }}
                    />
                  </div>

                  {status === "error" && (
                    <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>
                      送信に失敗しました。時間をおいて再度お試しいただくか、contact@opinio.co.jp までご連絡ください。
                    </p>
                  )}

                  <button
                    type="submit"
                    className="ca-submit-btn"
                    disabled={status === "sending"}
                  >
                    {status === "sending" ? "送信中..." : "無料で相談を申し込む →"}
                  </button>

                  <p style={{ fontSize: 12, color: "var(--ink-mute)", textAlign: "center", margin: 0 }}>
                    完全無料・営業電話なし・スカウトメールなし
                  </p>
                </form>
              )}
            </div>

            {/* Side info */}
            <div className="ca-info-col" style={{ width: 300, flexShrink: 0 }}>
              <div style={{
                background: "var(--royal-50)",
                borderRadius: 12,
                padding: "28px 24px",
                marginBottom: 20,
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--royal)", margin: "0 0 16px" }}>
                  こんな方におすすめ
                </h3>
                {[
                  "外資系IT・SaaS企業に興味がある",
                  "スタートアップへの転職を検討している",
                  "転職活動の進め方がわからない",
                  "エージェントに相談したことがない",
                  "入社前にリアルな社内情報を知りたい",
                ].map((t) => (
                  <div key={t} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--royal)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>{t}</span>
                  </div>
                ))}
              </div>

              <div style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "24px",
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", margin: "0 0 12px" }}>
                  お問い合わせ
                </h3>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 12px" }}>
                  フォーム以外でのお問い合わせはこちら
                </p>
                <a href="mailto:contact@opinio.co.jp" style={{
                  fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
                }}>
                  contact@opinio.co.jp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

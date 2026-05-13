import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export const metadata: Metadata = {
  title: "採用コスト、ゼロから。｜Opinio Work",
  description:
    "月額費用なし、広告費なし、入社決定時のみ成果報酬。IT/SaaS業界の即戦力人材を、無料で採用開始できる「Opinio Work」。メンター介在で採用ミスマッチを構造的に防ぐ。",
  openGraph: {
    title: "採用コスト、ゼロから。｜Opinio Work",
    description: "掲載・スカウト・面談まで全て無料。成果報酬は入社決定時のみ。IT/SaaS業界特化の採用プラットフォーム。",
    type: "website",
  },
};

// ── CTA Button ────────────────────────────────────────────────────────────────
function CtaButton({ center = false }: { center?: boolean }) {
  return (
    <div style={center ? { textAlign: "center" } : {}}>
      <Link
        href="/biz/companies/add/new/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "16px 36px",
          background: "var(--royal)",
          color: "#fff",
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: "none",
          letterSpacing: "0.01em",
        }}
      >
        企業を新規登録（無料）
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </Link>
      <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
        クレジットカード登録不要 · 自動課金なし
      </p>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "var(--royal)",
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

// ── CheckItem ─────────────────────────────────────────────────────────────────
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--royal)", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
      <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

// ── CrossItem ─────────────────────────────────────────────────────────────────
function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

// ── FaqItem ───────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div style={{
      padding: "24px 28px",
      background: "#fff",
      borderRadius: 12,
      border: "1px solid var(--line)",
    }}>
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: "var(--ink)",
        marginBottom: 10,
        display: "flex",
        gap: 10,
      }}>
        <span style={{ color: "var(--royal)", flexShrink: 0 }}>Q.</span>
        {q}
      </div>
      <div style={{
        fontSize: 14,
        color: "var(--ink-soft)",
        lineHeight: 1.8,
        paddingLeft: 24,
      }}>
        {a}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ForCompaniesPage() {
  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg,
    padding: "80px 24px",
  });

  const innerStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
  };

  return (
    <>
      <BusinessHeader />
      <main style={{ paddingTop: 60 }}>

        {/* ─── Section 1: Hero ──────────────────────────────────────────────── */}
        <section style={{ ...sectionStyle("#fff"), paddingTop: 100, paddingBottom: 100 }}>
          <div style={{ ...innerStyle, maxWidth: 720, textAlign: "center" }}>

            {/* Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 14px",
              background: "var(--royal-50)",
              border: "1px solid var(--royal-100)",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--royal)",
              marginBottom: 28,
              letterSpacing: "0.04em",
            }}>
              IT/SaaS業界 採用担当者の方へ
            </div>

            {/* Main Copy */}
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(36px, 6vw, 60px)",
              fontWeight: 500,
              lineHeight: 1.2,
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              marginBottom: 20,
            }}>
              採用コスト、
              <br />
              ゼロから。
            </h1>

            <p style={{
              fontSize: 18,
              color: "var(--ink-soft)",
              lineHeight: 1.8,
              marginBottom: 36,
            }}>
              月額費用なし、広告費なし、
              <br />
              入社決定時のみ成果報酬。
            </p>

            {/* Check list */}
            <div style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 10,
              textAlign: "left",
              marginBottom: 44,
            }}>
              <CheckItem>完全無料で求人掲載</CheckItem>
              <CheckItem>営業電話なし</CheckItem>
              <CheckItem>入社まで一切請求なし</CheckItem>
            </div>

            {/* CTA */}
            <div>
              <CtaButton center />
            </div>
          </div>
        </section>

        {/* ─── Section 2: Comparison Table ──────────────────────────────────── */}
        <section id="pricing" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>料金比較</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                lineHeight: 1.4,
                marginBottom: 16,
              }}>
                他社が「掲載で稼ぐ」のに対し、<br />
                Opinio は「採用が成功したときだけ」収益を得ます。
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                だから、企業も求職者も質の高いマッチングしか追求できない構造。
              </p>
            </div>

            {/* Table — horizontal scroll on mobile */}
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--line)" }}>
              <table style={{
                width: "100%",
                minWidth: 600,
                borderCollapse: "collapse",
                background: "#fff",
                fontSize: 14,
              }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {["サービス", "月額費用", "求人掲載", "成果報酬", "コスト発生タイミング"].map((h, i) => (
                      <th key={i} style={{
                        padding: "14px 18px",
                        textAlign: "left",
                        fontWeight: 700,
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        background: "var(--bg-tint)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Opinio row — highlighted */}
                  <tr style={{ background: "var(--royal-50)", borderBottom: "1px solid var(--royal-100)" }}>
                    <td style={{ padding: "16px 18px", fontWeight: 700, color: "var(--royal)", whiteSpace: "nowrap" }}>
                      Opinio Work
                    </td>
                    <td style={{ padding: "16px 18px", fontWeight: 700, color: "var(--ink)" }}>
                      <strong>無料</strong>
                    </td>
                    <td style={{ padding: "16px 18px", fontWeight: 700, color: "var(--ink)" }}>
                      <strong>無料</strong>（件数・期間無制限）
                    </td>
                    <td style={{ padding: "16px 18px", color: "var(--ink)" }}>
                      年収 30〜35%
                    </td>
                    <td style={{ padding: "16px 18px", fontWeight: 700, color: "var(--royal)" }}>
                      入社決定時のみ
                    </td>
                  </tr>

                  {/* Competitors — anonymous */}
                  {[
                    {
                      name: "他社例 A（スカウト型）",
                      monthly: "約20万円〜",
                      posting: "含まれる",
                      commission: "なし",
                      timing: "採用ゼロでも月額発生",
                    },
                    {
                      name: "他社例 B（媒体型）",
                      monthly: "媒体課金あり",
                      posting: "別途課金",
                      commission: "なし",
                      timing: "掲載期間中は常時発生",
                    },
                    {
                      name: "他社例 C（紹介型）",
                      monthly: "無料",
                      posting: "別途課金",
                      commission: "年収 30〜35%",
                      timing: "入社決定時 + 掲載費",
                    },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < 2 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ padding: "16px 18px", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={{ padding: "16px 18px", color: "var(--ink-soft)" }}>{row.monthly}</td>
                      <td style={{ padding: "16px 18px", color: "var(--ink-soft)" }}>{row.posting}</td>
                      <td style={{ padding: "16px 18px", color: "var(--ink-soft)" }}>{row.commission}</td>
                      <td style={{ padding: "16px 18px", color: "var(--ink-soft)" }}>{row.timing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 14, fontSize: 11, color: "var(--ink-mute)", textAlign: "right" }}>
              ※ 他社例は業界一般的な料金モデルを参考に記載。実際のサービス名・条件は各社により異なります。
            </p>
          </div>
        </section>

        {/* ─── Section 3: 3 Steps ───────────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <SectionLabel>はじめ方</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                3ステップで採用を開始
              </h2>
            </div>

            {/* Steps grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              marginBottom: 32,
            }}>
              {[
                {
                  step: "1",
                  title: "企業を登録（1分）",
                  body: "無料。メールアドレスだけで開始できます。クレジットカード登録不要。",
                },
                {
                  step: "2",
                  title: "求人を作成・公開（無料）",
                  body: "何件でも、何ヶ月でも、無料。スカウト機能も無料でご利用いただけます。",
                },
                {
                  step: "3",
                  title: "入社決定時のみ成果報酬",
                  body: "採用が決まるまで一切請求なし。ご納得いただけた採用のみ費用が発生します。",
                },
              ].map(({ step, title, body }) => (
                <div key={step} style={{
                  padding: "28px 24px",
                  background: "var(--bg-tint)",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--royal)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    marginBottom: 16,
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>

            {/* Emphasis box */}
            <div style={{
              padding: "20px 28px",
              background: "var(--royal-50)",
              border: "1px solid var(--royal-100)",
              borderRadius: 12,
              display: "flex",
              flexWrap: "wrap" as const,
              gap: "10px 32px",
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>
                ⭐ 応募・スカウト・面談まで全て無料
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)" }}>
                ⭐ お金が発生するのは「入社決定」の一点のみ
              </span>
            </div>
          </div>
        </section>

        {/* ─── Section 4: Why No Mismatch ────────────────────────────────────── */}
        <section id="features" style={sectionStyle("var(--ink)")}>
          <div style={{ ...innerStyle, textAlign: "center" }}>
            <SectionLabel>差別化</SectionLabel>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(22px, 3.5vw, 32px)",
              fontWeight: 500,
              color: "#fff",
              marginBottom: 16,
            }}>
              なぜ採用ミスマッチが起きないのか？
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 56, lineHeight: 1.7 }}>
              Opinio には、他の求人媒体にはない2つの仕組みがあります。
            </p>

            {/* 2 sub-sections side by side */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              marginBottom: 64,
              textAlign: "left",
            }}>
              {/* Mentor sub-section */}
              <div style={{
                padding: "32px 28px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--royal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginBottom: 20,
                }}>
                  🤝
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 12, lineHeight: 1.4 }}>
                  メンターが間に立つから
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.9 }}>
                  Opinio には、IT 業界で経験を積んだメンターが在籍しています。
                  候補者は応募前に必ずメンターと面談し、企業の文化や働き方、
                  キャリアの方向性を擦り合わせた上で応募してきます。
                  <br /><br />
                  「軽い気持ちでの応募」がなく、企業側には
                  <strong style={{ color: "#fff" }}>本気度の高い候補者だけが届く</strong>構造です。
                </p>
              </div>

              {/* User quality sub-section */}
              <div style={{
                padding: "32px 28px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(59,95,217,0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginBottom: 20,
                }}>
                  💼
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 12, lineHeight: 1.4 }}>
                  IT 業界職経ありユーザーが中心
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.9 }}>
                  Opinio に登録しているユーザーの大多数が、
                  IT 業界で実務経験を持つ即戦力人材です。
                  <br /><br />
                  業界知識ゼロから教育する必要がなく、
                  <strong style={{ color: "#fff" }}>入社後すぐに戦力として活躍できる人材</strong>と
                  出会えます。
                </p>
              </div>
            </div>

            {/* Stats: "Opinio が選ばれる理由" */}
            <div id="results" style={{ marginTop: 8 }}>
              <p style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 28,
              }}>
                Opinio が選ばれる理由
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 1,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 14,
                overflow: "hidden",
              }}>
                {[
                  { num: "120社+", label: "IT/SaaS企業が活用中" },
                  { num: "200名+", label: "キャリア意思決定をサポート" },
                  { num: "99%+", label: "早期離職率を業界平均より大幅に下回る※" },
                ].map(({ num, label }) => (
                  <div key={label} style={{
                    padding: "40px 24px",
                    background: "rgba(255,255,255,0.04)",
                  }}>
                    <div style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "clamp(36px, 5vw, 52px)",
                      fontWeight: 800,
                      color: "#fff",
                      letterSpacing: "-0.03em",
                      marginBottom: 8,
                    }}>
                      {num}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, lineHeight: 1.5 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "right" }}>
                ※自社調べ
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 5: Target ────────────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>対象</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                こんな企業に最適です
              </h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}>
              {/* Good fit */}
              <div style={{
                padding: "28px 28px",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 14,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--royal)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  marginBottom: 20,
                }}>
                  ✓ Opinio が力になれる
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CheckItem>IT/SaaS業界の即戦力人材を採用したい</CheckItem>
                  <CheckItem>コストを抑えつつ質の高い採用をしたい</CheckItem>
                  <CheckItem>早期離職を防ぐ採用設計を求めている</CheckItem>
                  <CheckItem>1名からでも丁寧に採用したい</CheckItem>
                </div>
              </div>

              {/* Not fit */}
              <div style={{
                padding: "28px 28px",
                background: "var(--bg-tint)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-mute)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  marginBottom: 20,
                }}>
                  （参考）不向きな場合
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <CrossItem>採用ボリュームを最大化したい</CrossItem>
                  <CrossItem>短期決戦で多数の候補者にスカウトを送りたい</CrossItem>
                  <CrossItem>IT/SaaS以外の業界での採用が中心</CrossItem>
                </div>
                <p style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  lineHeight: 1.7,
                }}>
                  ミスマッチを防ぐため、当社の強みを正直にお伝えしています。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 6: Logos (placeholder) ──────────────────────────────── */}
        {/*
          TODO: 許諾済みの企業ロゴを Hisato さんに確認の上、追加する。
          人材紹介事業の取引先（Sansan, freee, MoneyForward 等）。
          現時点ではテキストのみ表示。
        */}
        <section style={{ ...sectionStyle("var(--bg-tint)"), paddingTop: 56, paddingBottom: 56 }}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>
                多くの企業様にご利用いただいています
              </p>
            </div>
            <div style={{
              display: "flex",
              flexWrap: "wrap" as const,
              gap: 12,
              justifyContent: "center",
            }}>
              {["Sansan", "freee", "Money Forward", "SmartHR", "LayerX", "Ubie"].map((name) => (
                <div key={name} style={{
                  padding: "8px 20px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--ink-soft)",
                }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Section 7: FAQ ───────────────────────────────────────────────── */}
        <section id="faq" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>よくある質問</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
              }}>
                FAQ
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <FaqItem
                q="本当に掲載は無料ですか？"
                a="はい、月額費用や広告費は一切いただきません。求人公開、スカウト、面談まで全て無料でご利用いただけます。"
              />
              <FaqItem
                q="成果報酬の発生条件は？"
                a="候補者の入社が確定した時点で、内定後の年収の30〜35%をご請求します。それまでは一切請求が発生しません。"
              />
              <FaqItem
                q="自社で採用したい場合は？"
                a="求人公開、スカウト、面談まで全て無料でご利用いただけます。自社の採用力で完結する企業様にも、無料の掲載基盤としてご活用いただけます。"
              />
              <FaqItem
                q="営業電話はかかってきますか？"
                a="ございません。ご質問やご相談はサイト内のフォーム、またはメール（contact@opinio.co.jp）からのみ承ります。"
              />
              <FaqItem
                q="どのような業界に対応していますか？"
                a="現在は IT/SaaS 業界に特化して運営しています。将来的には他業界への展開も予定していますが、現時点では IT/SaaS 業界の即戦力人材採用に最適化されています。"
              />
              <FaqItem
                q="登録に審査はありますか？"
                a="ございません。セルフサーブ型で、登録後すぐに求人を公開できます。※ 明らかにスパムや偽情報と判断される場合のみ、運営側で削除する場合があります（事後巡回方式）。"
              />
              <FaqItem
                q="メンターとはどんな存在ですか？"
                a="IT 業界で経験を積んだプロフェッショナルです。候補者の方々は応募前にメンターと面談し、キャリアの方向性や企業選びについてアドバイスを受けます。これにより「本気度の高い応募」だけが企業に届きます。"
              />
            </div>

            <div style={{ textAlign: "center", marginTop: 36 }}>
              <p style={{ fontSize: 14, color: "var(--ink-mute)" }}>
                その他のご質問は{" "}
                <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)", textDecoration: "underline" }}>
                  contact@opinio.co.jp
                </a>{" "}
                までお気軽にどうぞ。
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 8: Final CTA ─────────────────────────────────────────── */}
        <section style={{
          padding: "96px 24px",
          background: "var(--royal)",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 500,
              color: "#fff",
              lineHeight: 1.3,
              marginBottom: 16,
            }}>
              今すぐ始める
            </h2>
            <p style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.8,
              marginBottom: 44,
            }}>
              登録は1分で完了します。<br />
              クレジットカード登録不要、自動課金もありません。
            </p>

            <Link
              href="/biz/companies/add/new/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "16px 40px",
                background: "#fff",
                color: "var(--royal)",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "0.01em",
              }}
            >
              企業を新規登録（無料）
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" as const }}>
              <a
                href="mailto:contact@opinio.co.jp"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", textDecoration: "underline" }}
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </section>

      </main>
      <JobseekerFooter />
    </>
  );
}

"use client";

import Link from "next/link";

const MOCK_CANDIDATES = [
  {
    init: "山",
    color: "linear-gradient(135deg, var(--royal), #3B5FD9)",
    name: "山田 健太郎",
    role: "フィールドセールス",
    company: "SmartHR 出身",
    tags: ["SaaS営業", "エンタープライズ"],
    matched: true,
  },
  {
    init: "中",
    color: "linear-gradient(135deg, var(--success), #047857)",
    name: "中村 さやか",
    role: "カスタマーサクセス",
    company: "Salesforce Japan 出身",
    tags: ["CS", "オンボーディング"],
    matched: true,
  },
  {
    init: "佐",
    color: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    name: "佐々木 拓也",
    role: "プロダクトマネージャー",
    company: "Money Forward 出身",
    tags: ["BtoB SaaS", "PM"],
    matched: false,
  },
];

function CtaButton() {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Link
          href="/biz/auth"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "15px 32px", background: "var(--royal)", color: "#fff",
            borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
            letterSpacing: "0.01em", boxShadow: "0 4px 16px rgba(0,35,102,0.25)",
          }}
        >
          企業を新規登録（無料）
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
        <a
          href="mailto:contact@opinio.co.jp"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "15px 22px", border: "1.5px solid var(--royal-100)",
            borderRadius: 10, fontSize: 14, fontWeight: 600,
            color: "var(--royal)", textDecoration: "none", background: "var(--royal-50)",
          }}
        >
          まず相談する（無料）
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </a>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: "var(--ink-mute)" }}>
        クレジットカード登録不要 · 自動課金なし
      </p>
    </div>
  );
}

export function BusinessHero() {
  return (
    <section
      style={{
        background: `
          radial-gradient(ellipse 60% 50% at 85% 30%, rgba(30,64,175,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 15% 80%, rgba(0,35,102,0.05) 0%, transparent 60%),
          linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)
        `,
      }}
      /* ① 上部余白を大幅削減 — CTA がファーストビューに収まるように */
      className="px-6 pt-8 pb-14 md:px-12 md:pt-12 md:pb-20"
    >
      <div
        style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
        className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16 items-center"
      >
        {/* ── Left ── */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 14px", background: "var(--royal-50)",
            border: "1px solid var(--royal-100)", borderRadius: 100,
            fontSize: 12, fontWeight: 600, color: "var(--royal)",
            marginBottom: 20, letterSpacing: "0.04em",
          }}>
            IT/SaaS業界 採用担当者の方へ
          </div>

          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(34px, 4.8vw, 56px)",
            fontWeight: 500, lineHeight: 1.25,
            color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 12,
          }}>
            スカウトしない、<br />
            <span style={{ color: "var(--royal)" }}>採用を。</span>
          </h1>

          <p style={{
            fontSize: "clamp(16px, 1.8vw, 19px)", fontWeight: 700,
            color: "var(--ink)", letterSpacing: "-0.01em", marginBottom: 12,
          }}>
            掲載費ゼロ · 成果報酬のみ。
          </p>

          <p style={{
            fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.85,
            marginBottom: 20, maxWidth: 460,
          }}>
            応募前にIT業界メンターと面談した、<strong style={{ color: "var(--ink)", fontWeight: 700 }}>本気度の高い候補者だけ</strong>が届きます。
            スカウト0通で、IT/SaaS即戦力採用を。
          </p>

          {/* ② 料金フロー — Hero 内でコスト発生タイミングを明示 */}
          <div style={{
            display: "flex", alignItems: "stretch",
            background: "#fff", border: "1px solid var(--line)",
            borderRadius: 10, overflow: "hidden", marginBottom: 20,
            boxShadow: "0 2px 8px rgba(0,35,102,0.06)",
          }}>
            {[
              { step: "掲載・スカウト", cost: "¥0", note: "完全無料", ok: true },
              { step: "面談・候補者閲覧", cost: "¥0", note: "完全無料", ok: true },
              { step: "入社決定時のみ", cost: "10%", note: "成果報酬", ok: false },
            ].map(({ step, cost, note, ok }, i) => (
              <div key={step} style={{
                flex: 1, padding: "10px 8px", textAlign: "center",
                borderRight: i < 2 ? "1px solid var(--line)" : "none",
                background: ok ? "#fff" : "var(--royal-50)",
              }}>
                <div style={{ fontSize: 9, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 3, letterSpacing: "0.04em" }}>{step}</div>
                <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 800, fontSize: 16, color: ok ? "var(--success)" : "var(--royal)", lineHeight: 1 }}>{cost}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: ok ? "var(--success)" : "var(--royal)", marginTop: 2 }}>{note}</div>
              </div>
            ))}
          </div>

          {/* Trust pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            {["掲載・面談まで完全無料", "営業電話なし", "入社まで請求なし"].map((label) => (
              <span key={label} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px", background: "var(--royal-50)",
                border: "1px solid var(--royal-100)", borderRadius: 100,
                fontSize: 12, fontWeight: 600, color: "var(--royal)",
              }}>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
                {label}
              </span>
            ))}
          </div>

          <CtaButton />
        </div>

        {/* ── Right: Candidate search mockup (desktop only) ── */}
        <div className="hidden md:flex justify-center" style={{ position: "relative" }}>
          <div style={{
            position: "absolute", bottom: -16, right: -8, zIndex: 10,
            background: "#fff", borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0,35,102,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, maxWidth: 240,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--success), #047857)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>田</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>田中さん（元Sansan）</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>この方をご紹介できます</div>
            </div>
          </div>

          <div style={{
            background: "#fff", borderRadius: 20,
            boxShadow: "0 30px 60px rgba(0,35,102,0.12), 0 8px 24px rgba(15,23,42,0.06)",
            padding: 24, width: "100%", maxWidth: 400,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--royal)" }}>OPINIO</span>
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Business</span>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-soft)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0, display: "inline-block" }} />
                新着候補者
              </span>
            </div>

            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>
              経験で絞り込む
            </div>
            <div style={{ border: "1.5px solid var(--royal)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>エンタープライズ営業 経験5年以上</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 12, color: "var(--ink-soft)" }}>
              <span><strong style={{ color: "var(--ink)", fontSize: 14 }}>47</strong> 件が該当</span>
              <span style={{ color: "var(--success)", fontSize: 11 }}>今日更新</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOCK_CANDIDATES.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 8,
                  background: c.matched ? "var(--royal-50)" : "var(--line-soft)",
                  border: c.matched ? "1px solid var(--royal-100)" : "1px solid transparent",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: c.color,
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  }}>{c.init}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.company}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name} · {c.role}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                      {c.tags.map((t) => (
                        <span key={t} style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "var(--royal-50)", color: "var(--royal)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    padding: "3px 7px",
                    background: c.matched ? "var(--success-soft)" : "var(--bg-tint)",
                    color: c.matched ? "var(--success)" : "var(--ink-mute)",
                    borderRadius: 100, fontSize: 9, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const,
                  }}>
                    {c.matched ? "★ 面談済" : "未面談"}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              すべての候補者に「OPINIO編集部の推薦コメント」付き
            </div>
          </div>
        </div>

        {/* ⑤ モバイル専用 — 候補者プレビュー簡易カード */}
        <div className="flex md:hidden" style={{ gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {MOCK_CANDIDATES.map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              padding: "10px 14px", background: c.matched ? "var(--royal-50)" : "#fff", borderRadius: 10,
              border: c.matched ? "1.5px solid var(--royal-100)" : "1px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,35,102,0.06)",
            } as React.CSSProperties}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: c.color,
                color: "#fff", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{c.init}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{c.role}</div>
              </div>
              {c.matched && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--success)", flexShrink: 0 }}>★面談済</span>}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

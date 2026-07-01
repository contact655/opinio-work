"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Steps ────────────────────────────────────────────────────────────────────

import type { JSX } from "react";

type Step = {
  id: string;
  icon: JSX.Element;
  question: string;
  sub: string;
  options: string[];
};

const STEPS: Step[] = [
  {
    id: "job_type",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
    question: "あなたの職種は？",
    sub: "最も近いものを選んでください",
    options: [
      // Leadership / Business
      "経営・CxO",
      "事業開発",
      "フィールドセールス",
      "インサイドセールス",
      "カスタマーサクセス",
      "マーケティング",
      "コーポレート",
      // Product / Design
      "プロダクトマネージャー",
      "デザイナー",
      "データサイエンティスト",
      // Engineering
      "エンジニア",
      "バックエンド",
      "フロントエンド",
      "フルスタック",
      "SRE/インフラ",
      "iOS/Android",
      // Others
      "その他",
    ],
  },
  {
    id: "experience_years",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    question: "社会人経験は何年ですか？",
    sub: "キャリアの長さを教えてください",
    options: ["1〜2年", "3〜5年", "6〜10年", "11年以上"],
  },
  {
    id: "worry",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    question: "今一番の悩みは？",
    sub: "相談したいテーマに近いもの",
    options: [
      "転職すべきか迷っている",
      "年収を大幅に上げたい",
      "外資・グローバル企業に行きたい",
      "キャリアチェンジを考えている",
      "スタートアップに興味がある",
      "まず話を聞いてみたい",
    ],
  },
];

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = (() => {
    const raw = searchParams.get("next") ?? "/companies";
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/companies";
  })();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const current = STEPS[step];

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?next=" + encodeURIComponent("/onboarding"));
      }
    });
  }, [router]);

  const select = async (value: string) => {
    const newAnswers = { ...answers, [current.id]: value };
    setAnswers(newAnswers);

    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    // 最終ステップ → 保存してリダイレクト
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // ow_profiles に既存レコードがあるかチェック
      const { data: existing } = await supabase
        .from("ow_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ow_profiles")
          .update({
            job_type: newAnswers.job_type,
            experience_years: newAnswers.experience_years,
            worry: newAnswers.worry,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
      } else {
        await supabase.from("ow_profiles").insert({
          user_id: user.id,
          job_type: newAnswers.job_type,
          experience_years: newAnswers.experience_years,
          worry: newAnswers.worry,
          onboarding_completed: true,
        });
      }

      // candidateロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      }).catch(() => {/* best-effort */});
    }

    setDone(true);
    setSaving(false);
  };

  // ── 完了画面 ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={pageWrap}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <LogoMark />
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 20,
            padding: "40px 36px",
            boxShadow: "var(--shadow-md)",
          }}>
            {/* Success icon */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--success), #34D399)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 6px 20px rgba(5,150,105,0.3)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: 24, fontWeight: 700,
              color: "var(--ink)", marginBottom: 10, textAlign: "center",
              letterSpacing: "0.01em",
            }}>
              ようこそ、OPINIO へ！
            </h2>
            <p style={{
              fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.85,
              marginBottom: 8, textAlign: "center",
            }}>
              基本情報を登録しました。<br />
              次は3つのアクションでキャリアを動かし始めましょう。
            </p>
            {/* ミニバッジ */}
            <div style={{
              display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap",
            }}>
              {["完全無料", "スカウトなし", "30分から"].map((t) => (
                <span key={t} style={{
                  fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)",
                }}>
                  ✓ {t}
                </span>
              ))}
            </div>

            {/* ── 次のステップ 選択カード ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* Step 1: プロフィール設定（推奨） */}
              <a
                href="/profile/edit?welcome=1"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  color: "#fff", borderRadius: 12, textDecoration: "none",
                  border: "none",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>プロフィールを設定する</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>自己紹介・職歴・スキルを登録（5分）</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", opacity: 0.7, flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

              {/* Step 2: 企業を探す */}
              <a
                href="/companies"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px",
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-soft)", borderRadius: 12, textDecoration: "none",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "var(--royal-50)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--royal)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--ink)" }}>企業を見てみる</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>IT/SaaS企業の内側を知ろう</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

              {/* Step 3: 取材記事を読む */}
              <a
                href="/articles"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px",
                  background: "var(--bg-tint)",
                  border: "1px solid var(--line)",
                  color: "var(--ink-soft)", borderRadius: 12, textDecoration: "none",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "var(--royal-50)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--royal)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--ink)" }}>取材記事を読む</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>現役社員のリアルな声を知ろう</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 質問画面 ──────────────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <LogoMark />

        {/* ステップインジケーター */}
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`ステップ ${step + 1} / ${STEPS.length}`}
          style={{ display: "flex", gap: 6, marginBottom: 28 }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "var(--royal)" : "var(--line)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* 質問カード */}
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "32px 28px",
          marginBottom: 16,
          boxShadow: "var(--shadow-sm)",
        }}>
          {/* Step label */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>{current.icon}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--royal)",
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              fontFamily: "'Inter', sans-serif",
            }}>
              Step {step + 1} / {STEPS.length}
            </span>
          </div>

          <h2 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 20, fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 6,
            lineHeight: 1.45,
          }}>
            {current.question}
          </h2>
          <p style={{
            fontSize: 13,
            color: "var(--ink-mute)",
            marginBottom: 22,
          }}>
            {current.sub}
          </p>

          {/* 選択肢 — job_type は 2 列グリッド、その他は 1 列 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: current.id === "job_type" ? "1fr 1fr" : "1fr",
            gap: 8,
          }}>
            {current.options.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => select(opt)}
                disabled={saving}
                style={{
                  padding: "13px 16px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "#fff",
                  color: "var(--ink)",
                  fontSize: 14,
                  cursor: saving ? "wait" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                  transition: "all 0.15s",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--royal)";
                  e.currentTarget.style.background = "var(--royal-50)";
                  e.currentTarget.style.color = "var(--royal)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line)";
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.color = "var(--ink)";
                }}
              >
                {saving ? (
                  <span style={{ opacity: 0.5 }}>{opt}</span>
                ) : (
                  opt
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 戻る / スキップ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              style={{
                fontSize: 12, color: "var(--ink-soft)", background: "none",
                border: "1px solid var(--line)", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit", padding: "8px 16px",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              前に戻る
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const { data: existing } = await supabase
                  .from("ow_profiles")
                  .select("id")
                  .eq("user_id", user.id)
                  .maybeSingle();
                if (existing) {
                  await supabase
                    .from("ow_profiles")
                    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
                    .eq("user_id", user.id);
                } else {
                  await supabase.from("ow_profiles").insert({
                    user_id: user.id,
                    onboarding_completed: true,
                  });
                }
              }
              router.push(nextUrl);
            }}
            disabled={saving}
            style={{
              fontSize: 12, color: "var(--ink-mute)", background: "none",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              padding: "8px 16px", textDecoration: "underline",
              textDecorationColor: "var(--line)",
            }}
          >
            後で設定する
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles & sub-components ──────────────────────────────────────────

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--bg-tint)",
};

function LogoMark() {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <a
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--royal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span style={{
          fontFamily: "var(--font-noto-serif)",
          fontSize: 20, fontWeight: 700,
          color: "var(--royal)",
        }}>
          OPINIO
        </span>
      </a>
    </div>
  );
}

// ─── Page export (Suspense boundary for useSearchParams) ─────────────────────

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-tint)",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid var(--royal-100)",
          borderTopColor: "var(--royal)",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  );
}

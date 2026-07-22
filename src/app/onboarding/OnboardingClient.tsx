"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Inner component (needs useSearchParams → wrapped in Suspense) ────────────

function OnboardingInner() {
  const router = useRouter();
  const _searchParams = useSearchParams();

  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?next=" + encodeURIComponent("/onboarding"));
      }
    });
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [router]);

  const finish = async (company?: string) => {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // ow_profiles に onboarding_completed を記録
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

      // 会社名が入力されていれば ow_experiences に登録
      if (company?.trim()) {
        try {
          await supabase.from("ow_experiences").insert({
            user_id: user.id,
            company_text: company.trim(),
            is_current: true,
            role_title: "",
            started_at: null,
          });
        } catch {/* best-effort */}
      }

      // candidate ロールを付与
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "candidate" }),
      }).catch(() => {/* best-effort */});
    }

    setSaving(false);
    setDone(true);
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
              marginBottom: 24, textAlign: "center",
            }}>
              登録が完了しました。<br />
              まず何から始めますか？
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href="/companies"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  color: "#fff", borderRadius: 12, textDecoration: "none",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>企業を見てみる</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>IT/SaaS企業の内側情報を確認する</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", opacity: 0.7, flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

              <a
                href="/profile/edit"
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: "var(--ink)" }}>プロフィールを設定する</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>職歴・スキルをあとから追加できます</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }} aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>

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

  // ── 現職会社入力画面 ──────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <LogoMark />

        {/* ステップインジケーター（1/1） */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--royal)" }} />
        </div>

        {/* 入力カード */}
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "32px 28px",
          marginBottom: 16,
          boxShadow: "var(--shadow-sm)",
        }}>
          {/* Step label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: "var(--royal)",
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              fontFamily: "'Inter', sans-serif",
            }}>
              Step 1 / 1
            </span>
          </div>

          <h2 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 20, fontWeight: 700,
            color: "var(--ink)", marginBottom: 6, lineHeight: 1.45,
          }}>
            現在お勤めの会社を教えてください
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
            在籍中の企業の情報は、あなたには非表示になります。<br />
            任意入力です。あとから変更できます。
          </p>

          <input
            ref={inputRef}
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) finish(companyName); }}
            placeholder="例：株式会社〇〇、〇〇 Inc."
            disabled={saving}
            style={{
              width: "100%",
              padding: "13px 16px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 14,
              color: "var(--ink)",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box" as const,
              background: saving ? "var(--bg-tint)" : "#fff",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
          />

          <button
            type="button"
            onClick={() => finish(companyName)}
            disabled={saving}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "13px 20px",
              background: companyName.trim()
                ? "linear-gradient(135deg, var(--royal), #3B5FD9)"
                : "var(--line)",
              color: companyName.trim() ? "#fff" : "var(--ink-mute)",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {saving ? "登録中..." : "登録して始める →"}
          </button>
        </div>

        {/* スキップ */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => finish(undefined)}
            disabled={saving}
            style={{
              fontSize: 13, color: "var(--ink-soft)", background: "none",
              border: "1px solid var(--line)", borderRadius: 8,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
              padding: "9px 20px", display: "flex", alignItems: "center", gap: 5,
            }}
          >
            後で設定する
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--royal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span style={{ fontFamily: "var(--font-noto-serif)", fontSize: 20, fontWeight: 700, color: "var(--royal)" }}>
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
        display: "flex", alignItems: "center", justifyContent: "center",
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

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

// ────────────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────────────

type PublicStep = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
  join_reason: string | null;
  employment_type: string | null;
  salary_man: number | null;
  visibility_company: "real" | "masked" | "hidden";
  visibility_salary: boolean;
  visibility_reason: boolean;
};

// ────────────────────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────────────────────

function companyDisplay(step: PublicStep): string {
  if (step.visibility_company === "real" && step.company_text) {
    return step.company_text;
  }
  return step.company_anonymized ?? "企業名非公開";
}

function formatPeriod(started_at: string, ended_at: string | null, is_current: boolean): string {
  const start = started_at.slice(0, 7).replace("-", ".");
  if (is_current) return `${start} - 現在`;
  const end = ended_at ? ended_at.slice(0, 7).replace("-", ".") : "";
  return `${start} - ${end}`;
}

function formatDuration(started_at: string, ended_at: string | null, is_current: boolean): string {
  const start = new Date(started_at);
  const end = is_current ? new Date() : (ended_at ? new Date(ended_at) : new Date());
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 1) return "1ヶ月未満";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}ヶ月`;
  if (m === 0) return `${y}年`;
  return `${y}年${m}ヶ月`;
}

function salaryDelta(a: PublicStep, b: PublicStep): number | null {
  if (a.salary_man === null || b.salary_man === null) return null;
  return b.salary_man - a.salary_man;
}

function formatSalary(man: number): string {
  return `${man.toLocaleString()}万円`;
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toLocaleString()}万円`;
}

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getData(userId: string) {
  const supabase = createClient();

  const [profileRes, userRes, stepsRes] = await Promise.all([
    supabase
      .from("ow_career_profiles")
      .select("headline, years_of_experience, is_published")
      .eq("user_id", userId)
      .eq("is_published", true)
      .maybeSingle(),
    supabase
      .from("ow_users")
      .select("name, visibility")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("get_public_career_steps", { p_user_id: userId }),
  ]);

  if (!profileRes.data) return null;

  return {
    profile: profileRes.data,
    userName: userRes.data?.name ?? null,
    steps: (stepsRes.data ?? []) as PublicStep[],
  };
}

// ────────────────────────────────────────────────────────────────
// ページ
// ────────────────────────────────────────────────────────────────

export default async function CareerTrajectoryPage({
  params,
}: {
  params: { userId: string };
}) {
  const data = await getData(params.userId);
  if (!data || data.steps.length === 0) notFound();

  const { profile, userName, steps } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* ── ヘッダー ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "48px 24px 40px",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: "0.1em", opacity: 0.6 }}>
            CAREER TRAJECTORY
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", fontFamily: "Noto Serif JP, serif" }}>
            {userName ?? "このユーザー"}のキャリア軌跡
          </h1>
          {profile.headline && (
            <p style={{ fontSize: 15, opacity: 0.85, margin: "0 0 16px", lineHeight: 1.6 }}>
              {profile.headline}
            </p>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{
              background: "rgba(255,255,255,0.12)", borderRadius: 100,
              padding: "4px 12px", fontSize: 12,
            }}>
              {steps.length}社のキャリア
            </span>
            {profile.years_of_experience && (
              <span style={{
                background: "rgba(255,255,255,0.12)", borderRadius: 100,
                padding: "4px 12px", fontSize: 12,
              }}>
                経験年数 {profile.years_of_experience}年
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── タイムライン本体 ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Desktop: 横スクロール / Mobile: 縦積み */}
        <style>{`
          .ct-timeline {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 0;
            overflow-x: auto;
            padding-bottom: 16px;
          }
          .ct-step-wrap {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            flex-shrink: 0;
          }
          .ct-card {
            width: 220px;
            flex-shrink: 0;
            background: #fff;
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 0;
          }
          .ct-card.current {
            border-color: var(--royal);
            box-shadow: 0 0 0 2px rgba(0,35,102,0.12);
          }
          .ct-connector {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 32px;
            width: 72px;
            flex-shrink: 0;
            gap: 4px;
          }
          .ct-arrow-line {
            display: flex;
            align-items: center;
            width: 100%;
            position: relative;
          }
          .ct-arrow-line::before {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--line);
          }
          .ct-arrow-head {
            width: 0; height: 0;
            border-top: 5px solid transparent;
            border-bottom: 5px solid transparent;
            border-left: 8px solid var(--ink-mute);
          }
          .ct-delta {
            font-size: 10px;
            font-family: Inter, sans-serif;
            font-weight: 700;
            color: var(--success);
            white-space: nowrap;
          }
          .ct-delta.negative { color: var(--error); }

          @media (max-width: 767px) {
            .ct-timeline {
              flex-direction: column;
              overflow-x: visible;
            }
            .ct-step-wrap {
              flex-direction: column;
              align-items: stretch;
              width: 100%;
            }
            .ct-card {
              width: auto;
            }
            .ct-connector {
              flex-direction: row;
              padding-top: 0;
              padding-left: 20px;
              width: auto;
              height: 48px;
              align-items: center;
              gap: 8px;
            }
            .ct-arrow-line {
              flex-direction: column;
              width: 1px;
              height: 100%;
            }
            .ct-arrow-line::before {
              content: '';
              width: 1px;
              height: 100%;
              flex: 1;
            }
            .ct-arrow-head {
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 8px solid var(--ink-mute);
              border-bottom: none;
            }
          }
        `}</style>

        <div className="ct-timeline">
          {steps.map((step, i) => {
            const name = companyDisplay(step);
            const period = formatPeriod(step.started_at, step.ended_at, step.is_current);
            const duration = formatDuration(step.started_at, step.ended_at, step.is_current);
            const prevStep = i > 0 ? steps[i - 1] : null;
            const delta = prevStep ? salaryDelta(prevStep, step) : null;

            return (
              <div key={step.id} className="ct-step-wrap">
                {/* コネクター（前のステップとの間） */}
                {i > 0 && (
                  <div className="ct-connector">
                    {delta !== null && (
                      <span className={`ct-delta${delta < 0 ? " negative" : ""}`}>
                        {formatDelta(delta)}
                      </span>
                    )}
                    <div className="ct-arrow-line">
                      <div className="ct-arrow-head" />
                    </div>
                  </div>
                )}

                {/* ステップカード */}
                <div className={`ct-card${step.is_current ? " current" : ""}`}>
                  {/* 在籍中バッジ */}
                  {step.is_current && (
                    <div style={{
                      alignSelf: "flex-start",
                      marginBottom: 8,
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                      color: "var(--royal)",
                      background: "var(--royal-50)", borderRadius: 100,
                      padding: "2px 8px",
                    }}>
                      現在
                    </div>
                  )}

                  {/* 企業名 */}
                  {step.visibility_company === "real" && step.company_id ? (
                    <Link
                      href={`/companies/${step.company_id}`}
                      style={{
                        fontSize: 15, fontWeight: 800, color: "var(--royal)",
                        textDecoration: "none", lineHeight: 1.3, marginBottom: 4,
                        display: "block",
                      }}
                    >
                      {name}
                    </Link>
                  ) : (
                    <div style={{
                      fontSize: 15, fontWeight: 800, color: "var(--ink)",
                      lineHeight: 1.3, marginBottom: 4,
                    }}>
                      {name}
                    </div>
                  )}

                  {/* 役職 */}
                  {step.role_title && (
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
                      {step.role_title}
                    </div>
                  )}

                  {/* 在籍期間 */}
                  <div style={{
                    fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif",
                    marginBottom: 6,
                  }}>
                    {period}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--ink-mute)", marginBottom: 12,
                  }}>
                    在籍 {duration}
                    {step.employment_type && ` ・ ${step.employment_type}`}
                  </div>

                  {/* 転職のきっかけ（visibility_reason=true かつ入力あり） */}
                  {step.join_reason && (
                    <div style={{
                      fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6,
                      fontStyle: "italic",
                      borderTop: "1px solid var(--line-soft)", paddingTop: 10, marginBottom: 10,
                    }}>
                      {step.join_reason}
                    </div>
                  )}

                  {/* 年収チップ（visibility_salary=true かつ salary_man != null のみ） */}
                  {step.salary_man !== null && (
                    <div style={{
                      alignSelf: "flex-start", marginTop: "auto", paddingTop: 8,
                      fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                      color: "var(--success)",
                      background: "var(--success-soft)", borderRadius: 100,
                      padding: "3px 10px",
                    }}>
                      {formatSalary(step.salary_man)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 注記 ── */}
        <p style={{ marginTop: 32, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
          ※ 企業名・年収の一部は本人の希望により非公開にしている場合があります
        </p>

        {/* ── CTA ── */}
        <div style={{
          marginTop: 48, background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>
            同じようなキャリアパスを考えていますか？
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 20 }}>
            アドバイザーに直接相談する
          </div>
          <Link
            href="/mentors"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, var(--warm) 0%, #f97316 100%)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              padding: "12px 28px", borderRadius: 8, textDecoration: "none",
            }}
          >
            先輩アドバイザーを探す →
          </Link>
        </div>
      </div>
    </div>
  );
}

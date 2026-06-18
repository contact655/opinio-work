import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

type CompanyLogo = {
  id: string;
  name: string;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
};

// ────────────────────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────────────────────

function companyDisplay(step: PublicStep, logoMap: Record<string, CompanyLogo>): string {
  if (step.visibility_company === "real") {
    if (step.company_text) return step.company_text;
    if (step.company_id && logoMap[step.company_id]?.name) return logoMap[step.company_id].name;
  }
  return step.company_anonymized ?? "企業名非公開";
}

function formatPeriod(started_at: string, ended_at: string | null, is_current: boolean): string {
  const start = started_at.slice(0, 7).replace("-", ".");
  if (is_current) return `${start} – 現在`;
  const end = ended_at ? ended_at.slice(0, 7).replace("-", ".") : "";
  return `${start} – ${end}`;
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

function formatSalary(man: number): string {
  return `${man.toLocaleString()}万円`;
}

// ────────────────────────────────────────────────────────────────
// ロゴコンポーネント
// ────────────────────────────────────────────────────────────────

function CompanyLogoSmall({
  logo,
  name,
  size = 34,
}: {
  logo: CompanyLogo | null;
  name: string;
  size?: number;
}) {
  if (logo?.logo_url) {
    return (
      <img
        src={logo.logo_url}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }}
      />
    );
  }
  const bg = logo?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
  const letter = logo?.logo_letter ?? name.charAt(0);
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: Math.floor(size * 0.41),
      fontFamily: "Inter, sans-serif",
    }}>
      {letter}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getData(userId: string) {
  const supabase = createClient();

  const [profileRes, stepsRes] = await Promise.all([
    supabase
      .from("ow_career_profiles")
      .select("headline, years_of_experience, is_published")
      .eq("user_id", userId)
      .eq("is_published", true)
      .maybeSingle(),
    supabase.rpc("get_public_career_steps", { p_user_id: userId }),
  ]);

  if (!profileRes.data) return null;

  // 古い順（display_order 降順）に並び替え: display_order=5=最初の会社、1=現職
  const steps = ((stepsRes.data ?? []) as PublicStep[])
    .slice()
    .sort((a, b) => b.display_order - a.display_order);

  // 実名公開のステップから company_id を収集してロゴ+社名を一括取得
  const companyIds = Array.from(
    new Set(
      steps
        .filter((s) => s.visibility_company === "real" && s.company_id)
        .map((s) => s.company_id as string)
    )
  );

  // ロゴ取得: is_published=false の会社も含むため admin client（RLS バイパス）を使用
  const logoMap: Record<string, CompanyLogo> = {};
  if (companyIds.length > 0) {
    const adminSupabase = createAdminClient();
    const { data: logos } = await adminSupabase
      .from("ow_companies")
      .select("id, name, logo_url, logo_gradient, logo_letter")
      .in("id", companyIds);
    if (logos) {
      for (const l of logos) logoMap[l.id] = l;
    }
  }

  return { profile: profileRes.data, steps, logoMap };
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

  const { profile, steps, logoMap } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>

      {/* ── パンくず ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 12, color: "var(--ink-mute)" }}>
          <Link href="/career-trajectories" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
            キャリア軌跡
          </Link>
          <span style={{ margin: "0 6px" }}>›</span>
          <span style={{ color: "var(--ink-soft)" }}>キャリア詳細</span>
        </div>
      </div>

      {/* ── プロフィールヘッダー ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "40px 24px 36px",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.1em", opacity: 0.6, marginBottom: 2 }}>
                CAREER TRAJECTORY
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "Noto Serif JP, serif" }}>
                キャリア軌跡
              </h1>
            </div>
          </div>

          {profile.headline && (
            <p style={{ fontSize: 15, opacity: 0.85, margin: "0 0 16px", lineHeight: 1.6 }}>
              {profile.headline}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 100, padding: "4px 12px", fontSize: 12 }}>
              {steps.length}社を経験
            </span>
            {profile.years_of_experience && (
              <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 100, padding: "4px 12px", fontSize: 12 }}>
                社会人歴 {profile.years_of_experience}年
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 縦タイムライン（古い順 → 現在）── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ position: "relative" }}>
          {/* 縦線 */}
          <div style={{
            position: "absolute", left: 16, top: 8, bottom: 8,
            width: 2, background: "var(--line)", zIndex: 0,
          }} />

          {steps.map((step, i) => {
            const name = companyDisplay(step, logoMap);
            const period = formatPeriod(step.started_at, step.ended_at, step.is_current);
            const duration = formatDuration(step.started_at, step.ended_at, step.is_current);
            const logo = step.company_id ? (logoMap[step.company_id] ?? null) : null;
            const prevStep = i > 0 ? steps[i - 1] : null;

            // 年収デルタ（古い→新しいの変化）
            const delta = (prevStep && prevStep.salary_man !== null && step.salary_man !== null)
              ? step.salary_man - prevStep.salary_man
              : null;

            // 同一会社からの社内昇格・異動か
            const isSameCompany = !!(
              prevStep &&
              step.company_id &&
              prevStep.company_id &&
              step.company_id === prevStep.company_id
            );

            return (
              <div key={step.id} style={{ position: "relative", paddingLeft: 48 }}>

                {/* タイムラインドット */}
                <div style={{
                  position: "absolute", left: 10, top: 20,
                  width: 14, height: 14, borderRadius: "50%", zIndex: 1,
                  background: step.is_current ? "var(--royal)" : "#fff",
                  border: `2px solid ${step.is_current ? "var(--royal)" : "var(--line)"}`,
                }} />

                {/* コネクター（2ステップ目以降） */}
                {i > 0 && (
                  <div style={{
                    position: "absolute", left: -4, top: -18,
                    zIndex: 2, display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {isSameCompany ? (
                      /* 社内昇格・異動 */
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                        color: "var(--royal)", background: "var(--royal-50)",
                        padding: "2px 7px", borderRadius: 100,
                        border: "1px solid var(--royal-100)",
                        whiteSpace: "nowrap",
                      }}>
                        社内昇格・異動
                      </span>
                    ) : delta !== null ? (
                      /* 年収変化バッジ */
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
                        color: delta >= 0 ? "var(--success)" : "var(--error)",
                        background: delta >= 0 ? "var(--success-soft)" : "var(--error-soft)",
                        padding: "2px 7px", borderRadius: 100,
                        border: `1px solid ${delta >= 0 ? "#6ee7b7" : "#fca5a5"}`,
                        whiteSpace: "nowrap",
                      }}>
                        {delta >= 0 ? "+" : ""}{delta.toLocaleString()}万円
                      </span>
                    ) : null}
                  </div>
                )}

                {/* ステップカード */}
                <div style={{
                  background: "#fff",
                  border: `1px solid ${step.is_current ? "var(--royal)" : isSameCompany ? "var(--royal-100)" : "var(--line)"}`,
                  borderRadius: 12,
                  padding: "20px 20px 18px",
                  marginBottom: i < steps.length - 1 ? 28 : 0,
                  boxShadow: step.is_current ? "0 0 0 3px rgba(0,35,102,0.06)" : "none",
                }}>

                  {/* バッジ行 */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                    {step.is_current && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                        color: "var(--royal)", background: "var(--royal-50)", borderRadius: 100, padding: "2px 8px",
                      }}>
                        現在
                      </span>
                    )}
                  </div>

                  {/* 企業ロゴ + 名前 行 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <CompanyLogoSmall logo={logo} name={name} size={34} />
                    <div>
                      {step.visibility_company === "real" && step.company_id ? (
                        <Link
                          href={`/companies/${step.company_id}`}
                          style={{ fontSize: 15, fontWeight: 800, color: "var(--royal)", textDecoration: "none", display: "block", lineHeight: 1.2 }}
                        >
                          {name}
                        </Link>
                      ) : (
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.2 }}>
                          {name}
                        </div>
                      )}
                      {step.role_title && (
                        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                          {step.role_title}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 在籍期間 */}
                  <div style={{
                    display: "flex", gap: 12, flexWrap: "wrap",
                    fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif",
                    marginBottom: step.join_reason || step.salary_man !== null ? 12 : 0,
                  }}>
                    <span>{period}</span>
                    <span>({duration}{step.employment_type ? ` · ${step.employment_type}` : ""})</span>
                  </div>

                  {/* 入社・転職のきっかけ */}
                  {step.join_reason && (
                    <div style={{ marginBottom: step.salary_man !== null ? 12 : 0 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
                        letterSpacing: "0.06em", marginBottom: 6,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        入社・転職のきっかけ
                      </div>
                      <div style={{
                        fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75,
                        background: "var(--bg-tint)", borderRadius: 8, padding: "10px 14px",
                      }}>
                        {step.join_reason}
                      </div>
                    </div>
                  )}

                  {/* 年収チップ（visibility_salary=true かつ salary_man != null のみ） */}
                  {step.salary_man !== null && (
                    <div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                        color: "var(--success)", background: "var(--success-soft)",
                        borderRadius: 100, padding: "3px 10px",
                      }}>
                        {formatSalary(step.salary_man)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 注記 ── */}
        <p style={{ marginTop: 40, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
          ※ 企業名・年収の一部は本人の希望により非公開にしている場合があります
        </p>

        {/* ── CTA ── */}
        <div style={{
          marginTop: 48, background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
            同じようなキャリアパスを考えていますか？
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 20 }}>
            先輩アドバイザーに直接相談する
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
            先輩を探す →
          </Link>
        </div>
      </div>
    </div>
  );
}

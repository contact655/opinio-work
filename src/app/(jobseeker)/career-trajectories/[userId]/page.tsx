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
  role_category_id: string | null;
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

type RoleInfo = {
  name: string;
  parent_name: string | null;
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
  const fmt = (s: string) => {
    const [y, m] = s.slice(0, 7).split("-");
    return `${y}年${parseInt(m)}月`;
  };
  const start = fmt(started_at);
  if (is_current) return `${start} – 現在`;
  const end = ended_at ? fmt(ended_at) : "";
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

// ────────────────────────────────────────────────────────────────
// 同一会社の連続ステップをグループ化
// ────────────────────────────────────────────────────────────────

type StepGroupData = {
  companyId: string | null;
  companySteps: PublicStep[];
};

function buildGroups(steps: PublicStep[]): StepGroupData[] {
  const groups: StepGroupData[] = [];
  for (const step of steps) {
    const last = groups[groups.length - 1];
    if (last && step.company_id && last.companyId === step.company_id) {
      last.companySteps.push(step);
    } else {
      groups.push({ companyId: step.company_id, companySteps: [step] });
    }
  }
  return groups;
}

// ────────────────────────────────────────────────────────────────
// ロゴコンポーネント（/u/[id] に合わせ大きく）
// ────────────────────────────────────────────────────────────────

function CompanyLogo({
  logo,
  name,
  size = 52,
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
        style={{ borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0, display: "block" }}
      />
    );
  }
  const bg = logo?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
  const letter = logo?.logo_letter ?? name.charAt(0);
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: bg, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: Math.floor(size * 0.40),
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
  const adminSupabase = createAdminClient();

  const [profileRes, userVisRes, stepsRes] = await Promise.all([
    adminSupabase
      .from("ow_career_profiles")
      .select("headline, years_of_experience, is_published")
      .eq("user_id", userId)
      .eq("is_published", true)
      .maybeSingle(),
    adminSupabase
      .from("ow_users")
      .select("visibility")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("get_public_career_steps", { p_user_id: userId }),
  ]);

  if (!profileRes.data || userVisRes.data?.visibility !== "public") return null;

  const { data: extraData } = await adminSupabase
    .from("ow_career_profiles")
    .select("gender, birth_year")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = {
    ...profileRes.data,
    gender: (extraData as { gender?: string | null } | null)?.gender ?? null,
    birth_year: (extraData as { birth_year?: number | null } | null)?.birth_year ?? null,
  };

  const steps = ((stepsRes.data ?? []) as PublicStep[])
    .slice()
    .sort((a, b) => b.display_order - a.display_order); // 古い順（古い職歴が先頭）

  const companyIds = Array.from(
    new Set(
      steps
        .filter((s) => s.visibility_company === "real" && s.company_id)
        .map((s) => s.company_id as string)
    )
  );

  const logoMap: Record<string, CompanyLogo> = {};
  if (companyIds.length > 0) {
    const { data: logos } = await adminSupabase
      .from("ow_companies")
      .select("id, name, logo_url, logo_gradient, logo_letter")
      .in("id", companyIds);
    if (logos) {
      for (const l of logos) logoMap[l.id] = l;
    }
  }

  // ow_roles から 部門(parent) / 職種(child) を取得
  const roleMap: Record<string, RoleInfo> = {};
  const { data: allRoles } = await adminSupabase
    .from("ow_roles")
    .select("id, name, parent_id");
  if (allRoles) {
    const byId: Record<string, { name: string; parent_id: string | null }> = {};
    for (const r of allRoles as { id: string; name: string; parent_id: string | null }[]) {
      byId[r.id] = { name: r.name, parent_id: r.parent_id };
    }
    for (const r of allRoles as { id: string; name: string; parent_id: string | null }[]) {
      roleMap[r.id] = {
        name: r.name,
        parent_name: r.parent_id ? (byId[r.parent_id]?.name ?? null) : null,
      };
    }
  }

  return { profile, steps, logoMap, roleMap };
}

// ────────────────────────────────────────────────────────────────
// 構造化インフォテーブル（部門 / 職種 / 役職）
// ────────────────────────────────────────────────────────────────

function RoleInfoTable({
  role,
  roleTitle,
  compact = false,
}: {
  role: RoleInfo | null;
  roleTitle: string | null;
  compact?: boolean;
}) {
  const cells: { label: string; value: string }[] = [];
  if (role?.parent_name) cells.push({ label: "部門", value: role.parent_name });
  if (role) cells.push({ label: "職種", value: role.name });
  if (roleTitle) cells.push({ label: "役職", value: roleTitle });
  if (cells.length === 0) return null;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap",
      border: "1px solid var(--line-soft)", borderRadius: 8, overflow: "hidden",
      marginBottom: compact ? 8 : 14,
      fontSize: compact ? 11 : 12,
    }}>
      {cells.map((cell, i) => (
        <div key={cell.label} style={{
          display: "flex", flexDirection: "column",
          padding: compact ? "5px 10px" : "7px 14px",
          borderRight: i < cells.length - 1 ? "1px solid var(--line-soft)" : undefined,
          minWidth: 0,
        }}>
          <span style={{ fontSize: compact ? 9 : 10, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.06em", marginBottom: 2, whiteSpace: "nowrap" }}>
            {cell.label}
          </span>
          <span style={{ fontWeight: 600, color: "var(--ink)", lineHeight: 1.35 }}>
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
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

  const { profile, steps, logoMap, roleMap } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <style>{`
        .traj-step-card {
          display: grid;
          grid-template-columns: 1fr 220px;
          background: #fff;
          border-radius: 14px;
          overflow: hidden;
        }
        .traj-role-section {
          display: grid;
          grid-template-columns: 1fr 220px;
        }
        @media (max-width: 680px) {
          .traj-step-card { grid-template-columns: 1fr; }
          .traj-step-sidebar { border-left: none !important; border-top: 1px solid var(--line-soft); }
          .traj-role-section { grid-template-columns: 1fr; }
          .traj-role-sidebar { border-left: none !important; border-top: 1px solid var(--line-soft); }
        }
        .traj-company-link:hover { text-decoration: underline; }
      `}</style>

      {/* ── パンくず ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "12px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", fontSize: 12, color: "var(--ink-mute)" }}>
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
        padding: "44px 24px 40px",
        color: "#fff",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* アバター + ラベル */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.12em", opacity: 0.5, marginBottom: 4, fontFamily: "Inter, sans-serif", textTransform: "uppercase" }}>
                Career Trajectory
              </div>
              {profile.headline ? (
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, fontFamily: "Noto Serif JP, serif", lineHeight: 1.4 }}>
                  {profile.headline}
                </h1>
              ) : (
                <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, fontFamily: "Noto Serif JP, serif" }}>
                  キャリア軌跡
                </h1>
              )}
            </div>
          </div>

          {/* バッジ行 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {profile.birth_year && (
              <span style={{
                background: "rgba(255,255,255,0.18)", borderRadius: 100,
                padding: "4px 14px", fontSize: 14, fontWeight: 800,
                fontFamily: "Inter, sans-serif",
              }}>
                {new Date().getFullYear() - profile.birth_year}
                <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 2 }}>歳</span>
              </span>
            )}
            {profile.gender && (
              <span style={{
                background: "rgba(255,255,255,0.14)", borderRadius: 100,
                padding: "4px 14px", fontSize: 13, fontWeight: 700,
              }}>
                {profile.gender}
              </span>
            )}
            <span style={{
              background: "rgba(255,255,255,0.1)", borderRadius: 100,
              padding: "4px 14px", fontSize: 12, fontWeight: 600,
            }}>
              {steps.length}社を経験
            </span>
            {profile.years_of_experience && (
              <span style={{
                background: "rgba(255,255,255,0.1)", borderRadius: 100,
                padding: "4px 14px", fontSize: 12, fontWeight: 600,
              }}>
                社会人歴 {profile.years_of_experience}年
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 縦タイムライン ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 80px" }}>

        {/* ラベル */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)",
          marginBottom: 28, fontFamily: "Inter, sans-serif", textTransform: "uppercase",
        }}>
          職歴
        </div>

        <div style={{ position: "relative" }}>
          {/* 縦線 */}
          <div style={{
            position: "absolute", left: 18, top: 12, bottom: 12,
            width: 2, background: "var(--line)", zIndex: 0,
          }} />

          {(() => {
            const groups = buildGroups(steps);
            return groups.map((group, groupIdx) => {
              const prevGroup = groupIdx > 0 ? groups[groupIdx - 1] : null;
              const firstStep = group.companySteps[0];
              const lastStep = group.companySteps[group.companySteps.length - 1];
              const prevLastStep = prevGroup
                ? prevGroup.companySteps[prevGroup.companySteps.length - 1]
                : null;

              const groupYear = firstStep.started_at.slice(0, 4);
              const prevGroupYear = prevGroup?.companySteps[0].started_at.slice(0, 4);
              const showYearHeader = groupYear !== prevGroupYear;

              const isCurrentGroup = group.companySteps.some((s) => s.is_current);
              const logo = firstStep.company_id ? (logoMap[firstStep.company_id] ?? null) : null;
              const name = companyDisplay(firstStep, logoMap);

              // 年収デルタ（会社変更時のみ）
              const delta =
                prevLastStep?.salary_man != null && firstStep.salary_man != null
                  ? firstStep.salary_man - prevLastStep.salary_man
                  : null;

              const isSingle = group.companySteps.length === 1;
              const step = group.companySteps[0];

              return (
                <div key={`group-${groupIdx}`}>
                  {/* 年ヘッダー */}
                  {showYearHeader && (
                    <div style={{ paddingLeft: 52, marginBottom: 10, marginTop: groupIdx > 0 ? 4 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif" }}>
                        {groupYear}
                      </span>
                    </div>
                  )}

                  <div style={{ position: "relative", paddingLeft: 52, marginBottom: groupIdx < groups.length - 1 ? 32 : 0 }}>
                    {/* タイムラインドット */}
                    <div style={{
                      position: "absolute", left: 11, top: 22,
                      width: 16, height: 16, borderRadius: "50%", zIndex: 1,
                      background: isCurrentGroup ? "var(--royal)" : "#fff",
                      border: `2.5px solid ${isCurrentGroup ? "var(--royal)" : "var(--line)"}`,
                      boxShadow: isCurrentGroup ? "0 0 0 4px rgba(0,35,102,0.1)" : "none",
                    }} />

                    {/* コネクターバッジ（前グループとの間） */}
                    {groupIdx > 0 && delta !== null && (
                      <div style={{ position: "absolute", left: -2, top: -20, zIndex: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
                          color: delta >= 0 ? "var(--success)" : "var(--error)",
                          background: delta >= 0 ? "var(--success-soft)" : "var(--error-soft)",
                          padding: "2px 8px", borderRadius: 100,
                          border: `1px solid ${delta >= 0 ? "#6ee7b7" : "#fca5a5"}`,
                          whiteSpace: "nowrap",
                        }}>
                          {delta >= 0 ? "+" : ""}{delta.toLocaleString()}万円
                        </span>
                      </div>
                    )}

                    {isSingle ? (
                      /* ── 単独ステップカード ── */
                      <div
                        className="traj-step-card"
                        style={{
                          border: `1px solid ${isCurrentGroup ? "var(--royal)" : "var(--line)"}`,
                          boxShadow: isCurrentGroup ? "0 0 0 3px rgba(0,35,102,0.06)" : "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ padding: "22px 22px 18px" }}>
                          {step.is_current && (
                            <div style={{ marginBottom: 10 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--royal)", background: "var(--royal-50)", borderRadius: 100, padding: "2px 10px", border: "1px solid var(--royal-100)" }}>現在</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                            {step.visibility_company === "real" && step.company_id ? (
                              <Link href={`/companies/${step.company_id}`} style={{ flexShrink: 0, display: "block" }}>
                                <CompanyLogo logo={logo} name={name} size={52} />
                              </Link>
                            ) : (
                              <CompanyLogo logo={logo} name={name} size={52} />
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              {step.visibility_company === "real" && step.company_id ? (
                                <Link href={`/companies/${step.company_id}`} className="traj-company-link"
                                  style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", textDecoration: "none", display: "block", lineHeight: 1.25 }}>
                                  {name}
                                </Link>
                              ) : (
                                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25 }}>{name}</div>
                              )}
                              <div style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginTop: 4 }}>
                                {formatPeriod(step.started_at, step.ended_at, step.is_current)}
                                <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                                {formatDuration(step.started_at, step.ended_at, step.is_current)}
                                {step.employment_type && <><span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>{step.employment_type}</>}
                              </div>
                            </div>
                          </div>
                          {/* 構造化インフォテーブル */}
                          <RoleInfoTable
                            role={step.role_category_id ? (roleMap[step.role_category_id] ?? null) : null}
                            roleTitle={step.role_title}
                          />
                          {step.description && (
                            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: step.salary_man !== null ? 14 : 0 }}>{step.description}</div>
                          )}
                          {step.salary_man !== null && (
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--success)", background: "var(--success-soft)", borderRadius: 100, padding: "3px 12px", border: "1px solid #6ee7b7" }}>
                                {step.salary_man.toLocaleString()}万円
                              </span>
                            </div>
                          )}
                        </div>
                        {step.join_reason && (
                          <div className="traj-step-sidebar" style={{ borderLeft: "1px solid var(--line-soft)", background: "var(--bg-tint)", padding: "22px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-mute)", textTransform: "uppercase", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              入社・転職のきっかけ
                            </div>
                            <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>{step.join_reason}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── 複数ロール: グループカード ── */
                      <div style={{
                        background: "#fff", borderRadius: 14, overflow: "hidden",
                        border: `1px solid ${isCurrentGroup ? "var(--royal)" : "var(--line)"}`,
                        boxShadow: isCurrentGroup ? "0 0 0 3px rgba(0,35,102,0.06)" : "0 1px 4px rgba(0,0,0,0.04)",
                      }}>
                        {/* 会社ヘッダー（1回だけ） */}
                        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 14 }}>
                          {firstStep.visibility_company === "real" && firstStep.company_id ? (
                            <Link href={`/companies/${firstStep.company_id}`} style={{ flexShrink: 0 }}>
                              <CompanyLogo logo={logo} name={name} size={48} />
                            </Link>
                          ) : (
                            <CompanyLogo logo={logo} name={name} size={48} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {firstStep.visibility_company === "real" && firstStep.company_id ? (
                              <Link href={`/companies/${firstStep.company_id}`} className="traj-company-link"
                                style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", textDecoration: "none", display: "block", lineHeight: 1.25 }}>
                                {name}
                              </Link>
                            ) : (
                              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25 }}>{name}</div>
                            )}
                            <div style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                              {formatPeriod(firstStep.started_at, lastStep.ended_at, lastStep.is_current)}
                              <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                              {group.companySteps.length}ポジション
                            </div>
                          </div>
                          {isCurrentGroup && (
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--royal)", background: "var(--royal-50)", borderRadius: 100, padding: "2px 10px", border: "1px solid var(--royal-100)", flexShrink: 0 }}>現在</span>
                          )}
                        </div>

                        {/* 各ロール */}
                        {group.companySteps.map((roleStep, roleIdx) => (
                          <div key={roleStep.id}>
                            {/* 社内昇格・異動ディバイダー */}
                            {roleIdx > 0 && (
                              <div style={{
                                padding: "6px 22px", fontSize: 10, fontWeight: 700,
                                letterSpacing: "0.05em", color: "var(--royal)",
                                background: "var(--royal-50)",
                                borderTop: "1px solid var(--royal-100)",
                                borderBottom: "1px solid var(--royal-100)",
                                fontFamily: "Inter, sans-serif",
                              }}>
                                ↑ 社内昇格・異動
                              </div>
                            )}

                            {/* ロールセクション: 2カラム */}
                            <div className="traj-role-section">
                              <div style={{ padding: "16px 22px 14px" }}>
                                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", marginBottom: 8 }}>
                                  {formatPeriod(roleStep.started_at, roleStep.ended_at, roleStep.is_current)}
                                  <span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>
                                  {formatDuration(roleStep.started_at, roleStep.ended_at, roleStep.is_current)}
                                  {roleStep.employment_type && <><span style={{ margin: "0 6px", opacity: 0.5 }}>·</span>{roleStep.employment_type}</>}
                                </div>
                                {/* 構造化インフォテーブル */}
                                <RoleInfoTable
                                  role={roleStep.role_category_id ? (roleMap[roleStep.role_category_id] ?? null) : null}
                                  roleTitle={roleStep.role_title}
                                  compact
                                />
                                {roleStep.description && (
                                  <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: roleStep.salary_man !== null ? 12 : 0 }}>{roleStep.description}</div>
                                )}
                                {roleStep.salary_man !== null && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--success)", background: "var(--success-soft)", borderRadius: 100, padding: "3px 12px", border: "1px solid #6ee7b7" }}>
                                      {roleStep.salary_man.toLocaleString()}万円
                                    </span>
                                    {roleIdx > 0 && (() => {
                                      const prev = group.companySteps[roleIdx - 1];
                                      if (prev.salary_man == null || roleStep.salary_man == null) return null;
                                      const d = roleStep.salary_man - prev.salary_man;
                                      if (d === 0) return null;
                                      return (
                                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", color: d >= 0 ? "var(--success)" : "var(--error)" }}>
                                          ({d >= 0 ? "+" : ""}{d.toLocaleString()}万円)
                                        </span>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* サイドバー */}
                              {roleStep.join_reason && (
                                <div className="traj-role-sidebar" style={{ borderLeft: "1px solid var(--line-soft)", background: "var(--bg-tint)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-mute)", textTransform: "uppercase", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    {roleIdx === 0 ? "入社・転職のきっかけ" : "昇格・異動のきっかけ"}
                                  </div>
                                  <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>{roleStep.join_reason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* 注記 */}
        <p style={{ marginTop: 40, fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
          ※ 企業名・年収の一部は本人の希望により非公開にしている場合があります
        </p>

        {/* CTA */}
        <div style={{
          marginTop: 48, background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
            同じようなキャリアパスを考えていますか？
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 20, fontFamily: "Noto Serif JP, serif" }}>
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

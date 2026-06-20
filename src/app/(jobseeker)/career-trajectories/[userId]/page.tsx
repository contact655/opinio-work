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
  join_reason: string | null;
  turning_point: string | null;
  exit_reason: string | null;
  employment_type: string | null;
  salary_man: number | null;
  display_order: number;
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
// ロゴコンポーネント（64px、MergedTimeline と同スタイル）
// ────────────────────────────────────────────────────────────────

function CompanyLogoIcon({
  logo,
  name,
  isCurrent = false,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent?: boolean;
}) {
  const size = 48;
  const wrapStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: 11, flexShrink: 0,
    position: "relative", zIndex: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  if (logo?.logo_url) {
    return (
      <div style={wrapStyle}>
        <img
          src={logo.logo_url}
          alt={name}
          width={size}
          height={size}
          style={{ borderRadius: 11, objectFit: "cover", border: "1px solid var(--line)", display: "block" }}
        />
      </div>
    );
  }
  const bg = logo?.logo_gradient
    ?? (isCurrent
      ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
      : "linear-gradient(135deg, #64748B 0%, #94A3B8 100%)");
  const letter = logo?.logo_letter ?? name.charAt(0);
  return (
    <div style={{ ...wrapStyle, background: bg }}>
      <span style={{ color: "#fff", fontWeight: 800, fontSize: 20, fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
        {letter}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// バッジ
// ────────────────────────────────────────────────────────────────

function CurrentBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
      color: "var(--success)", background: "var(--success-soft)",
      border: "1px solid #6ee7b7", borderRadius: 4,
      padding: "1px 6px", verticalAlign: "middle", marginLeft: 6, lineHeight: 1.6,
    }}>
      <span className="tl-pulse-dot" />
      在籍中
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// 構造化インフォテーブル（部門 / 職種 / 役職）
// ────────────────────────────────────────────────────────────────

function RoleInfoTable({
  role,
  roleTitle,
  size = "md",
}: {
  role: RoleInfo | null;
  roleTitle: string | null;
  size?: "sm" | "md";
}) {
  const cells: { label: string; value: string }[] = [];
  if (role?.parent_name) cells.push({ label: "部門", value: role.parent_name });
  if (role) cells.push({ label: "職種", value: role.name });
  if (roleTitle) cells.push({ label: "役職", value: roleTitle });
  if (cells.length === 0) return null;

  const labelSz = size === "sm" ? 9 : 10;
  const valueSz = size === "sm" ? 12 : 13;

  return (
    <div style={{
      display: "inline-flex", flexWrap: "wrap",
      border: "1px solid var(--line-soft)", borderRadius: 7, overflow: "hidden",
      fontSize: valueSz, marginBottom: size === "sm" ? 6 : 8,
    }}>
      {cells.map((cell, i) => (
        <div key={cell.label} style={{
          display: "flex", flexDirection: "column",
          padding: size === "sm" ? "4px 10px" : "5px 12px",
          borderRight: i < cells.length - 1 ? "1px solid var(--line-soft)" : undefined,
          background: "#FAFBFC",
        }}>
          <span style={{ fontSize: labelSz, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em", marginBottom: 1, whiteSpace: "nowrap" }}>
            {cell.label}
          </span>
          <span style={{ fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// インタビューコンテンツブロック
// ────────────────────────────────────────────────────────────────

type ContentBlockConfig = {
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
  text: string | null;
  hide?: boolean;
};

function InterviewContent({ blocks }: { blocks: ContentBlockConfig[] }) {
  const visible = blocks.filter((b) => !b.hide && b.text);
  if (visible.length === 0) return null;
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {visible.map((block) => (
        <div key={block.key} style={{
          background: block.bg, border: `1px solid ${block.border}`,
          borderRadius: 10, padding: "12px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%",
              background: block.color, color: "#fff", flexShrink: 0,
            }}>
              {block.icon}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: block.color, letterSpacing: "0.05em", fontFamily: "Inter, sans-serif" }}>
              {block.label}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>
            {block.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────────────────────────

async function getData(userId: string) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  const [profileRes, userRes, stepsRes] = await Promise.all([
    adminSupabase
      .from("ow_career_profiles")
      .select("headline, years_of_experience, is_published, gender, birth_year")
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

  if (!profileRes.data || userRes.data?.visibility !== "public") return null;

  const steps = ((stepsRes.data ?? []) as PublicStep[])
    .slice()
    .sort((a, b) => b.display_order - a.display_order);

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

  return { profile: profileRes.data, steps, logoMap, roleMap };
}

// ────────────────────────────────────────────────────────────────
// アイコン SVG
// ────────────────────────────────────────────────────────────────

const IconDoor = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconBriefcase = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconStar = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconArrow = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ────────────────────────────────────────────────────────────────
// インタビューブロックビルダー
// ────────────────────────────────────────────────────────────────

function buildBlocks(
  step: PublicStep,
  joinLabel: string,
  showExitReason: boolean,
): ContentBlockConfig[] {
  return [
    {
      key: "join",
      label: joinLabel,
      color: "var(--royal)",
      bg: "var(--royal-50)",
      border: "var(--royal-100)",
      icon: IconDoor,
      text: step.join_reason,
    },
    {
      key: "desc",
      label: "仕事の内容・成果",
      color: "#64748B",
      bg: "var(--bg-tint)",
      border: "var(--line-soft)",
      icon: IconBriefcase,
      text: step.description,
    },
    {
      key: "turn",
      label: "転機・成長のポイント",
      color: "#D97706",
      bg: "#FFFBEB",
      border: "#FDE68A",
      icon: IconStar,
      text: step.turning_point,
    },
    {
      key: "exit",
      label: "次のステップへ",
      color: "var(--purple)",
      bg: "var(--purple-soft)",
      border: "#DDD6FE",
      icon: IconArrow,
      text: step.exit_reason,
      hide: !showExitReason || step.is_current,
    },
  ];
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

  const groups = buildGroups(steps);
  const totalCompanies = groups.length;
  const currentStep = steps.find((s) => s.is_current);
  const currentCompanyName = currentStep ? companyDisplay(currentStep, logoMap) : null;

  const roleSet = new Set<string>();
  for (const s of steps) {
    if (s.role_category_id && roleMap[s.role_category_id]) {
      roleSet.add(roleMap[s.role_category_id].name);
    }
  }
  const roleLabels = Array.from(roleSet).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA" }}>
      <style>{`
        .traj-company-link { transition: color 0.15s; }
        .traj-company-link:hover { color: var(--royal) !important; text-decoration: underline; text-underline-offset: 3px; }

        /* Timeline grid */
        .traj-timeline {
          position: relative;
        }
        .traj-timeline::before {
          content: "";
          position: absolute;
          top: 40px; bottom: 40px; left: 40px;
          width: 2px;
          background: #CBD5E1;
          z-index: 0;
        }

        .traj-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          align-items: start;
        }
        .traj-row + .traj-row {
          border-top: 1px solid var(--line-soft);
          padding-top: 8px;
          margin-top: 4px;
        }
        .traj-row-current {
          background: linear-gradient(90deg, rgba(0,35,102,0.04) 0%, transparent 60%);
          border-radius: 8px;
        }

        /* Year separator */
        .traj-year-sep {
          display: grid;
          grid-template-columns: 80px 1fr;
          align-items: center;
          position: relative;
          z-index: 2;
          margin: 8px 0 0;
        }

        /* 在籍中パルスドット */
        .tl-pulse-dot {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--success);
          animation: pulseDot 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>

      {/* ── パンくず ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line-soft)", padding: "10px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/career-trajectories" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
            キャリア軌跡
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span style={{ color: "var(--ink-soft)" }}>キャリア詳細</span>
        </div>
      </div>

      {/* ── ヒーローヘッダー ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 55%, #0f3280 100%)",
        padding: "40px 24px 44px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: "40%", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.025)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", fontFamily: "Inter, sans-serif", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
            Career Trajectory
          </div>
          <h1 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, margin: "0 0 20px", fontFamily: "Noto Serif JP, serif", lineHeight: 1.5, color: "#fff" }}>
            {profile.headline ?? "キャリア軌跡"}
          </h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {profile.birth_year && (
              <span style={{ background: "rgba(255,255,255,0.14)", borderRadius: 100, padding: "5px 14px", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif", border: "1px solid rgba(255,255,255,0.1)" }}>
                {new Date().getFullYear() - profile.birth_year}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>歳</span>
              </span>
            )}
            {profile.gender && (
              <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 100, padding: "5px 14px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {profile.gender}
              </span>
            )}
            <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {totalCompanies}社を経験
            </span>
            {profile.years_of_experience && (
              <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 100, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
                社会人歴 {profile.years_of_experience}年
              </span>
            )}
          </div>
          {roleLabels.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "Inter, sans-serif" }}>経験職種</span>
              {roleLabels.map((r) => (
                <span key={r} style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, padding: "2px 10px" }}>
                  {r}
                </span>
              ))}
              {currentCompanyName && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>→</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 100, padding: "2px 10px" }}>
                    現在: {currentCompanyName}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── コンテンツエリア ── */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "36px 24px 80px" }}>

        {/* 職歴ラベル */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", marginBottom: 20, fontFamily: "Inter, sans-serif", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 10 }}>
          <span>職歴</span>
          <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
        </div>

        {/* タイムライン */}
        <div className="traj-timeline">
          {groups.map((group, groupIdx) => {
            const prevGroup = groupIdx > 0 ? groups[groupIdx - 1] : null;
            const firstStep = group.companySteps[0];
            const lastStep = group.companySteps[group.companySteps.length - 1];
            const prevLastStep = prevGroup?.companySteps[prevGroup.companySteps.length - 1];

            const groupYear = firstStep.started_at.slice(0, 4);
            const prevGroupYear = prevGroup?.companySteps[0].started_at.slice(0, 4);
            const showYearHeader = groupYear !== prevGroupYear;

            const isCurrentGroup = group.companySteps.some((s) => s.is_current);
            const logo = firstStep.company_id ? (logoMap[firstStep.company_id] ?? null) : null;
            const name = companyDisplay(firstStep, logoMap);
            const isSingle = group.companySteps.length === 1;

            // 年収デルタ
            const delta =
              prevLastStep?.salary_man != null && firstStep.salary_man != null
                ? firstStep.salary_man - prevLastStep.salary_man
                : null;

            return (
              <div key={`group-${groupIdx}`}>
                {/* 年区切り */}
                {showYearHeader && (
                  <div className="traj-year-sep">
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{
                        background: "#fff", border: "1.5px solid var(--line)", borderRadius: 100,
                        padding: "2px 9px", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)",
                        fontFamily: "Inter, sans-serif", letterSpacing: "0.04em", lineHeight: 1.6, whiteSpace: "nowrap",
                      }}>
                        {groupYear}
                      </div>
                    </div>
                    <div style={{ height: 1, background: "var(--line-soft)", marginLeft: 12 }} />
                  </div>
                )}

                {/* 年収デルタ */}
                {groupIdx > 0 && delta !== null && (
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", marginBottom: 4 }}>
                    <div />
                    <div style={{ paddingLeft: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: "Inter, sans-serif",
                        color: delta >= 0 ? "var(--success)" : "var(--error)",
                        background: delta >= 0 ? "var(--success-soft)" : "var(--error-soft)",
                        padding: "2px 8px", borderRadius: 100,
                        border: `1px solid ${delta >= 0 ? "#6ee7b7" : "#fca5a5"}`,
                      }}>
                        年収 {delta >= 0 ? "+" : ""}{delta.toLocaleString()}万円
                      </span>
                    </div>
                  </div>
                )}

                {/* メイン行 */}
                <div className={["traj-row", isCurrentGroup && "traj-row-current"].filter(Boolean).join(" ")}>
                  {/* 左: 会社ロゴ */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
                    <CompanyLogoIcon logo={logo} name={name} isCurrent={isCurrentGroup} />
                  </div>

                  {/* 右: コンテンツ */}
                  <div style={{ paddingTop: 10, paddingBottom: 28, paddingLeft: 8 }}>
                    {/* 会社名 + 在籍中 */}
                    <div style={{ marginBottom: 4, lineHeight: 1.35 }}>
                      {firstStep.visibility_company === "real" && firstStep.company_id ? (
                        <Link href={`/companies/${firstStep.company_id}`} className="traj-company-link"
                          style={{ fontSize: 18, fontWeight: 700, color: "#111", textDecoration: "none" }}>
                          {name}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>{name}</span>
                      )}
                      {isCurrentGroup && <CurrentBadge />}
                      {!isSingle && (
                        <span style={{ fontSize: 13, color: "var(--ink-mute)", marginLeft: 8 }}>
                          {group.companySteps.length}ポジション
                        </span>
                      )}
                    </div>

                    {isSingle ? (
                      /* ── 単独ポジション ── */
                      <>
                        {/* 部門/職種/役職 */}
                        <RoleInfoTable
                          role={firstStep.role_category_id ? (roleMap[firstStep.role_category_id] ?? null) : null}
                          roleTitle={firstStep.role_title}
                          size="md"
                        />
                        {/* 在籍期間 */}
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.4 }}>
                          {formatPeriod(firstStep.started_at, firstStep.ended_at, firstStep.is_current)}
                          {" · "}
                          <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
                            {formatDuration(firstStep.started_at, firstStep.ended_at, firstStep.is_current)}
                          </span>
                          {firstStep.employment_type && ` · ${firstStep.employment_type}`}
                        </div>
                        {/* 年収 */}
                        {firstStep.salary_man !== null && (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
                              color: "var(--success)", background: "var(--success-soft)",
                              borderRadius: 100, padding: "3px 12px", border: "1px solid #6ee7b7",
                            }}>
                              {firstStep.salary_man.toLocaleString()}万円
                            </span>
                          </div>
                        )}
                        {/* インタビューコンテンツ */}
                        <InterviewContent blocks={buildBlocks(firstStep, "入社の決め手", true)} />
                      </>
                    ) : (
                      /* ── 複数ポジション ── */
                      <>
                        {/* 通算期間 */}
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginBottom: 14, lineHeight: 1.4 }}>
                          {formatPeriod(firstStep.started_at, lastStep.ended_at, lastStep.is_current)}
                          {" · "}
                          <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
                            {formatDuration(firstStep.started_at, lastStep.ended_at, lastStep.is_current)}
                          </span>
                        </div>

                        {/* 各ポジション */}
                        {group.companySteps.map((roleStep, roleIdx) => {
                          const isLast = roleIdx === group.companySteps.length - 1;
                          const role = roleStep.role_category_id ? (roleMap[roleStep.role_category_id] ?? null) : null;
                          return (
                            <div key={roleStep.id} style={{
                              paddingTop: roleIdx > 0 ? 14 : 0,
                              paddingBottom: isLast ? 0 : 14,
                              borderTop: roleIdx > 0 ? "1px dashed var(--line)" : undefined,
                            }}>
                              {/* 社内昇格・異動 */}
                              {roleIdx > 0 && (
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  fontSize: 10, fontWeight: 700, color: "var(--royal)",
                                  background: "var(--royal-50)", borderRadius: 100,
                                  padding: "2px 10px", border: "1px solid var(--royal-100)",
                                  marginBottom: 10,
                                }}>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="18 15 12 9 6 15"/>
                                  </svg>
                                  社内昇格・異動
                                </div>
                              )}
                              {/* 部門/職種/役職 */}
                              <RoleInfoTable role={role} roleTitle={roleStep.role_title} size="sm" />
                              {/* 在籍期間 */}
                              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.4 }}>
                                {formatPeriod(roleStep.started_at, roleStep.ended_at, roleStep.is_current)}
                                {" · "}
                                <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>
                                  {formatDuration(roleStep.started_at, roleStep.ended_at, roleStep.is_current)}
                                </span>
                                {roleStep.employment_type && ` · ${roleStep.employment_type}`}
                              </div>
                              {/* 年収 */}
                              {roleStep.salary_man !== null && (
                                <div style={{ marginBottom: 10 }}>
                                  <span style={{
                                    fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                                    color: "var(--success)", background: "var(--success-soft)",
                                    borderRadius: 100, padding: "2px 10px", border: "1px solid #6ee7b7",
                                  }}>
                                    {roleStep.salary_man.toLocaleString()}万円
                                  </span>
                                </div>
                              )}
                              {/* インタビューコンテンツ */}
                              <InterviewContent blocks={buildBlocks(
                                roleStep,
                                roleIdx === 0 ? "入社の決め手" : "異動・昇格のきっかけ",
                                !isLast,
                              )} />
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 注記 */}
        <p style={{ marginTop: 40, fontSize: 12, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.8 }}>
          ※ 企業名・年収の一部は本人の希望により非公開にしている場合があります
        </p>

        {/* CTA */}
        <div style={{
          marginTop: 40,
          background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
          borderRadius: 16, padding: "32px 28px", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, letterSpacing: "0.05em" }}>
            同じようなキャリアを考えていますか？
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 22, fontFamily: "Noto Serif JP, serif", lineHeight: 1.5 }}>
            先輩アドバイザーに<br />直接話を聞いてみる
          </div>
          <Link
            href="/mentors"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, var(--warm) 0%, #f97316 100%)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              padding: "12px 32px", borderRadius: 8, textDecoration: "none",
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}
          >
            先輩を探す →
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

type PublicStep = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  display_order: number;
  visibility_company: "real" | "masked" | "hidden";
};

type CompanyLogo = {
  id: string;
  name: string;
  brand_name: string | null;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
};

export type CardData = {
  userId: string;
  userName: string | null;
  headline: string | null;
  yearsOfExperience: number | null;
  gender: string | null;
  birthYear: number | null;
  steps: PublicStep[];
  logoMap: Record<string, CompanyLogo>;
  salaryCurve: number[];
  verified: boolean;
  serialNumber: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// [Fix #4/#10] 英語職種タイトルを日本語に変換
const EN_TO_JA_ROLES: Record<string, string> = {
  "Account Executive": "アカウントエグゼクティブ（営業）",
  "Senior Account Executive": "シニアアカウントエグゼクティブ",
  "Enterprise Account Executive": "エンタープライズ営業",
  "People & Culture Manager": "人事・組織開発マネージャー",
  "People and Culture Manager": "人事・組織開発マネージャー",
  "Customer Success Manager": "カスタマーサクセスマネージャー",
  "Solution Engineer": "ソリューションエンジニア",
  "Sales Development Representative": "インサイドセールス（SDR）",
  "Business Development Representative": "ビジネスデベロップメント",
  "Marketing Manager": "マーケティングマネージャー",
  "Product Manager": "プロダクトマネージャー",
  "Software Engineer": "ソフトウェアエンジニア",
  "Sales Manager": "セールスマネージャー",
  "Territory Account Executive": "テリトリー営業",
  "Regional Sales Manager": "リージョナルセールスマネージャー",
};

function translateRoleTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return EN_TO_JA_ROLES[title] ?? title;
}

function toBrandName(fullName: string): string {
  return fullName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人|NPO法人)\s*/, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/, "")
    .trim() || fullName;
}

function getDisplayName(step: PublicStep, logo: CompanyLogo | null): string {
  if (step.visibility_company !== "real") {
    return step.company_anonymized ?? "非公開";
  }
  if (logo?.brand_name) return logo.brand_name;
  if (logo?.name) return toBrandName(logo.name);
  if (step.company_text) return toBrandName(step.company_text);
  return step.company_anonymized ?? "非公開";
}

function formatPeriod(startedAt: string, endedAt: string | null): string {
  const yr = (s: string) => `'${s.slice(2, 4)}`;
  return `${yr(startedAt)}〜${endedAt ? yr(endedAt) : "現在"}`;
}

const ROLE_SHORT: Record<string, string> = {
  "アカウントエグゼクティブ（営業）": "営業",
  "シニアアカウントエグゼクティブ": "営業(Senior)",
  "エンタープライズ営業": "エンタープライズ営業",
  "人事・組織開発マネージャー": "人事",
  "カスタマーサクセスマネージャー": "CS",
  "ソリューションエンジニア": "SE",
  "インサイドセールス（SDR）": "インサイドセールス",
  "マーケティングマネージャー": "マーケ",
  "プロダクトマネージャー": "PM",
  "ソフトウェアエンジニア": "エンジニア",
  "セールスマネージャー": "営業マネージャー",
  "テリトリー営業": "テリトリー営業",
  "リージョナルセールスマネージャー": "営業マネージャー",
  "ビジネスデベロップメント": "BizDev",
};

function toShortRole(title: string | null | undefined): string | null {
  if (!title) return null;
  const ja = EN_TO_JA_ROLES[title] ?? title;
  if (ROLE_SHORT[ja]) return ROLE_SHORT[ja];
  // 括弧前の基本職種名を抽出（例: "営業（メジャー営業統括部）" → "営業"）
  const base = ja.replace(/[（(].*/, "").trim();
  const short = base || ja;
  return short.length > 12 ? `${short.slice(0, 12)}…` : short;
}

function getRoleTransition(steps: PublicStep[]): { from: string; to: string } | null {
  const sorted = [...steps]
    .filter((s) => s.role_title)
    .sort((a, b) => a.display_order - b.display_order);
  if (sorted.length < 2) return null;
  const fromRole = toShortRole(sorted[0].role_title);
  const toRole = toShortRole(sorted[sorted.length - 1].role_title);
  if (!fromRole || !toRole || fromRole === toRole) return null;
  return { from: fromRole, to: toRole };
}

function getCTAText(
  roleTransition: { from: string; to: string } | null,
  currentCompanyName: string | null,
  headline: string | null,
): string {
  if (roleTransition) {
    return `${roleTransition.to}への転身の理由を見る →`;
  }
  if (currentCompanyName) {
    return `${currentCompanyName}への転職理由 →`;
  }
  if (headline) {
    return "軌跡を見る →";
  }
  return "転職・キャリア変化を見る →";
}

// ── LogoChip ──────────────────────────────────────────────────────────────────

function LogoChip({
  logo,
  name,
  isCurrent,
  companyId,
  size = 48,
  period,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent: boolean;
  companyId: string | null;
  size?: number;
  period?: string;
}) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (!companyId) return;
    e.preventDefault();
    e.stopPropagation();
    router.push(`/companies/${companyId}`);
  };

  const isClickable = !!companyId;

  const inner = logo?.logo_url ? (
    <img
      src={logo.logo_url}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      style={{ borderRadius: 8, objectFit: "contain", background: "#fff", display: "block" }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: logo?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: Math.round(size * 0.36),
      fontFamily: "Inter, sans-serif",
    }}>
      {logo?.logo_letter ?? name.charAt(0)}
    </div>
  );

  return (
    <div
      onClick={handleClick}
      title={isClickable ? `${name}の企業ページへ` : undefined}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0,
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      <div style={{
        position: "relative",
        border: "2px solid var(--line)",
        boxShadow: isCurrent ? "0 0 0 2px var(--royal)" : "none",
        borderRadius: 10,
        padding: 2,
        background: "transparent",
        transition: isClickable ? "transform 0.15s, box-shadow 0.15s" : undefined,
      }}
        className={isClickable ? "logo-chip-hoverable" : undefined}
      >
        {inner}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <div
          title={name}
          style={{
            fontSize: 10, color: isCurrent ? "var(--ink)" : "var(--ink-soft)",
            fontWeight: isCurrent ? 700 : 500,
            maxWidth: size + 24, textAlign: "center",
            textDecoration: isClickable ? "underline" : "none",
            textDecorationColor: "var(--line)",
            textUnderlineOffset: 2,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            lineHeight: 1.3,
          }}>
          {name}
        </div>
        {period && (
          <div style={{
            fontSize: 9, color: "var(--ink-mute)",
            fontFamily: "Inter, sans-serif", lineHeight: 1,
          }}>
            {period}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connector ─────────────────────────────────────────────────────────────────

// [Fix #7] 点線を濃くして視認性向上 (#B0BDD0 vs 旧 var(--line)=#E2E8F0)
function Connector({ small }: { small?: boolean }) {
  return (
    <div style={{
      width: small ? 18 : 24, height: 1,
      borderTop: "2px dashed #B0BDD0",
      margin: `0 ${small ? 2 : 4}px`, marginBottom: small ? 18 : 22, flexShrink: 0,
    }} />
  );
}

// ── TrajectoryCardClient ───────────────────────────────────────────────────────

export function TrajectoryCardClient({
  card,
  listMode = false,
}: {
  card: CardData;
  listMode?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const sortedSteps = [...card.steps].sort((a, b) => b.display_order - a.display_order);
  const uniqueSteps = sortedSteps.filter((s, i) => {
    if (i === 0) return true;
    return !(s.company_id && s.company_id === sortedSteps[i - 1].company_id);
  });

  const MAX_SHOW = listMode ? 5 : 3;
  const olderCount = uniqueSteps.length > MAX_SHOW ? uniqueSteps.length - MAX_SHOW : 0;
  const olderSteps = uniqueSteps.slice(0, olderCount);
  const recentSteps = uniqueSteps.slice(olderCount);

  const currentStep = uniqueSteps.find((s) => s.is_current);
  const age = card.birthYear ? new Date().getFullYear() - card.birthYear : null;
  // [Fix #4/#10] 英語タイトルを日本語に変換
  const roleTitle = translateRoleTitle(currentStep?.role_title ?? card.headline);

  const roleTransition = getRoleTransition(card.steps);

  const currentCompanyName = (() => {
    if (!currentStep) return null;
    const logo = currentStep.company_id ? (card.logoMap[currentStep.company_id] ?? null) : null;
    if (currentStep.visibility_company !== "real") return null;
    return getDisplayName(currentStep, logo);
  })();

  const ctaText = getCTAText(roleTransition, currentCompanyName, card.headline);

  const handleChipClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(true);
  };

  const handleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(false);
  };

  const handleCardClick = () => router.push(`/career-trajectories/${card.userId}`);

  // ── メタバッジ行 ─────────────────────────────────────────────────────────────

  // [Fix #6] フォントサイズ11→12、padding増やして視認性向上
  const MetaBadges = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {card.yearsOfExperience && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
          background: "var(--line-soft)", borderRadius: 6, padding: "4px 9px",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          社会人歴 {card.yearsOfExperience}年
        </span>
      )}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
        background: "var(--line-soft)", borderRadius: 6, padding: "4px 9px",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        {uniqueSteps.length}社経験
      </span>
    </div>
  );

  // ── ロゴストリップ ───────────────────────────────────────────────────────────

  const LogoStrip = ({ chipSize }: { chipSize: number }) => {
    const GRID_CHIP_SIZE = 40;

    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2, overflow: "hidden" }}>
        {expanded && olderCount > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="older-chip-btn"
              onClick={handleCollapse}
              title="折りたたむ"
            >
              <div className="older-chip" style={{ width: GRID_CHIP_SIZE, height: GRID_CHIP_SIZE }}>
                <svg width={GRID_CHIP_SIZE * 0.36} height={GRID_CHIP_SIZE * 0.36} viewBox="0 0 24 24" fill="none"
                  stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              <div className="older-chip-label" style={{
                fontSize: 10, color: "var(--ink-mute)", fontWeight: 700,
                fontFamily: "Inter, sans-serif", textAlign: "center", lineHeight: 1.3,
              }}>
                まとめる
              </div>
            </button>
            <Connector small />
          </div>
        )}
        {expanded && olderSteps.map((step, i) => {
          const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
          const name = getDisplayName(step, logo);
          return (
            <div
              key={step.id}
              style={{
                display: "flex", alignItems: "center",
                animation: `slideInFromLeft 0.32s ease ${i * 0.07}s both`,
              }}
            >
              <LogoChip logo={logo} name={name} isCurrent={false} companyId={step.company_id} size={chipSize} period={formatPeriod(step.started_at, step.ended_at)} />
              <div style={{ animation: `fadeInConnector 0.3s ease ${i * 0.07 + 0.15}s both`, opacity: 0 }}>
                <Connector small />
              </div>
            </div>
          );
        })}

        {!expanded && olderCount > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="older-chip-btn"
              onClick={handleChipClick}
              title={`さらに${olderCount}社の経歴あり`}
            >
              <div className="older-chip" style={{ width: GRID_CHIP_SIZE, height: GRID_CHIP_SIZE }}>
                <svg width={GRID_CHIP_SIZE * 0.36} height={GRID_CHIP_SIZE * 0.36} viewBox="0 0 24 24" fill="none"
                  stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </div>
              <div className="older-chip-label" style={{
                fontSize: 10, color: "var(--ink-mute)", fontWeight: 700,
                fontFamily: "Inter, sans-serif", textAlign: "center", lineHeight: 1.3,
              }}>
                さらに<br />{olderCount}社
              </div>
            </button>
            <Connector small />
          </div>
        )}

        {recentSteps.map((step, i) => {
          const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
          const name = getDisplayName(step, logo);
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
              <LogoChip logo={logo} name={name} isCurrent={step.is_current} companyId={step.company_id} size={chipSize} period={formatPeriod(step.started_at, step.ended_at)} />
              {i < recentSteps.length - 1 && <Connector small />}
            </div>
          );
        })}
      </div>
    );
  };

  // ── LIST MODE ─────────────────────────────────────────────────────────────

  if (listMode) {
    return (
      <div className="trajectory-list-card" onClick={handleCardClick}>

        {/* 左：役職 + メタ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 15, fontWeight: 800, color: "var(--ink)",
              lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {roleTitle ?? "—"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {age && (
              <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 700 }}>
                {age}歳
              </span>
            )}
            {card.gender && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                {card.gender}
              </span>
            )}
            <MetaBadges />
          </div>
        </div>

        {/* 中：ロゴストリップ */}
        <div style={{ flexShrink: 0, width: 280, overflow: "hidden" }}>
          <LogoStrip chipSize={40} />
        </div>

        {/* 右：職種変遷 + CTA */}
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "flex-end", gap: 6,
        }}>
          {roleTransition && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontSize: 11, color: "var(--ink-soft)", fontWeight: 600,
                background: "var(--line-soft)", borderRadius: 6, padding: "3px 8px",
                whiteSpace: "nowrap",
              }}>
                {roleTransition.from}
              </span>
              <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>→</span>
              <span style={{
                fontSize: 11, color: "var(--royal)", fontWeight: 700,
                background: "var(--royal-50)", borderRadius: 6, padding: "3px 8px",
                whiteSpace: "nowrap",
              }}>
                {roleTransition.to}
              </span>
            </div>
          )}
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 700, whiteSpace: "nowrap", maxWidth: 180, textAlign: "right", lineHeight: 1.4 }}>
            {ctaText}
          </span>
        </div>
      </div>
    );
  }

  // ── GRID MODE ─────────────────────────────────────────────────────────────

  return (
    <div className="trajectory-card-interactive" onClick={handleCardClick}>

      {/* ヘッダー：役職 */}
      <div style={{ marginBottom: 12 }}>
        {roleTitle && (
          <div style={{
            fontSize: 15, fontWeight: 800, color: "var(--ink)",
            lineHeight: 1.4, marginBottom: 6,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {roleTitle}
          </div>
        )}

        {/* 年齢 + 性別 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {age && (
            <span style={{
              fontSize: 22, fontWeight: 900, color: "var(--ink)",
              fontFamily: "Inter, sans-serif", lineHeight: 1,
            }}>
              {age}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 1, color: "var(--ink-soft)" }}>歳</span>
            </span>
          )}
          {card.gender && (
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
              {card.gender}
            </span>
          )}
        </div>

        <MetaBadges />
      </div>

      {/* 区切り線 */}
      <div style={{ borderTop: "1px solid var(--line-soft)", marginBottom: 16 }} />

      {/* ロゴストリップ */}
      <div style={{ flex: 1, paddingBottom: 4 }}>
        <LogoStrip chipSize={56} />
      </div>
    </div>
  );
}

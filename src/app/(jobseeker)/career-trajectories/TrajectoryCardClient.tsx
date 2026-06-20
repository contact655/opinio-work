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
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── LogoChip ──────────────────────────────────────────────────────────────────

function LogoChip({
  logo,
  name,
  isCurrent,
  companyId,
  size = 48,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent: boolean;
  companyId: string | null;
  size?: number;
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
      style={{ borderRadius: 10, objectFit: "contain", background: "#fff", display: "block" }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: 10,
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
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0,
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      <div style={{
        position: "relative",
        border: "2px solid var(--line)",
        boxShadow: isCurrent ? "0 0 0 2px var(--royal)" : "none",
        borderRadius: 12,
        padding: 2,
        background: isCurrent ? "var(--royal-50)" : "transparent",
        transition: isClickable ? "transform 0.15s, box-shadow 0.15s" : undefined,
      }}
        className={isClickable ? "logo-chip-hoverable" : undefined}
      >
        {inner}
        {isCurrent && (
          <div style={{
            position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
            background: "var(--royal)", color: "#fff",
            fontSize: 8, fontWeight: 800, fontFamily: "Inter, sans-serif",
            padding: "1px 5px", borderRadius: 100, whiteSpace: "nowrap",
            letterSpacing: "0.05em",
          }}>
            現職
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11, color: isCurrent ? "var(--ink)" : "var(--ink-soft)",
        fontWeight: isCurrent ? 700 : 500,
        maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", textAlign: "center",
        textDecoration: isClickable ? "underline" : "none",
        textDecorationColor: "var(--line)",
        textUnderlineOffset: 2,
      }}>
        {name}
      </div>
    </div>
  );
}

// ── Connector line ─────────────────────────────────────────────────────────────

function Connector() {
  return (
    <div style={{
      width: 28, height: 1,
      borderTop: "2px dashed var(--line)",
      margin: "0 4px", marginBottom: 24, flexShrink: 0,
    }} />
  );
}

// ── TrajectoryCardClient ───────────────────────────────────────────────────────

export function TrajectoryCardClient({ card }: { card: CardData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const sortedSteps = [...card.steps].sort((a, b) => b.display_order - a.display_order);
  const uniqueSteps = sortedSteps.filter((s, i) => {
    if (i === 0) return true;
    return !(s.company_id && s.company_id === sortedSteps[i - 1].company_id);
  });

  const MAX_SHOW = 3;
  const olderCount = uniqueSteps.length > MAX_SHOW ? uniqueSteps.length - MAX_SHOW : 0;
  const olderSteps = uniqueSteps.slice(0, olderCount);   // 古い職歴
  const recentSteps = uniqueSteps.slice(olderCount);     // 直近3社

  const currentStep = uniqueSteps.find((s) => s.is_current);
  const age = card.birthYear ? new Date().getFullYear() - card.birthYear : null;
  const roleTitle = currentStep?.role_title || card.headline;

  const handleChipClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(true);
  };

  return (
    <>
      <style>{`
        @keyframes slideInFromLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInConnector {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .trajectory-card-interactive {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 22px 22px 16px;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
          cursor: pointer;
        }
        .trajectory-card-interactive:hover {
          box-shadow: 0 4px 24px rgba(0,35,102,0.12);
          border-color: var(--royal-100);
          transform: translateY(-2px);
        }
        .older-chip-btn {
          display: flex; flex-direction: column; align-items: center; gap: 6;
          cursor: pointer; border: none; background: transparent; padding: 0;
        }
        .older-chip {
          width: 64px; height: 64px; border-radius: 12px;
          background: var(--royal-50); border: 1.5px solid var(--royal-100);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }
        .older-chip-btn:hover .older-chip {
          background: var(--royal); border-color: var(--royal);
          transform: scale(1.08);
        }
        .older-chip-btn:hover .older-chip svg { stroke: #fff; }
        .older-chip-btn:hover .older-chip-label { color: var(--royal); }
        .logo-chip-hoverable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,35,102,0.18);
          border-color: var(--royal-100) !important;
        }
      `}</style>

      <div
        className="trajectory-card-interactive"
        onClick={() => router.push(`/career-trajectories/${card.userId}`)}
      >
        {/* ── ヘッダー ── */}
        <div style={{ marginBottom: 14 }}>
          {/* 年齢 + 性別バッジ */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            {age && (
              <span style={{
                fontSize: 28, fontWeight: 900, color: "var(--ink)",
                fontFamily: "Inter, sans-serif", lineHeight: 1,
              }}>
                {age}<span style={{ fontSize: 14, fontWeight: 700, marginLeft: 2 }}>歳</span>
              </span>
            )}
            {card.gender && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 100,
                background: card.gender === "女性" ? "#FDF2F8" : "var(--royal-50)",
                color: card.gender === "女性" ? "#9D174D" : "var(--royal)",
                border: `1px solid ${card.gender === "女性" ? "#FBCFE8" : "var(--royal-100)"}`,
                letterSpacing: "0.04em",
              }}>
                {card.gender}
              </span>
            )}
          </div>

          {/* 役職・ヘッドライン */}
          {roleTitle && (
            <div style={{
              fontSize: 13, fontWeight: 700, color: "var(--ink)",
              marginBottom: 8, lineHeight: 1.45,
            }}>
              {roleTitle}
            </div>
          )}

          {/* メタバッジ行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {card.yearsOfExperience && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 600, color: "var(--ink-soft)",
                background: "var(--line-soft)", borderRadius: 6,
                padding: "3px 8px",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                社会人歴 {card.yearsOfExperience}年
              </span>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600, color: "var(--ink-soft)",
              background: "var(--line-soft)", borderRadius: 6,
              padding: "3px 8px",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              {uniqueSteps.length}社経験
            </span>
          </div>
        </div>

        {/* 区切り線 */}
        <div style={{ borderTop: "1px solid var(--line-soft)", marginBottom: 16 }} />

        {/* ── ロゴストリップ ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4, flex: 1, paddingBottom: 4, overflow: "hidden" }}>

          {/* 展開後: 古い職歴がスライドイン */}
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
                <LogoChip logo={logo} name={name} isCurrent={false} companyId={step.company_id} size={64} />
                <div style={{ animation: `fadeInConnector 0.3s ease ${i * 0.07 + 0.15}s both`, opacity: 0 }}>
                  <Connector />
                </div>
              </div>
            );
          })}

          {/* 折りたたみ時: 矢印チップ */}
          {!expanded && olderCount > 0 && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <button
                className="older-chip-btn"
                onClick={handleChipClick}
                title={`過去${olderCount}社を表示`}
              >
                <div className="older-chip">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </div>
                <div className="older-chip-label" style={{
                  fontSize: 10, color: "var(--ink-mute)", fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                }}>
                  +{olderCount}社
                </div>
              </button>
              <Connector />
            </div>
          )}

          {/* 直近3社（常に表示） */}
          {recentSteps.map((step, i) => {
            const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
            const name = getDisplayName(step, logo);
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <LogoChip logo={logo} name={name} isCurrent={step.is_current} companyId={step.company_id} size={64} />
                {i < recentSteps.length - 1 && <Connector />}
              </div>
            );
          })}
        </div>

        {/* ── CTA ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 8,
        }}>
          <span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 700 }}>
            詳しく見る →
          </span>
        </div>
      </div>
    </>
  );
}

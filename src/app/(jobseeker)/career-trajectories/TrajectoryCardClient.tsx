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
  size = 48,
}: {
  logo: CompanyLogo | null;
  name: string;
  isCurrent: boolean;
  size?: number;
}) {
  const inner = logo?.logo_url ? (
    <img
      src={logo.logo_url}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: 10, objectFit: "cover", display: "block" }}
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{
        position: "relative",
        border: isCurrent ? "2.5px solid var(--royal)" : "2px solid var(--line)",
        borderRadius: 12,
        padding: 2,
        background: isCurrent ? "var(--royal-50)" : "transparent",
      }}>
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
      width: 20, height: 1,
      borderTop: "2px dashed var(--line)",
      margin: "0 4px", marginBottom: 18, flexShrink: 0,
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
        .older-chip {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--line-soft); border: 1px dashed var(--line);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: var(--ink-mute);
          font-family: Inter, sans-serif;
          transition: background 0.15s, border-color 0.15s;
        }
        .older-chip-wrap:hover .older-chip {
          background: var(--royal-50);
          border-color: var(--royal-100);
          color: var(--royal);
        }
      `}</style>

      <div
        className="trajectory-card-interactive"
        onClick={() => router.push(`/career-trajectories/${card.userId}`)}
      >
        {/* ── ヘッダー ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            display: "flex", alignItems: "center",
            fontSize: 16, fontWeight: 800, color: "var(--ink)",
            fontFamily: "var(--font-noto-sans), sans-serif", marginBottom: 4,
          }}>
            {age && <span>{age}歳</span>}
            {age && card.gender && (
              <span style={{ color: "var(--line)", margin: "0 8px", fontWeight: 300, fontSize: 18 }}>｜</span>
            )}
            {card.gender && <span>{card.gender}</span>}
          </div>
          {roleTitle && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5, lineHeight: 1.4 }}>
              {roleTitle}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {card.yearsOfExperience && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>社会人歴 {card.yearsOfExperience}年</span>
            )}
            {card.yearsOfExperience && (
              <span style={{ fontSize: 12, color: "var(--line)" }}>·</span>
            )}
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{uniqueSteps.length}社経験</span>
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
                <LogoChip logo={logo} name={name} isCurrent={false} size={48} />
                <div style={{ animation: `fadeInConnector 0.3s ease ${i * 0.07 + 0.15}s both`, opacity: 0 }}>
                  <Connector />
                </div>
              </div>
            );
          })}

          {/* 折りたたみ時: +N チップ */}
          {!expanded && olderCount > 0 && (
            <div
              className="older-chip-wrap"
              style={{ display: "flex", alignItems: "center" }}
              onClick={handleChipClick}
              title={`過去${olderCount}社を表示`}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div className="older-chip">+{olderCount}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>前職</div>
              </div>
              <Connector />
            </div>
          )}

          {/* 直近3社（常に表示） */}
          {recentSteps.map((step, i) => {
            const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
            const name = getDisplayName(step, logo);
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <LogoChip logo={logo} name={name} isCurrent={step.is_current} size={48} />
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

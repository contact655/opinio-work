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

function getSalaryDiff(curve: number[]): { text: string; value: number; positive: boolean } | null {
  if (curve.length < 2) return null;
  const diff = curve[curve.length - 1] - curve[0];
  if (diff === 0) return null;
  return {
    text: `${diff > 0 ? "+" : ""}${diff}万円`,
    value: diff,
    positive: diff > 0,
  };
}

// ② パーソナライズされたCTAテキスト生成
function getCTAText(
  salaryDiff: { text: string; positive: boolean } | null,
  currentCompanyName: string | null,
  headline: string | null,
): string {
  if (salaryDiff?.positive) {
    return `${salaryDiff.text}の年収変化の内訳を見る →`;
  }
  if (currentCompanyName) {
    return `${currentCompanyName}に転職した理由 →`;
  }
  if (headline) {
    return `${headline}の軌跡を見る →`;
  }
  return "転職理由・年収変化を見る →";
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
      <div style={{
        fontSize: 10, color: isCurrent ? "var(--ink)" : "var(--ink-soft)",
        fontWeight: isCurrent ? 700 : 500,
        maxWidth: size + 16, overflow: "hidden", textOverflow: "ellipsis",
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

// ── Connector ─────────────────────────────────────────────────────────────────

function Connector({ small }: { small?: boolean }) {
  return (
    <div style={{
      width: small ? 18 : 24, height: 1,
      borderTop: "2px dashed var(--line)",
      margin: `0 ${small ? 2 : 4}px`, marginBottom: small ? 18 : 22, flexShrink: 0,
    }} />
  );
}

// ── Shared card styles ────────────────────────────────────────────────────────

const CARD_STYLES = `
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
    padding: 20px 20px 16px;
    height: 100%;
    min-height: 280px;
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
  .trajectory-list-card {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    transition: box-shadow 0.15s, border-color 0.15s, transform 0.15s;
  }
  .trajectory-list-card:hover {
    box-shadow: 0 3px 16px rgba(0,35,102,0.10);
    border-color: var(--royal-100);
    transform: translateX(2px);
  }
  .older-chip-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer; border: none; background: transparent; padding: 0;
  }
  .older-chip {
    border-radius: 8px;
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
`;

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

  const MAX_SHOW = 3;
  const olderCount = uniqueSteps.length > MAX_SHOW ? uniqueSteps.length - MAX_SHOW : 0;
  const olderSteps = uniqueSteps.slice(0, olderCount);
  const recentSteps = uniqueSteps.slice(olderCount);

  const currentStep = uniqueSteps.find((s) => s.is_current);
  const age = card.birthYear ? new Date().getFullYear() - card.birthYear : null;
  const roleTitle = currentStep?.role_title || card.headline;

  const salaryDiff = getSalaryDiff(card.salaryCurve);

  // ② 現職会社名の取得（CTAテキスト用）
  const currentCompanyName = (() => {
    if (!currentStep) return null;
    const logo = currentStep.company_id ? (card.logoMap[currentStep.company_id] ?? null) : null;
    if (currentStep.visibility_company !== "real") return null;
    return getDisplayName(currentStep, logo);
  })();

  const ctaText = getCTAText(salaryDiff, currentCompanyName, card.headline);

  const handleChipClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(true);
  };

  const handleCardClick = () => router.push(`/career-trajectories/${card.userId}`);

  // ── メタバッジ行（verified バッジ除外） ─────────────────────────────────────

  const MetaBadges = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {card.yearsOfExperience && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 11, fontWeight: 600, color: "var(--ink-soft)",
          background: "var(--line-soft)", borderRadius: 6, padding: "3px 8px",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          社会人歴 {card.yearsOfExperience}年
        </span>
      )}
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 11, fontWeight: 600, color: "var(--ink-soft)",
        background: "var(--line-soft)", borderRadius: 6, padding: "3px 8px",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        {uniqueSteps.length}社経験
      </span>
    </div>
  );

  // ⑧ Verified バッジ（独立コンポーネント・右上固定配置用）
  const VerifiedBadge = () => card.verified ? (
    <span
      title="OPINIO編集部が実際に面談し、職歴・年収の内容を確認しています"
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 10, fontWeight: 700, color: "var(--royal)",
        background: "var(--royal-50)", borderRadius: 6,
        padding: "3px 7px", border: "1px solid var(--royal-100)",
        cursor: "help", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      OPINIO編集部 取材済み
    </span>
  ) : null;

  // ── ③⑦ ロゴストリップ（グリッド用：全件対応、リスト用：最大2件） ──────────

  const LogoStrip = ({ chipSize, listCap }: { chipSize: number; listCap?: number }) => {
    // リストモード：チップ表示時は現職（末尾1社）のみ表示してコンテナに収める
    if (listCap !== undefined) {
      // まず仮計算してチップが出るかを確認
      const tentativeVisible = recentSteps.slice(-listCap);
      const tentativeHidden = olderCount + (recentSteps.length - tentativeVisible.length);
      // チップが出る場合は現職のみ1社に絞る（chip+connector+1logoで収まる）
      const effectiveCap = tentativeHidden > 0 ? 1 : listCap;
      const visibleSteps = recentSteps.slice(-effectiveCap);
      const hiddenCount = olderCount + (recentSteps.length - visibleSteps.length);
      return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          {hiddenCount > 0 && !expanded && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <button
                className="older-chip-btn"
                onClick={handleChipClick}
                title={`さらに${hiddenCount}社の経歴あり`}
              >
                <div className="older-chip" style={{ width: chipSize, height: chipSize }}>
                  <svg width={chipSize * 0.36} height={chipSize * 0.36} viewBox="0 0 24 24" fill="none"
                    stroke="var(--royal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </div>
                {/* ⑩ ラベル変更 */}
                <div className="older-chip-label" style={{
                  fontSize: 10, color: "var(--ink-mute)", fontWeight: 700,
                  fontFamily: "Inter, sans-serif", textAlign: "center", lineHeight: 1.3,
                }}>
                  さらに<br />{hiddenCount}社
                </div>
              </button>
              <Connector small={chipSize <= 40} />
            </div>
          )}
          {visibleSteps.map((step, i) => {
            const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
            const name = getDisplayName(step, logo);
            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
                <LogoChip logo={logo} name={name} isCurrent={step.is_current} companyId={step.company_id} size={chipSize} />
                {i < visibleSteps.length - 1 && <Connector small={chipSize <= 40} />}
              </div>
            );
          })}
        </div>
      );
    }

    // グリッドモード：チップがある場合は直近2社まで（右端クリップ防止）
    const stepsToShow = (olderCount > 0 && !expanded) ? recentSteps.slice(-2) : recentSteps;

    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2, overflow: "hidden" }}>
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
              <LogoChip logo={logo} name={name} isCurrent={false} companyId={step.company_id} size={chipSize} />
              <div style={{ animation: `fadeInConnector 0.3s ease ${i * 0.07 + 0.15}s both`, opacity: 0 }}>
                <Connector small={chipSize <= 40} />
              </div>
            </div>
          );
        })}

        {/* ⑩ 折りたたみ時：前職チップ — ラベル変更 */}
        {!expanded && olderCount > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="older-chip-btn"
              onClick={handleChipClick}
              title={`さらに${olderCount}社の経歴あり`}
            >
              <div className="older-chip" style={{ width: chipSize, height: chipSize }}>
                <svg width={chipSize * 0.36} height={chipSize * 0.36} viewBox="0 0 24 24" fill="none"
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
            <Connector small={chipSize <= 40} />
          </div>
        )}

        {stepsToShow.map((step, i) => {
          const logo = step.company_id ? (card.logoMap[step.company_id] ?? null) : null;
          const name = getDisplayName(step, logo);
          return (
            <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
              <LogoChip logo={logo} name={name} isCurrent={step.is_current} companyId={step.company_id} size={chipSize} />
              {i < stepsToShow.length - 1 && <Connector small={chipSize <= 40} />}
            </div>
          );
        })}
      </div>
    );
  };

  // ⑥ 年収エリア：スパークライン廃止、数値を大型化
  const SalaryArea = ({ compact }: { compact?: boolean }) => (
    <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      {salaryDiff && (
        <span style={{
          fontSize: compact ? 15 : 18, fontWeight: 900,
          color: salaryDiff.positive ? "var(--success)" : "var(--error)",
          fontFamily: "Inter, sans-serif",
          background: salaryDiff.positive ? "var(--success-soft)" : "var(--error-soft)",
          borderRadius: 8, padding: compact ? "4px 10px" : "6px 12px",
          whiteSpace: "nowrap",
          letterSpacing: "-0.02em",
        }}>
          {salaryDiff.text}
        </span>
      )}
    </div>
  );

  // ── LIST MODE ─────────────────────────────────────────────────────────────

  if (listMode) {
    return (
      <>
        <style>{CARD_STYLES}</style>
        <div className="trajectory-list-card" onClick={handleCardClick}>

          {/* 左：ロゴストリップ（固定幅） */}
          <div style={{ flexShrink: 0, width: 140, overflow: "hidden" }}>
            <LogoStrip chipSize={40} listCap={2} />
          </div>

          {/* 中：役職 + メタ */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* ⑧ verified バッジをタイトル行の右に固定 */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, color: "var(--ink)",
                lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, minWidth: 0,
              }}>
                {roleTitle ?? "—"}
              </div>
              <VerifiedBadge />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {age && (
                <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
                  {age}歳
                </span>
              )}
              {card.gender && (
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>
                  {card.gender}
                </span>
              )}
              <MetaBadges />
            </div>
          </div>

          {/* 右：⑥ 大型年収diff + ② パーソナライズCTA */}
          <div style={{
            flexShrink: 0, display: "flex", flexDirection: "column",
            alignItems: "flex-end", gap: 6,
          }}>
            <SalaryArea compact />
            <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 700, whiteSpace: "nowrap", maxWidth: 180, textAlign: "right", lineHeight: 1.4 }}>
              {ctaText}
            </span>
          </div>
        </div>
      </>
    );
  }

  // ── GRID MODE ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CARD_STYLES}</style>

      <div className="trajectory-card-interactive" onClick={handleCardClick}>

        {/* ヘッダー：役職（1行に収める） */}
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
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>
                {card.gender}
              </span>
            )}
          </div>

          {/* メタバッジ行にVerifiedBadgeを統合（タイトル行での折り返し防止） */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <MetaBadges />
            <VerifiedBadge />
          </div>
        </div>

        {/* 区切り線 */}
        <div style={{ borderTop: "1px solid var(--line-soft)", marginBottom: 16 }} />

        {/* ── ③ ロゴストリップ（グリッドモード：overflow制御済み） ── */}
        <div style={{ flex: 1, paddingBottom: 4 }}>
          <LogoStrip chipSize={56} />
        </div>

        {/* ── ⑥② 年収大型表示 + パーソナライズCTA ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 8,
          gap: 8,
        }}>
          <SalaryArea />
          <span style={{
            fontSize: 11, color: "var(--royal)", fontWeight: 700,
            textAlign: "right", flexShrink: 1, lineHeight: 1.5,
            maxWidth: 160,
          }}>
            {ctaText}
          </span>
        </div>
      </div>
    </>
  );
}

import { CareerEntry, calculateTenure, groupOverlappingCareers } from "@/lib/utils/career";
import { CompanyLogo } from "@/components/jobseeker/CompanyLogo";

// ─── Helpers (shared within this file) ───────────────────────────────────────

function formatCareerPeriod(
  startedAt: string,
  endedAt: string | null,
  isCurrent: boolean
): string {
  const start = startedAt.slice(0, 7).replace("-", ".");
  if (isCurrent) return `${start} 〜 現在`;
  if (!endedAt) return `${start} 〜`;
  const end = endedAt.slice(0, 7).replace("-", ".");
  return `${start} 〜 ${end}`;
}

function getRoleLabel(slugOrUuid: string): string {
  const LABELS: Record<string, string> = {
    sales: "営業", pm: "PdM / PM", cs: "カスタマーサクセス",
    engineer: "エンジニア", marketing: "マーケティング", exec: "経営・CxO", other: "その他",
    field_sales: "フィールドセールス", enterprise_sales: "エンタープライズ営業",
    inside_sales: "インサイドセールス", sdr_bdr: "SDR / BDR",
    product_manager: "プロダクトマネージャー", product_owner: "プロダクトオーナー",
    pmm: "PMM（プロダクトマーケティングマネージャー）",
    backend: "バックエンドエンジニア", frontend: "フロントエンドエンジニア",
    fullstack: "フルスタックエンジニア", sre: "SRE / インフラエンジニア",
    ios_android: "iOS / Androidエンジニア",
    ceo: "CEO", coo: "COO", cpo: "CPO", cto: "CTO", cfo: "CFO",
    designer: "デザイナー", biz_dev: "事業開発", hrbp: "HRBP",
    corporate: "コーポレート（HR/経理/法務）", data_scientist: "データサイエンティスト",
    customer_success: "カスタマーサクセス", customer_support: "カスタマーサポート",
    digital_mkt: "デジタルマーケティング", content_mkt: "コンテンツマーケティング",
    event_mkt: "イベントマーケティング",
  };
  return LABELS[slugOrUuid] ?? slugOrUuid;
}

// ─── CareerCard ───────────────────────────────────────────────────────────────

function CareerCard({ entry, flex }: { entry: CareerEntry; flex?: boolean }) {
  const { label: tenureLabel } = calculateTenure(entry.startedAt, entry.endedAt);
  const period = formatCareerPeriod(entry.startedAt, entry.endedAt, entry.isCurrent);

  return (
    <div
      style={{
        flex: flex ? 1 : undefined,
        minWidth: 0,
        background: "var(--bg-tint)",
        border: entry.isCurrent ? "1px solid var(--success)" : "1px solid var(--line)",
        borderLeft: entry.isCurrent ? "3px solid var(--success)" : undefined,
        borderRadius: 12,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header: logo + company/role */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <CompanyLogo
          name={entry.companyName}
          logoUrl={entry.logoUrl}
          logoLetter={entry.logoLetter}
          logoGradient={entry.logoGradient}
          size="md"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)",
            marginBottom: 3, lineHeight: 1.4,
          }}>
            {entry.roleTitle || getRoleLabel(entry.roleSlug)}
          </div>
          <div style={{
            fontSize: 12, color: "var(--ink-soft)",
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          }}>
            {entry.companyType === "anon" ? (
              <span style={{ fontStyle: "italic" }}>{entry.companyName}</span>
            ) : (
              <span>{entry.companyName}</span>
            )}
            {entry.companyType === "master" && (
              <span style={{
                fontSize: 9, padding: "1px 5px", borderRadius: 3,
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                color: "var(--royal)", flexShrink: 0,
              }}>
                マスタ登録
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Period + tenure + current badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        fontFamily: "Inter, sans-serif", fontSize: 11,
        color: "var(--ink-mute)", fontWeight: 500,
      }}>
        <span>{period}</span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span>{entry.isCurrent ? `${tenureLabel}（現在）` : tenureLabel}</span>
        {entry.isCurrent && (
          <span style={{
            background: "var(--success-soft)", color: "var(--success)",
            padding: "1px 6px", borderRadius: 4, fontWeight: 700,
            fontSize: 9, letterSpacing: "0.05em",
          }}>
            CURRENT
          </span>
        )}
      </div>

      {/* Description — non-italic, 3-line clamp */}
      {entry.description && (
        <div
          style={{
            fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.75,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}
        >
          {entry.description}
        </div>
      )}

      {/* Why — italic, 2-line clamp */}
      {entry.why && (
        <div
          style={{
            fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.75,
            fontStyle: "italic",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            borderTop: entry.description ? "1px dashed var(--line)" : undefined,
            paddingTop: entry.description ? 8 : 0,
          } as React.CSSProperties}
        >
          「{entry.why}」
        </div>
      )}
    </div>
  );
}

// ─── CareerTimeline ───────────────────────────────────────────────────────────

/**
 * キャリアタイムライン表示コンポーネント。
 *
 * - groupOverlappingCareers でグループ化
 * - 1件グループ: 全幅カード
 * - 2〜3件グループ: 横並び（flex-row）+ "並行勤務" バッジ
 * - 4件以上グループ: 縦スタック + "並行勤務" バッジ
 */
export function CareerTimeline({ careers }: { careers: CareerEntry[] }) {
  if (careers.length === 0) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", color: "var(--ink-mute)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        職歴は非公開または未登録です
      </div>
    );
  }

  const groups = groupOverlappingCareers(careers);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((group, gi) => {
        const isParallel = group.length > 1;

        return (
          <div key={gi}>
            {/* 並行勤務バッジ */}
            {isParallel && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 8,
              }}>
                <div style={{
                  height: 1, flex: 1, background: "var(--line)",
                }} />
                <span style={{
                  fontSize: 10, fontFamily: "Inter, sans-serif", fontWeight: 600,
                  letterSpacing: "0.06em", color: "var(--ink-mute)",
                  background: "var(--bg-tint)", border: "1px solid var(--line)",
                  padding: "2px 8px", borderRadius: 100,
                  whiteSpace: "nowrap",
                }}>
                  並行勤務 · {group.length}社
                </span>
                <div style={{
                  height: 1, flex: 1, background: "var(--line)",
                }} />
              </div>
            )}

            {/* 1件: 全幅 */}
            {group.length === 1 && (
              <CareerCard entry={group[0]} />
            )}

            {/* 2〜3件: 横並び */}
            {group.length >= 2 && group.length <= 3 && (
              <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                {group.map((entry) => (
                  <CareerCard key={entry.id} entry={entry} flex />
                ))}
              </div>
            )}

            {/* 4件以上: 縦スタック */}
            {group.length >= 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {group.map((entry) => (
                  <CareerCard key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

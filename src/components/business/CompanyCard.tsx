import Link from "next/link";

type Props = {
  tenantId: string;
  tenantName: string;
  logoGradient?: string | null;
  logoLetter?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  memberCount?: number | null;
  planType?: string | null;
};

const PLAN_LABELS: Record<string, string> = {
  performance: "成果報酬プラン",
  saas_monthly: "SaaS月額プラン",
  saas_yearly: "SaaS年額プラン",
};

export function CompanyCard({
  tenantId,
  tenantName,
  logoGradient,
  logoLetter,
  industry,
  employeeCount,
  memberCount,
  planType,
}: Props) {
  const gradient = logoGradient || "linear-gradient(135deg, #F97316, #EA580C)";
  const letter = logoLetter || tenantName.trim().charAt(0).toUpperCase();
  const isPaid = !!planType;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
      marginBottom: 20,
      display: "grid",
      gridTemplateColumns: "64px 1fr auto",
      gap: 20,
      alignItems: "center",
    }}>
      {/* Logo */}
      <div style={{
        width: 64, height: 64, borderRadius: 14,
        background: gradient, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 28,
        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}>
        {letter}
      </div>

      {/* Body */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: "var(--ink)",
          marginBottom: 4,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          {tenantName}
          {isPaid ? (
            <span style={{
              padding: "3px 10px", borderRadius: 100,
              fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.1em",
              background: "linear-gradient(135deg, var(--gold), #B45309)",
              color: "#fff",
            }}>
              {PLAN_LABELS[planType!] ?? "有料プラン"}
            </span>
          ) : (
            <span style={{
              padding: "3px 10px", borderRadius: 100,
              fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.1em",
              background: "var(--line-soft)", color: "var(--ink-soft)",
              border: "1px solid var(--line)",
            }}>
              無料プラン
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          {[
            industry,
            employeeCount ? <><strong style={{ color: "var(--ink)" }}>{employeeCount.toLocaleString()}名</strong></> : null,
            memberCount ? <>担当者<strong style={{ color: "var(--ink)" }}>{memberCount}名</strong></> : null,
          ]
            .filter(Boolean)
            .reduce<React.ReactNode[]>((acc, item, i) => (i === 0 ? [item] : [...acc, " · ", item]), [])}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Link
          href={`/companies/${tenantId}`}
          target="_blank"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 600, color: "var(--ink)",
            border: "1px solid var(--line)", borderRadius: 8,
            background: "#fff", textDecoration: "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--royal-100)";
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--royal-50)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--royal)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--line)";
            (e.currentTarget as HTMLAnchorElement).style.background = "#fff";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          公開ページを見る
        </Link>
        <Link
          href="/biz/company"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 600, color: "#fff",
            border: "1px solid var(--royal)", borderRadius: 8,
            background: "var(--royal)", textDecoration: "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--royal-deep)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--royal)";
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          企業情報を編集
        </Link>
      </div>
    </div>
  );
}

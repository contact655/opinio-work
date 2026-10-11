import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";

export const metadata = {
  title: { absolute: "提案の根拠になるもの | OPINIO Business" },
};

/**
 * ★提案の根拠になるもの（2026-10-11 / 柴さんの指示）。/biz/proposals の0件の案内に長く書いていた一覧をここへ移した。
 * ⚠️ 中身は `lib/evidence/` の根拠の種類と揃えること（足したら、ここにも足す）。
 */
export default async function ProposalHelpPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;
  const li: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.9, color: "var(--ink)" };
  return (
    <BusinessLayout userName={ctx.userName} tenantName={ctx.tenantName} tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter} memberships={ctx.allCompanies} currentTenantId={ctx.tenantId}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, maxWidth: 880 }}>
        <div>
          <Link href="/biz/proposals" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>← 提案に戻る</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "8px 0 0" }}>提案の根拠になるもの</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
            OPINIO は、根拠が2つ以上そろった候補者だけをご提案します。根拠になるのは次のものです。
          </p>
        </div>
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 }}>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>貴社に移ってきた方の人数</li>
            <li style={li}>在籍している方・していた方が挙げた入社の決め手</li>
            <li style={li}>話を聞ける方の人数</li>
            <li style={li}>貴社の求人や部門の職種と同じ経験</li>
            <li style={li}>ご本人の希望条件との一致</li>
            <li style={li}>貴社の顧客の業界や事業領域での経験（業界の経験だけでは提案になりません）</li>
          </ul>
        </section>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          求人・職種を設定した部門・社員の回答などの「提案の材料」が増えるほど、根拠のある提案が届きやすくなります。
        </p>
      </div>
    </BusinessLayout>
  );
}

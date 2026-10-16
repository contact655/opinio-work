import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";

export const metadata = {
  title: { absolute: "貴社に興味を持った方が届くしくみ | OPINIO Business" },
};

/**
 * ★貴社に興味を持った方が届くしくみ（2026-10-11 / 柴さんの指示）。旧 /biz/help/proposals から移した（旧 URL は 301）。
 * ⚠️ 企業向けでは「紹介」「提案」と書かない（人材紹介と紛らわしいため）。
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
          <Link href="/biz/messages" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>← メッセージに戻る</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "8px 0 0" }}>貴社に興味を持った方が届くしくみ</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>
            OPINIO は、経歴や希望が貴社と合う求職者に、貴社をおすすめします。おすすめするのは、次のうち2つ以上がそろった方だけです。
          </p>
        </div>
        <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 }}>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>貴社に移ってきた方の人数</li>
            <li style={li}>在籍している方・していた方が挙げた入社の決め手</li>
            <li style={li}>貴社の求人や部門の職種と同じ経験</li>
            <li style={li}>ご本人の希望条件との一致</li>
            <li style={li}>貴社の顧客の業界や事業領域での経験（業界の経験だけではおすすめしません）</li>
          </ul>
        </section>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          求人・職種を設定した部門・社員の回答などの登録が増えるほど、合う方に貴社がおすすめされやすくなります。
          求職者が「話を聞いてみたい」と答えると、その方は貴社の「メッセージ」に届き（一覧に「貴社に興味があります」と出ます）、そのままやり取りできます。届いたときはメールでお知らせします。貴社から送る必要はなく、送れる数の枠も使いません。
          「話を聞いてみたい」と答えなかった方や、誰におすすめしたかは表示しません。
        </p>
      </div>
    </BusinessLayout>
  );
}

import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { ApproachStepsLarge, ApproachTipsList } from "@/components/approaches/ApproachGuide";
import {
  APPROACH_EXPIRE_DAYS, APPROACH_HEADLINE, APPROACH_MONTHLY_LIMIT, APPROACH_OPEN_LIMIT, APPROACH_RESEND_DAYS,
} from "@/lib/constants/companyApproaches";

export const metadata = {
  title: { absolute: "メッセージリクエストとは | OPINIO Business" },
};

/**
 * ★声かけのヘルプ（2026-10-11 / 柴さんの指示）。/biz/approaches の見出しの横「声かけとは？」から来る。
 * ⚠️ 仕組み・書き方のコツは /biz/approaches と同じ部品（`ApproachGuide`）。**文言を書き写さないこと。**
 * ⚠️ 企業側の言葉は「返事待ち」「受け入れられた」。「承認」と書かない（docs/approach-wording-20261011.md）。
 * ⚠️ 数字（月の通数・同時の件数・日数）は定数から出す。直書きしない。
 */
export default async function ApproachHelpPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 };
  const li: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.9, color: "var(--ink)" };

  return (
    <BusinessLayout userName={ctx.userName} tenantName={ctx.tenantName} tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter} memberships={ctx.allCompanies} currentTenantId={ctx.tenantId}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, maxWidth: 880 }}>
        <div>
          <Link href="/biz/approaches" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>← メッセージリクエストに戻る</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "8px 0 0" }}>メッセージリクエストとは</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>{APPROACH_HEADLINE}</p>
        </div>

        <section>
          <h2 style={h2}>仕組み</h2>
          <ApproachStepsLarge />
        </section>

        <section style={card}>
          <h2 style={h2}>送れる数</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>1社あたり毎月{APPROACH_MONTHLY_LIMIT}通まで送れます。毎月1日に戻ります。</li>
            <li style={li}>返事待ちのメッセージリクエストは、同時に{APPROACH_OPEN_LIMIT}件までです。受け入れられるか、送ってから{APPROACH_EXPIRE_DAYS}日たつと枠に戻ります。</li>
            <li style={li}>同じ方へは、送ってから{APPROACH_RESEND_DAYS}日間は再びメッセージリクエストを送れません。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>企業に表示されること</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>受け入れられると、メールでお知らせし、メッセージでやり取りできるようになります。</li>
            <li style={li}>見送られたかどうかは、企業には表示されません。{APPROACH_EXPIRE_DAYS}日たつと、返事がなかったものと同じ表示になります。</li>
            <li style={li}>メッセージリクエストを送れるのは、「企業からのメッセージリクエストを受け取る」と設定している方だけです。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>受け入れられやすい理由の書き方</h2>
          <ApproachTipsList />
        </section>

        <section style={card}>
          <h2 style={h2}>提案との違い</h2>
          <p style={{ margin: 0, ...li }}>
            メッセージリクエストは、御社が自分で見つけた方に送るものです。提案は、OPINIO が根拠をそろえてお届けするもので、双方が「会いたい」と答えるとメッセージが開きます。
          </p>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/biz/candidates" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>候補者を探す</Link>
          <Link href="/biz/approaches" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>メッセージリクエストの状況を見る</Link>
        </div>
      </div>
    </BusinessLayout>
  );
}

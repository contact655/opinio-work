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
 * ⚠️ 企業側の言葉は「返事待ち」「返信あり」。「承認」「受け入れ」と書かない（2026-10-11）（docs/approach-wording-20261011.md）。
 * ⚠️★「メッセージリクエスト」と書くのは見出しと最初の説明文（と戻るリンク）だけ。ほかは「リクエスト」（2026-10-11）。
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
            <li style={li}>返事待ちのリクエストは、同時に{APPROACH_OPEN_LIMIT}件までです。返信があるか、送ってから{APPROACH_EXPIRE_DAYS}日たつと枠に戻ります。</li>
            <li style={li}>返信が来るまでは、同じ方に続けて送ることはできません。</li>
            <li style={li}>同じ方へは、送ってから{APPROACH_RESEND_DAYS}日間は再びリクエストを送れません。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>相手の返事と、企業に表示されること</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>相手は理由と本文を読んで、返信するかを決めます。返信は、届いたリクエストの下の欄にそのまま書いて送れます。</li>
            <li style={li}>返信があると、メールでお知らせします。会話が開き、御社の理由と本文が1通目、相手の返信が2通目として入ります（状態は「返信あり」）。会話は御社の有効な担当者なら誰でも見て返信できます。</li>
            <li style={li}>「今回は見送る」が選ばれても、企業には表示されません。返事が無いものと同じく「返事待ち」のまま、送ってから{APPROACH_EXPIRE_DAYS}日たつと「{APPROACH_EXPIRE_DAYS}日を過ぎました」になります。</li>
            <li style={li}>相手の一覧からは、届いてから{APPROACH_EXPIRE_DAYS}日たつと外れ、返信もできなくなります。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>返信をもらいやすい理由の書き方</h2>
          <ApproachTipsList />
        </section>

        {/* ★LinkedIn の InMail との違い（2026-10-11 / 柴さんの指示）。⚠️ 仕組みを変えたときはここも直す */}
        <section style={card} data-state="help-inmail-diff">
          <h2 style={h2}>LinkedIn の InMail との違い</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}><strong>受け取る設定の人にだけ届きます。</strong>リクエストを受け取ると設定した方にだけ送れます。</li>
            <li style={li}><strong>理由が必須です。</strong>経歴を見て、話を聞きたい理由を書いてから送ります。</li>
            <li style={li}><strong>見送りは伝わりません。</strong>「今回は見送る」が選ばれても、企業には表示されません。</li>
            <li style={li}><strong>{APPROACH_EXPIRE_DAYS}日で外れます。</strong>返事が無いまま{APPROACH_EXPIRE_DAYS}日たつと、相手の一覧から外れ、返信もできなくなります。返事待ちの枠も戻ります。</li>
            <li style={li}><strong>返事待ちは{APPROACH_OPEN_LIMIT}件までです。</strong>同時に返事を待てるリクエストは{APPROACH_OPEN_LIMIT}件までで、返信が来るまで同じ方に続けて送ることはできません。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>提案との違い</h2>
          <p style={{ margin: 0, ...li }}>
            リクエストは、御社が自分で見つけた方に送るものです。提案は、OPINIO が根拠をそろえてお届けするもので、双方が「会いたい」と答えるとメッセージが開きます。
          </p>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/biz/candidates" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>候補者を探す</Link>
          <Link href="/biz/approaches" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>リクエストの状況を見る</Link>
        </div>
      </div>
    </BusinessLayout>
  );
}

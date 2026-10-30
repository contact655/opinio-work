import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { ApproachStepsLarge, ApproachTipsList } from "@/components/approaches/ApproachGuide";
import {
  APPROACH_HEADLINE, APPROACH_SILENCE_NOTE, APPROACH_RESEND_DAYS,
} from "@/lib/constants/companyApproaches";

export const metadata = {
  title: { absolute: "候補者にメッセージを送るときのルール | OPINIO Business" },
};

/**
 * ★候補者にメッセージを送るときのルール（2026-10-11 / 柴さんの指示）。/biz/messages の見出しの横「送るときのルール」から来る。
 *   旧 /biz/help/approaches は next.config.mjs で 301 転送。
 * ⚠️ 仕組み・書き方のコツは /biz/messages と同じ部品（`ApproachGuide`）。**文言を書き写さないこと。**
 * ⚠️★「リクエスト」「受け入れ」「確認する」「承認」と書かない（2026-10-11 に「メッセージ」へまとめた）（docs/approach-wording-20261011.md）。
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
          <Link href="/biz/messages" style={{ fontSize: 13, color: "var(--ink-soft)", textDecoration: "none" }}>← メッセージに戻る</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "8px 0 0" }}>候補者にメッセージを送るときのルール</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)", margin: "6px 0 0" }}>{APPROACH_HEADLINE}</p>
        </div>

        <section>
          <h2 style={h2}>仕組み</h2>
          <ApproachStepsLarge />
        </section>

        <section style={card}>
          <h2 style={h2}>送れる数</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>送れる数に上限はありません。</li>
            <li style={li}>返信が来るまでは、同じ方に続けて送ることはできません。</li>
            <li style={li}>返信があった方へは、送ってから{APPROACH_RESEND_DAYS}日間は再び送れません。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>相手の返事と、企業に表示されること</h2>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
            <li style={li}>相手は理由と本文を読んで、返信するかを決めます。相手はメッセージ一覧の「未返信」から開き、下の欄にそのまま返信を書いて送れます。</li>
            <li style={li}>返信があると、メールでお知らせします。そのままメッセージでやり取りが続きます（貴社の理由と本文が1通目、相手の返信が2通目）。会話は貴社の有効な担当者なら誰でも見て返信できます。</li>
            <li style={li}>{APPROACH_SILENCE_NOTE}</li>
            <li style={li}>メッセージに期限はありません。相手はいつでも返信できます。</li>
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
            <li style={li}><strong>転職を考えていない方には届きません。</strong>「転職意欲」で「今は考えていない」を選んだ方は、候補者検索に表示されず、メッセージも届きません。</li>
            <li style={li}><strong>理由が必須です。</strong>経歴を見て、話を聞きたい理由を書いてから送ります。</li>
            <li style={li}><strong>返事がない理由は表示されません。</strong>返事が来ない場合、その理由は企業には表示されません。</li>
            <li style={li}><strong>返信が来るまで、同じ方に続けて送れません。</strong>送ったメッセージに期限はなく、相手はいつでも返信できます。</li>
          </ul>
        </section>

        <section style={card}>
          <h2 style={h2}>貴社に興味を持った方</h2>
          {/* ⚠️ 企業向けでは「紹介」「提案」と書かない（2026-10-11 / 柴さんの指示） */}
          <p style={{ margin: 0, ...li }}>
            OPINIO が経歴の合う方に貴社をおすすめし、「話を聞いてみたい」と答えた方も、このメッセージに届きます（一覧に「貴社に興味があります」と出ます）。貴社から送る必要はありません。
            {" "}<Link href="/biz/help/interested" style={{ color: "var(--royal)", fontWeight: 600 }}>しくみを見る</Link>
          </p>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/biz/candidates" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>候補者を探す</Link>
          <Link href="/biz/messages?tab=pending" className="btn-fixed-size" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>返事待ちを見る</Link>
        </div>
      </div>
    </BusinessLayout>
  );
}

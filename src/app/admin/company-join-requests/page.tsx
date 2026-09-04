import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOpenJoinRequests } from "@/lib/business/joinRequests";
import { RequestsClient } from "./RequestsClient";

/* ⚠️ 運営が押した結果をすぐ反映する。キャッシュに載せない。 */
export const dynamic = "force-dynamic";

export const metadata = { title: { absolute: "企業への参加依頼 | OPINIO 運営" } };

/**
 * 「この企業の担当者に追加してください」と送られた依頼を、全社横断で1枚に出す（2026-09-04）。
 *
 * ── なぜ運営に要るか ────────────────────────────────────────────────────────
 * 依頼は**既存の担当者にメールを送るだけ**だが、
 * **掲載中79社のうち、そのメールが誰かに届く企業は2社しかない**（2026-09-04 実測）。
 * 残り77社では、企業側に受け取れる人がいない。**運営が見なければ依頼はどこにも着かない。**
 *
 * ⚠️ `/admin/ambassador-requests`（面談対応者）とは**別の問い**に答える画面。
 *    あちらは「勝手に載っている人がいないか」、ここは「入りたい人を入れるか」。統合しない。
 *
 * ⚠️ 取得に失敗したら「0件」と表示しない。**失敗した事実を出す**
 *    （CLAUDE.md「403 は0件として静かに素通りする」）。
 */
export default async function CompanyJoinRequestsPage() {
  const requests = await fetchOpenJoinRequests(createAdminClient());

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>
        企業への参加依頼
      </h1>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)" }}>既存の担当者がいる企業に「担当者に追加してほしい」と送られた依頼</strong>
        のうち、まだ担当者になれていないものです。<strong style={{ color: "var(--ink)" }}>古いものが上に並びます。</strong>
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#92400e", lineHeight: 1.7, fontWeight: 600 }}>
        依頼メールは企業の担当者に送られますが、担当者が登録されていない企業では誰にも届きません。
        承認すると<strong style={{ color: "#7c2d12" }}>その企業の管理画面をその人に渡す</strong>ことになります。
        OPINIO は在籍確認を行っていません。
      </p>

      {requests === null ? (
        /* ⚠️ 空配列に倒さない。壊れているのに正常に見える形を作らない */
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
          padding: 20, fontSize: 13, color: "var(--error)", fontWeight: 600, lineHeight: 1.8,
        }}>
          依頼の取得に失敗しました（0件という意味ではありません）。
          時間をおいて開き直してください。
        </div>
      ) : (
        <RequestsClient requests={requests} />
      )}
    </div>
  );
}

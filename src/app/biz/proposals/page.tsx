import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import BizProposalsClient, { type BizProposalView } from "./BizProposalsClient";

export const dynamic = "force-dynamic";

/**
 * ⑨ 企業への候補者提案（②の裏返し）。
 *
 * ⚠️★★**候補者は匿名。氏名・顔写真・現職社名を出さない。**
 *    そのために **`ow_users` を一切 select しない**（join もしない）。
 *    ここに `ow_users(name)` を足した瞬間に匿名でなくなる。
 *    ⚠️ 「画面で出さなければよい」ではない。**サーバーから送らない**こと。
 *       送ると RSC ペイロードに載り、HTML を見れば読める。
 *
 * ⚠️★**これはスカウトではない。** `ow_scouts` には触らない。
 *    スカウトの3つのゲート（`SCOUT_SENDING_ENABLED` / 有料プラン / `can_send_scout`）
 *    とも無関係。**ここから送信機能を生やさないこと。**
 *
 * ⚠️ 年齢・年代は出さない（`/biz` に年齢を渡さないという既存方針）。
 *    `ow_users.birth_date` も `ow_profiles.birth_year` も読んでいない。
 */
export default async function BizProposalsPage() {
  const ctx = await getTenantContext();
  /* ⚠️ 他の /biz と同じ形にする。`null` を返すと**真っ白な画面**になる */
  if (!ctx) return <BizNoTenantPage />;

  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("ow_proposals")
    /* ★★候補者を特定できる列を1つも取らない。
          取るのは id（操作に要る）と、提案そのものの中身だけ。 */
    .select("id, evidence, counter_evidence, candidate_response, company_response, computed_at, job_id, ow_jobs(title)")
    .eq("company_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  if (error) console.error("[biz/proposals] ow_proposals:", error.message);

  const proposals: BizProposalView[] = (rows ?? []).map((p) => ({
    id: p.id as string,
    evidence: Array.isArray(p.evidence) ? (p.evidence as BizProposalView["evidence"]) : [],
    counter: Array.isArray(p.counter_evidence) ? (p.counter_evidence as BizProposalView["counter"]) : [],
    /* ★相手が既に「興味がある」と答えているか。**名前は渡さない** */
    candidateInterested: p.candidate_response === "interested",
    candidateDeclined: p.candidate_response === "declined",
    response: (p.company_response as string | null) ?? null,
    jobTitle: ((p.ow_jobs as { title?: string } | null)?.title as string | undefined) ?? null,
    computedAt: (p.computed_at as string).slice(0, 10),
  }));

  /* ⚠️★**`BusinessLayout` で包む。** 2026-09-21 にナビへ「提案」を足すまで
        このページには**どこからもリンクが無く**、包み忘れに気づけなかった。
        包まないと**ナビが出ず、開いた人が戻れない**（求職者側の `/proposals` が
        `MypageLayout` の外にあったのと同じ形）。 */
  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <BizProposalsClient proposals={proposals} loadFailed={!!error} />
    </BusinessLayout>
  );
}

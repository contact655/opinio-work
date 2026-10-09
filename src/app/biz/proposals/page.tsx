import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import BizProposalsClient, { type BizProposalView } from "./BizProposalsClient";

export const dynamic = "force-dynamic";

/* ★タブの題（2026-09-21）。それまで指定が無く、サイト全体の題が出ていた。
      サイドバーの「提案」と同じ名前にする */
export const metadata = {
  title: { absolute: "提案 | OPINIO Business" },
};

/**
 * ⑨ 企業への候補者提案（②の裏返し）。
 *
 * ★★**候補者は実名で出す**（2026-10-09 / 柴さんの判断・案B）。
 *    それまでは「匿名」としていたが、提案の対象（実在の利用者）は**全員**、
 *    同じ企業の候補者検索（`/biz/candidates`）に実名で出ていた（実測: 差は0人）。
 *    「匿名」は守れない約束になっていたので、検索と同じ見え方にそろえた。
 * ⚠️★**名前を出すかは `can_send_scout()` で毎回決める。** 提案は作った時点の
 *    スナップショットだが、名前はスナップショットにしない。本人がその後
 *    「今は考えていない」に変えた・ブロックした・在籍した、などで見せてはいけなくなった
 *    候補者は**名前を送らない**（候補者検索から消えるのと同じ規則）。
 *    ⚠️ 「画面で出さなければよい」ではない。**サーバーから送らない**こと。
 *       送ると RSC ペイロードに載り、HTML を見れば読める。
 * ⚠️ 送るのは氏名・見出し・`/u/[id]` 用の id だけ。顔写真・現職社名はプロフィール側で見る。
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
    /* ★`introduced_at` / `conversation_id` も取る（2026-09-21）。双方合意のカードから
          その会話を直接開くため。⚠️ どちらも候補者を特定できる列ではない（会話の id） */
    .select("id, candidate_user_id, evidence, counter_evidence, candidate_response, company_response, computed_at, job_id, introduced_at, conversation_id, ow_jobs(title)")
    .eq("company_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  if (error) console.error("[biz/proposals] ow_proposals:", error.message);

  /* ★候補者の氏名（2026-10-09 / 案B）。**`can_send_scout()` が true の人だけ**送る。 */
  const candidateIds = Array.from(new Set((rows ?? []).map((p) => p.candidate_user_id as string)));
  const { data: userRows, error: userErr } = candidateIds.length > 0
    ? await db.from("ow_users").select("id, name, headline, auth_id").in("id", candidateIds)
    : { data: [], error: null };
  if (userErr) console.error("[biz/proposals] ow_users:", userErr.message);
  const visibleCandidates = new Map<string, { id: string; name: string; headline: string | null }>();
  await Promise.all((userRows ?? []).map(async (u) => {
    if (!u.auth_id) return;
    /* ⚠️ 失敗したら**出さない側**に倒す（名前が出ないだけで、提案は見える）。黙らない */
    const { data: ok, error: rpcErr } = await db.rpc("can_send_scout", {
      p_company_id: ctx.tenantId,
      p_candidate_id: u.auth_id as string,
    });
    if (rpcErr) console.error("[biz/proposals] can_send_scout:", rpcErr.message);
    if (ok === true) {
      visibleCandidates.set(u.id as string, {
        id: u.id as string,
        name: ((u.name as string | null) ?? "").trim() || "名前未設定",
        headline: ((u.headline as string | null) ?? "").trim() || null,
      });
    }
  }));

  const proposals: BizProposalView[] = (rows ?? []).map((p) => ({
    id: p.id as string,
    evidence: Array.isArray(p.evidence) ? (p.evidence as BizProposalView["evidence"]) : [],
    counter: Array.isArray(p.counter_evidence) ? (p.counter_evidence as BizProposalView["counter"]) : [],
    /* ★候補者の氏名。見せてはいけない人は null（上の `can_send_scout()`） */
    candidate: visibleCandidates.get(p.candidate_user_id as string) ?? null,
    /* ★相手が既に「興味がある」と答えているか */
    candidateInterested: p.candidate_response === "interested",
    candidateDeclined: p.candidate_response === "declined",
    response: (p.company_response as string | null) ?? null,
    jobTitle: ((p.ow_jobs as { title?: string } | null)?.title as string | undefined) ?? null,
    computedAt: (p.computed_at as string).slice(0, 10),
    /* ⚠️ 紹介したかの正は `introduced_at`（CLAUDE.md）。`conversation_id` は会話を消すと
          null になりうるので、両方あるときだけリンクを出す */
    conversationId: p.introduced_at && p.conversation_id ? (p.conversation_id as string) : null,
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

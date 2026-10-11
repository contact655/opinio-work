import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { companyLinkStateFor } from "@/lib/companies/linkState";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";
import MypageLayout from "../_components/MypageLayout";
import ProposalsClient, { type ProposalView } from "./ProposalsClient";
import { isVisiblePair, phaseInputOf, PROPOSAL_PHASE_COLS, proposalDaysLeft, visiblePairs } from "@/lib/evidence/proposalEnded";
import { getCompanyProposalMode } from "@/lib/evidence/companyProposals";
import { proposalPhase } from "@/lib/constants/proposalResponses";
import { jobListingStateFor } from "@/lib/jobs/publicJobs";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";

export const dynamic = "force-dynamic";

export const metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
        `template: "%s | OPINIO"` が後ろに足すので、素の `title` だと
        「… | OPINIO | OPINIO」になる。 */
  title: { absolute: "あなたに合いそうな会社 | OPINIO" },
  /* ⚠️ 本人にしか出ない画面。検索結果に出す意味が無い */
  robots: { index: false, follow: false },
};

/**
 * ② 根拠つきのフィット提案。
 *
 * ⚠️★**ここで根拠を作り直さない。** `ow_proposals.evidence` は作成時点の
 *    スナップショット。作り直すと、候補者に見せた数字と後から見る数字が食い違う。
 *
 * ⚠️ 認証は `src/middleware.ts` の `needsAuth` にも足すこと。
 *    ページ側の `redirect()` だけだと `loading.tsx` を持つ配下で
 *    **200 のままシェルが流れる**（CLAUDE.md「ソフト200」）。
 */
export default async function ProposalsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=%2Fmypage%2Fproposals");

  const db = createAdminClient();
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[proposals] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fmypage%2Fproposals");

  const { data: rows, error } = await db
    .from("ow_proposals")
    /* ★段の判定に要る列は `PROPOSAL_PHASE_COLS` の1か所。
          ⚠️★**`company_response` / `delivery_mode` そのものはクライアントに送らない**
            （企業が見送ったこと・企業の設定を伝えない。送るのは段から作った表示用の区分だけ） */
    .select(`id, company_id, evidence, counter_evidence, computed_at, conversation_id, candidate_note, ${PROPOSAL_PHASE_COLS}, ow_companies(id, name, name_en, slug, tagline, logo_url, is_test), ow_jobs(id, title, slug, status, is_test)`)
    .eq("candidate_user_id", me.id)
    .order("created_at", { ascending: false });
  /* ⚠️ 握り潰さない。失敗を「0件」に見せない（CLAUDE.md） */
  if (error) console.error("[proposals] ow_proposals:", error.message);

  const visible = await visiblePairs(
    (rows ?? []).map((p) => ({ companyId: p.company_id as string, candidateUserId: me.id as string })),
  );

  /* ★未回答の提案について、企業の設定（すぐにメッセージ／確認してから）を引く。
        押す直前の説明を変えるためだけに使う（「押すとすぐメッセージ」が B では事実と違うため）。
        ⚠️ 読めなかったら review 側の説明に倒す（できると言い過ぎない） */
  const pendingCompanyIds = Array.from(new Set((rows ?? [])
    .filter((p) => !p.candidate_response).map((p) => p.company_id as string)));
  const modeByCompany = new Map(await Promise.all(
    pendingCompanyIds.map(async (id) => [id, (await getCompanyProposalMode(id)) ?? "review"] as const),
  ));

  /* ★運営会社（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();
  const proposals: ProposalView[] = (rows ?? []).map((p) => {
    const phase = proposalPhase(
      phaseInputOf(p),
      isVisiblePair(visible, { companyId: p.company_id as string, candidateUserId: me.id as string }),
    );
    /* ★求職者に見せる区分。⚠️ 企業が見送った・期限切れ・いまは見せない、を区別しない（「終了しました」だけ） */
    const status: ProposalView["status"] =
      phase === "candidate_pending" ? "pending"
      : phase === "introduced" ? "introduced"
      : phase === "candidate_declined" ? "declined"
      : phase === "company_review" || phase === "connecting" ? "waiting"
      : "ended";
    const co = p.ow_companies as unknown as {
      id: string; name: string; name_en: string | null; slug: string | null;
      tagline: string | null; logo_url: string | null; is_test: boolean | null;
    } | null;
    const job = p.ow_jobs as unknown as {
      id: string; title: string | null; slug: string | null; status: string | null; is_test: boolean | null;
    } | null;
    const { displayName } = co
      ? companyDisplayName(co.name, co.name_en)
      : { displayName: "—" };
    /* ★関連する求人。⚠️ 掲載を終了した求人はリンクにしない（404 の行き止まりを作らない） */
    const jobState = job ? jobListingStateFor(job, { viewerIsTest: me.is_test === true, companyIsTest: co?.is_test === true }) : "closed";
    return {
      id: p.id as string,
      companyName: displayName,
      /* ★見ている人と会社がどちらも検証用なら、社名は文字だけ（`companyLinkStateFor`）。
            ⚠️ `is_test` を select から落とさない。落とすと実在の会社として扱われ、404 へのリンクが出る */
      companyHref: co && companyLinkStateFor({ isTest: co.is_test }, { viewerIsTest: me.is_test === true }) === "open"
        ? `/companies/${co.slug ?? co.id}` : null,
      tagline: co?.tagline ?? null,
      logoUrl: co?.logo_url ?? null,
      isOwnCompany: ownCompanyId !== null && (p.company_id as string) === ownCompanyId,
      evidence: Array.isArray(p.evidence) ? (p.evidence as ProposalView["evidence"]) : [],
      counter: Array.isArray(p.counter_evidence) ? (p.counter_evidence as ProposalView["counter"]) : [],
      status,
      companyReviews: status === "pending" ? modeByCompany.get(p.company_id as string) !== "auto" : false,
      jobTitle: job?.title ?? null,
      jobHref: job && jobState === "open" ? `/jobs/${job.slug ?? job.id}` : null,
      jobClosed: !!job && jobState === "closed",
      note: (p.candidate_note as string | null) ?? null,
      conversationId: status === "introduced" ? ((p.conversation_id as string | null) ?? null) : null,
      computedAt: (p.computed_at as string).slice(0, 10),
      /* ★締め切り（2026-10-10）。⚠️ 未回答のときだけ出す */
      daysLeft: status === "pending" ? proposalDaysLeft(p.respond_by as string) : null,
    };
  });

  /* ⚠️ **取得に失敗したときはバッジを出さない。** 0 を渡すと
        `badge > 0` で描画ごと落ちる＝「未回答は無い」と嘘をつくことになる。 */
  /* ⚠️ 答えられる提案だけ数える（`/mypage` のバッジ `countOpenProposals` と同じ条件＝段が candidate_pending） */
  const unanswered = error ? undefined : proposals.filter((p) => p.status === "pending").length;

  return (
    <MypageLayout activeKey="proposals" proposalsBadge={unanswered}>
      <ProposalsClient
        proposals={proposals}
        minEvidence={MIN_EVIDENCE_FOR_PROPOSAL}
        /* ⚠️ 取得に失敗したときに「0社でした」と言わない。CLAUDE.md
              「取得に失敗したら『0件』と表示しない」 */
        loadFailed={!!error}
      />
    </MypageLayout>
  );
}

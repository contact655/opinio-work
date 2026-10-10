import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { companyLinkStateFor } from "@/lib/companies/linkState";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";
import MypageLayout from "../_components/MypageLayout";
import ProposalsClient, { type ProposalView } from "./ProposalsClient";
import { isProposalEndedFor, isVisiblePair, proposalDaysLeft, visiblePairs } from "@/lib/evidence/proposalEnded";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";

export const dynamic = "force-dynamic";

export const metadata = {
  /* ⚠️ **`| OPINIO` を自分で書くなら `absolute` にする。** ルートの
        `template: "%s | OPINIO"` が後ろに足すので、素の `title` だと
        「… | OPINIO | OPINIO」になる。 */
  title: { absolute: "あなたへの提案 | OPINIO" },
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
    /* ★`company_id` / `company_response` / `introduced_at` は「終了したか」の判定だけに使う（2026-10-09）。
          ⚠️★**`company_response` そのものはクライアントに送らない**（企業が見送ったことを伝えない） */
    .select("id, company_id, evidence, counter_evidence, candidate_response, company_response, introduced_at, computed_at, respond_by, ow_companies(id, name, name_en, slug, tagline, logo_url, is_test)")
    .eq("candidate_user_id", me.id)
    .order("created_at", { ascending: false });
  /* ⚠️ 握り潰さない。失敗を「0件」に見せない（CLAUDE.md） */
  if (error) console.error("[proposals] ow_proposals:", error.message);

  const visible = await visiblePairs(
    (rows ?? []).map((p) => ({ companyId: p.company_id as string, candidateUserId: me.id as string })),
  );

  /* ★運営会社（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();
  const proposals: ProposalView[] = (rows ?? []).map((p) => {
    const ended = isProposalEndedFor("candidate", {
      companyId: p.company_id as string,
      candidateUserId: me.id as string,
      candidateResponse: (p.candidate_response as string | null) ?? null,
      companyResponse: (p.company_response as string | null) ?? null,
      introducedAt: (p.introduced_at as string | null) ?? null,
      respondBy: p.respond_by as string,
    }, isVisiblePair(visible, { companyId: p.company_id as string, candidateUserId: me.id as string }));
    const co = p.ow_companies as unknown as {
      id: string; name: string; name_en: string | null; slug: string | null;
      tagline: string | null; logo_url: string | null; is_test: boolean | null;
    } | null;
    const { displayName } = co
      ? companyDisplayName(co.name, co.name_en)
      : { displayName: "—" };
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
      response: (p.candidate_response as string | null) ?? null,
      ended,
      computedAt: (p.computed_at as string).slice(0, 10),
      /* ★締め切り（2026-10-10）。⚠️ 終了した・両方が答えた提案には出さない */
      daysLeft: ended || (p.candidate_response && p.company_response) ? null : proposalDaysLeft(p.respond_by as string),
    };
  });

  /* ⚠️ **取得に失敗したときはバッジを出さない。** 0 を渡すと
        `badge > 0` で描画ごと落ちる＝「未回答は無い」と嘘をつくことになる。 */
  /* ⚠️ 終了した提案は答えられないので数えない（`/mypage` のバッジと同じ条件） */
  const unanswered = error ? undefined : proposals.filter((p) => !p.response && !p.ended).length;

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

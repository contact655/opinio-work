import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";
import ProposalsClient, { type ProposalView } from "./ProposalsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "あなたへの提案 | OPINIO",
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
  if (!user) redirect("/auth?next=%2Fproposals");

  const db = createAdminClient();
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[proposals] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fproposals");

  const { data: rows, error } = await db
    .from("ow_proposals")
    .select("id, evidence, counter_evidence, candidate_response, computed_at, ow_companies(id, name, name_en, slug, tagline, logo_url)")
    .eq("candidate_user_id", me.id)
    .order("created_at", { ascending: false });
  /* ⚠️ 握り潰さない。失敗を「0件」に見せない（CLAUDE.md） */
  if (error) console.error("[proposals] ow_proposals:", error.message);

  const proposals: ProposalView[] = (rows ?? []).map((p) => {
    const co = p.ow_companies as unknown as {
      id: string; name: string; name_en: string | null; slug: string | null;
      tagline: string | null; logo_url: string | null;
    } | null;
    const { displayName } = co
      ? companyDisplayName(co.name, co.name_en)
      : { displayName: "—" };
    return {
      id: p.id as string,
      companyName: displayName,
      companyHref: co ? `/companies/${co.slug ?? co.id}` : null,
      tagline: co?.tagline ?? null,
      logoUrl: co?.logo_url ?? null,
      evidence: Array.isArray(p.evidence) ? (p.evidence as ProposalView["evidence"]) : [],
      counter: Array.isArray(p.counter_evidence) ? (p.counter_evidence as ProposalView["counter"]) : [],
      response: (p.candidate_response as string | null) ?? null,
      computedAt: (p.computed_at as string).slice(0, 10),
    };
  });

  return (
    <ProposalsClient
      proposals={proposals}
      minEvidence={MIN_EVIDENCE_FOR_PROPOSAL}
      /* ⚠️ 取得に失敗したときに「0社でした」と言わない。CLAUDE.md
            「取得に失敗したら『0件』と表示しない」 */
      loadFailed={!!error}
    />
  );
}

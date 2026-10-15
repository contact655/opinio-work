import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyLinkStateFor } from "@/lib/companies/linkState";
import { buildForYou } from "@/lib/forYou/rank";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";
import MypageLayout from "../_components/MypageLayout";
import ForYouClient, { type ForYouView } from "./ForYouClient";

/* ⚠️ 本人ごとに並びが違う。キャッシュしない */
export const dynamic = "force-dynamic";

export const metadata = {
  /* ⚠️ `| OPINIO` を自分で書くので absolute（ルートの template が後ろに足すため） */
  title: { absolute: "あなたに合う順 | OPINIO" },
  /* ⚠️ 本人にしか出ない画面 */
  robots: { index: false, follow: false },
};

/**
 * ★「あなたに合う順」の企業一覧（2026-10-15）。並べ方は lib/forYou/（weights.ts に重みと理由）。
 *
 * ⚠️ 認証は middleware の `/mypage` の行が弾く（ページ側の redirect だけだと loading.tsx の内側で 200 のまま流れる）。
 * ⚠️ 本人にしか見せない。企業には何も渡らない（渡るのは「興味あり」を押した後だけ）。
 * ⚠️★ISR のページ（/companies など）にこの一覧を混ぜないこと（認証を読むとページ全体が動的になる）。
 */
export default async function ForYouPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=%2Fmypage%2Ffor-you");

  const db = createAdminClient();
  const { data: me, error: meErr } = await db
    .from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[for-you] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fmypage%2Ffor-you");

  const result = await buildForYou(me.id as string);
  const viewerIsTest = me.is_test === true;

  const companies: ForYouView[] = result.ok
    ? result.companies.map((c) => ({
        id: c.id,
        rank: c.rank,
        name: c.name,
        /* ★見ている人と会社がどちらも検証用なら文字だけ（企業ページは検証用の会社を誰にも開かない） */
        href: companyLinkStateFor({ isTest: c.isTest, isPublished: c.isPublished }, { viewerIsTest }) === "open"
          ? `/companies/${c.slug ?? c.id}` : null,
        tagline: c.tagline,
        reasons: c.reasons,
        hasTalkable: c.hasTalkable,
        hasResponder: c.hasResponder,
        reaction: c.reaction?.reaction ?? null,
        conversationId: c.reaction?.conversationId ?? null,
        interested: !!c.reaction?.interestedAt,
      }))
    : [];

  return (
    <MypageLayout activeKey="for_you">
      <ForYouClient
        companies={companies}
        /* ⚠️ 取得に失敗したときに「0社」と言わない */
        loadFailed={!result.ok}
        noReasons={result.ok && result.withReasonCount === 0}
        declineReasons={CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label }))}
      />
    </MypageLayout>
  );
}

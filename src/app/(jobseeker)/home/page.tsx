import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPERIENCE_COMPANY_COLS, resolveExperienceCompanyLabel } from "@/lib/experiences/companyName";
import { buildForYou } from "@/lib/forYou/rank";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";
import ForYouSection from "../mypage/proposals/ForYouSection";
import { toForYouViews } from "../mypage/proposals/forYouViews";
import HomeDecisionCard from "./HomeDecisionCard";
import { currentJoinDecisionPrompt } from "@/lib/joinDecision/server";
import { HOME_FOR_YOU_LIMIT, HOME_MOBILE_FOR_YOU_AFTER, HOME_MOBILE_PATHS_AFTER } from "@/lib/home/homeState";
import { getPathsView } from "@/lib/paths/server";
import { PrevCareerSummary } from "@/components/people/PrevCareerSummary";
import FeedClient from "../feed/(list)/FeedClient";
import { loadFeedProps } from "../feed/(list)/loadFeedProps";

/**
 * ★ホーム（2026-11-03 に /feed をまとめた / 柴さんの指示）。ログイン後の着地。
 *
 *   左＝プロフィール欄・右の列は、旧 /feed の部品（FeedClient）のまま。
 *   ★2026-11-04 に並びを変えた（柴さんの指示。PC 1440×900 の最初の画面でタイムラインが見えるように）:
 *   中央の上から:
 *     ① 入社の決め手（聞いてよいときだけ。lib/joinDecision）
 *     ② 投稿欄 → ③ タイムライン（旧 /feed）
 *   右の列（PC）の上から: 職歴の案内（職歴が0件の人だけ。×で7日間出さない。2026-11-04 に中央の帯から移した）
 *     → あなたに合う会社（3社・「…」に 保存／あとで／興味なし）→ フォロー中のユーザー → 同じ経歴の人の行き先 → いつもの枠
 *   ★右の列の箱と行の見た目は components/feed/railKit.tsx の1か所
 *   スマホ: 職歴の案内はページの一番上に同じ箱で出す
 *   スマホ: 合う会社はタイムラインの2件目と3件目の間（横スクロール）、行き先は5件目のあと（lib/home/homeState.ts）
 * ⚠️★どのブロックも中身が無ければ描かない（空の箱を出さない）
 * ⚠️ 2026-11-03 に「あなたの転機の傾向」と「提案の精度を上げる（転機の回答数）」は外した（柴さんの判断）。
 *    似た経歴の要約（lib/companyFlow の getSimilarPaths・下限3人・在籍平均と1年後の割合）も ④ に置き換えた
 * ⚠️ /feed は middleware が /home へ転送する（未ログインは /）。/feed/[postId] は残す
 * ⚠️ 認証は middleware の needsAuth にも入れてある（loading の境界の内側の redirect は 200 になるため）
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "ホーム | OPINIO" },
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=%2Fhome");
  const db = createAdminClient();
  const { data: me, error: meErr } = await db.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[home] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fhome");
  const owId = me.id as string;
  const isTest = me.is_test === true;

  /* ★タイムライン（loadFeedProps）と上のブロックは互いに依存しないので並列に引く */
  const [expRes, forYou, proposedRes, decisionPrompt, paths, feed] = await Promise.all([
    db.from("ow_experiences").select(`id, ${EXPERIENCE_COMPANY_COLS}`).eq("user_id", owId),
    buildForYou(owId),
    db.from("ow_proposals").select("company_id").eq("candidate_user_id", owId),
    /* ★入社の決め手（1問・2026-11-02）。現職の会社について、いま聞いてよいときだけ */
    currentJoinDecisionPrompt(owId),
    /* ★同じ経歴の人の行き先。起点は本人の直近の職歴（職種の大分類 × 業界の大分類） */
    getPathsView({}, { owUserId: owId, isTest }),
    loadFeedProps(),
  ]);
  if (expRes.error) console.error("[home] experiences:", expRes.error.message);
  if (proposedRes.error) console.error("[home] proposals:", proposedRes.error.message);
  type Exp = { id: string; company_id: string | null; company_text: string | null; company_anonymized: string | null; ow_companies: { name: string | null; name_en: string | null } | null };
  const exps = (expRes.data ?? []) as unknown as Exp[];
  /* ⚠️ 取得に失敗したときは「職歴なし」と決めつけない（案内を誤って出さない） */
  const noExperience = !expRes.error && exps.length === 0;

  const proposed = new Set(((proposedRes.data ?? []) as { company_id: string }[]).map((p) => p.company_id));
  const forYouViews = toForYouViews(forYou, isTest, proposed);

  /* ⚠️ この style タグの中に不等号や山かっこを書かないこと（ハイドレーションが壊れる） */
  const homeBoxCss = (
    <style>{`
      .home-box { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 16px; min-width: 0; }
      .home-h2 { font-size: 17px; font-weight: 800; color: var(--ink); margin: 0; line-height: 1.5; }
      .home-lead { font-size: 12.5px; color: var(--ink-mute); line-height: 1.8; margin: 6px 0 0; }
      @media (max-width: 767px) { .home-box { padding: 16px 14px 14px; } .home-h2 { font-size: 16px; } }
    `}</style>
  );

  const top = (
    <>
      {homeBoxCss}
      {decisionPrompt && (() => {
        const e = exps.find((x) => x.id === decisionPrompt.experienceId);
        const name = e ? resolveExperienceCompanyLabel({ ...e, visibility_company: "real" }) ?? "今の会社" : "今の会社";
        return <HomeDecisionCard experienceId={decisionPrompt.experienceId} companyName={name} />;
      })()}
    </>
  );

  const forYouProps = {
    companies: forYouViews,
    loadFailed: !forYou.ok,
    noReasons: false,
    declineReasons: CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label })),
  };
  /* ⚠️ PC の右の列とスマホの差し込みは、どちらか一方しか描かれない（FeedClient が幅で出し分ける） */
  const railTop = <ForYouSection {...forYouProps} compact={{ limit: HOME_FOR_YOU_LIMIT, moreHref: "/mypage/proposals", title: "あなたに合う会社", layout: "rail" }} />;
  /* ★行き先は5人以上の行が1つも無ければ出さない（PrevCareerSummary も null を返すが、スマホの差し込みの枠ごと作らないためここでも見る） */
  const pathsHasRows = !!paths?.start && !!paths.summary && paths.summary.company.length + paths.summary.role.length + paths.summary.industry.length > 0;
  const railAfterUsers = paths && pathsHasRows ? <PrevCareerSummary view={paths} variant="rail" /> : null;
  const mobileInserts = [
    { key: "home-for-you", after: HOME_MOBILE_FOR_YOU_AFTER, node: <ForYouSection {...forYouProps} compact={{ limit: HOME_FOR_YOU_LIMIT, moreHref: "/mypage/proposals", title: "あなたに合う会社", layout: "scroll" }} /> },
    ...(paths && pathsHasRows ? [{ key: "home-paths", after: HOME_MOBILE_PATHS_AFTER, node: <div style={{ marginBottom: 16 }}><PrevCareerSummary view={paths} variant="home" /></div> }] : []),
  ];

  return <FeedClient {...feed} top={top} railTop={railTop} railAfterUsers={railAfterUsers} mobileInserts={mobileInserts} careerPrompt={noExperience} />;
}

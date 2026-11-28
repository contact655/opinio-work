import CompanyInterestButton from "@/components/interest/CompanyInterestButton";
import type { Metadata } from "next";
import { getCompanyFlowCached } from "@/lib/companyFlow/server";
import { hasAnyFlowItem, toFlowSummary } from "@/lib/companyFlow/compute";
import { CompanyFlowSection } from "./CompanyFlowSection";
import { DetailSide } from "@/components/detail/DetailSide";
import { CompanyReasonRanking } from "./CompanyReasonRanking";
import { getCompanyReasonRanking } from "@/lib/joinDecision/server";
import { enterTestViewMode, jobPath, companyPath, TEST_COMPANY_NOTICE } from "@/lib/jobs/testViewMode";
import { respondingCompanyIds } from "@/lib/jobs/respondingJobs";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Fragment } from "react";
import type React from "react";
import { permanentRedirect } from "next/navigation";
import {
  getCompanyBySlugOrId,
  getTestCompanyBySlugOrId, getCompanyForPreview,
  getListedCompanyParams,
  getCompanyPhotosCached,
  getArticlesByCompanyCached,
  getCompanyEmployeesCached,
  getCompanyToolsCached,
  getCompanyStoriesCached,
} from "@/lib/supabase/queries";
import type { CompanyTool } from "@/lib/supabase/queries";
import { SecTitle } from "./SecTitle";
import { DetailHero, HeroChip } from "@/components/detail/DetailHero";
import { DetailSectionNav } from "@/components/detail/DetailSectionNav";
import type { Milestone } from "@/lib/companies/milestones";
import { MilestonesSection } from "./CompanyProfileSections";
import { BusinessSection, MissionSection, WorkstyleSection, BenefitTagsSection, ExternalLinksSection, PROFILE_CSS,
  hasBusinessSection, hasMissionSection, workstyleBoxes, benefitTags, type ExternalLink } from "./CompanyProfileSections";
import MeetingFlowNote from "./MeetingFlowNote";
import ViewBeacon from "@/components/views/ViewBeacon";
import { CompanyEmployeeSections } from "./CompanyEmployeeSections";
import { CompanyConnections } from "@/components/companies/CompanyConnections";
import ToolsSectionClient from "./ToolsSectionClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { CompanyInfoTable, companyTypeLabel, fundingStageLabel } from "@/components/companies/CompanyInfoBox";
import { CompanyContactsCard } from "@/components/companies/CompanyContactsCard";
import { CompanyUpdatesList, type CompanyUpdateItem } from "@/components/companies/CompanyUpdatesList";
import { getSimilarCompanies } from "@/lib/companies/similar";
import { storyCategoryLabel } from "@/lib/companyStories/shared";
import { shortAddress } from "@/lib/jobs/heroFacts";
import { CompanyStoriesStaffCta } from "@/components/companies/CompanyStoriesStaffCta";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import BookmarkButton, { RecentlyViewedTracker, ShareButton, FollowButton, CompanyMoreMenu, CtaReveal } from "./CompanyDetailClient";
import OrgTeamsSectionClient from "./OrgTeamsSectionClient";
/* ⚠️ 2026-08-31 にページから切り出した。`/dev/preview/products` から見るため */

/*
  各セクションの**初期表示の上限**（2026-08-13）。

  取材の進んだ1社だけが全セクションをフル展開しており、ページ長の差が
  そのまま「情報量の差」に見えていた。内容は減らさず初期表示の高さだけ揃える。

  ⚠️ 上限は「畳む/畳まない」の判断にしか使わない。**データは全件描画して渡す。**
  ⚠️ 製品の 5 は 900px でグリッド1行ぶん（`Math.min(全件, 5)` 列）。
     ここを変えるときは列数の式（下の products-grid）も一緒に見ること。
*/
const JOBS_LIMIT = 3;
/* ⚠️ 実体は共通部品に移した（2026-08-30）。求人詳細と同じ値を見るため。
      ⚠️ ここで再定義しないこと。二重管理になる。 */
// BENEFIT_CATEGORY_LIMIT は @/components/companies/BenefitsList にある
import { BackToTop } from "@/components/jobseeker/BackToTop";
import { fmtMan, payNegotiableText } from "@/lib/utils/salary";
import { employeeBandRange, formatEmployeeSize } from "@/lib/constants/employeeBand";
import { isJobPostAlive, isArticlePostAlive, postRefersToTest } from "@/lib/feed/visibility";
import { companyBrandName, companyLegalName } from "@/lib/companies/displayName";
/* ⚠️ `primaryBusinessDomain` は meta・OGPバッジ・Hero が使う（**1つに絞る場所**）。
      **全部**出すのは `CompanyInfoBox`（サイドバーと本文が共有）で、そちらが
      `orderedBusinessDomains` を持つ。混同しないこと。 */
import { primaryBusinessDomain } from "@/types/genre";
import { Markdown } from "@/components/common/Markdown";
import { MEETING_CTA_BG, MEETING_CTA_FG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";
import { getPublicMaterialItemsCached, type PublicMaterialItem } from "@/lib/companyMaterials/server";
import { MATERIAL_CATEGORIES, MATERIAL_CATEGORY_LABELS } from "@/lib/constants/companyMaterials";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";
import { OwnCompanyNote } from "@/components/companies/OwnCompanyNote";
import { CompanyStaffEntry } from "@/components/companies/CompanyStaffEntry";

// Deduplicate getCompanyBySlugOrId calls within a single request
// (generateMetadata and CompanyDetailPage both call it)
const getCompanyBySlugOrIdCached = cache(getCompanyBySlugOrId);



/**
 * ISR の鮮度（2026-09-08 に 60秒 → **300秒**）。
 *
 * ── なぜ延ばしたか ────────────────────────────────────────────────────────
 * ⚠️★**60 は「開発中だから」という一時的な値だった。** `694b9242`（2026-06-10）が
 *    300 → 60 に下げたときのコミットメッセージ自身がこう書いている:
 *      "Faster cache refresh during active development.
 *       After UI stabilizes, can be increased back to 300s for better CDN performance."
 *
 * ⚠️★**編集の即時反映は `revalidatePath` が担保するようになった**（2026-09-07〜08）。
 *    運営・企業の編集経路から `revalidateCompanyPages()` / `revalidateJobPages()` を
 *    呼んでいる。本番実測（`/companies/opinio` を2秒間隔でポーリング）:
 *      tagline 変更 … 保存 → 反映 **391ms**
 *      ツール追加（`unstable_cache` 300秒越し）… **188ms**
 *    → **秒数は「保険」の役割に変わった。** 触っていない企業を何秒古くしてよいか、の値。
 *
 * ⚠️ 300 は `694b9242` が下げる前の値でもある（「安定したら 300 に戻せ」と書かれていた）。
 *
 * ⚠️★**3600 に伸ばさない。理由は 2026-09-08 に差し替わった。**
 *    それまでの理由は「`getCompanyEmployeesCached`（社員）の編集経路＝本人の職歴編集が
 *    配線されておらず、そこだけ最大1時間古くなるため」だった。
 *    **この理由は解消している**（職歴の3経路から `revalidateCompanyPages()` を呼んでいる）。
 *
 *    にもかかわらず伸ばさないのは、**伸ばしても再生成が減らないから。**
 *    ISR の再生成は「**期限切れ後に最初のリクエストが来たとき**」に1回起きる。
 *    つまり**節約になるのは、その1ページが TTL より短い間隔で訪問される場合だけ。**
 *    1時間に1回しか見られないページは、TTL が 300 でも 3600 でも**再生成は1回**。
 *
 *    ⚠️ 実測（2026-09-08 / デプロイの約40分後に10社を1回ずつ取得）:
 *       **有効な9社すべてが `x-vercel-cache: PRERENDER`**
 *       ＝ **デプロイ以降、誰もそのページを開いていない。**
 *       この訪問頻度では 300 と 3600 に差が出ない。
 *
 *    ⚠️ 一方で伸ばすと、**`revalidatePath` を通らない変更**（migration・直接 SQL）が
 *       最大1時間古くなる。**得が無く損だけがある**ので 300 のままにしている。
 *
 *    ⚠️★**伸ばすなら、まず「1ページあたりの訪問間隔が 300秒を切っている」ことを
 *       実測してから。** 宣言値を変えるだけでは何も速くならない。
 *       ⚠️ **`queries.ts` の `unstable_cache` 8本も一緒に上げないと no-op**（下記）。
 *
 * ⚠️ 実データが動かないことも確かめてある（2026-09-07 実測 / 掲載83社）:
 *      `ow_companies` の updated_at … 24時間で **0社** / 7日で4社 / 30日で68社
 *      公開求人（2件）… 7日で0件 ／ 企業投稿・記事 … 30日で0件
 *
 * ⚠️★**巡回時の再生成が減るのが実利。** 83社すべてを事前生成しているので、
 *    クローラが全社を1周するたびに `60秒` だと **83ページ × 約26クエリ ≒ 2,160クエリ**の
 *    再生成が走りうる。300 なら **1/5**。ビルド1回より、こちらのほうが継続的な負荷。
 *    ⚠️ ただし**この 1/5 は「巡回が 60〜300秒おきに来る」場合の上限**。
 *       上で測ったとおり実際の訪問はもっとまばらなので、**これ以上伸ばしても
 *       同じ理屈で減らない**（再生成は訪問回数で頭打ちになる）。
 *
 * ── 変えるときに一緒に見るもの ────────────────────────────────────────────
 * ⚠️★★**この宣言値だけでは決まらない。描画中に使われた `unstable_cache` / fetch の
 *    最小の `revalidate` が、そのままルートの値になる。**
 *    Next のソース（`unstable-cache.js:79-85` / `patch-fetch.js:381,573`）が
 *    `store.revalidate < options.revalidate` で短い方を残している。
 *
 *    ⚠️ **2026-09-08 に実際に踏んだ。** ここを 3600 にしたが、`queries.ts` 側に
 *       60秒のものが3本（記事・ストーリー・面談対応者）残っていたため**実効は 60 のまま**で、
 *       本番の `age` は 60前後で `STALE` に落ちていた（宣言 3600 のはずが変化なし＝no-op）。
 *       → `queries.ts` の 60/120 を **300 に揃えて**から、ここを 300 にした。
 *
 *    ⚠️★**この値を変えるときは `queries.ts` の `unstable_cache` も一緒に見ること。**
 *       1本でも短いものが残っていると、そちらが上限になる。
 *       ⚠️ 宣言値ではなく**本番の `age` が伸びるか**で確かめる（CLAUDE.md
 *          「`revalidate` を書いても効いているとは限らない」）。
 *
 * ⚠️★**`revalidatePath` を通らない変更は最大300秒古くなる。** 具体的には
 *    **migration や直接 SQL でのデータ投入**。CLAUDE.md「コード変更が1行も無い migration は
 *    デプロイのきっかけ自体が発生しない」と同じ話で、**データだけの migration でも
 *    commit / push してデプロイを走らせること**（デプロイすれば ISR ごと作り直される）。
 *
 * ⚠️ 掲載状態（`is_published` / 求人の `status`）が絡むページなので、CLAUDE.md には
 *    「60秒以下にすること」と書いてあった。**その前提は編集経路の配線で解消している**
 *    ——運営が取り下げた瞬間に `revalidateCompanyPages()` が走る。
 *    ⚠️ 配線されていない経路を新しく作ったら、この値を延ばした判断ごと崩れる。
 */
/* ⚠️ revalidate はルートの page.tsx に置く（ここはページの本体の部品）。値は 300 */

/*
 * ⚠️ **これが無いと `revalidate` が効かない**（2026-08-09 実測。詳細は CLAUDE.md）。
 *    動的セグメントは generateStaticParams を持つものだけがキャッシュされる。
 *
 * ⚠️ 足す前に、このページから no-store の読み取りに到達しないか確認すること。
 *    到達するとビルドは成功したまま、その項目だけ消えたページが生成される。
 *    2026-08-09 時点では到達しないことを確認済み。
 */
/**
 * ビルド時に事前生成する企業ページ ——**掲載中の全社**（2026-09-07 に 12社 → 全件へ）。
 *
 * ⚠️★**件数をハードコードしないこと。** 返すのは `getListedCompanyParams()`（＝
 *    `filterListedCompanies`: `is_published` かつ `listing_status='listed'` かつ
 *    `is_test=false`）が引いた**そのままの件数**。企業は増減するので `.slice(0, N)` に戻さない。
 *
 * ── なぜ12社上限をやめたか（2026-09-07 実測）────────────────────────────────
 * **デプロイ直後に温まっているのは事前生成した12社だけ。** デプロイの約6分後に
 * 掲載83社を1社1回ずつ叩いた結果:
 *
 *     PRERENDER 11 ／ STALE 1 ／ **MISS 71**（＝ 83社中 86% が冷えていた）
 *
 * 温まっていた12社は**事前生成の12社と完全に一致**した。
 * ⚠️★**Vercel はデプロイのたびに ISR キャッシュを捨てる。** つまり
 *    **デプロイのたびに 71社が冷える**（今日だけで3回デプロイしている）。
 *    冷えた企業を最初に踏んだ人は毎回 MISS を払う
 *    （実測: クリック→描画 **890〜1,152ms**。事前生成側は **99〜121ms**）。
 *
 * ── 2026-08-23 の「全79社を事前生成して本番DBが40分落ちた」件との違い ──────
 * ⚠️ **あの事故の機構（Disk IO バジェットの枯渇）は、いまの構成では働かない。**
 *    当時は **NANO**（メモリ 0.5GB）で、DB がバッファキャッシュに載り切らず
 *    ディスクを読み続けたのが原因だった。同日 **MICRO** に上げてある。
 *    実測（2026-09-07）: DB **26MB** に対し `shared_buffers` **256MB**（約10倍）。
 *    企業詳細の代表クエリは `Buffers: shared hit=2` / **`read=0`** ＝ **ディスクを読まない。**
 *    ディスクを読まなければ IO バジェットは減らない。
 * ⚠️ **それでも「クエリが増える」ことは事実。** 上げるときは必ずビルドを回して
 *    PostgREST への実リクエスト数を数えること（`edge_logs` を発信元IPで絞る）。
 *    実測（**fetch キャッシュを消してから**の同条件2本）:
 *      12社 … **524件 / 45秒** ／ 全83社 … **2,555件 / 89秒**（+2,031件・1社あたり約29件）
 *    ⚠️ クエリ数は事故時の記録（約2,200件）と同水準だが、**機構が違う**ので通した。
 *       根拠: `pg_stat_database` の**バッファヒット率 99.998%**
 *       （`blks_read` 2,574 / `blks_hit` 1.28億）＝**ディスクを読んでいない。**
 * ⚠️ **NANO に戻すなら、この設定も12社へ戻すこと。** 前提が変わる。
 *
 * ⚠️ ここに載らない企業も**問題なく表示される**。`dynamicParams` の既定が true なので、
 *    未知の slug は都度レンダリングされ、以降 `revalidate` に従ってキャッシュされる。
 *    SEO の発見性は sitemap が担保している（`filterListedCompanies`）。
 *
 * ⚠️ **`generateStaticParams` 自体は消さないこと。** 2026-08-09 の実測で、
 *    この関数を持たない動的セグメントは **ISR が効かず毎回 MISS** だった。
 *
 * ⚠️★**「一覧が古くて事前生成が減る」問題は 2026-09-07 に解消した。**
 *    `generateStaticParams` の fetch は Data Cache に**1年**載るため、以前は
 *    **83社のはずが79社**（古いスナップショット）だった。専用の
 *    `getListedCompanyParams()`（no-store・id と slug だけ）に切り替えて直してある。
 *    ⚠️ **`getCompaniesForList()` に戻さないこと。** 戻すと同じ形で静かに減る。
 *    ⚠️ 事前生成が想定より少ないときは、まずここを疑う（ビルドログの生成ページ数を見る）。
 */
export async function generateStaticParams() {
  /* ⚠️ `getCompanies()` は使えない。内部で Cookie を読む `createClient()` を使っており、
        ビルド時（リクエスト外）に `cookies was called outside a request scope` で落ちる。
     ⚠️★**`getCompaniesForList()` も使わない**（2026-09-07）。あちらは `createAdminClient()`
        なので、ここで呼ぶと応答が **Data Cache に1年載り、次のビルドが古い一覧を使う。**
        理由と実測は `getListedCompanyParams` の注記に書いてある。 */
  const companies = await getListedCompanyParams();
  return companies.map((c) => ({ id: c.slug ?? c.id }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyBySlugOrIdCached(params.id);
  if (!result) notFound();
  const { company, slug, listingStatus } = result;

  const canonicalId = slug ?? params.id;
  /*
    ⚠️ ディレクトリ非掲載のページは検索結果に出さない（2026-08-13）。

    2026-08-13 に「ページは作られた時点で存在する」へ変えたので、
    一覧に載せないと決めたページも URL としては生きている。
    sitemap は filterListedCompanies を通すので載らないが、
    **経歴からリンクされるためクロールは到達しうる。**
    それまでは is_published=false が実質 noindex の代わりをしていた。

    follow は残す。ページ内の求人・記事へのリンクは辿ってよい。
  */
  const noindex = listingStatus !== "listed";
  // 「カジュアル面談受付中」「カジュアル面談で現場の声を聞けます」は 2026-08-03 に削除。
  // 面談前提の説明はプラットフォーム側では使わない方針。掲載企業ぶん全ページの
  // meta description になるので、外向きの文言としては最も露出が大きい。
  //
  // ⚠️ employee_count は数値ではなく自由記述で、「約200名」「3500名以上」のように
  //    単位まで含んだ文字列が入る（2026-08-03 時点で値のある全社が「名」を含む）。
  //    以前は一律 `+ "名規模"` していたため「3500名以上名規模」「約200名名規模」と
  //    全社の meta description が二重になっていた。値はそのまま使う。
  /* ★2026-10-10 から帯（「51〜200名」）。時点は meta には入れない（短く保つ） */
  const size = formatEmployeeSize(company.employee_count_band, null, { compact: true });

  /* ⚠️ **求職者側の分類は事業領域。** `company.industry`(text) は廃止予定で
        新規企業には書かれないため、ここで使うと新しい企業の meta が欠ける。
     ⚠️ 「業界」を後ろに付けない（2026-08-11 削除）。値は業界名ではなく
        製品・業務領域なので、「開発者ツール業界」のように日本語として成立しない。 */
  const domainLabel = primaryBusinessDomain(company.business_domains)?.name ?? null;

  /* ⚠️ **`?? "IT"` のようなフォールバックを書かないこと。**
        2026-08-25 まで `company.industry ?? "IT"` と書いていたが、
        `mapCompany` が先に `?? ""` で潰しているため **一度も発火せず**、
        値が無い企業では「タグライン｜・約200名。」と**余った区切りだけ**が出ていた。
        `??` は null / undefined しか拾わない。**無いものは項目ごと落とす。** */
  const metaParts = [domainLabel, size].filter(Boolean).join("・");
  const description = company.tagline
    ? `${company.tagline}${metaParts ? `｜${metaParts}` : ""}。企業情報と求人をOPINIOで確認。`
    : `${company.name}の企業情報・求人・組織文化をOPINIOで確認。`;

  /* ⚠️ バッジが無いときは**空で渡す**（`/api/og` は空ならピルごと描かない）。
        推測の「IT」を入れない。 */
  const ogImageUrl = `/api/og?type=company&name=${encodeURIComponent(company.name)}&sub=${encodeURIComponent(company.tagline ?? "")}&badge=${encodeURIComponent(domainLabel ?? "")}&v=2`;

  return {
    title: { absolute: `${company.name} — 企業情報・求人 | OPINIO` },
    description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/companies/${canonicalId}` },
    // 「カジュアル面談」は 2026-08-03 に削除（面談前提の説明はプラットフォーム側では使わない）
    keywords: [company.name, domainLabel ?? "", "企業情報", "求人", "IT転職", "SaaS転職"].filter(Boolean),
    openGraph: {
      title: `${company.name} | OPINIO`,
      description,
      type: "website",
      url: `/companies/${canonicalId}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: company.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${company.name} | OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/* ⚠️ ブックマーク／フォローの状態は props で渡さない（2026-08-09）。
      各ボタンが useCompanyViewerState で自分で取る。
      ここに閲覧者依存の props を足すと、それを作るためにサーバーで
      認証を読むことになり、ページの ISR が壊れる。 */
/**
 * ★ヘッダーカード（2026-11-26 / 柴さんの指示。求人ページのヘッダーカードと同じ見た目）。
 *   カバー（あるときだけ）→ ロゴ（88px）と右のボタン → 社名・英語名 → キャッチコピー → メタ情報2行。
 *
 * ⚠️ カバーが無い会社では帯を描かずロゴから始める（2026-11-26 時点で掲載中の全社がカバー無し）。
 * ⚠️ メタ情報は値があるものだけを「・」でつなぐ。フォロワー数は1人以上のときだけ。
 * ⚠️ 事業領域・ジャンル・事業ステージのチップはここから外した（同じものが右の「会社概要」の表にある）。
 * ⚠️ `data-cd-hero` は下の固定バー（CtaReveal）が見ている。外さないこと。
 * ⚠️ ボタンの並び（デスクトップ右／767px 以下は本文の下で折り返す）は下の style タグ。インラインに戻さないこと。
 */
function CompanyHeader({
  company,
  detail,
  followerCount,
  isOwnCompany = false,
}: {
  company: Company;
  detail: CompanyDetail;
  followerCount: number;
  /** ★運営会社か（2026-10-10）。判定は `getOwnCompanyId()` */
  isOwnCompany?: boolean;
}) {
  /* ⚠️ 表示名は `@/lib/companies/displayName` に集約した（2026-08-13）。正規表現をここに書き戻さないこと。 */
  /* ★見出しはブランド名、その下に正式社名（2026-11-27。違うときだけ）。⚠️ 見出しに正式社名を戻さないこと */
  const brandName = companyBrandName(company);
  const legalName = companyLegalName(company);
  const industryLeaf = detail.industryPath ? detail.industryPath.split(/\s*[›>＞]\s*/).pop() ?? null : null;
  /* ★要点チップ（2026-11-26 / 柴さんの指示）: 企業タイプ／従業員数／設立／資金調達ステージ。事実だけ・値があるものだけ。
     ⚠️ company_features と評価の言葉は出さない（2026-11-26 時点の company_features はすべて一括投入で、企業の入力ではない） */
  const typeLabel = companyTypeLabel(company, detail);
  const fundingLabel = fundingStageLabel(detail);
  const chips = [
    typeLabel,
    formatEmployeeSize(company.employee_count_band, null, { compact: true }),
    detail.established ? `${detail.established}設立` : null,
    /* ⚠️ 企業タイプにすでに同じ語（「上場企業」など）が入っていれば出さない（同じことを2回言わない） */
    fundingLabel && !(typeLabel ?? "").includes(fundingLabel) ? fundingLabel : null,
  ].filter((v): v is string => !!v);
  const isFresh = company.updated_days_ago <= 30;
  const meta = [
    followerCount > 0 ? `フォロワー ${followerCount}人` : null,
    company.job_count > 0 ? `採用中 ${company.job_count}件` : null,
    isFresh ? formatUpdated(company.updated_days_ago) : null,
  ].filter((v): v is string => !!v);
  const siteHref = detail.url ? (detail.url.startsWith("http") ? detail.url : `https://${detail.url}`) : null;
  const ghost: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, minHeight: 34,
    padding: "6px 14px", borderRadius: 100, fontSize: 12.5, fontWeight: 700,
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", textDecoration: "none", whiteSpace: "nowrap",
  };
  const iconLink: React.CSSProperties = {
    width: 34, height: 34, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", textDecoration: "none", flexShrink: 0,
  };

  const actions = (
    <>
      {/* ★フォローを先頭に置く（2026-11-28 / 柴さんの指示。冒頭のカードで一番目立つ位置） */}
      <FollowButton companyId={company.id} tone="primary" />
      {company.accepting_casual_meetings && (
        <Link href={`/companies/${company.id}/casual-meeting`} data-state="cta-meeting"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 40,
            padding: "8px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: MEETING_CTA_BG, color: MEETING_CTA_FG, textDecoration: "none", whiteSpace: "nowrap",
            boxShadow: `0 3px 10px rgba(${MEETING_CTA_SHADOW_RGB},0.3)`,
          }}>
          話を聞く
        </Link>
      )}
      {/* ★「話を聞いてみたい」（2026-10-27）。押せない会社・未ログインでは何も描かない（CompanyInterestButton の中で判定） */}
      <CompanyInterestButton companyId={company.id} />
      <BookmarkButton companyName={company.name} companyId={company.id} variant="pill" />
      {/* 共有は小さいアイコン（767px 以上）。767px 以下は「…」の中にある */}
      <span className="cd-links-row"><ShareButton companyName={company.name} companyId={company.id} iconOnly /></span>
      {siteHref && (
        <a href={siteHref} target="_blank" rel="noopener noreferrer" style={ghost} data-state="company-site">
          公式サイト <span aria-hidden>↗</span>
        </a>
      )}
      {(company.x_url || company.linkedin_url || company.careers_url) && (
        /* ⚠️ 767px 以下は出さない（.cd-links-row）。「…」の中に同じものがある */
        <span className="cd-links-row" style={{ gap: 6, alignItems: "center" }}>
          {company.careers_url && (
            <a href={company.careers_url} target="_blank" rel="noopener noreferrer" style={ghost}>採用情報 <span aria-hidden>↗</span></a>
          )}
          {company.x_url && (
            <a href={company.x_url} target="_blank" rel="noopener noreferrer" title="X (Twitter)" aria-label="X (Twitter)" style={iconLink}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" style={iconLink}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          )}
        </span>
      )}
      {/* ★スマホだけの「…」（2026-10-17）。公式サイト以外のリンクと共有をここにまとめる */}
      <CompanyMoreMenu
        companyName={company.name}
        companyId={company.id}
        links={[
          ...(company.careers_url ? [{ label: "採用情報", href: company.careers_url }] : []),
          ...(company.x_url ? [{ label: "X (Twitter)", href: company.x_url }] : []),
          ...(company.linkedin_url ? [{ label: "LinkedIn", href: company.linkedin_url }] : []),
        ]}
      />
    </>
  );

  return (
    <>
      <DetailHero
        state="company-header"
        logo={
          <CompanyLogo name={company.name} logoUrl={company.logo_url} logoLetter={company.logo_letter}
            logoGradient={company.gradient} companyUrl={company.url} size={88} borderRadius={16}
            style={{ border: "1px solid var(--line)" }} />
        }
        category={industryLeaf ?? undefined}
        title={brandName}
        formalName={brandName !== legalName ? legalName : null}
        /* ★運営会社の開示（2026-10-10） */
        note={isOwnCompany ? <OwnCompanyNote style={{ marginTop: 4 }} /> : undefined}
        tagline={company.tagline}
        chips={chips.length > 0 ? <>{chips.map((c) => <HeroChip key={c}>{c}</HeroChip>)}</> : undefined}
        meta={meta}
        actions={actions}
      />
      {/* ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（サーバーだけが実体参照に変えてハイドレーションが壊れる） */}
      <style>{`
        .cd-links-row { display: inline-flex; }
        .cd-more { display: none; }
        @media (max-width: 767px) {
          .cd-links-row { display: none; }
          .cd-more { display: block; }
        }
      `}</style>
    </>
  );
}


// ─── Company Materials Section ───────────────────────────────────────────────

/**
 * ★企業が「公開」で確定した項目を区分ごとに出す（2026-10-09 / 依頼②）。
 * ⚠️ 受け取るのは `getPublicMaterialItemsCached` の結果だけ。**ここで項目を引き直さない。**
 * ⚠️ 企業の申告であることを書く（運営が確かめた情報と読ませない）。
 * ⚠️ 区分ごとの色分けはしない（ui-conventions「色の役割」）。
 * ⚠️ 「合意後に開示」は依頼③。ここには決して出さない（型も PublicMaterialItem しか受けない）。
 */
function CompanyMaterialsSection({ items }: { items: PublicMaterialItem[] }) {
  if (items.length === 0) return null;
  const groups = MATERIAL_CATEGORIES
    .map((c) => ({ c, list: items.filter((i) => i.category === c) }))
    .filter((g) => g.list.length > 0);

  return (
    <section
      id="company-materials"
      className="cd-sec"
    >
      <div style={{ padding: "var(--space-6) var(--cd-pad-x, 32px) var(--space-4)" }}>
        <SecTitle>
          企業からの情報
        </SecTitle>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          この会社が登録し、公開を確定した内容です（企業の申告で、OPINIO が確認したものではありません）。
        </p>
      </div>
      <div style={{ padding: "var(--space-6) var(--cd-pad-x, 32px)", display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(({ c, list }) => (
          <div key={c}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{MATERIAL_CATEGORY_LABELS[c]}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {list.map((i) => (
                <li key={i.id} style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.85, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {i.content}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Tools Section ───────────────────────────────────────────────────────────

function ToolsSection({ tools }: { tools: CompanyTool[] }) {
  if (tools.length === 0) return null;

  return (
    <section
      id="tools"
      className="cd-sec"
    >
      <div style={{
        padding: "var(--space-6) var(--cd-pad-x, 32px) var(--space-4)",
      }}>
        <SecTitle>
          導入ツール
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
        <ToolsSectionClient tools={tools} />
      </div>
    </section>
  );
}

/** 7日以内に掲載した募集に「新着」を付ける */
const NEW_JOB_DAYS = 7;
/** 職種ごとの見出しを付けるのは、募集がこの件数以上の会社だけ */
const JOB_GROUP_HEADERS_MIN = 6;

/** 年収の表示。⚠️ 数字の途中で折り返さないよう、呼び出し側で nowrap の塊にする */
function jobPayText(job: import("@/app/companies/[id]/mockDetailData").JobItem): string {
  const min = job.salaryMin && job.salaryMin > 0 ? job.salaryMin : null;
  const max = job.salaryMax && job.salaryMax > 0 ? job.salaryMax : null;
  if (min && max) return `${fmtMan(min)}〜${fmtMan(max)}万円`;
  if (min) return `${fmtMan(min)}万円〜`;
  if (max) return `〜${fmtMan(max)}万円`;
  /* ⚠️ 金額が無いときは「給与非公開」。企業が「要相談」を選んだときだけ要相談の文言（2026-10-10） */
  return job.salaryNegotiable ? payNegotiableText(job.employmentType) : "給与非公開";
}

function isNewJob(job: import("@/app/companies/[id]/mockDetailData").JobItem): boolean {
  if (job.publishedAt) return Date.now() - new Date(job.publishedAt).getTime() <= NEW_JOB_DAYS * 24 * 60 * 60 * 1000;
  return job.is_new === true;
}

/**
 * ★募集中のポジション（2026-11-26 / 柴さんの指示）。1件1行: 左にタイトルと「職種 ・ 勤務地 ・ 雇用形態」、右に年収。
 *   7日以内に掲載したものに「新着」。初期表示は3件で、4件以上なら「すべての募集を見る（N件）」（/jobs?company=）。
 *
 * ⚠️ 0件ならセクションごと出さない（「現在、公開中の募集はありません」は出さない。値が無いものは出さない決まり）。
 * ⚠️ 職種ごとの見出しは6件以上の会社だけ。少ない会社では見出しなしで並べる。
 * ⚠️ `/companies/[id]/jobs` には戻さないこと（2026-07-01 に削除済みで 404）。
 * ⚠️ 年収のある募集を先に並べる（それまでと同じ）。
 */
function JobsSection({ company, detail }: { company: Company; detail: CompanyDetail }) {
  const total = detail.jobs.reduce((sum, cat) => sum + cat.items.length, 0);
  if (total === 0) return null;
  const hasPay = (j: import("@/app/companies/[id]/mockDetailData").JobItem) => ((j.salaryMin ?? 0) > 0 || (j.salaryMax ?? 0) > 0) ? 1 : 0;
  const cats = detail.jobs.map((c) => ({ cat: c.cat, items: [...c.items].sort((a, b) => hasPay(b) - hasPay(a)) }));
  const grouped = total >= JOB_GROUP_HEADERS_MIN && cats.length > 1;
  const flat = cats.flatMap((c) => c.items.map((job) => ({ job, cat: c.cat })));
  const shown = flat.slice(0, JOBS_LIMIT);
  const companyHQ = detail.hq || "";

  const row = (job: import("@/app/companies/[id]/mockDetailData").JobItem, cat: string, first: boolean) => {
    /* ⚠️ 勤務地は求人ページと同じく短くする（番地まで出さない） */
    const loc = shortAddress(job.location) || companyHQ || null;
    const meta = [cat, loc, job.employmentType || null].filter((v): v is string => !!v);
    return (
      <li key={job.id ?? job.title} style={{ borderTop: first ? undefined : "1px solid var(--line-soft)" }}>
        <Link href={job.id ? jobPath(job.slug ?? job.id) : "#jobs"} className="cd-job-row" data-state="company-job-row">
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{job.title}</span>
              {isNewJob(job) && (
                <span data-state="job-new" style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", whiteSpace: "nowrap" }}>新着</span>
              )}
            </span>
            {meta.length > 0 && (
              <span style={{ display: "block", marginTop: 3, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                {meta.map((m, i) => (
                  <Fragment key={i}>{i > 0 && <span aria-hidden style={{ margin: "0 6px" }}>・</span>}<span style={{ whiteSpace: "nowrap" }}>{m}</span></Fragment>
                ))}
              </span>
            )}
          </span>
          <span className="cd-job-pay" style={{ fontSize: 14, fontWeight: 700, color: hasPay(job) ? "var(--ink)" : "var(--ink-mute)", whiteSpace: "nowrap" }}>{jobPayText(job)}</span>
        </Link>
      </li>
    );
  };

  /* 職種ごとの見出しを付けるときは、表示する3件だけをその職種の見出しの下に並べる */
  const groups: { cat: string; items: typeof shown }[] = [];
  for (const s of shown) {
    const last = groups[groups.length - 1];
    if (last && last.cat === s.cat) last.items.push(s); else groups.push({ cat: s.cat, items: [s] });
  }

  return (
    <section id="jobs" className="cd-sec cd-sec-pad" data-state="company-jobs">
      <SecTitle>
        募集中のポジション
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-mute)" }}>{company.job_count}件</span>
      </SecTitle>
      <div style={{ marginTop: 10 }}>
        {grouped ? groups.map((g) => (
          <div key={g.cat} style={{ marginTop: 10 }}>
            <h3 style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>
              {g.cat}<span style={{ marginLeft: 6, fontWeight: 600, color: "var(--ink-mute)" }}>{cats.find((c) => c.cat === g.cat)?.items.length ?? 0}件</span>
            </h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>{g.items.map((s, i) => row(s.job, s.cat, i === 0))}</ul>
          </div>
        )) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>{shown.map((s, i) => row(s.job, s.cat, i === 0))}</ul>
        )}
      </div>
      {total > JOBS_LIMIT && (
        /* ⚠️ 値は slug 優先・UUID も可（JobsClient が両方受ける） */
        <Link href={`/jobs?company=${encodeURIComponent(company.slug ?? company.id)}`} data-state="company-jobs-all"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12, minHeight: 44, borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
          すべての募集を見る（{company.job_count}件）
        </Link>
      )}
      <style>{`
        .cd-job-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 0; text-decoration: none; }
        .cd-job-row:hover .cd-job-pay { color: var(--royal); }
        @media (max-width: 640px) {
          .cd-job-row { flex-direction: column; gap: 4px; }
        }
      `}</style>
    </section>
  );
}

// ─── Company Posts（企業からの投稿） ──────────────────────────────────────────

type CompanyPost = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

// ─── MobileBottomCTA ── サイドバーが消える幅（< 1024px）の固定底部バー ────────
/**
 * ⚠️ **表示幅はサイドバーと必ず対にすること。**
 *
 * サイドバーの CTA カードは `hidden lg:flex` で **1024px 未満は消える**。
 * このバーは以前 `md:hidden`（768px 未満）で、**768〜1023px にどちらも出ない
 * 256px 幅の帯があった**（2026-08-13 実測）。iPad 縦(768) がここに入る。
 * 求人詳細の `JobMobileStickyBar` は元から `lg:hidden` で塞がっていたので、そちらに揃えた。
 *
 * ⚠️ **`bottom` をインラインに書かないこと。** 幅で変える値なので Tailwind に持たせる。
 *    モバイルボトムナビ（`MobileBottomNav`・高さ64px）は **768px 以上で消える**ので、
 *    768〜1023px で `bottom: 64` のままだと**下端に64pxの空白が浮く**。
 *      `bottom-16`     … < 768px、ナビの上に載せる
 *      `md:bottom-0`   … >= 768px、ナビが無いので下端に付ける
 *
 * ⚠️ ボトムナビ側を `lg:hidden` に広げる案は採らなかった。
 *    ナビは全ページ共通で、タブレットにナビを出すかは別の判断になる。
 *    **ここで直したいのは企業詳細のCTA欠落だけ**なので、影響範囲を広げない。
 */
/**
 * 固定底部バーを出すか。**バー本体と `<main>` の下余白が同じ条件を見るために切り出した。**
 * 別々に書くと、面談も求人も無い企業で「バーは出ないのに余白だけ192px空く」ことになる。
 */
function hasMobileBottomCta(company: Company): boolean {
  return company.accepting_casual_meetings === true || company.job_count > 0;
}

function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.accepting_casual_meetings === true;
  const hasJobs = company.job_count > 0;
  if (!hasMobileBottomCta(company)) return null;

  /* ★横1列にした（2026-10-03 / 柴さんの指示）。それまでは全幅で縦2段で、
        バーだけで 122px、下部ナビと合わせて約186px が常に画面を塞いでいた。
     ⚠️ 並びは「左：募集を見る（白・枠）／右：カジュアル面談（オレンジ）」、幅はおよそ 1:2。
     ★右の文言は「話を聞く」から「カジュアル面談」に変えた（2026-10-29 / 柴さんの指示。採用担当者カードのボタンと揃える）。
     ⚠️ 片方しか無いときは**その1つを全幅**で出す（空いた列を残さない）。
     ⚠️★高さ・余白・safe-area は globals.css の .company-mobile-cta に置いてある。
        バーの高さを変えたら、そこにある main の下余白と ↑ボタンの位置も一緒に直すこと。 */
  const both = hasMeeting && hasJobs;

  return (
    /* ★上部が見えている間は隠す（CtaReveal。2026-10-17） */
    <CtaReveal>
    <div className="company-mobile-cta lg:hidden bottom-16 md:bottom-0">
      <div className={`company-mobile-cta-row${both ? " company-mobile-cta-row--two" : ""}`}>
        {hasJobs && (
          <a
            href="#jobs"
            className="company-mobile-cta-btn"
            style={
              hasMeeting
                ? { background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal)" }
                : /* 募集しか無い企業では、これが唯一の主導線なので塗りにする（従来どおり） */
                  { background: "var(--royal)", color: "#fff" } /* ★紺の単色・影なし（2026-11-27） */
            }
          >
            募集を見る
          </a>
        )}
        {hasMeeting && (
          /* ⚠️ 行き先は従来どおり /companies/[id]/casual-meeting。文言だけ短くした */
          <Link
            href={`/companies/${company.id}/casual-meeting`}
            className="company-mobile-cta-btn"
            style={{
              background: MEETING_CTA_BG,
              color: MEETING_CTA_FG,
              boxShadow: `0 3px 12px rgba(${MEETING_CTA_SHADOW_RGB},0.35)`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#fff",
                flexShrink: 0,
                animation: "cta-pulse 1.8s ease-in-out infinite",
              }}
            />
            カジュアル面談
          </Link>
        )}
      </div>
    </div>
    </CtaReveal>
  );
}

/**
 * ★フォロワー数（2026-11-26）。検証用アカウントのフォローは数えない。⚠️ 取れなければ 0（＝出さない）
 */
async function countCompanyFollowers(companyId: string): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_company_follows").select("follower_user_id").eq("company_id", companyId);
  if (error) { console.error("[CompanyDetailPage] followers:", error.message); return 0; }
  const ids = Array.from(new Set((data ?? []).map((r) => r.follower_user_id as string)));
  if (ids.length === 0) return 0;
  const { count, error: uErr } = await db.from("ow_users").select("id", { count: "exact", head: true }).in("id", ids).eq("is_test", false);
  if (uErr) { console.error("[CompanyDetailPage] followers users:", uErr.message); return 0; }
  return count ?? 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────


/**
 * ★本体。`testMode` は /t/companies/[id]（検証用アカウント専用・動的・noindex）だけが true にする（2026-10-12）。
 *   true のとき: 検証用の会社だけを引き、リンクを /t/… に向け、上部に灰色の一行を出す。閲覧は数えない。
 * ⚠️ この公開ページ（ISR）は testMode = false のまま。ここで認証を読まないこと（下の注記）。
 */
/* ★タブに無いセクションを「働く人」タブとして点ける（OB/OG など。2026-10-03 / 2026-11-26） */
/* ★タブの中身（2026-11-28 / 柴さんの指示）: 概要＝事業内容・ミッション・沿革・組織体制 ／ 働く環境＝働き方・福利厚生・導入ツール・公開した情報 ／
      働く人＝人の流れ・現役社員・OB/OG。「公式の発信」はどのタブにも入れない（空文字＝下線を付けない）。
   ⚠️ タブの id はそのグループで最初に出るセクションなので、別名の行き先も描くたびに決める（navAliases） */
const OVERVIEW_IDS = ["business", "mission", "milestones", "org-teams"] as const;
const WORK_ENV_IDS = ["workstyle", "benefits", "tools", "company-materials"] as const;
function navAliases(overviewId: string | null, workEnvId: string | null): Record<string, string> {
  const a: Record<string, string> = {
    alumni: "company-people", "current-employees": "company-people", "company-flow": "company-people", "company-reasons": "company-people",
    "official-links": "",
  };
  if (overviewId) for (const id of OVERVIEW_IDS) if (id !== overviewId) a[id] = overviewId;
  if (workEnvId) for (const id of WORK_ENV_IDS) if (id !== workEnvId) a[id] = workEnvId;
  return a;
}

export async function renderCompanyDetailPage(params: { id: string }, mode: boolean | { preview: { companyId: string; banner: React.ReactNode } }) {
  /* ★mode: false … 公開ページ ／ true … 検証用アカウント（/t/companies）／ { preview } … 担当者のプレビュー（/biz/company/preview） */
  const preview = typeof mode === "object" ? mode.preview : null;
  const testMode = mode === true;
  if (testMode) enterTestViewMode();
  /* ⚠️ 認証はここで読まない（2026-08-09）。読むとルートが動的化して
        `export const revalidate = 300` が効かなくなる。
        閲覧者ごとに変わるもの（社員一覧・ブックマーク・フォロー）は
        すべてクライアント側の専用APIに移してある。
        ⚠️ ここに `createClient()` や `auth.getUser()` を足さないこと。 */
  const adminSupabase = createAdminClient();

  const companyResult = preview
    ? await getCompanyForPreview(preview.companyId)
    : testMode ? await getTestCompanyBySlugOrId(params.id) : await getCompanyBySlugOrIdCached(params.id);

  if (!companyResult) return notFound();

  const { company, detail, resolvedId, slug: companySlug } = companyResult;
  /* ★運営会社か（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();

  // UUID が渡されてスラッグがある場合は 308 リダイレクト
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
  if (!preview && isUUID && companySlug) {
    permanentRedirect(companyPath(companySlug));
  }

  // Phase 2: 残りのデータを companyId（UUID）で並列取得
  const companyId = resolvedId;

  const [photos, companyArticles, employees, companyPosts, companyTools,
         articleIdRowsResult, materialItems, companyFlow, reasonRanking, followerCount, similarCompanies, externalLinksResult, milestonesResult] = await Promise.all([
    getCompanyPhotosCached(companyId),
    /* ⚠️ 採用担当者はサーバーで引かない（2026-11-26）。人の情報を ISR の HTML に入れないため、
          サイドバーの「話せる人」（CompanyContactsCard）がブラウザで /api/jobseeker/companies/[id]/contacts から取る */
    /* ⚠️ ここから4本は 2026-08-09 にキャッシュ版へ差し替えた。
          このページは認証を読むためルート単位では毎回再レンダリングされるが、
          企業単位の公開データは閲覧者によって変わらないのでキャッシュしてよい。
          ⚠️ 反映の遅れはここの `revalidate`（60〜300秒）が上限。**ページの 3600 とは別。**
             編集経路からは `revalidateCompanyPages()` がこの層ごと落とす（2026-09-08 実測）。 */
    getArticlesByCompanyCached(companyId),
    getCompanyEmployeesCached(companyId),
    getCompanyStoriesCached(companyId) as Promise<CompanyPost[]>,
    getCompanyToolsCached(companyId),
    /* ⚠️ 旧「顧客の業界」（ow_company_target_industries）は 2026-10-12 から読まない。
          お客さまの業界は detail（getCompanyById）が新しい表から組む */
    /* ⚠️ 記事IDは companyId しか要らないのでここに相乗りさせる。
          閲覧者の ow_users はもう引かない（認証を読まないため）。 */
    /* ⚠️ 公開中の記事だけ（2026-10-20）。非公開の記事の「公開しました」を更新情報に出さないため */
    adminSupabase.from("ow_articles").select("id").eq("company_id", companyId).eq("is_published", true),
    /* ★企業資料の「公開」項目（2026-10-09 / 依頼②）。**確定済み・公開・restricted でない**ものだけ。
          ⚠️ 条件は `getPublicMaterialItemsCached` の1か所。ここで絞り直さないこと。
          ⚠️ 確定・変更時は `revalidateCompanyPages()` がこのキャッシュごと落とす。 */
    getPublicMaterialItemsCached(companyId),
    /* ★人の流れ（2026-10-27）。⚠️ 集計（数と業界・職種の名前）だけ。下限未満は null。ページには件数だけを渡す（下の toFlowSummary） */
    getCompanyFlowCached(companyId),
    /* ★入社の決め手の上位3つ（2026-11-02）。毎月1日のバッチの結果を読むだけ。順位だけで人数は持たない。10人未満の会社は null */
    getCompanyReasonRanking(companyId),
    /* ★フォロワー数（2026-11-26）。ヘッダーのメタ情報に1人以上のときだけ出す。会社の情報なのでページに焼いてよい（最大300秒古い） */
    countCompanyFollowers(companyId),
    /* ★似ている企業（2026-11-26）。会社の情報だけ */
    getSimilarCompanies(companyId),
    /* ★公式の発信（2026-11-26）。公開中のリンクだけ（RLS の公開条件と同じ is_published）。会社の情報なのでページに焼いてよい */
    adminSupabase.from("ow_company_external_links").select("id, url, title, source_name, type")
      .eq("company_id", companyId).eq("is_published", true).order("sort_order", { ascending: true }),
    /* ★これまでの歩み（2026-11-27）。会社の情報なのでページに焼いてよい */
    adminSupabase.from("ow_company_milestones").select("year, month, event, sort_order").eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
  ]);
  if (milestonesResult.error) console.error("[company-detail] milestones:", milestonesResult.error.message);
  const milestones: Milestone[] = ((milestonesResult.data ?? []) as Milestone[]).map((m) => ({ year: m.year, month: m.month, event: m.event }));
  if (externalLinksResult.error) console.error("[company-detail] external_links:", externalLinksResult.error.message);
  /* ⚠️ http(s) 以外の URL は数えない（ExternalLinksSection が描かないので、タブだけ出るのを防ぐ） */
  const externalLinks: ExternalLink[] = ((externalLinksResult.data ?? []) as ExternalLink[]).filter((l) => /^https?:\/\//i.test(l.url ?? ""));
  /* ★人の流れの件数だけの形（2026-10-27）。出せる項目が無ければ null（見出しごと出さない） */
  const flowSummary = hasAnyFlowItem(companyFlow) ? toFlowSummary(companyFlow!) : null;

  /* ⚠️ 社員一覧の出し分けはここでは行わない（2026-08-09）。
        絞り込みは /api/jobseeker/companies/[id]/employees が
        閲覧者のセッションで行う。ここで employees を触らないこと。 */

  /* ⚠️ 閲覧者と企業の関係（在籍者かどうか）の判定はここから外した（2026-08-09）。
        閲覧者ごとに変わるためサーバーで引くとページが動的化する。
        判定は /api/jobseeker/companies/[id]/employees に移してある。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。 */

  // フィード投稿 (会社ID + 求人ID OR + 記事ID OR)
  type ActivityPost = {
    id: string;
    post_type: string;
    content: string;
    created_at: string;
    ref_job_id: string | null;
    ref_article_id: string | null;
    ref_company_id: string | null;
    ow_jobs: { id: string; title: string; status: string | null; company_id?: string | null; is_test?: boolean | null; company?: { is_test?: boolean | null } | null } | null;
    ow_articles: { id: string; slug: string; title: string; is_published: boolean | null; company?: { is_test?: boolean | null } | null } | null;
  };

  const companyJobIds = detail.jobs.flatMap((c) => c.items.map((j) => j.id));

  /* ⚠️ 旧 Phase 3（閲覧者の ow_users ＋ 記事ID）は Phase 2 に統合した（2026-08-09）。
        どちらも Phase 1 の結果しか要らず、独立した待ちを1段作る理由が無かった。 */
  const companyArticleIds = ((articleIdRowsResult.data ?? []) as { id: string }[]).map((r) => r.id);

  const orParts: string[] = [`ref_company_id.eq.${companyId}`];
  if (companyJobIds.length > 0) orParts.push(`ref_job_id.in.(${companyJobIds.join(",")})`);
  if (companyArticleIds.length > 0) orParts.push(`ref_article_id.in.(${companyArticleIds.join(",")})`);

  /* ⚠️ ブックマークとフォローの取得はここから外した（2026-08-09）。
        閲覧者ごとに変わる値なのでサーバーで引くとページを動的化させる。
        `/api/jobseeker/companies/[id]/viewer-state` からクライアントが取る。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。 */
  const activityPostsRaw = await adminSupabase
    // ⚠️ 読みは ow_posts_visible。参照先が消えた投稿（ref_* が NULL）を落とすビュー。
    .from("ow_posts_visible")
    .select("id, post_type, content, created_at, ref_job_id, ref_article_id, ref_company_id, ow_jobs!ref_job_id(id, title, status, company_id, is_test, company:ow_companies!company_id(is_test)), ow_articles!ref_article_id(id, slug, title, is_published, company:ow_companies!company_id(is_test))")
    .or(orParts.join(","))
    .neq("post_type", "company_joined")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(50);

  /* ⚠️ 掲載を下ろした求人の「募集を開始しました」は出さない（2026-08-11）。
        残すと 404 になるリンクが企業ページの更新情報に並ぶ。判定は lib/feed/visibility に集約。 */
  /* ★担当者がいない会社の求人の「募集を開始しました」も出さない（2026-10-27。lib/jobs/respondingJobs.ts） */
  const activityRaw = (activityPostsRaw.data ?? []) as unknown as ActivityPost[];
  const respondingForActivity = await respondingCompanyIds(
    activityRaw.map((p) => p.ow_jobs?.company_id ?? null), "CompanyDetailPage 更新情報",
  );
  const activityPosts = activityRaw
    /* ★検証用の会社・求人・記事を指す投稿は出さない（2026-10-27。lib/feed/visibility.ts の postRefersToTest）。
          ⚠️ このページは ISR で全員に同じ HTML を配るので、閲覧者で出し分けられない。検証用の人にも出さない側に倒す */
    .filter((p) => !postRefersToTest({ ref_job: p.ow_jobs, ref_article: p.ow_articles }))
    .filter((p) => isJobPostAlive({ post_type: p.post_type, ref_job: p.ow_jobs }, respondingForActivity)
      // 非公開にした記事の「公開しました」も出さない（2026-10-20）
      && isArticlePostAlive({ post_type: p.post_type, ref_article: p.ow_articles }));

  /* ★記事・更新情報（2026-11-26）。企業からの投稿・取材記事・更新情報を日付の新しい順に1本へ。
        ⚠️ 取材記事の「公開しました」は記事そのものの行と重なるので、更新情報からは外す */
  const articleSlugs = new Set(companyArticles.map((a) => a.slug));
  const activityForList = activityPosts.filter((p) => !(p.post_type === "article_published" && p.ow_articles?.slug && articleSlugs.has(p.ow_articles.slug)));
  const activityGroups = (() => {
    const map = new Map<string, ActivityPost[]>();
    for (const post of activityForList) {
      const key = `${post.created_at.slice(0, 10)}__${post.post_type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return Array.from(map.entries()).map(([key, posts]) => ({ date: key.split("__")[0], post_type: posts[0].post_type, posts }));
  })();
  const updateItems: CompanyUpdateItem[] = [
    ...companyPosts.map((p): CompanyUpdateItem => ({
      key: `story-${p.id}`,
      date: (p.published_at ?? "").slice(0, 10),
      text: p.title,
      storyId: p.id,
      /* ⚠️ 投稿には別のページが無いので、本文は行を押すとその場で開く（CompanyUpdatesList） */
      body: (
        <div style={{ display: "grid", gap: 10 }}>
          {p.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cover_image_url} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 8, display: "block" }} />
          )}
          {p.category && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>{storyCategoryLabel(p.category)}</span>}
          {p.body && <Markdown>{p.body}</Markdown>}
        </div>
      ),
    })),
    ...companyArticles.map((a): CompanyUpdateItem => ({
      key: `article-${a.slug}`, date: a.date, text: `記事「${a.title}」`, href: `/articles/${a.slug}`,
    })),
    ...activityGroups.map((g): CompanyUpdateItem => {
      const n = g.posts.length;
      const post = g.posts[0];
      if (g.post_type === "job_posted") {
        return n > 1
          ? { key: `act-${g.date}-${g.post_type}`, date: g.date, text: `募集を ${n} 件追加しました`, href: "#jobs" }
          : { key: `act-${post.id}`, date: g.date, text: post.ow_jobs?.title ? `「${post.ow_jobs.title}」の募集を開始しました` : post.content, href: post.ref_job_id ? jobPath(post.ref_job_id) : "#jobs" };
      }
      if (g.post_type === "article_published") {
        return n > 1
          ? { key: `act-${g.date}-${g.post_type}`, date: g.date, text: `記事を ${n} 件公開しました`, href: null }
          : { key: `act-${post.id}`, date: g.date, text: post.ow_articles?.title ? `記事「${post.ow_articles.title}」を公開しました` : post.content, href: post.ow_articles?.slug ? `/articles/${post.ow_articles.slug}` : null };
      }
      return n > 1
        ? { key: `act-${g.date}-${g.post_type}`, date: g.date, text: `投稿を ${n} 件しました`, href: null }
        : { key: `act-${post.id}`, date: g.date, text: post.content, href: null };
    }),
  ].filter((it) => it.date && it.text).sort((a, b) => b.date.localeCompare(a.date));

  /* ★タブと本文の出し分けに使う（中身の無いタブ・セクションは出さない） */
  const hasBusiness = hasBusinessSection(company, detail, photos);
  const hasOrgTeams = !!(detail.orgTeams && detail.orgTeams.length > 0);
  const hasJobs = detail.jobs.some((c) => c.items.length > 0);
  const hasPeople = !!(flowSummary || reasonRanking || employees.current.length > 0 || employees.alumni.length > 0);
  const hasWorkstyle = workstyleBoxes(detail).length > 0;
  const hasBenefits = benefitTags(detail).length > 0;
  /* ★概要＝事業内容・ミッション・沿革・組織体制（2026-11-28 に組織体制を働く環境から移した） */
  const overviewFirstId = hasBusiness ? "business" : hasMissionSection(detail) ? "mission" : milestones.length > 0 ? "milestones" : hasOrgTeams ? "org-teams" : null;
  /* ★働く環境＝働き方・福利厚生・導入ツール・公開した情報（2026-11-28 に公式の発信と組織体制を外した） */
  const workEnvFirstId = hasWorkstyle ? "workstyle" : hasBenefits ? "benefits" : companyTools.length > 0 ? "tools" : materialItems.length > 0 ? "company-materials" : null;
  return (
    <>
      {/* ★検証用アカウントにだけ（2026-10-12）。⚠️ 検証用の会社の閲覧は数えない */}
      {testMode && (
        <p data-state="test-company-notice" style={{ margin: 0, padding: "8px 16px", textAlign: "center", fontSize: 12.5, color: "var(--ink-mute)", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
          {TEST_COMPANY_NOTICE}
        </p>
      )}
      {/* ★閲覧を数える（2026-10-09 / 段階D）。数えるかどうかはサーバーが決める */}
      {preview?.banner}
      {!testMode && !preview && <ViewBeacon type="company" id={company.id} />}
      <BackToTop aboveMobileCta={hasMobileBottomCta(company)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: company.name,
            /* ⚠️ `??` ではなく `||`。`mapCompany` が先に `?? ""` で潰しているため（2026-08-28） */
            description: company.tagline || undefined,
            url: `https://opinio.jp/companies/${companySlug ?? companyId}`,
            /* ★2026-10-10 から帯の下限・上限で出す（自由記述の原文は使わない） */
            numberOfEmployees: (() => {
              const r = employeeBandRange(company.employee_count_band);
              if (!r) return undefined;
              return r.max == null
                ? { "@type": "QuantitativeValue", minValue: r.min }
                : { "@type": "QuantitativeValue", minValue: r.min, maxValue: r.max };
            })(),
          }),
        }}
      />
      <RecentlyViewedTracker id={companySlug ?? companyId} name={company.name} logoUrl={company.logo_url ?? null} logoLetter={company.logo_letter ?? undefined} />

      <div className="cd-page">
        {/* ★パンくずは「企業 ＞ 会社名」（2026-11-26 / 柴さんの指示） */}
        <Breadcrumb items={[{ label: "企業", href: "/companies" }, { label: company.name }]} />
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-4 pt-3 pb-4 md:px-12">
          <CompanyHeader
            company={company}
            detail={detail}
            followerCount={followerCount}
            isOwnCompany={ownCompanyId !== null && ownCompanyId === resolvedId}
          />
        </div>

        {/* ★タブ（2026-11-26）。ヘッダーカードの下に置き、追従は今までどおり（CompanyStickyNav）。
               ⚠️ 新しいルートは作らない（同じページの中のアンカー）。中身の無いタブは出さない */}
        <DetailSectionNav aliases={navAliases(overviewFirstId, workEnvFirstId)} items={[
          /* ★並びは 概要 → 募集 → 働く環境 → 働く人 → 記事・更新情報（2026-11-28 / 柴さんの指示で働く環境を働く人の前へ） */
          ...(overviewFirstId ? [{ id: overviewFirstId, label: "概要" }] : []),
          /* ⚠️ タブに数字を入れない（2026-11-26） */
          ...(company.job_count > 0 && hasJobs ? [{ id: "jobs", label: "募集" }] : []),
          ...(workEnvFirstId ? [{ id: workEnvFirstId, label: "働く環境" }] : []),
          /* ⚠️ 在籍者が1人でもいれば出す（閲覧者ごとの可視件数はサーバーでは分からない。タブは案内なので許容する） */
          ...(hasPeople ? [{ id: "company-people", label: "働く人" }] : []),
          ...(updateItems.length > 0 ? [{ id: "updates", label: "記事・更新情報" }] : []),
        ]} />

        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          /* ★`cd-body` はカードの左右の余白（`--cd-pad-x`）と見出しの位置合わせ（scroll-margin）を決める。globals.css を参照 */
          className="cd-body px-4 md:px-12 pt-5 pb-10 md:pb-12"
        >
          {/* ★本文はセクションごとに1枚のカード（2026-11-26 / 柴さんの指示。.dt-stack .cd-sec が globals.css で枠を付ける）。
                 サイドバーは欄全体が貼り付く（画面に収まるときだけ。DetailSide） */}
          <div className="dt-cols">
            <div className="dt-stack" data-state="company-body">
              <style>{PROFILE_CSS}</style>
              {/* ★並び（2026-11-28 / 柴さんの指示）:
                     概要（事業内容 → ミッション・カルチャー → これまでの歩み → 組織体制）→ 募集
                     → 働く環境（働き方 → 福利厚生 → 導入ツール → 企業が公開した情報）
                     → 働く人（つながり → 人の流れ・入社の決め手 → 現役社員 → OB・OG）→ 記事・更新情報 → 公式の発信（どのタブにも入れない）。
                     ⚠️ 中身の無いセクションは出さない（タブにも出さない）。並びを変えたらタブ（navAliases）も合わせる */}
              <BusinessSection company={company} detail={detail} photos={photos} />
              <MissionSection detail={detail} />
              <MilestonesSection items={milestones} />
              {/* ⚠️ 組織体制は org_teams に入力がある会社だけ（部品の中で判定） */}
              <OrgTeamsSectionClient detail={detail} companyId={company.id} jobCount={company.job_count} />

              {/* 募集中のポジション */}
              <JobsSection company={company} detail={detail} />

              {/* 働く環境。1つも無ければ何も出ない */}
              <WorkstyleSection detail={detail} />
              <BenefitTagsSection detail={detail} />
              <ToolsSection tools={companyTools} />
              <CompanyMaterialsSection items={materialItems} />

              {/* この会社で働く人: つながり → 人の流れ → 入社の決め手 → 現役・OB/OG
                     ⚠️ 社員・つながりは閲覧者で変わるのでブラウザで取る（ページは ISR のまま）。0人なら何も出ない */}
              <div id="company-people" className="cd-people">
                <div className="cd-optional"><CompanyConnections companyId={company.id} /></div>
                {(flowSummary || reasonRanking) && (
                  <div className="cd-sec cd-sec-pad">
                    {flowSummary && <CompanyFlowSection companyId={companyId} summary={flowSummary} />}
                    {reasonRanking && <CompanyReasonRanking labels={reasonRanking} />}
                  </div>
                )}
                {/* ★最大6名。残りは一覧ページ（2026-11-26） */}
                <CompanyEmployeeSections companyId={company.id} limit={6} listHref={`${companyPath(companySlug ?? companyId)}/people`} />
              </div>

              {/* 記事・更新情報（企業からの投稿・取材記事・募集開始などを日付順に1本） */}
              {updateItems.length > 0 && (
                <section id="updates" className="cd-sec cd-sec-pad" data-state="company-updates">
                  <SecTitle>記事・更新情報</SecTitle>
                  <div style={{ marginTop: 6 }}>
                    <CompanyUpdatesList items={updateItems} countViews={!testMode && !preview} />
                  </div>
                </section>
              )}
              {/* ★公式の発信はどのタブにも入れず、本文の最後に置く（2026-11-28 / 柴さんの指示）。締めの申し込みブロックだけがこの後に来る */}
              <ExternalLinksSection links={externalLinks} />
              {/* ★企業の投稿が0件のときだけ、その会社の担当者に「記事を書く」を出す（担当者にしか見えない） */}
              {companyPosts.length === 0 && <div className="cd-optional"><CompanyStoriesStaffCta companyId={company.id} /></div>}

              {/* 6. 締めのブロック ——ページで唯一の申し込みを促す場所（2026-11-26）。
                     ⚠️ 途中の誘導バナー・NEXT STEP・サイドバーの申込カードはここにまとめた */}
              {company.accepting_casual_meetings && (
                <section className="cd-sec cd-sec-pad" data-state="company-closing">
                  <div style={{ background: "var(--bg-tint)", borderRadius: 12, padding: "22px 20px", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>気になったら、まずは話を聞いてみませんか</p>
                    <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>選考とは別の、カジュアルな面談です</p>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 16 }}>
                      <Link href={`/companies/${company.id}/casual-meeting`} data-state="cta-meeting"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 700, background: MEETING_CTA_BG, color: MEETING_CTA_FG, textDecoration: "none", whiteSpace: "nowrap", boxShadow: `0 3px 10px rgba(${MEETING_CTA_SHADOW_RGB},0.3)` }}>
                        話を聞く
                      </Link>
                      {/* ⚠️ ここはページ内の募集セクションへの錨（一覧ページへの遷移は募集セクションの「すべての募集を見る」） */}
                      {company.job_count > 0 && hasJobs && (
                        <a href="#jobs" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 700, background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal)", textDecoration: "none", whiteSpace: "nowrap" }}>
                          募集を見る（{company.job_count}件）
                        </a>
                      )}
                    </div>
                    {/* ★申し込みの流れ（2026-10-09）。⚠️ 部品は1つ（複製を作らない） */}
                    <div style={{ marginTop: 14, textAlign: "left" }}><MeetingFlowNote /></div>
                  </div>
                </section>
              )}
            </div>

            {/* ── サイドバー（1023px 以下は本文の下に 行動 → a → b → c の順で並ぶ）── */}
            <DetailSide ariaLabel="この会社の募集・担当者と会社概要">
              {/* ★行動カード（2026-11-26）。募集があれば「募集N件を見る」、無ければ小さいカードでフォローを案内する */}
              {company.job_count > 0 && hasJobs ? (
                <div className="jd-card jd-side-card dt-action" data-state="company-action-card">
                  <a href="#jobs" data-state="company-action-jobs"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "10px 20px", borderRadius: 10, fontSize: 15, fontWeight: 700, background: "var(--royal)", color: "#fff", textDecoration: "none" }}>
                    募集{company.job_count}件を見る
                  </a>
                </div>
              ) : (
                <div className="jd-card jd-side-card dt-action" data-state="company-action-nojobs">
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>受付中の募集はありません</p>
                  <div style={{ marginTop: 10 }}><FollowButton companyId={company.id} tone="primary" label="フォローして新着を受け取る" /></div>
                </div>
              )}
              {/* a. 話せる人（ブラウザで取る。0人ならカードを出さず、担当者の入口だけ） */}
              <CompanyContactsCard
                companyId={company.id}
                meetingHref={company.accepting_casual_meetings ? `/companies/${company.id}/casual-meeting` : null}
                jobsHref={company.job_count > 0 && hasJobs ? "#jobs" : null}
                staffEntry={!testMode && !preview && !(ownCompanyId !== null && ownCompanyId === resolvedId)
                  ? <CompanyStaffEntry companyId={company.id} compact />
                  : undefined}
              />
              {/* b. 会社概要（拠点・資本関係もここ） */}
              <CompanyInfoTable company={company} detail={detail} />
              {/* c. 似ている企業 */}
              {similarCompanies.length > 0 && (
                <div className="jd-card jd-side-card" data-state="similar-companies">
                  <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>似ている企業</h2>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {similarCompanies.map((s, i) => (
                      <li key={s.id} style={{ borderTop: i === 0 ? undefined : "1px solid var(--line-soft)" }}>
                        <Link href={companyPath(s.slug ?? s.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", textDecoration: "none" }}>
                          <CompanyLogo name={s.name} logoUrl={s.logoUrl} logoLetter={s.logoLetter} size={40} borderRadius={10} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{s.name}</span>
                            {(s.domainName || s.jobCount > 0) && (
                              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)" }}>
                                {[s.domainName, s.jobCount > 0 ? `採用中 ${s.jobCount}件` : null].filter(Boolean).map((t, j) => (
                                  <Fragment key={j}>{j > 0 && <span aria-hidden style={{ margin: "0 6px" }}>・</span>}<span style={{ whiteSpace: "nowrap" }}>{t}</span></Fragment>
                                ))}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </DetailSide>
          </div>
        </div>
      </div>

      {/* モバイル固定底部バー（1023px 以下） */}
      <MobileBottomCTA company={company} />

      {/* ⚠️ style タグの中に不等号・バッククォートを書かない（ハイドレーションが壊れる） */}
      <style>{`
        .cd-page { background: var(--bg-tint); }
        .cd-sec-pad { padding: 28px var(--cd-pad-x, 32px); }
        .cd-people { display: flex; flex-direction: column; gap: 16px; }
        .cd-optional:empty, .cd-people:empty { display: none; }
        @media (max-width: 640px) {
          .cd-sec-pad { padding: 22px var(--cd-pad-x, 18px); }
        }
      `}</style>
    </>
  );
}

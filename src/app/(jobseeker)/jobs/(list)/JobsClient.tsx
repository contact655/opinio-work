"use client";

import { SearchAllLink } from "@/components/jobseeker/SearchAllLink";
import { ListSearchButton } from "@/components/common/ListSearchButton";
import { FilterChip } from "@/components/common/FilterChip";
import { DetailSearchToggle, ActiveFilterChips, type ActiveFilter } from "@/components/common/DetailSearch";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Job } from "@/app/jobs/mockJobData";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { getVisibleRoles } from "@/lib/constants/roleTracks";
import type { BusinessDomainFacet } from "@/lib/companies/businessDomainsCached";
import { JOB_EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { PHASE_OPTIONS, phaseMatches } from "@/lib/constants/phase";
/**
 * 勤務形態フィルタの語。**DB の値ではなく「表示ラベルへの部分一致で使う語」。**
 * 求人側のラベルは フルリモート可 / ハイブリッド / 原則出社 の3種で、
 * `t.includes(語)` で当てている（絞り込みは下の workStyleSet のところ）。
 *
 * ⚠️ 2026-08-08 に「リモート可」を落とした。
 *    「フルリモート可」にしか当たらず、「フルリモート」と**絞れる集合が完全に同じ**で、
 *    選択肢が2つある意味が無かった。
 * ⚠️ デスクトップのピルとモバイルのシートが同じこの定数を見る。片方に直書きしない。
 */
const WORK_STYLE_FILTERS = ["フルリモート", "ハイブリッド", "出社"] as const;



const SALARY_PILL_TIERS = [
  { value: "400",  label: "400万〜" },
  { value: "500",  label: "500万〜" },
  { value: "600",  label: "600万〜" },
  { value: "700",  label: "700万〜" },
  { value: "800",  label: "800万〜" },
  { value: "1000", label: "1000万〜" },
  { value: "1200", label: "1200万〜" },
  { value: "1500", label: "1500万〜" },
] as const;
import type { JobsListCompany } from "@/lib/jobs/listCompany";
import { extractPrefecture, PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";
import { parseEmployeeCount } from "@/lib/utils/employeeCount";
import { fmtMan } from "@/lib/utils/salary";
import { JobListItem, hasSalaryData } from "@/components/jobs/JobListItem";
import { JobPane } from "@/components/jobs/JobPane";
import { CompanySplitLayout } from "@/components/companies/CompanySplitLayout";
import { JobCardGrid } from "@/components/jobs/JobCardGrid";
import { ViewToggle } from "@/components/common/ViewToggle";
import { SortSelect } from "@/components/common/SortSelect";

// ─── Constants ────────────────────────────────────────────────────────────────

const PER_PAGE = 15;

/**
 * ★分割ビューの左レールの幅（2026-09-17。それまで 700）。
 *
 * ⚠️★**値はここ1箇所。** `CompanySplitLayout` には props で渡す
 *    （`/companies` は 420 と 700 を使っており、**共有の既定値にしてはいけない**）。
 *
 * 440 にした根拠（2026-09-17 / 1440x900 の実測）:
 *   ・中央カラムが 329px になり、**メタ行（勤務地・勤務形態・年収）が1行に収まる**
 *     （420 以下だと2行になり、カードが 25px 高くなる）
 *   ・右ペインは 1280px で 464 → **724**、1440px で 624 → **884**
 *     （左右比 60:40 → 38:62 ／ 53:47 → 33:67）
 *
 * ⚠️★**440 は「カードのボタン列を畳み、求人名を2行クランプにした」前提の値。**
 *    どちらかを戻すと求人名が 115px しか出なくなる（ボタン列 104px ＋
 *    `maxWidth: calc(100% - 110px)` が中央カラムを食っていた）。
 * ⚠️ 実データの公開求人は2件だけ。長い求人名・年収なしは `/dev/preview/job-cards` で見ること。
 */
const RAIL_WIDTH = 440;

// ─── Helpers ──────────────────────────────────────────────────────────────────


/* ⚠️ formatSalary / hasSalaryData / JobListItem は 2026-08-31 に
      `@/components/jobs/JobListItem` へ移した（`/dev/preview/job-cards` から見るため）。 */






/* ─── 職種の色分けは廃止した（2026-08-30）────────────────────────────────────
   ⚠️★**戻さないこと。** 以前は職種ごとに9通りの色を割り当てていた
      （エンジニア青 / デザイン・プロダクト・PdM **紫** / 営業・CS **緑** /
        マーケティング **黄色背景** / コーポレート緑 / 経営赤）。

   ① `.claude/skills/ui-conventions`「色の役割」が禁じている色を3つ含んでいた
      —— **紫は使わない** / **黄色背景は使わない** / **緑は金銭的にプラスの条件のみ**。
   ② **凡例が無い。** 「デザインが紫」に意味は無く、読み手は解釈できない。
   ③ ★**選択状態の見た目が9通りある**のが一番まずい。ここの色は
      「その職種が何であるか」ではなく「**その絞り込みが効いている**」を表しており、
      1つの意味に9つの見た目を与えていた（規約の「1つの色が2つ以上の意味を持たない」の逆）。

   ⚠️ 職種を色で見分けたくなったら、**色ではなく文言・順序・件数**で示すこと。
      `--royal` は globals.css で「ヘッダー・CTA・**アクティブ**」と定義されている色で、
      絞り込みの選択状態はこれ1つに揃える。
   ─────────────────────────────────────────────────────────────────────────── */

/* ⚠️ 選択状態の色を持つ定数（ACTIVE_FILTER）は 2026-09-09 に削除した。
      使っていたのはサイドバーとモバイルの職種ピルで、どちらも同日に消えている。
      **上の「色分けは廃止した」という判断はそのまま生きている**ので、
      職種ごとの色を作りたくなったらこのコメントの上を読むこと。
      いまの選択状態は共通の FilterChip が持つ（2026-10-09）。 */





// ─── マッチ理由テキスト（フィルター文脈ベース）────────────────────────────────

function computeMatchReason(
  job: Job,
  filters: { category: string; dept: string; salary: string; prefecture: string; q: string },
  parentRoles: { id: string; name: string }[],
): string | null {
  const { category, dept, prefecture, q } = filters;
  // 職種カテゴリフィルター
  if (category) {
    const roleName = parentRoles.find((r) => r.id === category)?.name;
    if (roleName) return `「${roleName}」職種での絞り込み結果`;
  }
  // 旧 dept フィルター
  if (!category && dept && (job.dept?.includes(dept) || dept.includes(job.dept ?? ""))) {
    return `「${dept}」職種での絞り込み結果`;
  }
  // 年収フィルター — ラベル非表示
  // 勤務地フィルター
  if (prefecture && job.location?.includes(prefecture)) {
    return `${prefecture}勤務の募集`;
  }
  // キーワード検索
  if (q.trim().length >= 1) return `「${q.trim()}」の検索結果`;
  return null;
}

// ─── LinkedIn 型縦リスト行 ────────────────────────────────────────────────────




/* ⚠️★デスクトップのサイドバー（SidebarFilters / SectionHeader / CheckItem）は
      2026-09-09 に削除した。条件は「詳細検索」に集約している。**戻さないこと。**
      ── 経緯 ──
      2026-08-08 に6項目（業種 / 年収 / こだわり条件 / 企業ステージ / 業態 / 技術スタック）を
      削除して2項目（職種 / 勤務地）まで減らしていたが、それでも上部のピル行と
      2箇所に分かれており、勤務地は「2県以上あるときだけ出す」ゲートがピル側に無く
      同じ画面で食い違っていた。**条件の置き場を1つにするのが目的。**
      ⚠️ 職種は詳細検索のピルへ移した。勤務地は都道府県ピルと同じものだったので消した。 */


// ─── Main client component ─────────────────────────────────────────────────────

export default function JobsClient({
  jobs: allJobs,
  companies,
  parentRoles,
  industryOptions,
  roleAliases = [],
}: {
  jobs: Job[];
  /* ⚠️ 画面が使う列だけ（`lib/jobs/listCompany.ts`）。公開中の求人を持つ企業だけが入る */
  companies: JobsListCompany[];
  parentRoles: { id: string; name: string }[];
  /** 事業領域の選択肢。⚠️ **マスタが唯一の出どころ。** ここに値を書かない。
   *  ⚠️ 掲載中が1社以上あるものだけをサーバ側が渡す（0件の選択肢を出さない）。 */
  industryOptions: BusinessDomainFacet[];
  /** 検索用の職種辞書（職種名＋別名）。roleIds はその語が指す職種そのものだけ
   *  （祖先は求人側の roleIds に入っている。queries.ts の getRoleAliases 参照） */
  roleAliases?: { alias: string; roleIds: string[] }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
    ── 「あなたへのおすすめ」（2026-08-13 にサーバーからここへ移した）──────────

    元はページのサーバーコンポーネントで計算して props で受けていたが、
    そのために `/jobs` 全体が `force-dynamic` になり、**未ログインの訪問者まで
    毎回サーバー関数の起動（コールドスタート 2〜4秒）を負担していた。**
    ページを ISR に載せ、パーソナライズだけをここから取りに行く。

    ⚠️ **未ログインでは fetch しない。** `getSession()` はクッキーを読むだけで
       ネットワークに出ないので、ログアウト中のサーバー往復は 0 のままになる。
       ここで無条件に fetch すると、CDN から返した意味が半分無くなる。

    ⚠️ **API からは求人IDだけ受け取る。** 求人の中身は allJobs に既にあるので、
       オブジェクトを返させると同じデータを2回運ぶことになる。

    ⚠️ **API が返した順序を保つこと。** スコア降順に並んでいる。
       allJobs 側でフィルタし直すと順序が失われる。
  */
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession();
        if (!session || !active) return;
        const res = await fetch("/api/jobseeker/recommendations");
        if (!res.ok || !active) return;
        const data = (await res.json()) as { jobIds?: string[] };
        if (active) setRecommendedIds(data.jobIds ?? []);
      } catch {
        // おすすめが出ないだけ。求人一覧の表示は妨げない
      }
    })();
    return () => { active = false; };
  }, []);

  const recommendations = useMemo(() => {
    if (recommendedIds.length === 0) return [];
    const byId = new Map(allJobs.map((j) => [j.id, j]));
    return recommendedIds
      .map((id) => byId.get(id))
      .filter((j): j is Job => Boolean(j));
  }, [recommendedIds, allJobs]);

  const category = searchParams.get("category") ?? "";
  const bizOnly = searchParams.get("biz_only") === "1";
  const dept = searchParams.get("dept") ?? "";       // 後方互換 (新規 URL では未使用)
  const work_style = searchParams.get("work_style") ?? "";
  const salary = searchParams.get("salary") ?? "";
  /* ⚠️ 2026-08-06 に salary_max を削除した。指定するUIがサイドバーにもピル行にも
        当時のフィルタシートにも無く、URLを手で書く以外に到達できなかった。
        年収は下限指定（salary・8段階）が自然な軸なのでそちらに一本化する。
        レンジ指定が必要になったら、ピルを「400〜600万」型に作り替えるところから設計すること。 */
  const industry = searchParams.get("industry") ?? "";
  /* ⚠️ 2026-08-06 に industry_id を削除した。当時それを指定できるのはモバイルの
        「詳細条件」だけで、そこをデスクトップと同じ industry（INDUSTRY_GROUPS の
        グループキー）に揃えた結果、到達手段が無くなったため。
        外部から ?industry_id= を作るリンクも存在しない。
        （その「詳細条件」も 2026-08-08 に削除した。業種は上部のピルで指定する）
        ow_industries マスタで絞りたくなったら、まず industry との二本立てをどうするか決めること。 */
  const prefecture = searchParams.get("prefecture") ?? "";
  const empType = searchParams.get("emp_type") ?? "";   // 雇用形態フィルター（カンマ区切り複数可）
  /* 企業で絞る（2026-08-15 実装）。値は **slug 優先・UUID も受理**。
     ⚠️ 2026-08-08 に企業ページの「N件すべての求人を見る」を消したとき、
        コメントに「復活させるなら `/jobs?company=` が筋」と残していたもの。
        それまで `company` は**読まれておらず、200 を返して全社の求人を出していた**
        （記事CTA は 2026-08-04 にこれを理由にリンクごと企業ページへ寄せた）。
     ⚠️ 生成側は `/companies/${slug ?? id}` と同じ綴りにすること。
        リンクを作る箇所を増やすときも slug を優先する（共有URLが読める）。 */
  const companyParam = searchParams.get("company") ?? "";

  /* companyParam → 企業。見つからなければ null。
     ⚠️ **`is_published` を必ず見る。** ここを外すと、運営が取り下げた企業の社名が
        チップに出てしまう（取り下げ＝詳細ページが404、が現在の意味。CLAUDE.md 参照）。
        求人カードの企業名リンクが `company.is_published` を見ているのと同じ理由。
     ⚠️★`companies` は**公開中の求人を持つ企業だけ**（2026-10-09 に絞った。全社を渡すと
        掲載していない企業までページのソースに載るため）。公開求人0件の企業は
        ここで見つからないので、下の `fetchedCompany` で `/api/companies/batch`
        （詳細ページが見える企業だけを返す）に問い合わせて社名を出す。
        「この企業の公開求人はありません」を社名付きで出すため。 */
  const localCompanyFilter = useMemo(() => {
    if (!companyParam) return null;
    const key = companyParam.toLowerCase();
    return companies.find(
      (c) => c.is_published && (c.slug?.toLowerCase() === key || c.id.toLowerCase() === key)
    ) ?? null;
  }, [companyParam, companies]);

  const [fetchedCompany, setFetchedCompany] = useState<{ key: string; company: JobsListCompany | null } | null>(null);
  useEffect(() => {
    if (!companyParam || localCompanyFilter) return;
    if (fetchedCompany?.key === companyParam) return;
    let cancelled = false;
    fetch(`/api/companies/batch?ids=${encodeURIComponent(companyParam)}`)
      .then((r) => (r.ok ? r.json() : { companies: [] }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((d: { companies?: any[] }) => {
        if (cancelled) return;
        const c = (d.companies ?? [])[0];
        setFetchedCompany({
          key: companyParam,
          company: c
            ? { id: c.id, slug: c.slug ?? null, name: c.name, brand_name: null, tagline: c.tagline ?? "",
                phase: "", url: null, employee_count: null, business_domains: [], is_published: true,
                gradient: "", logo_letter: null, logo_url: null }
            : null,
        });
      })
      .catch((e) => {
        console.error("[jobs] ?company= の解決に失敗:", e);
        if (!cancelled) setFetchedCompany({ key: companyParam, company: null });
      });
    return () => { cancelled = true; };
  }, [companyParam, localCompanyFilter, fetchedCompany?.key]);

  const companyFilter =
    localCompanyFilter ?? (fetchedCompany?.key === companyParam ? fetchedCompany.company : null);

  /* 指定されたが解決できなかった。**黙って無視しない**（CLAUDE.md「エラーを握りつぶさない」）。
     404 にはしない — 古い共有リンクで真っ白になるより、全件＋注記のほうが読める。
     ⚠️ 問い合わせ中は「見つからない」と出さない（一瞬だけ注記が出るのを避ける）。 */
  const companyNotFound =
    !!companyParam && !companyFilter && fetchedCompany?.key === companyParam;

  /** チップ・空状態に出す企業名。求人カードと同じ綴り（brand_name 優先） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyFilterName = companyFilter ? ((companyFilter as any).brand_name ?? companyFilter.name) as string : "";

  // 複数選択用: カンマ区切り文字列 → Set
  const categorySet = useMemo(() => new Set(category ? category.split(",") : []), [category]);
  const workStyleSet = useMemo(() => new Set(work_style ? work_style.split(",") : []), [work_style]);
  const empTypeSet = useMemo(() => new Set(empType ? empType.split(",") : []), [empType]);
  const [sort, setSort] = useState(searchParams.get("sort") ?? "updated");
  /* ★一覧（グリッド）／詳細（1列＋分割）の切り替え（2026-10-01 / 柴さんの指示）。
        ⚠️★**`?view=` の読み方も既定も `/companies` と完全に同じ**にしてある
           （`card` = グリッド = 既定 / `list` = 1列＋分割）。同じ語が隣り合うページで
           別の意味や別の既定を持たないようにするため。
        ⚠️★**未知の値はグリッドに落とす**（`=== "list"` だけを名指しする）。
           `/companies` が 2026-08-28 に踏んだ形の再発を防ぐ ——あちらは
           `!view || view === "card"` と書いていたため、`?view=grid` のような綴り違いで
           **どちらの分岐にも入らず、空ページが 200 で返っていた。**
        ⚠️ 既定は 2026-10-01 に「詳細」から「一覧」へ変えた（同日中・柴さんの指示）。
           戻すならこの1行（と下の `setParam` の向き）だけ。 */
  const view: "card" | "list" = searchParams.get("view") === "list" ? "list" : "card";
  /* ⚠️ `isDesktop`（1024px 判定）は 2026-09-09 に削除した。サイドバーの列幅を
        出し分けるためだけの state で、サイドバーごと無くなった。
        ⚠️ 幅で挙動を変えたくなったら CSS のメディアクエリを使うこと。JS で幅を持つと
           サーバー描画と初回描画がずれる（このコードも初期値 false から始まっていた）。 */

  /* ★キーワード（2026-10-01 / ステップ2）。**確定済みは URL（`?q=`）。**
     ⚠️★それまで URL は**初期値を読むだけ**で、打った文字は client state に閉じていた
        —— リロードで消え、共有もできなかった。`/companies` と `/articles` は
        URL に入れていたので、**同じ列の4ページで挙動が割れていた。**
     ⚠️ `qDraft` は**入力中の値**。サジェストの計算に使う（確定前の候補を出すため）。
     ⚠️ LP のヒーロー検索から `?q=` で飛んでくる経路はそのまま効く。 */
  const q = searchParams.get("q") ?? "";
  const [qDraft, setQDraft] = useState(q);
  useEffect(() => { setQDraft(q); }, [q]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const toggleFilter = (k: string) => setOpenFilter((cur) => (cur === k ? null : k));

  /* ★「詳細検索」の開閉（2026-09-09。柴さんの要望）。
     ⚠️★**既定は閉じている。** 条件が8つあり、常時出すと結果より条件のほうが高くなる。
     ⚠️ 条件が1つでも効いていれば**選択中チップ**を外に出すので、閉じていても
        「いま何で絞っているか」は分かる（`activeChips`）。ここを消さないこと
        ——消すと、絞り込んだ結果を見ている最中に理由が画面から消える。 */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const filterPillsRef = useRef<HTMLDivElement>(null);

  /* フィルターピルの外クリックで閉じる。
     ⚠️ サジェストの開閉は `ListSearchButton` が自分で持つようになった（2026-10-01）。 */
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inFilterBar = filterPillsRef.current?.contains(target);
      /* ⚠️ メニューは FilterChip の中（ツールバーの中）にあるので、ツールバーの外だけ見ればよい */
      if (!inFilterBar) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // ⑧ 企業グルーピング toggle（デフォルトON）
  const [groupByCompany, setGroupByCompany] = useState(false);


  // 企業ステージフィルター
  const [companyStage, setCompanyStage] = useState(""); // カンマ区切り複数選択
  const companyStageSet = useMemo(() => new Set(companyStage ? companyStage.split(",") : []), [companyStage]);
  function toggleParam(key: string, value: string, current: string) {
    const set = new Set(current ? current.split(",") : []);
    if (set.has(value)) set.delete(value); else set.add(value);
    setParam(key, Array.from(set).join(","));
  }
  function toggleStage(value: string) {
    /* ⚠️ 前の値から作る（2026-10-09）。続けて呼ばれても取りこぼさない */
    setCompanyStage((prev) => {
      const set = new Set(prev ? prev.split(",") : []);
      if (set.has(value)) set.delete(value); else set.add(value);
      return Array.from(set).join(",");
    });
  }
  /** フェーズだけを全部外す。⚠️ 外資系（同じ companyStage に入っている）は残す */
  function clearPhases() {
    setCompanyStage((prev) => {
      const set = new Set(prev ? prev.split(",") : []);
      phaseKeysRef.current.forEach((k) => set.delete(k));
      return Array.from(set).join(",");
    });
  }

  // Which filter chip dropdown is open
  const filterBarRef = useRef<HTMLDivElement>(null);

  // Bookmarks + applied jobs: load in parallel on mount
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  /* ⚠️ 希望職種はサーバーから props で受け取る（desiredRoleIds）。
        ここでクライアントから ow_profiles を引いていたが、**ow_users.id で引いており
        常に0件**で、「あなたの希望職種にマッチ」が一度も出ていなかった（2026-08-07 修正）。
        サーバーで解決すれば空間を取り違えようがない。auth.getUser() もここでは不要になった。 */
  useEffect(() => {
    Promise.all([
      fetch("/api/bookmarks?target_type=job").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
      fetch("/api/user/applied-jobs").then((r) => r.ok ? r.json() : { ids: [] }).catch(() => ({ ids: [] })),
    ]).then(([bookmarkData, appliedData]) => {
      if ((bookmarkData as { ids?: string[] }).ids) setBookmarkedIds(new Set((bookmarkData as { ids: string[] }).ids));
      if ((appliedData as { ids?: string[] }).ids) setAppliedJobIds(new Set((appliedData as { ids: string[] }).ids));
    }).catch(() => {});
  }, []);

  // ⑤ "もっと見る" — init from URL param ?show=N, resets when filters change
  const initShow = Math.max(PER_PAGE, parseInt(searchParams.get("show") ?? "0") || PER_PAGE);
  const [displayCount, setDisplayCount] = useState(initShow);

  // Build Map for fast company lookup
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  /* ⚠️ フェーズの選択肢は**実データから作る**（2026-08-08）。
        固定の3段（listed/unicorn/startup）を出していたが、
        公開求人が付いている企業は listed と unicorn だけで、
        「スタートアップ」は必ず0件だった。逆に non_listed は選択肢が無く絞れなかった。 */
  const phaseOptions = useMemo(
    /* ⚠️ 実データから絞らない。該当0件の段も出す（phase.ts のコメント参照）。
          歯抜けの梯子（シード・シリーズA・シリーズC が無い）に見えるのを避ける。 */
    () => PHASE_OPTIONS,
    [],
  );
  const phaseKeys = useMemo(() => phaseOptions.map((o) => o.value), [phaseOptions]);
  const phaseKeysRef = useRef<string[]>([]);
  phaseKeysRef.current = phaseKeys;
  const phaseLabels = useMemo(
    () => Object.fromEntries(phaseOptions.map((o) => [o.value, o.label])),
    [phaseOptions],
  );
  /* companyStage には外資系（foreign）も入っている。フェーズの表示・判定からは外す */
  const phaseSet = useMemo(
    () => new Set(phaseKeys.filter((k) => companyStageSet.has(k))),
    [companyStageSet, phaseKeys],
  );


  /* ★いま効いている条件のチップ（2026-09-09）。「詳細検索」を閉じていても外に出す。
     ⚠️★**これを消さないこと。** 8条件を1つのパネルに畳んだので、これが無いと
        「なぜこの件数なのか」が画面から消える。`/companies` で「顧客の業界」を
        結果側に出したのと同じ理由（絞り込みにしか無い軸を作らない）。
     ⚠️ **解除の手段はチップの ✕ だけにしない。** パネルを開けば元のピルからも外せる。
        ここは近道であって唯一の入口ではない。
     ⚠️ 並びは詳細検索パネルのピルの並びと**同じ順**にしてある。片方だけ変えないこと。 */
  const activeChips = useMemo(() => {
    const chips: ActiveFilter[] = [];
    categorySet.forEach((id) => {
      const name = parentRoles.find((r) => r.id === id)?.name;
      /* ⚠️ 名前が引けない id は出さない（生の uuid を画面に出さないため） */
      if (name) chips.push({ key: `category:${id}`, label: name, clear: () => toggleParam("category", id, category) });
    });
    phaseSet.forEach((k) => chips.push({ key: `phase:${k}`, label: phaseLabels[k] ?? k, clear: () => toggleStage(k) }));
    if (industry) {
      const name = industryOptions.find((g) => g.slug === industry)?.name;
      if (name) chips.push({ key: "industry", label: name, clear: () => setParam("industry", "") });
    }
    if (prefecture) chips.push({ key: "prefecture", label: prefecture, clear: () => setParam("prefecture", "") });
    workStyleSet.forEach((v) => chips.push({ key: `ws:${v}`, label: v, clear: () => toggleParam("work_style", v, work_style) }));
    empTypeSet.forEach((v) => chips.push({ key: `et:${v}`, label: v, clear: () => toggleParam("emp_type", v, empType) }));
    if (salary) {
      const label = SALARY_PILL_TIERS.find((t) => t.value === salary)?.label;
      if (label) chips.push({ key: "salary", label, clear: () => setParam("salary", "") });
    }
    if (companyStageSet.has("foreign")) chips.push({ key: "foreign", label: "外資系", clear: () => toggleStage("foreign") });
    return chips;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [categorySet, category, parentRoles, phaseSet, phaseLabels, industry, industryOptions,
      prefecture, workStyleSet, work_style, empTypeSet, empType, salary, companyStageSet]);

  // 検索サジェスト: キーワードから求人タイトル・会社名をマッチ
  const suggestions = useMemo(() => {
    /* ⚠️ 確定済み（`q`）ではなく**入力中**（`qDraft`）から作る。
          確定してからしか候補が出ないと、サジェストの意味が無い。 */
    const trimmed = qDraft.trim();
    if (trimmed.length < 1) return [];
    const lower = trimmed.toLowerCase();
    const seen = new Set<string>();
    const results: { label: string; sub: string; q: string }[] = [];
    for (const j of allJobs) {
      if (results.length >= 8) break;
      const roleMatch = j.role.toLowerCase().includes(lower);
      const co = companyMap.get(j.company_id);
      const coName = co?.name ?? "";
      const coMatch = coName.toLowerCase().includes(lower);
      if (roleMatch) {
        const key = j.role;
        if (!seen.has(key)) { seen.add(key); results.push({ label: j.role, sub: coName, q: j.role }); }
      } else if (coMatch) {
        const key = `co:${coName}`;
        if (!seen.has(key)) { seen.add(key); results.push({ label: coName, sub: "企業で絞り込む", q: coName }); }
      }
    }
    return results;
  }, [qDraft, allJobs, companyMap]);


  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.replace(`/jobs?${params.toString()}`, { scroll: false });
  }

  /* 都道府県は **47件すべて**を出す（柴さんの判断・2026-09-06）。
     ⚠️★**実データから作らないこと。** 以前は求人にある都道府県だけを出しており、
        公開求人が東京都の2件しか無いため**選択肢が「東京都」1つ**になっていた。
        入力欄（職歴・オンボーディング）と同じ見た目に揃えるほうを優先する。
     ⚠️ 分け方も見出しも lib/utils/location.ts の `PREFECTURE_FILTER_GROUPS` が唯一の出どころ。
     ⚠️ この例外は**都道府県だけ**。フェーズ・事業領域には広げないこと。 */

  const searchResult = useMemo(() => {
    let list = [...allJobs];
    let ignoredTerms: string[] = [];

    if (q.trim()) {
      /*
        語ごとに絞り込む（2026-08-03）。

        以前はクエリ全体を1語として includes() していたため、
        「エンタープライズ企業 営業」が丸ごと1つの文字列として扱われ 0件 になっていた。
        /companies?q= 側（lib/search/companies.ts）は既に空白区切りの AND 検索なので、
        そちらに揃える。

        ただし単純な AND だと、こちらで解釈できない語が1つでも混ざると 0件 になる。
        「エンタープライズ企業」は企業規模の言い換えで、今はまだ辞書に無い。
        そこで **どの求人にも当たらなかった語は絞り込みから外す** ことにした。
        結果として「解釈できた語だけを AND する」挙動になる。

          エンタープライズ企業 営業 → 「エンタープライズ企業」は0件なので除外
                                    → 「営業」だけで絞る
          営業 エンジニア           → どちらも当たるので AND（＝セールスエンジニア系）
          ぬるぽ                    → 全語が当たらない → 0件（黙って全件返さない）

        外した語は ignoredTerms に入れ、画面に「絞り込みに使わなかった語」として出す。
        黙って無視すると、入力した条件が効いていないことに気づけないため。
      */
      const words = q.trim().toLowerCase().split(/[\s　]+/).filter(Boolean);

      const jobRoleIds = (j: (typeof list)[number]) =>
        j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);

      const matchesText = (j: (typeof list)[number], w: string) => {
        const co = companyMap.get(j.company_id);
        return (
          j.role.toLowerCase().includes(w) ||
          (co?.name ?? "").toLowerCase().includes(w) ||
          (co?.brand_name ?? "").toLowerCase().includes(w) ||
          (co?.slug ?? "").toLowerCase().includes(w) ||
          j.highlight.toLowerCase().includes(w)
        );
      };

      /*
        辞書（職種名 ＋ 別名。queries.ts の getRoleAliases）で当てる。1段だけ。

        ⚠️ 段階分けはしない。2026-08-06 まで「第1段=職種そのもの / 第2段=祖先まで」の
           2段構えで、第1段が当たると第2段に落ちない作りだった。
           求人に具体職種を付けた瞬間、「営業」で検索しても営業配下が出なくなった
           （14件 → 8件）。逆に「法人営業」は第1段が0件なので祖先に落ちて営業配下14件を返し、
           子職種で検索したのに祖先の兄弟まで出ていた。どちらの向きにも壊れていた。

        いまは辞書側が職種そのものだけを指し、求人側の roleIds に祖先が入っている。
        「営業」→ 営業 を roleIds に持つ求人＝営業配下すべて。
        「エンタープライズセールス」→ その職種の求人だけ。
        1本の判定で両方成立する。
      */
      const matchByAlias = (w: string, pool: typeof list) => {
        const hits = roleAliases.filter((a) => a.alias.toLowerCase().includes(w));
        if (hits.length === 0) return null;
        const ids = new Set(hits.flatMap((a) => a.roleIds).filter(Boolean));
        const matched = pool.filter((j) => jobRoleIds(j).some((id) => ids.has(id)));
        return matched.length > 0 ? matched : null;
      };

      const ignored: string[] = [];
      for (const w of words) {
        const byText = list.filter((j) => matchesText(j, w));
        const byAlias = matchByAlias(w, list) ?? [];
        // 本文一致と辞書一致の和集合
        const merged = byText.length || byAlias.length
          ? Array.from(new Set([...byText, ...byAlias]))
          : [];

        if (merged.length === 0) {
          ignored.push(w);   // 解釈できなかった語。絞り込みには使わない
          continue;
        }
        list = merged;
      }
      // 全語が解釈できなかったときだけ 0件 にする
      if (ignored.length === words.length) list = [];
      ignoredTerms = ignored;
    }

    // ビジネス職のみフィルタ
    if (bizOnly && !category) {
      const { business } = getVisibleRoles(parentRoles);
      const bizIds = new Set(business.map((r) => r.id));
      list = list.filter((j) => bizIds.has(j.role_category_id ?? ""));
    }

    // ow_roles 親カテゴリフィルタ — 複数選択対応（カンマ区切り）
    if (categorySet.size > 0) list = list.filter((j) => {
      const ids = j.roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      return ids.some((id) => categorySet.has(id));
    });

    // 旧 dept フィルタ (後方互換、URLに ?dept= が残っている場合)
    if (!category && dept) list = list.filter((j) => j.dept === dept);

    if (workStyleSet.size > 0) {
      list = list.filter(
        (j) =>
          workStyleSet.has(j.work_style) ||
          j.tags.some((t) => Array.from(workStyleSet).some((ws) => t.includes(ws)))
      );
    }

    if (salary) {
      const min = parseInt(salary, 10);
      if (!isNaN(min)) {
        list = list.filter((j) => j.salary_max > 0 && j.salary_max >= min);
      }
    }


    if (industry) {
      /* ⚠️ **事業領域で絞る（2026-08-26）。** `?industry=` の値は事業領域の slug。
            それまでは `industry`(text) と比べていたが、あれは廃止予定で
            新規企業には書かれないため、新しい企業が全業種で出なくなる。
         ⚠️ **主だけでなく全部の事業領域に当てる。** 主だけで絞ると複数持てる意味が無い。 */
      const companyIds = companies
        .filter((c) => (c.business_domains ?? []).some((d) => d.slug === industry))
        .map((c) => c.id);
      list = list.filter((j) => companyIds.includes(j.company_id));
    }


    /* 企業フィルタ（?company=）。他のフィルタと AND で重なる。
       ⚠️ 解決できなかったとき（companyNotFound）は**絞らない**。
          全件＋注記にする判断（2026-08-15）。ここで0件にすると、
          綴り違いの共有リンクが「求人なし」に見えてしまう。 */
    if (companyFilter) {
      list = list.filter((j) => j.company_id === companyFilter.id);
    }

    // 都道府県フィルタ (job.location から抽出した都道府県と完全一致)
    if (prefecture) {
      list = list.filter((j) => extractPrefecture(j.location) === prefecture);
    }

    // 雇用形態フィルタ（複数選択対応）
    // ⚠️ 未設定（null）は**どの雇用形態にも一致させない**（2026-08-07）。
    //    以前は queries.ts が null を "正社員" に倒しており、
    //    雇用形態が入っていない求人が「正社員」で絞ると出てきていた。
    if (empTypeSet.size > 0) {
      list = list.filter((j) => !!j.employment_type && empTypeSet.has(j.employment_type));
    }

    // 企業ステージフィルタ（複数選択対応）
    if (companyStageSet.size > 0) {
      list = list.filter((j) => {
        const co = companyMap.get(j.company_id);
        const rawPhase = co?.phase ?? null;
        const matchesStage = (s: string) => {
          /* ⚠️ 正規表現をやめて写像に寄せた（2026-08-08）。/companies と同じ
                PHASE_FILTER_MAP を見る。旧実装が拾っていた nasdaq|nyse|グロース|プライム は
                実データに0件だったので、失うものは無い（実測済み）。 */
          if (s === "foreign") {
            const nm = co?.name ?? "";
            const url = (co?.url ?? "").toLowerCase();
            if (nm.toLowerCase().includes("japan")) return true;
            if (url && !url.includes(".co.jp") && !url.includes(".jp/") && !url.endsWith(".jp")) return true;
            if (/^[゠-ヿ]/.test(nm)) return true;
            return false;
          }
          return phaseMatches(rawPhase, s);
        };
        return Array.from(companyStageSet).some(matchesStage);
      });
    }


    // ソート
    if (sort === "salary") {
      list = [...list].sort((a, b) => (b.salary_max ?? 0) - (a.salary_max ?? 0));
    } else if (sort === "employees") {
      // 社員数順（多い企業の求人が上位）
      /* ⚠️★**直す前は動いていなかった**（2026-08-28）。`employee_count` は
            **text**（「約200名」など）なのに `?? 0` で受けて `bE - aE` を計算しており、
            文字列同士の引き算で **NaN** になっていた。比較関数が NaN を返すと
            並び順は事実上変わらない。**型が number だと嘘をついていたので気づけなかった。**
         ⚠️ 数が読めない企業は **-1** で末尾へ。0 にすると「社員0名」と同じ扱いになる。 */
      list = [...list].sort((a, b) => {
        const aE = parseEmployeeCount(companyMap.get(a.company_id)?.employee_count) ?? -1;
        const bE = parseEmployeeCount(companyMap.get(b.company_id)?.employee_count) ?? -1;
        return bE - aE;
      });
    } else if (sort === "disclosure") {
      // 開示充実順: 年収+キャッチコピー+説明の充実度スコア
      const score = (j: Job) => {
        let s = 0;
        if (hasSalaryData(j.salary_min, j.salary_max)) s += 3;
        if (j.highlight) s += 2;
        if (j.overview && j.overview.length > 100) s += 1;
        if (j.required_skills && j.required_skills.length > 0) s += 1;
        return s;
      };
      list = [...list].sort((a, b) => score(b) - score(a));
    } else {
      // デフォルト(新着順): 給与記載あり優先、次に更新日
      list = [...list].sort((a, b) => {
        const aHas = hasSalaryData(a.salary_min, a.salary_max) ? 0 : 1;
        const bHas = hasSalaryData(b.salary_min, b.salary_max) ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.updated_days_ago - b.updated_days_ago;
      });
    }

    return { list, ignoredTerms };
  }, [allJobs, q, category, categorySet, dept, work_style, workStyleSet, salary, industry, prefecture, empType, empTypeSet, companyStage, companyStageSet, companyFilter, sort, companies, companyMap, roleAliases]);

  const filtered = searchResult.list;
  const ignoredTerms = searchResult.ignoredTerms;

  // ⑧ グルーピング適用（1社あたり最大3件・更新日新しい順）
  const filteredForDisplay = useMemo(() => {
    if (!groupByCompany) return filtered;
    // 企業ごとにグループ化し、更新日昇順（古い日数=新しい）でソート後、先頭3件を取る
    const byCompany = new Map<string, typeof filtered>();
    for (const j of filtered) {
      const arr = byCompany.get(j.company_id) ?? [];
      arr.push(j);
      byCompany.set(j.company_id, arr);
    }
    byCompany.forEach((arr) => arr.sort((a, b) => a.updated_days_ago - b.updated_days_ago));
    // 企業の出現順（filteredリスト内の初出）を維持して平坦化
    const seenCompanies: string[] = [];
    for (const j of filtered) {
      if (!seenCompanies.includes(j.company_id)) seenCompanies.push(j.company_id);
    }
    return seenCompanies.flatMap((cid) => (byCompany.get(cid) ?? []).slice(0, 3));
  }, [filtered, groupByCompany]);

  // ⑧ グルーピング時に「まとめられた社数」を計算
  const hiddenByGrouping = filtered.length - filteredForDisplay.length;
  // ⑧ 最も多い企業の件数を計算
  const maxPerCompany = useMemo(() => {
    const countMap = new Map<string, number>();
    filtered.forEach((j) => countMap.set(j.company_id, (countMap.get(j.company_id) ?? 0) + 1));
    return Math.max(0, ...Array.from(countMap.values()));
  }, [filtered]);

  // ⑤ reset when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterKey = [category, dept, work_style, salary, industry, prefecture, empType, sort, q, bizOnly, companyStage].join("|");
  useEffect(() => {
    setDisplayCount(PER_PAGE);
    // Clear ?show from URL when filters change
    const p = new URLSearchParams(window.location.search);
    if (p.has("show")) { p.delete("show"); router.replace(`/jobs?${p.toString()}`, { scroll: false }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const paged = filteredForDisplay.slice(0, displayCount);

  /* ── ★分割ビュー（2026-09-09。柴さんの要望）──────────────────────────────
     ⚠️★**サーバーへ取りに行かない。** 求人は既に全件クライアントに載っている
        （`allJobs`）ので、`/companies` と違って追加のクエリが1本も要らない。
     ⚠️ 先頭を自動で開く。`/companies` の詳細表示と同じ理由——右側が空のままだと
        分割ビューがあることに気づけない。
     ⚠️ **並び替え・絞り込みの結果に追随する**（`paged` の先頭を見る）。
     ⚠️ 見つからない slug は黙って無視して先頭に落とす（一覧そのものは正しいので
        404 にはしない）。 */
  const selectedSlug = searchParams.get("selected");
  const selectedJob =
    (selectedSlug ? paged.find((j) => (j.slug ?? j.id) === selectedSlug) : undefined) ?? paged[0];
  const selectedCompany = selectedJob ? companyMap.get(selectedJob.company_id) : undefined;

  /* ★選んだ求人のカードを、レールの見える位置まで送る（2026-09-17）。
     `?selected=` の直リンク・リロード・戻るで来たとき、その求人が一覧の下のほうに
     あると**右ペインには出ているのに、左では見えない**（どれが開いているのか分からない）。

     ⚠️★**「レールの外に出ているときだけ」動かす。** これが唯一の条件で、
        「直リンクのときだけ」のような分岐を書かなくて済む:
          ・カードを押したとき … そのカードは見えているので**何も起きない**
          ・直リンク・戻る     … 見えていなければ送る
        ⚠️ 「初回だけ」にすると、戻る・進むで選択が変わったときに動かない。

     ⚠️★**`scrollIntoView` を使わない。** あれは**祖先を全部**スクロールするので、
        レールだけでなく**ページごと動く**（2ペインを独立スクロールにした意味が消える）。
        レールの `scrollTop` を自分で計算して動かす。

     ⚠️★**分割しない幅でも安全。** そのときレールはスクローラではなく
        `clientHeight` が中身の高さと等しいので、どのカードも「中に入っている」ことになり
        **この処理は何もしない。** 幅の判定を書かなくてよいのはそのため。

     ⚠️ `getBoundingClientRect` は**2つの矩形の差**にだけ使っている（.claude/rules の⑪-2で
        「相対比較にだけ使う」とされている使い方）。絶対座標としては使わない。

     ⚠️ `html { scroll-behavior: smooth }` は効かない。あれは継承しないので、
        レールの `scrollTop` 代入は即座に反映される。 */
  useEffect(() => {
    if (!selectedJob) return;
    const rail = document.querySelector<HTMLElement>(".companies-rail");
    const card = rail
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.closest<HTMLElement>(".job-list-card");
    if (!rail || !card) return;
    /* 上下に少しだけ余白を残す。端にぴったり付けると「続きがある」ことが見えない */
    const MARGIN = 12;
    const r = rail.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    if (c.top < r.top + MARGIN) rail.scrollTop += c.top - r.top - MARGIN;
    else if (c.bottom > r.bottom - MARGIN) rail.scrollTop += c.bottom - r.bottom + MARGIN;
  }, [selectedJob]);

  const hasMore = displayCount < filteredForDisplay.length;
  const remainingCount = filteredForDisplay.length - displayCount;

  /* ★2ペインの高さの起点（2026-09-17）。ヘッダー ＋ ツールバー ＋ 本文の上余白。
     ⚠️★**即値で書かない。** ツールバーは「詳細検索」を開くと 69px から 140px に伸び、
        注記の帯が出る日もある。固定値にすると、開いた瞬間にペインの下端が
        画面の外へ 71px はみ出す。
     ⚠️ `resize` ではなく `ResizeObserver` で測る。ツールバーの高さは
        ウィンドウ幅を変えなくても（開閉だけで）変わる。
     ⚠️ 分割しない幅では誰もこの変数を読まない（CSS が `@media` の中にある）ので、
        測っておくだけで害は無い。 */
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [splitTop, setSplitTop] = useState(162);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const read = () => {
      const header = document.querySelector("header");
      /* 本文の上余白は md:py-8 = 32px。⚠️ ここを変えたら合わせること */
      setSplitTop((header?.offsetHeight ?? 61) + el.offsetHeight + 32);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setDisplayCount((c) => c + PER_PAGE); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  /* ⚠️ `companyFilter`（解決できた企業）だけを数える。`companyParam` を入れると、
        綴り違いのときに「絞り込み中」と言いながら全件出ている状態になる。
        解決できなかったことは companyNotFound の注記で別に伝える。 */
  const hasFilter = !!(category || dept || work_style || salary || industry || prefecture || empType || companyStage || bizOnly || companyFilter);

  /* ★注記の帯を出すか（2026-09-17）。⚠️ 3つの条件は帯の中身と**同じ順**に並べてある。
        片方だけ足すと「帯は出るのに中身が無い」か「中身があるのに帯が出ない」になる。 */
  const hasNotices = ignoredTerms.length > 0 || companyNotFound || !!companyFilter;


  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of allJobs) {
      const ids = (j as { roleIds?: string[] }).roleIds ?? (j.role_category_id ? [j.role_category_id] : []);
      for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [allJobs]);



  /* ★進捗バー・もっと見る・センチネル。**一覧（グリッド）と詳細（分割）で共有する**
        （2026-10-01 にグリッドを足したときに変数へ出した）。
     ⚠️★**2つに書き写さないこと。** 片方だけ直る形の不具合になる。 */
  const listTail = (
    <>
            {/* ★進捗・もっと見る・センチネルは**レールの中**（2026-09-17）。
                   scrollMode="panes" ではレールが自分でスクロールするので、
                   **外に置くと一覧の続きが2ペインの下（＝画面の外）に落ちる。**
                ⚠️ 無限スクロールの IntersectionObserver は root を指定していない
                   （＝ビューポート基準）。**祖先のスクロール領域によるクリップは効く**ので
                   レールが独立スクロールでも動く。root をレールに変えないこと ——
                   分割しない幅ではレールがスクローラではなく、
                   **常に交差して無限に読み込む**。 */}
            {/* ⑦ プログレスバー + もっと見るボタン */}
            <div style={{ marginTop: 16, marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                  <strong style={{ color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{paged.length}</strong>
                  {" / "}
                  <strong style={{ color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{filteredForDisplay.length}</strong>
                  {" 件表示中"}
                </span>
                {hasMore && (
                  <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>残り{remainingCount}件</span>
                )}
              </div>
              <div style={{ height: 4, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.round(paged.length / Math.max(filteredForDisplay.length, 1) * 100)}%`,
                  background: "linear-gradient(to right, var(--royal), #3B5FD9)",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => {
                  const next = displayCount + PER_PAGE;
                  setDisplayCount(next);
                  const p = new URLSearchParams(window.location.search);
                  p.set("show", next.toString());
                  router.replace(`/jobs?${p.toString()}`, { scroll: false });
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  margin: "12px auto 0",
                  padding: "12px 32px", borderRadius: 999,
                  border: "1.5px solid var(--royal)",
                  background: "#fff", color: "var(--royal)",
                  fontSize: 14, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                  boxShadow: "0 2px 8px rgba(0,35,102,0.1)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--royal)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
              >
                もっと見る
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            )}
            {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </>
  );

  return (
    <>
      <h1 className="sr-only">IT募集を探す</h1>

      {/* ── ★ツールバー（2026-09-17 に検索帯と並び替え帯を1つにした）──────────────
             それまで **sticky な帯が2本**あり、一覧が始まるのは 267px（本番 1440px 実測）だった。
               ヘッダー 61 ＋ 検索帯 91 ＋ 並び替え帯 83 ＋ 余白 32
             並び替え・件数を検索窓と同じ行に入れて帯を1本にしてある。

          ⚠️★**1行に収まるのは分割表示の幅だけ。** 実測の intrinsic は
             検索窓 220（flex-basis の下限）＋ 詳細検索 103 ＋ 並び替え 455 ＋ 件数 90
             ＝ **約 908px** で、内側の幅は 1280px で 1,184 / 1440px で 1,344。
             それより狭い画面では `.jobs-toolbar-sort` が `flex-basis: 100%` で
             **自分から行を折る**（＝従来どおりの2行）。下の CSS を参照。

          ⚠️ `top: 60` はヘッダー（実高 61px）に貼り付けるための即値。**このリポジトリでは
             6ファイルに直書きされている**（`--header-h` のような変数が無い）。
             変数に寄せるなら5画面まとめて直すこと。ここだけ変えると段差になる。 */}
      <div
        ref={toolbarRef}
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          /* ⚠️ 上下を 20/14 から 12/12 に詰めた。帯が1本になったぶん、
                詰めすぎると検索窓がヘッダーに貼り付いて見える。12 が下限。 */
          padding: "12px 0 0",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          position: "sticky",
          top: 60,
          zIndex: 30,
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="page-gutter">

          {/* ツールバー本体（企業ページ .csb-bar と同等） */}
          <div ref={filterPillsRef} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "0 0 12px" }}>

            {/* ★「一覧内を検索」（2026-10-01 / ステップ2）。実体は
                   components/common/ListSearchButton —— **4つの一覧で同じ部品**。
                ⚠️★ここに入力欄を書き戻さないこと。1440px で検索窓が 971px を占めていた。
                ⚠️ サジェストの材料（求人のタイトルと企業名）はページが持っているので、
                   入力中の値（`qDraft`）もページが持つ。 */}
            <ListSearchButton
              value={q}
              draft={qDraft}
              onDraftChange={setQDraft}
              onCommit={(v) => setParam("q", v)}
              onClear={() => setParam("q", "")}
              placeholder="職種・企業名で検索"
              inputAriaLabel="募集を検索"
              suggestions={suggestions.map((sg, i) => ({ key: `${i}:${sg.q}`, label: sg.label, sub: sg.sub }))}
              onPickSuggestion={(sg) => setParam("q", suggestions.find((x, i) => `${i}:${x.q}` === sg.key)?.q ?? sg.label)}
            />

            {/* ── ★詳細検索（2026-09-09。柴さんの要望）────────────────────────────
                   条件が3箇所（上のピル行 / 左サイドバー / モバイルの職種ピル）に
                   散っていたのを1つに畳んだ。**サイドバーは削除した**（職種はここへ、
                   勤務地は削除）。
                ⚠️★**閉じていても `activeChips` は外に出す。** 隠しきると
                   「なぜこの件数なのか」が画面から消える。 */}
            {/* ⚠️★ボタンだけを1つの flex item にする（2026-09-09）。
                   チップを同じ item に入れていたら、**開くとチップが消えて検索窓が広がり、
                   「詳細検索」ボタン自身が 98px 右へ動いていた**（実測）。
                   押した控えが動くのは、押した本人には何が起きたか分からない。 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <DetailSearchToggle
                open={showAdvanced}
                count={activeChips.length}
                onToggle={() => setShowAdvanced((v) => !v)}
              />

            </div>

            {/* ── ★並び替え＋件数（2026-09-17 に下の帯からここへ移した）──────────
                   ⚠️★**白いカードの装飾（枠・影・角丸）は外した。** 帯が1本になったので、
                      同じ行の中にもう1枚カードを置くと「窓の中の窓」になる。
                      区切りは縦罫だけにしてある。
                   ⚠️★**折り返しの制御は `.jobs-toolbar-sort` の `flex-basis` 1箇所だけ。**
                      分割しない幅では 100% で**自分から行を折る**（＝従来どおりの2行）。
                      分割表示の幅でだけ `auto` になって検索窓と同じ行に収まる。
                   ⚠️ 中身・ハンドラ・`jobs-sort-btn` の見た目は移す前と1文字も変えていない。
                   ⚠️★件数の塊に `marginLeft: auto` が要る。**行を折ったときだけ効く**
                      （1行のときは余白が無いので 0）。外すと、折れた行で件数が
                      ピルの直後に寄って右端が空く。 */}
            <div className="jobs-toolbar-sort">
              {/* ★ピル4つ（**513px**）から畳んだ（2026-09-17 / 柴さんの要望）。
                     ツールバーを1行にしたので、ここが一番かさばっていた。約140px になる。
                  ⚠️★**いま何順かは閉じていても見える**（ボタンに現在値が出る）。
                     隠れるのは他の選択肢だけ。絞り込みのチップとは事情が違う
                     （あちらは効いている条件が消えるので `activeChips` が要る）。
                  ⚠️ 選択肢と既定値はここが持つ。**部品は表示と開閉だけ。**
                  ⚠️★アイコンは部品側にある。ここで別のものを足さないこと。 */}
              <SortSelect
                value={sort}
                onChange={(v) => setSort(v as typeof sort)}
                options={[
                  { value: "updated",    label: "新着順" },
                  { value: "salary",     label: "年収順" },
                  { value: "employees",  label: "社員数順" },
                  { value: "disclosure", label: "開示充実順" },
                ]}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
              {maxPerCompany > 3 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setGroupByCompany(v => !v); setDisplayCount(PER_PAGE); }}
                    className={`jobs-sort-btn${groupByCompany ? " active" : ""}`}
                    title="同一企業の募集を1社あたり3件に絞る"
                  >
                    {groupByCompany ? "✓ " : ""}1社3件まで
                  </button>
                  {groupByCompany && hiddenByGrouping > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#C2410C", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                      {hiddenByGrouping}件非表示
                      <button type="button" onClick={() => setGroupByCompany(false)} style={{ background: "none", border: "none", color: "#C2410C", fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}>全表示</button>
                    </span>
                  )}
                </>
              )}
              {/* ★ビュートグル（2026-10-01）。⚠️★見た目は `components/common/ViewToggle.tsx`
                     の1箇所。`/companies` と同じ部品で、**ここに書き写さないこと。**
                  ⚠️ 置き場所は件数の**左**。`/companies` と同じ並び（並び替え → 切替 → 件数）。 */}
              {/* ⚠️★**既定（グリッド）のときは `?view=` を URL から消す**。`/companies` の
                     `GridSortBar` と同じ向き。残すと、既定を将来入れ替えたときに
                     **古い共有リンクが意図しない側を開く。** */}
              <ViewToggle value={view} onChange={(v) => setParam("view", v === "list" ? "list" : "")} />
              <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
              <span aria-live="polite" style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
                <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 16 }}>{filteredForDisplay.length}</strong>
                <span style={{ marginLeft: 2 }}>件</span>
                {(hasFilter || q) && <span style={{ fontSize: 12, color: "var(--success-ink)", marginLeft: 6, fontWeight: 600 }}>絞込中</span>}
              </span>
              </div>
            </div>

            {/* 選択中の条件。⚠️ ✕ で1つずつ外せる。件数のバッジとは別の役割（何で絞っているか）
                   ⚠️★**開いているときは出さない**（2026-09-09）。ピル自身が選択状態を
                      持っているので、「事業開発 ✕」の隣に「事業開発 ⌄」が並んで
                      **同じ語が2回**出ていた。閉じているときだけの近道にする。
                   ⚠️★**検索窓と同じ行に置かない。** 同じ行だと、開閉のたびに検索窓の幅が
                      変わって「詳細検索」ボタンが左右に動く。`flexBasis: 100%` で必ず折る。 */}
            {!showAdvanced && <ActiveFilterChips chips={activeChips} />}

            {/* フィルターピル群。
                ⚠️ 詳細検索を開いたときだけ出す。メニューは各 FilterChip の直下に開く。
                ⚠️★**検索窓と同じ行に並べないこと**（2026-09-09）。以前は
                   検索窓・詳細検索・チップ・8ピルが**全部1行**に詰まり、
                   どこまでが詳細検索の中身なのか読めなかった。
                   `flexBasis: "100%"` で必ず行を折り、薄い面を敷いて塊として見せる。 */}
            {showAdvanced && (
            <div style={{
              flexBasis: "100%", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
              background: "var(--bg-tint)", border: "1px solid var(--line)",
              borderRadius: 12, padding: "10px 12px", marginBottom: 2,
            }}>

              {/* ★2026-10-09 に共通の FilterChip に寄せた（それまで /jobs だけ独自のピルと
                     position: fixed のメニュー1枚を持っていた）。
                  ⚠️ `labelPrefix` を外さないこと。8つ並ぶので、値だけだと何の条件か分からない。
                  ⚠️ 単一選択（事業領域・都道府県・年収）は選ぶと閉じる。複数選択は閉じない。
                  ⚠️ 「すべて」の行は無くした。外すのはチップの ✕（/companies と同じ）。 */}
              {/* 職種（複数選択）。⚠️ 親職種だけ。子まで出すと148件になり選べない。
                  ⚠️ 件数は公開求人（allJobs）の数。0 も出す */}
              <FilterChip label="職種" labelPrefix listStyle value="" values={Array.from(categorySet)}
                options={parentRoles.map((r) => ({ value: r.id, label: r.name, count: roleCounts.get(r.id) ?? 0 }))}
                onSelect={() => setParam("category", "")} onClear={() => setParam("category", "")}
                onToggleValue={(v) => toggleParam("category", v, category)}
                isOpen={openFilter === "category"} onToggle={() => toggleFilter("category")} />
              {/* フェーズ（複数選択）。⚠️ ✕ は外資系を消さない（clearPhases） */}
              <FilterChip label="フェーズ" labelPrefix phaseStyle value="" values={Array.from(phaseSet)}
                options={phaseOptions}
                onSelect={clearPhases} onClear={clearPhases} onToggleValue={toggleStage}
                isOpen={openFilter === "phase"} onToggle={() => toggleFilter("phase")} />
              <FilterChip label="事業領域" labelPrefix listStyle value={industry}
                options={industryOptions.map((g) => ({ value: g.slug, label: g.name }))}
                onSelect={(v) => setParam("industry", v ?? "")}
                isOpen={openFilter === "industry"} onToggle={() => toggleFilter("industry")} />
              <FilterChip label="都道府県" labelPrefix listStyle searchable value={prefecture}
                options={PREFECTURE_FILTER_GROUPS.flatMap((g) => g.prefectures.map((p) => ({ value: p, label: p, group: g.group })))}
                onSelect={(v) => setParam("prefecture", v ?? "")}
                isOpen={openFilter === "prefecture"} onToggle={() => toggleFilter("prefecture")} />
              {/* 勤務形態（複数選択。2026-08-08 に単一選択から変えた） */}
              <FilterChip label="勤務形態" labelPrefix value="" values={Array.from(workStyleSet)}
                options={WORK_STYLE_FILTERS.map((v) => ({ value: v, label: v }))}
                onSelect={() => setParam("work_style", "")} onClear={() => setParam("work_style", "")}
                onToggleValue={(v) => toggleParam("work_style", v, work_style)}
                isOpen={openFilter === "work_style"} onToggle={() => toggleFilter("work_style")} />
              {/* 雇用形態（複数選択）。⚠️ 選択肢は careerOptions.ts の JOB_EMPLOYMENT_TYPES */}
              <FilterChip label="雇用形態" labelPrefix value="" values={Array.from(empTypeSet)}
                options={JOB_EMPLOYMENT_TYPES.map((v) => ({ value: v, label: v }))}
                onSelect={() => setParam("emp_type", "")} onClear={() => setParam("emp_type", "")}
                onToggleValue={(v) => toggleParam("emp_type", v, empType)}
                isOpen={openFilter === "empType"} onToggle={() => toggleFilter("empType")} />
              <FilterChip label="年収" labelPrefix listStyle value={salary}
                options={SALARY_PILL_TIERS.map((t) => ({ value: t.value, label: t.label }))}
                onSelect={(v) => setParam("salary", v ?? "")}
                isOpen={openFilter === "salary"} onToggle={() => toggleFilter("salary")} />

              {/* 外資系 トグル。⚠️ 見た目は /companies と同じ .foreign-toggle */}
              <button type="button"
                className={`foreign-toggle${companyStageSet.has("foreign") ? " active" : ""}`}
                onClick={() => toggleStage("foreign")}
                aria-pressed={companyStageSet.has("foreign")}
              >
                外資系{companyStageSet.has("foreign") && <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>}
              </button>

              {/*
                ⚠️ 2026-08-06 に「面談受付中」ピルを削除した。
                   フィルタピルと並んでいたが実体は並び替え（sort="meeting"）で、
                   面談を受け付ける企業を上に寄せるだけ。掲載中76社が全て
                   accepting_casual_meetings = true なので1件も順番が変わらず、
                   押しても何も起きないのに絞り込めるように見えていた。
                   面談の可否で絞りたくなったら、sort ではなくフィルタとして作ること。
              */}

              {/* ⚠️★**「✕ リセット」は廃止した**（2026-09-06 / 柴さんの判断・`/companies` と揃えた）。
                     絞り込みが1つ付くたびに現れて右端の並びが動くうえ、**すべて個別に外せる**:
                       各ピル → 開いて「すべて」／ 外資系 → もう一度押す（元からトグル）
                       検索文字 → 入力欄の ✕ ／ 職種（サイドバー）→ もう一度押す
                  ⚠️ 0件のときの「すべてリセット」は**残してある**（別の場所・別の役割）。
                  ⚠️ サイドバーは 2026-09-09 に削除したので、そこの「検索条件をリセットする」も無い。 */}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ★注記の帯（2026-09-17）────────────────────────────────────────────
             並び替えと件数は上のツールバーへ移したので、ここに残るのは
             **注記3種だけ**（解釈できなかった検索語 / 企業が見つからない / 企業で絞り込み中）。

          ⚠️★**中身が無いときは帯ごと出さない。** 出すと `py-3` と下罫だけの
             白い帯が 25px 残り、ツールバーとの間に意味の無い段差ができる。
          ⚠️★**sticky を外した**（以前は `top: 64px`）。上のツールバーが `top: 60` で
             高さ 68px あるので、64 に貼り付けると**ツールバーの裏に隠れる**
             （ツールバーは z:30、こちらは z:auto）。注記は流れてよい情報なので静的にする。 */}
      {hasNotices && (
      <div
        ref={filterBarRef}
        className="jobs-mobile-filterbar"
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }} className="page-gutter py-3">

          {/* 解釈できなかった検索語の通知。
              「エンタープライズ企業 営業」のように、こちらで扱えない語が混ざったとき
              その語は絞り込みから外している。黙って外すと、入力した条件が効いていない
              ことに気づけないので明示する。 */}
          {ignoredTerms.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              background: "var(--warm-soft)", border: "1px solid #FDE68A",
              borderRadius: 10, padding: "8px 14px",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warm-ink)" }}>
                {ignoredTerms.map((t) => `「${t}」`).join("")}
                は絞り込みに使えませんでした
              </span>
              {/* 全語が使えなかったときは「残りの語」が存在しないので出さない */}
              {ignoredTerms.length < q.trim().split(/[\s　]+/).filter(Boolean).length && (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--warm-ink)", opacity: 0.85 }}>
                  残りの語だけで検索しています
                </span>
              )}
            </div>
          )}

          {/* ⚠️ モバイルの職種クイックピル（上位10件）は 2026-09-09 に削除した。
                 職種は「詳細検索」に集約したので、同じものが2箇所に出ていた。 */}

          {/* 企業が解決できなかったときの注記。⚠️ 黙って全件を出さない */}
          {companyNotFound && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0,
                padding: "3px 10px", borderRadius: 100,
                background: "#FEF3C7", border: "1.5px solid #FDE68A",
                color: "var(--warm-ink)", fontSize: 12, fontWeight: 700,
              }}>
                指定された企業が見つかりません。すべての募集を表示しています
              </span>
              <button type="button" onClick={() => setParam("company", "")} style={{
                fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none",
                border: "none", cursor: "pointer", padding: "3px 4px",
                fontFamily: "inherit", textDecoration: "underline",
              }}>
                指定を外す
              </button>
            </div>
          )}

          {/* ⚠️★**「絞り込み中」のサマリー行は廃止した**（2026-09-06 / 柴さんの判断）。
                 職種・勤務形態・年収・雇用形態・地域は、**ピルとサイドバーが
                 選択状態で示している**ので同じことを2箇所に出していた。

              ⚠️★**企業（`?company=`）だけは残す。これにはピルが無い。**
                 企業詳細の「N件すべての求人を見る」と `/u/[id]` の現職リンクから
                 `/jobs?company=<slug>` で来る導線が生きており、消すと
                 **なぜ2件しか出ていないのか画面のどこにも出ず、外す手段も無くなる。**
                 「なくても分かる」が成り立たない唯一の絞り込み。 */}
          {companyFilter && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2, paddingBottom: 2, alignItems: "center" }}>
              <button key="co" type="button" onClick={() => setParam("company", "")} title={companyFilterName} style={{
                display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%",
                padding: "3px 10px", borderRadius: 100,
                background: "var(--royal-50)", border: "1.5px solid var(--royal)",
                color: "var(--royal)", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {/* ⚠️ minWidth:0 が無いと ellipsis が効かず親を押し広げる（375px で実測済みの罠） */}
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  企業: {companyFilterName}
                </span>
                <span style={{ fontSize: 12, opacity: 0.8, flexShrink: 0 }}>✕</span>
              </button>
            </div>
          )}

        </div>
      </div>
      )}

      {/* Main content */}
      {/* ⚠️ ページ背景。★2026-09-17 に直書きの #F5F7FA から --bg-tint へ寄せた。
             右ペインの**下部の固定バー**（2026-09-30 に `.jp-sticky` から置き換え）が
             **同じ色**である必要があり、
             値を2箇所に持つと片方だけずれる。#F5F7FA と #F8FAFC の差は3階調で見た目は変わらない。 */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="page-gutter py-6 md:py-8"
        >
          {/* ⚠️★サイドバーは 2026-09-09 に削除した（柴さんの要望）。職種は「詳細検索」へ移し、
                 勤務地は消した。**戻さないこと** ——条件が2箇所に分かれると、片方だけ直す
                 事故が起きる（勤務地は「2県以上あるときだけ出す」ゲートがピル側に無く、
                 同じ画面で食い違っていた前例がある）。
              ⚠️ 1カラムになったぶんの幅は分割ビュー（Stage 2）で使う。 */}
          {/* ⚠️ `--split-top` は `CompanySplitLayout` の scrollMode="panes" だけが読む。
                 ここに置いているのは、ツールバーの高さを知っているのがこの画面だからで、
                 部品側に測らせない（`/companies` はツールバーの形が違う）。 */}
          <div className="jobs-layout" style={{ "--split-top": `${splitTop}px` } as React.CSSProperties}>
            {/* ─ Results column ─ */}
            <main id="jobs-results-top" style={{ minWidth: 0 }}>

          {/* ⚠️★「あなたへのおすすめ」は 2026-09-09 に**最下部へ移した**（柴さんの要望）。
                 ここに戻さないこと —— 一覧を開いた人が最初に見るのは検索結果で、
                 上に置くとおすすめ2件が結果より先に出て、本題が下へ押される。
                 実体は `</main>` の直前。 */}

          {/* ⚠️ ここにあった「あなたの希望職種にマッチ」セクションは 2026-08-07 に削除した。
                 recommendations.length === 0 のときだけ出るフォールバックだったが、
                 希望職種が1つでも当たれば scoreJob の職種48点だけで MIN_SCORE(30) を
                 超えるため、**「マッチ求人がある＝おすすめも必ずある」**になり
                 条件が永久に成立しなくなった（希望職種の中間テーブル化で scoreJob が
                 正しく動き出したことによる）。復活させるなら、おすすめとは別の切り口で。 */}

          {paged.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "48px 24px", background: "#fff",
              borderRadius: 16, border: "1px solid var(--line)", marginTop: 20,
            }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              {/* ⚠️ 企業で絞っているときは「条件に合う募集が…」では何が起きたか分からない。
                     公開求人を1件も持たない企業は 86/87 社あるので、ここは頻繁に踏まれる。 */}
              <h3 style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 8, overflowWrap: "anywhere" }}>
                {companyFilter
                  ? `${companyFilterName}の公開中の募集はありません`
                  : "条件に合う募集が見つかりませんでした"}
              </h3>
              {/* 「カジュアル面談で直接聞いてみましょう」は 2026-08-03 に差し替え。
                  面談を前提にした案内はプラットフォーム側の説明では使わない方針。
                  ここは検索結果が0件のときの導線なので、条件を緩めるか企業から辿るかを示す。 */}
              <p style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: 20 }}>
                {companyFilter
                  ? "企業ページから会社の情報を見られます"
                  : "条件を緩めるか、企業から探してみてください"}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {/* 企業で絞って0件のときは、その企業のページへ戻れるようにする */}
                {companyFilter && (
                  <Link href={`/companies/${companyFilter.slug ?? companyFilter.id}`} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                    color: "#fff", fontSize: "var(--text-base)", fontWeight: 600, textDecoration: "none",
                  }}>
                    企業ページを見る
                  </Link>
                )}
                <button type="button" onClick={() => router.replace("/jobs")} style={{
                  padding: "10px 24px", borderRadius: 8, background: "var(--royal)",
                  color: "#fff", border: "none", fontSize: "var(--text-base)", fontWeight: 600, cursor: "pointer",
                }}>
                  すべてリセット
                </button>
                <Link href="/companies" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 8,
                  background: "linear-gradient(135deg, var(--royal), var(--accent))",
                  color: "#fff", fontSize: "var(--text-sm)", fontWeight: 600, textDecoration: "none",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  企業を見る
                </Link>
              </div>
              {/* ★この窓は職種・会社などの絞り込みで、業種は対象外。
                     「IT」のような語は0件が正しいが、行き止まりにしない（2026-08-27）。 */}
              <SearchAllLink q={q} />
            </div>
          ) : (
            <>
              {/* リスト表示（デスクトップ・モバイル共通）。
                     ⚠️★骨組みと CSS は `/companies` と**同じ部品**（CompanySplitLayout）。
                        ここに書き写さないこと——割れると片方の画面でだけペインが出なくなる。
                     ⚠️ 部品名が `Company…` なのは歴史的な理由（CompanySplitLinks の注記）。
                     ⚠️ レール幅 700 は企業の詳細表示と同じ。求人カードも横長の行で、
                        420 では本文が入らない。 */}
              {/* ★★一覧（グリッド）と詳細（1列＋分割）の出し分け（2026-10-01 / 柴さんの指示）。
                     ⚠️★**`/companies` と同じ約束**:「**グリッドは全画面 / 1列は分割**」。
                        グリッドは `CompanySplitLayout` で**包まない**。包むと 1280px 以上で
                        右ペインに戻り、3列が 1枚 130px に潰れる
                        （`/companies` の `GRID_RAIL_WIDTH` を 2026-09-30 に消したのと同じ理由）。
                     ⚠️★グリッド側では `?selected=` を**見ない**。押したら全画面へ遷移する。
                     ⚠️ 進捗・もっと見るは `listTail` で共有している。書き写さないこと。 */}
              {view === "card" ? (
                <>
                  <div className="jobs-grid">
                    {paged.map((job) => (
                      <JobCardGrid
                        key={job.id}
                        job={job}
                        companyMap={companyMap}
                        initialBookmarked={bookmarkedIds.has(job.id)}
                        isApplied={appliedJobIds.has(job.id)}
                      />
                    ))}
                  </div>
                  {listTail}
                </>
              ) : (
              <CompanySplitLayout
                pane={selectedJob ? <JobPane job={selectedJob} company={selectedCompany} /> : null}
                paneLabel={selectedJob ? selectedJob.role : null}
                railWidth={RAIL_WIDTH}
                basePath="/jobs"
                /* ★2ペインを独立スクロールにする（2026-09-17）。
                   ⚠️★**`/companies` は既定（"page"）のまま。** 同じ部品を4箇所が使っており、
                      うち3つが `/companies`。複製せず props で分けている。 */
                scrollMode="panes"
              >
              <div className="jobs-list-desktop">
                {(() => {
                  return paged.map((job) => {
                    return (
                      <JobListItem
                        key={job.id}
                        job={job}
                        companyMap={companyMap}
                        initialBookmarked={bookmarkedIds.has(job.id)}
                        isApplied={appliedJobIds.has(job.id)}
                        matchReason={computeMatchReason(job, { category, dept, salary, prefecture, q }, parentRoles)}
                        /* ★いま右ペインに出している求人に印を付ける（2026-09-09）。
                           ⚠️ 判定は `selectedJob` と同じ式にしない。**同一オブジェクトで比べる**
                              ——`?selected=` は slug でも id でもありうるので、文字列で比べると
                              片方の形でだけ印が付かない（企業側で踏んだのと同じ罠）。 */
                        selected={job === selectedJob}
                      />
                    );
                  });
                })()}
              </div>
              {listTail}
              </CompanySplitLayout>
              )}

            </>
          )}

          {/* ── ★パーソナライズ: あなたへのおすすめ（2026-09-09 に最上部から移動）──
                 ⚠️ 出す条件は変えていない（絞り込みも検索語も無く、推薦が1件以上あるとき）。
                    絞り込み中に出すと「絞ったのに関係ない求人が出た」になる。
                 ⚠️ `marginBottom` を `marginTop` に変えてある。最下部では上に間が要る。 */}
          {!hasFilter && !q && recommendations.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>あなたへのおすすめ</span>
                <span style={{ fontSize: 12, padding: "1px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontWeight: 600 }}>
                  {recommendations.length}件
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {recommendations.slice(0, 6).map((job) => {
                  const recCompany = companyMap.get(job.company_id);
                  return (
                    <a
                      key={job.id}
                      href={`/jobs/${job.slug ?? job.id}`}
                      style={{
                        padding: "12px 14px", borderRadius: 12,
                        background: "#fff", color: "var(--ink)",
                        border: "1.5px solid var(--line)",
                        textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 10,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        transition: "border-color .15s, box-shadow .15s",
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 1 }}>
                        {recCompany && (
                          <CompanyLogo
                            name={recCompany.name}
                            logoUrl={recCompany.logo_url}
                            logoLetter={recCompany.logo_letter}
                            logoGradient={recCompany.gradient}
                            size={36}
                            borderRadius={8}
                          />
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.role}
                        </div>
                        {recCompany && (
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(recCompany as any).brand_name ?? recCompany.name}
                          </div>
                        )}
                        {(job.salary_min ?? 0) > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)", marginTop: 4, fontFamily: "var(--font-inter), var(--font-noto)" }}>
                            {fmtMan(job.salary_min)}
                            {job.salary_max && job.salary_max > job.salary_min! ? `〜${fmtMan(job.salary_max)}` : ""}万円
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
              {recommendations.length > 4 && (
                <div style={{ marginTop: 8, textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>他 +{recommendations.length - 4}件</span>
                </div>
              )}
            </div>
          )}

            </main>
          </div>{/* jobs-layout end */}
        </div>
      </div>{/* bg end */}


      <style>{`
        .jobs-sort-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600;
          cursor: pointer; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft);
          transition: all 0.15s ease; white-space: nowrap; font-family: inherit; flex-shrink: 0;
        }
        .jobs-sort-btn:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .jobs-sort-btn.active {
          background: var(--royal); border-color: var(--royal); color: #fff;
          font-weight: 700; box-shadow: 0 3px 12px rgba(0,35,102,0.35); transform: scale(1.03);
        }

        /* ── Job card hover ── */
        .job-card-link:hover {
          box-shadow: 0 12px 36px rgba(0,35,102,0.18), 0 2px 8px rgba(0,35,102,0.08) !important;
          transform: translateY(-5px) !important;
        }
        .job-card-link .job-card-cta-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 16px 14px;
          background: linear-gradient(to top, rgba(0,35,102,0.85) 0%, rgba(0,35,102,0) 100%);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-align: right;
          opacity: 0;
          transition: opacity 0.22s ease;
          border-radius: 0 0 18px 18px;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 4px;
        }
        .job-card-link:hover .job-card-cta-overlay {
          opacity: 1;
        }
        .job-card-link:active {
          box-shadow: 0 4px 12px rgba(15,23,42,0.10) !important;
          transform: translateY(-2px) !important;
          transition-duration: 0.06s !important;
        }
        /* ── 縦リストカードhover ── */
        .job-list-card:hover {
          box-shadow: 0 3px 14px rgba(0,35,102,0.10) !important;
        }
        .job-list-item-link:hover {
          background: var(--royal-50) !important;
        }
        .job-list-item-link:active {
          background: var(--royal-100) !important;
          transition-duration: 0.06s !important;
        }
        .job-search-input:focus {
          box-shadow: 0 0 0 3px rgba(0,35,102,0.12) !important;
        }

        /* ── Default layout (mobile: single column) ── */
        .jobs-layout {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        /* ⚠️ jobs-sidebar の指定は 2026-09-09 に削除した（サイドバーごと無い）。 */
        /* 注記の帯。⚠️★sticky を外した（2026-09-17）。理由は JSX 側の注記。 */
        .jobs-mobile-filterbar { display: block; }

        /* ── ★ツールバーの並び替え群（2026-09-17）────────────────────────────
           ⚠️★**ここが「1行にするか2行にするか」の唯一の制御。**
              既定は flex-basis 100% ＝ 自分から行を折る（従来どおりの2行）。
              分割表示の幅でだけ auto にして検索窓と同じ行へ入れる。
           ⚠️★**1280 は lib/constants/splitView.ts の SPLIT_MIN_WIDTH と同じ値を
              手で書いている。** CSS からは定数を参照できない（CompanySplitLayout と同じ事情）。
              **変えるときは両方**。ここだけ変えると「分割は出るのにツールバーが2行」になる。
           ⚠️★ここは style タグのテンプレートリテラルの中。**バッククォートを書かないこと**
              （2026-09-17 にこの行で実際に文字列が途中で閉じ、tsc が 60件のエラーを出した）。 */
        .jobs-toolbar-sort {
          flex-basis: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .jobs-toolbar-sortpills {
          display: flex;
          gap: 6px;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: none;
          min-width: 0;
        }
        .jobs-toolbar-sortpills::-webkit-scrollbar { display: none; }
        @media (min-width: 1280px) {
          /* ★1行のときは右端に寄せる（2026-10-01 / 柴さんの指示。/people に揃えた）。
                 ⚠️ 1280px 未満は flex-basis: 100% で行を占めるので、ここは効かない。
                    あちらの行の右寄せは中の margin-left: auto（件数の塊）が担う。
                 ⚠️★flex-shrink: 0 を外さないこと。先に縮むのは検索窓のほうで、
                    ここが縮むとピルが横スクロールに化けて選択肢が隠れる。
                 ⚠️★この中はテンプレートリテラル（style タグ）。
                    バッククォートと不等号を書かないこと（ui-debugging ⑲）。 */
          .jobs-toolbar-sort { flex-basis: auto; flex-shrink: 0; margin-left: auto; }
          /* ⚠️ 1行のときはピルを縮めない。縮むと検索窓が伸びたぶんだけ
                 ピルが横スクロールに化け、押せる選択肢が隠れる。
                 先に縮むのは検索窓（flex 1 1 220px）。 */
          .jobs-toolbar-sortpills { flex-shrink: 0; overflow-x: visible; }
        }
        /* 縦リスト: 1カラム — 個別カード方式 */
        .jobs-list-desktop {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* desktop grid mode (旧カードグリッド: 残置) */
        .jobs-grid-desktop {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .jobs-grid-desktop { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .jobs-grid-desktop { display: none; }
          .jobs-view-toggle { display: none !important; }
        }

        /* ── Desktop layout (≥1024px): サイドバー + 縦リスト [+ 詳細ペイン] ── */
        @media (min-width: 1024px) {
          /* ⚠️★2026-09-09 にサイドバーを削除したので**1カラムのまま**にする。
                 ここに 220px の2カラム指定が残っていると、存在しない列にカードが
                 押し込まれて幅 120px まで潰れる（実際に踏んだ）。
                 ⚠️ ここは style タグのテンプレートリテラルの中。引用の記号を書かないこと。
                 ⚠️ 空いた幅は分割ビュー（Stage 2）で使う。 */
          .jobs-location-select, .jobs-location-separator { display: none !important; }
        }

        @media (max-width: 767px) {
          .job-list-mobile-hide { display: none !important; }
        }
        @media (max-width: 1023px) {
          .jobs-mobile-role-pills { display: flex !important; }
        }

        /* ⚠️★分割表示でボタン列を畳む CSS と、カードに重ねる♡の CSS は
               **globals.css に置いてある**（2026-09-17）。ここではない理由:
                 ① ボタン列の display は JobListItem の**インライン style**にあり、
                    インラインは CSS に勝つ。**インラインから display を外す**必要があり、
                    外したら /dev/preview/job-cards でも効く場所に基本ルールが要る
                    （この style タグはあのページには出ない）。
                 ② 基本ルールと分割時の上書きが別のファイルに分かれると、
                    片方だけ直す事故になる。**3つとも globals.css にまとめてある。** */

        /* ⚠️★.job-title-clamp の定義は globals.css に1本化した（2026-09-17）。
               ここに複製が残っていたせいで、globals.css 側のモバイル2行クランプが
               **一度も効いていなかった**（body の style タグが後から当たるため）。
               **書き戻さないこと。** */

        /* company name hover */
        .company-name-link:hover {
          text-decoration: underline;
        }

        /* 検索サジェスト hover */
        .suggest-item:hover {
          background: var(--royal-50) !important;
        }

        /* 面談CTA hover */
        .job-meeting-cta:hover {
          background: #FED7AA !important;
        }

        /* ボトムシートアニメーション */
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

      `}</style>
    </>
  );
}

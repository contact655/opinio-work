// src/lib/search/companies.ts
import { resolveIndustryKey } from "./industryGroups";
import { parseEmployeeCount } from "@/lib/utils/employeeCount";
// 企業検索の抽象化レイヤー
//
// 事前調査結果（2026-05-17）:
//   employee_count: 大多数は純粋な数値文字列 ("20","50","80","150","300","500")
//                   一部 "1-10名" / "11-50名" 形式が混在 → アプリ側でレンジ判定
//   work_style:     ow_companies には remote_work_status カラム (on_site/hybrid/full_remote)
//                   work_style は ow_jobs 側のカラム → remote_work_status を使用
//   募集中判定:      ow_jobs.status = 'published' の存在チェック（Migration 113以降）
//   is_published:   boolean NOT NULL — 31社 true / 3社 false
//
// 将来の拡張パス:
//   Phase 2: pg_trgm + trigram インデックス → ILIKE を similarity に差し替え
//   Phase 3: pgvector + embedding → embedding 類似度スコアを統合
//   Phase 4: LLM によるクエリ解釈 → params を前処理してからこの関数へ渡す

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyForCarousel, CompanyBusinessDomain } from "@/types/genre";
import { PHASE_FILTER_MAP } from "@/lib/constants/phase";
import { filterListedCompanies } from "@/lib/companies/visibility";

// ── 型定義 ─────────────────────────────────────────────────────────────────────

export type WorkStyleValue = "on_site" | "hybrid" | "full_remote";

export type CompanySearchParams = {
  q?: string;
  phase?: string;      // フェーズフィルタ（例: "シリーズA", "上場"）
  workStyle?: WorkStyleValue;
  hiring?: boolean;
  location?: string;   // 都道府県フィルタ（例: "東京都", "大阪府"）
  industry?: string;   // 事業領域フィルタ（値は ow_business_domains.slug）
  /** 対象業界（軸2）。値は `ow_industries.slug`。⚠️ `industry`（事業領域）とは別の軸。 */
  targetIndustry?: string;
  foreign?: boolean;   // 外資系のみ表示
  sort?: string;       // "newest" | "employees" | "disclosure"（"jobs" は 2026-08-18・"salary" は 2026-08-25 に廃止）
  // DB側ページネーション（hiring フィルターなしの場合のみ有効）
  limit?: number;
  offset?: number;
};

export type CompanySearchResult = {
  companies: CompanyForCarousel[];
  totalCount: number;       // フィルター適用後の総件数
  appliedFilters: CompanySearchParams;
};

// ── フェーズフィルター: 日本語 UI 値 → DB 値（英語/日本語混在）のマッピング ───

// ── メイン検索関数（将来の差し替えポイント）────────────────────────────────────

/**
 * 企業を検索する。
 *
 * 内部実装: Supabase + ILIKE（ローンチ時 34社規模で十分高速）
 * 将来: `searchCompanies` のシグネチャを変えずに内部を差し替え可能
 */
export async function searchCompanies(
  params: CompanySearchParams
): Promise<CompanySearchResult> {
  const supabase = createPublicClient();

  // ── DB側ページネーションを使うか判定
  // hiring / foreign / クライアントソート フィルターはアプリ側で処理するため、DB ページネーションと併用不可
  /* ⚠️ **アプリ側で並べるものはここに列挙する。** 列挙するとDB側ページネーションが
        無効になり（下の useDbPagination）、全件取ってから並べてページを切る。
     ⚠️ `employees` を足した（2026-08-28）。**DB側の `employee_count DESC` は
        text列の辞書順**で、`約800名` が1位・`約10000名` が下位という並びだった
        （実測。この列は自由記述で、純粋な数値は79社中2社しかない）。 */
  const clientSideSort = params.sort === "disclosure" || params.sort === "employees";
  const useDbPagination = !params.hiring && !params.foreign && params.phase !== "外資系" && !clientSideSort && params.limit !== undefined;

  // ── フィルター条件を組み立てるヘルパー
  // #14: スペース区切りで AND 検索（例: "SaaS PM" → name.ilike.%SaaS% AND name.ilike.%PM%）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (params.q?.trim()) {
      const words = params.q.trim().split(/\s+/).filter(Boolean);
      for (const word of words) {
        // PostgREST injection 対策: .or() 文字列に埋め込む前にメタ文字を除去
        const safeWord = word.replace(/[(),"\\]/g, "");
        if (!safeWord) continue;
        const p = `%${safeWord}%`;
        /* ★**社名は「和名・英語名・ブランド名・slug」の4つで引く**（2026-08-20）。
           ⚠️ 和名（`name`）だけで引くと、**英語名で検索した人には見つからない**。
              このサイトの社名は「アドビ株式会社」「シスコシステムズ合同会社」のように
              カタカナで入っており、公開79社のうち **50社は英語名の綴りが `name` に無い**。
              実測: 「Cisco」で検索すると**シスコ本体は出ず、説明文に Cisco を含む競合2社だけ**が出た。
           ⚠️ 検索できる場所は3つある（ヘッダーのサジェスト / `/companies` の一覧 /
              企業ピッカー）。**3つとも同じ列を見ること。** 1つ直すと他が取り残される。 */
        q = q.or(
          `name.ilike.${p},name_en.ilike.${p},brand_name.ilike.${p},slug.ilike.${p},` +
          /* 読み仮名（2026-08-21）。カタカナで打たれたときに拾う。画面には出さない */
          `search_aliases.ilike.${p},` +
          `description.ilike.${p},industry.ilike.${p},tagline.ilike.${p}`
        );
      }
    }
    if (params.phase && params.phase !== "外資系") {
      const dbValues = PHASE_FILTER_MAP[params.phase] ?? [params.phase];
      q = q.in("phase", dbValues);
    }
    if (params.workStyle)  q = q.eq("remote_work_status", params.workStyle);
    if (params.location) {
      // branch_locations 配列にも対応（大阪府 → 大阪, 愛知県 → 名古屋|愛知 等）
      // PostgREST injection 対策: メタ文字を除去してからフィルター文字列に埋め込む
      const safeLocation = params.location.replace(/[(),"\\]/g, "");
      if (safeLocation) {
        const extraKeys = PREF_TO_BRANCH_KEYS[params.location];
        if (extraKeys) {
          // 既知の都道府県: PREF_TO_BRANCH_KEYS の値のみ使用（ユーザー入力を埋め込まない）
          const branchConds = extraKeys.map((k) => `branch_locations.cs.{"${k}"}`).join(",");
          q = q.or(`location.ilike.%${safeLocation}%,${branchConds}`);
        } else {
          // 未知の値: ilike のみ（branch_locations フィルターは使わない）
          q = q.ilike("location", `%${safeLocation}%`);
        }
      }
    }
    /* ⚠️ 事業領域での絞り込みは `applyFilters` の外で company_id を解決し、
          `domainCompanyIds` として渡す（下）。ここで `industry`(text) を見ない。 */
    if (domainCompanyIds) q = q.in("id", domainCompanyIds);
    return q;
  }

  /* ── 事業領域の絞り込み（2026-08-26。`industry`(text) から移行）─────────────
     ⚠️ **`?industry=` の値は事業領域の slug**（ai / infra / crm …）。
        事業領域の slug は旧 `INDUSTRY_GROUPS` の key と一致させてあるので、
        既存の被リンク・ブックマークはそのまま効く。それより前の旧 key だけ
        `resolveIndustryKey` で読み替える。
     ⚠️ **主だけでなく全部の事業領域に当てる。** 主だけで絞ると複数持てる意味が無い。
     ⚠️ 該当0社のときは `[]` ではなく **ダミーの id 1件**を渡す。空配列を `.in()` に
        渡すと PostgREST が「絞り込み無し」と解釈して**全件返す**（0件のはずが全件になる）。
     ⚠️ 結果を `.in("id", ...)` で **DB 側の条件**にするので、ページネーションは維持される。 */
  let domainCompanyIds: string[] | null = null;
  if (params.industry) {
    const slug = resolveIndustryKey(params.industry);
    const { data: domainRows, error: domainErr } = await supabase
      .from("ow_company_business_domains")
      .select("company_id, ow_business_domains!inner(slug)")
      .eq("ow_business_domains.slug", slug);
    if (domainErr) {
      // ⚠️ 握りつぶさない。空にすると「該当0社」と「取得失敗」が区別できない
      console.error("[getCompanies] 事業領域での絞り込みに失敗:", domainErr.message);
    }
    const ids = Array.from(new Set((domainRows ?? []).map((r) => r.company_id as string)));
    domainCompanyIds = ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
  }

  /* ── 対象業界（軸2）の絞り込み（2026-09-06 に求職者側へ出した）───────────────
     ⚠️★**事業領域（`?industry=`）とは別の軸。** あちらは「何を作っているか」、
        こちらは「誰に売っているか」。混ぜないこと。値は `ow_industries.slug`。
     ⚠️ **祖先展開しない。** 業種の祖先展開は**本人側**に掛ける規則で（CLAUDE.md）、
        企業の対象業界は展開しない。選んだ業種そのものだけに当てる。
     ⚠️ `ow_industries` は埋め込んでよい（`industry_id` は単純FK）。
        **`ow_companies` は埋め込めない** —— そちらは複合FKで PostgREST が解決できない。
     ⚠️ 事業領域と同時に指定されたら **積集合**にする（両方の条件を満たすものだけ）。 */
  let targetCompanyIds: string[] | null = null;
  if (params.targetIndustry) {
    const { data: targetRows, error: targetErr } = await supabase
      .from("ow_company_target_industries")
      .select("company_id, ow_industries!inner(slug)")
      .eq("ow_industries.slug", params.targetIndustry);
    if (targetErr) {
      // ⚠️ 握りつぶさない。空にすると「該当0社」と「取得失敗」が区別できない
      console.error("[getCompanies] 対象業界での絞り込みに失敗:", targetErr.message);
    }
    const ids = Array.from(new Set((targetRows ?? []).map((r) => r.company_id as string)));
    targetCompanyIds = ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
  }

  /* ⚠️ **空配列を `.in()` に渡さない。** PostgREST が「絞り込み無し」と解釈して全件返す。
        積が空になるときはダミーの id を1件入れる。 */
  if (targetCompanyIds) {
    domainCompanyIds = domainCompanyIds
      ? (domainCompanyIds.filter((id) => targetCompanyIds!.includes(id)).length > 0
          ? domainCompanyIds.filter((id) => targetCompanyIds!.includes(id))
          : ["00000000-0000-0000-0000-000000000000"])
      : targetCompanyIds;
  }

  // ── Step 1: データ取得 + 総件数を1クエリで同時取得（count: "exact"）
  // 旧: COUNT クエリ → await → DATA クエリ（2 hop）
  // 新: DATA クエリ + count: "exact" で1 hop に統合
  /* ⚠️ **`employee_count` で order しない**（2026-08-28 に外した）。text列なので
        辞書順になる。従業員数の並びは下のアプリ側ソートが担当する。
     ⚠️ ここが基準の並び（新着順）になり、**安定ソートなので同数のときはこの順が残る**。 */
  const orderCol = "updated_at";
  const orderAsc = false;

  let dataQuery = applyFilters(
    supabase
      .from("ow_companies")
      .select(
        "id, slug, name, name_en, tagline, industry, funding_stage:phase, employee_count, description, is_foreign, " +
        "accepting_casual_meetings, remote_work_status, location, branch_locations, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count, company_features, reality_disclosure",
        useDbPagination ? { count: "exact" } : undefined
      )
  );
  /* ⚠️ ディレクトリの絞り込みは lib/companies/visibility.ts の1本に寄せる。
        .eq("is_published", true) をここに直書きしない。 */
  dataQuery = filterListedCompanies(dataQuery).order(orderCol, { ascending: orderAsc });

  if (useDbPagination) {
    const offset = params.offset ?? 0;
    const limit  = params.limit!;
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const { data: rawCompanies, count: rawCount, error } = await dataQuery;
  if (error) throw error;
  let totalCount = rawCount ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyList: CompanyForCarousel[] = (rawCompanies ?? []) as any[];

  // ── Step 2: 求人件数 + 記事件数 + hiring フラグ（表示企業分のみ）
  const companyIds = companyList.map((c) => c.id);
  const hiringSet  = new Set<string>();
  const jobCountMap: Record<string, number> = {};
  const articleCountMap: Record<string, number> = {};

  // #2: 求人タイトルマップ（最大2件/企業）
  const jobTitlesMap: Record<string, string[]> = {};

  /* 事業領域（複数・主が1件）。⚠️ カードに出すのは**主の1件だけ**だが、
        絞り込みは**全部**に当てる（複数持てる意味が無くなるため）。 */
  const domainsMap: Record<string, CompanyBusinessDomain[]> = {};

  // ライブ社員数集計（案X）— is_test=false かつ visibility!='private'
  // current/obog の定義:
  //   現役 = is_current=true
  //   OB   = is_current=false かつ 同社で is_current=true を持たない
  const liveCurrentCountMap: Record<string, number> = {};
  const liveObogCountMap: Record<string, number> = {};

  if (companyIds.length > 0) {
    const [activeJobsResult, articlesResult, expResult, domainsResult] = await Promise.all([
      supabase
        .from("ow_jobs")
        .select("company_id, title, salary_min, salary_max")
        .in("company_id", companyIds)
        .eq("status", "published").eq("is_test", false),
      supabase
        .from("ow_articles")
        .select("company_id")
        .in("company_id", companyIds)
        .eq("is_published", true),
      // login_only ユーザーも集計に含めるため adminSupabase を使用（RLS バイパス）
      createAdminClient()
        .from("ow_experiences")
        .select("company_id, user_id, is_current, ow_users!inner(id, is_test, visibility)")
        .in("company_id", companyIds),
      /* 事業領域。⚠️ N+1 にしない（表示企業ぶんを1クエリで引く）。
            並び順は display_order（主が1番）なので、そのまま出せば主が先頭に来る。 */
      supabase
        .from("ow_company_business_domains")
        .select("company_id, is_primary, ow_business_domains(id, name, slug)")
        .in("company_id", companyIds)
        .order("display_order", { ascending: true }),
    ]);

    /* ⚠️ error を握りつぶさない。空で返すと「事業領域が未設定の企業」と
          「取得に失敗した」が区別できなくなる（カードのタグが黙って消える）。 */
    if (domainsResult.error) {
      console.error("[getCompanies] 事業領域の取得に失敗:", domainsResult.error.message);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (domainsResult.data ?? []) as any[]) {
      const d = row.ow_business_domains as { id: string; name: string; slug: string } | null;
      if (!d) continue;
      const cid = row.company_id as string;
      if (!domainsMap[cid]) domainsMap[cid] = [];
      domainsMap[cid].push({ id: d.id, name: d.name, slug: d.slug, is_primary: !!row.is_primary });
    }

    // 集計: 企業ごとに現役 user_id セット / OB候補 user_id セットを構築
    const currentSets  = new Map<string, Set<string>>();
    const alumniSets   = new Map<string, Set<string>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (expResult.data ?? []) as any[]) {
      const u = e.ow_users as { id: string; is_test: boolean | null; visibility: string | null } | null;
      if (!u || u.is_test === true || u.visibility === "private") continue;
      const cid = e.company_id as string;
      const uid = e.user_id as string;
      if (e.is_current) {
        if (!currentSets.has(cid)) currentSets.set(cid, new Set());
        currentSets.get(cid)!.add(uid);
      } else {
        if (!alumniSets.has(cid)) alumniSets.set(cid, new Set());
        alumniSets.get(cid)!.add(uid);
      }
    }
    companyIds.forEach((cid) => {
      const curr = currentSets.get(cid) ?? new Set<string>();
      const alum = alumniSets.get(cid) ?? new Set<string>();
      liveCurrentCountMap[cid] = curr.size;
      let obogCount = 0;
      alum.forEach((uid) => { if (!curr.has(uid)) obogCount++; });
      liveObogCountMap[cid] = obogCount;
    });

    // 企業ごとに求人中央値のリストを集める

    (activeJobsResult.data ?? []).forEach((j: { company_id: string; title?: string; salary_min?: number | null; salary_max?: number | null }) => {
      hiringSet.add(j.company_id);
      jobCountMap[j.company_id] = (jobCountMap[j.company_id] || 0) + 1;
      // #2: 最大2件のタイトルを記録
      if (j.title) {
        if (!jobTitlesMap[j.company_id]) jobTitlesMap[j.company_id] = [];
        if (jobTitlesMap[j.company_id].length < 2) {
          jobTitlesMap[j.company_id].push(j.title);
        }
      }
    });

    (articlesResult.data ?? []).forEach((a: { company_id: string | null }) => {
      if (a.company_id) {
        articleCountMap[a.company_id] = (articleCountMap[a.company_id] || 0) + 1;
      }
    });
  }

  // ── Step 3: アプリ側フィルタ（hiring のみ、DB ページネーション時は不要）
  const companies: CompanyForCarousel[] = companyList
    .filter((c) => {
      if (params.hiring && !hiringSet.has(c.id)) return false;
      return true;
    })
    .map((c) => ({
      ...(c as CompanyForCarousel),
      job_count: jobCountMap[c.id] || 0,
      article_count: articleCountMap[c.id] || 0,
      business_domains: domainsMap[c.id] ?? [],
      // #2 求人タイトル / #3 カルチャータグ
      top_job_titles: jobTitlesMap[c.id] || [],
      company_features: Array.isArray((c as CompanyForCarousel).company_features)
        ? (c as CompanyForCarousel).company_features
        : [],
      // 案X: ライブ集計値（静的カラムを廃止し、これを正値とする）
      live_current_count: liveCurrentCountMap[c.id] ?? 0,
      live_obog_count: liveObogCountMap[c.id] ?? 0,
    }));

  // client-side: 外資系フィルター（is_foreign カラムを使用）
  let filteredCompanies = companies;
  if (params.foreign || params.phase === "外資系") {
    filteredCompanies = filteredCompanies.filter((c) => {
      return (c as { is_foreign?: boolean }).is_foreign === true;
    });
    totalCount = filteredCompanies.length;
  }

  /* client-side ソート（salary / disclosure）
     ⚠️ "jobs"（募集中あり優先）は 2026-08-18 に廃止した。「募集あり」フィルタと同じ用途。
        知らない値は下の分岐に入らず、DB 側の既定（updated_at 降順）のまま返る。 */
  /* ⚠️ 「年収高い順」（sort === "salary"）は 2026-08-25 に外した。**戻さないこと。**
        年収はポジションによって違うので、会社単位の1つの数字では表せない。
        実データでも、求人に年収が入っている企業は 79社中**1社**しかなく、
        残り78社は 0 として並ぶだけだった。あわせて `?salaryMin=` の絞り込みと、
        その裏で走っていた求人年収の集計（calc_avg_salary_man）も削除した。
     ⚠️ 旧 URL の `?sort=salary` / `?salaryMin=` は無視され、既定に落ちる。壊れない。 */
  /* ── 社員数順 ────────────────────────────────────────────────────────────────
     ⚠️ **`employee_count` は自由記述の text**。`parseEmployeeCount` で数値を取り出して
        並べる（括弧の中は捨て、最初の数字を採る。規則は employeeCount.ts）。
     ⚠️ **第2キーは置いていない。** `Array.prototype.sort` は安定なので、同数のときは
        前段のDB順（`updated_at DESC` ＝新着順）がそのまま残る。
        実測（2026-08-28 / 公開79社）: 異なる数値は33種類しかなく、
        **同数のグループが11組（最大12社）**あるので、ここの挙動は実際に効く。
        ⚠️ 名前順など別のキーにしたくなったら、ここに1行足す。
           `updated_at` は企業情報を1つ直すたびに動くので、同数内の順序も動く。
     ⚠️ **数値が取れない企業は末尾へ**（-1）。0 として扱うと「0名の会社」に見える。 */
  if (params.sort === "employees") {
    filteredCompanies = [...filteredCompanies].sort(
      (a, b) =>
        (parseEmployeeCount(b.employee_count) ?? -1) -
        (parseEmployeeCount(a.employee_count) ?? -1),
    );
  }

  if (params.sort === "disclosure") {
    /* ⚠️ **これは `/companies` の並び替え専用のスコア。**
          `lib/utils/disclosureScore.ts` の `calcDisclosureScore`（95点満点・
          /biz/dashboard と /biz/company 用）とは**別物**。名前が似ているので混同しないこと。
       ⚠️ `avg_salary` の +2 は 2026-08-11 に外した。出典の無い機械投入値が
          68社すべてに入っており、全社が一律に +2 を得ていて差がつかなかったうえ、
          「開示が充実している」という意味づけの根拠が無かった。 */
    const disclosureScore = (c: CompanyForCarousel) => {
      let score = 0;
      if ((c.article_count ?? 0) > 0) score += 3;
      if ((c.job_count ?? 0) > 0) score += 1;
      if (Array.isArray(c.company_features) && c.company_features.length > 0) score += 1;
      if ((c.live_current_count ?? c.current_member_count ?? 0) > 0) score += 2;
      if ((c.live_obog_count ?? c.obog_count ?? 0) > 0) score += 1;
      return score;
    };
    filteredCompanies = [...filteredCompanies].sort((a, b) => disclosureScore(b) - disclosureScore(a));
  }

  return {
    companies: filteredCompanies,
    totalCount: useDbPagination ? totalCount : filteredCompanies.length,
    appliedFilters: params,
  };
}

/* ⚠️ ここにあった「業種一覧取得（フィルタ選択肢用）」の JSDoc は、
      対応する関数が既に削除されており**コメントだけが残っていた**（2026-08-11 削除）。
      業種フィルタの選択肢は DB の distinct ではなく
      `src/lib/search/industryGroups.ts` の INDUSTRY_GROUPS にハードコードされている。
      DB の industry を変えるときは、そちらも必ず同時に直すこと。 */

// branch_locations の値（都道府県サフィックスなし）→ 正式な都道府県名 マッピング
const BRANCH_TO_PREF: Record<string, string> = {
  "大阪": "大阪府", "京都": "京都府", "兵庫": "兵庫県",
  "神奈川": "神奈川県", "埼玉": "埼玉県", "千葉": "千葉県",
  "広島": "広島県", "福岡": "福岡県", "宮城": "宮城県",
  "北海道": "北海道", "名古屋": "愛知県", "愛知": "愛知県",
};

/**
 * 都道府県名 → `branch_locations` で使われるキー群（複数ありうる）。
 *
 * ⚠️★**手で書かない。`BRANCH_TO_PREF` から導出する**（2026-09-06）。
 *    それまで手書きで **`愛知県` の1件しか無かった**ため、
 *    「支社があるから選択肢には出るが、選ぶと必ず0件」という空振りが
 *    **8つの選択肢のうち5つ**で起きていた（福岡県・埼玉県・神奈川県・京都府・広島県）。
 *    選択肢を作るのは `BRANCH_TO_PREF`、絞り込むのはこちら、と
 *    **逆向きの対応表が2つあって同期していなかった**のが原因。
 *    → 片方から作れば、`BRANCH_TO_PREF` に足すだけで両方に効く。
 */
const PREF_TO_BRANCH_KEYS: Record<string, string[]> = Object.entries(BRANCH_TO_PREF).reduce(
  (acc, [branchKey, pref]) => {
    (acc[pref] ??= []).push(branchKey);
    return acc;
  },
  {} as Record<string, string[]>,
);

/* ⚠️★**`fetchAvailablePhases` は削除した**（2026-09-06）。
      フェーズの選択肢を「実データにある段だけ」から**マスタ全件**に変えたので、
      DB を引く必要がなくなった。選択肢は lib/constants/phase.ts の `PHASE_OPTIONS`。
      ⚠️ 経緯: 2026-08-08 に「0件の選択肢を出さない」ために作った関数だが、
         フェーズは**段階の梯子**なので歯抜けだと不自然だった
         （シリーズB と シリーズD以降 はあるのに シード・A・C が無い、という並び）。
         都道府県と同じ扱いにした。詳しくは phase.ts のコメント。 */


/* ⚠️★**`fetchDistinctLocations` は削除した**（2026-09-06）。
      都道府県の選択肢を「実データにあるものだけ」から**47件固定**に変えたので、
      DB を引く必要がなくなった（選択肢は lib/utils/location.ts）。
      ⚠️ `BRANCH_TO_PREF` は**残す。絞り込み側（PREF_TO_BRANCH_KEYS）が使う。**
         支社しかない県（福岡・広島など）を選んだときに拾うのはこの表。 */

/**
 * 掲載中の企業に**実際に設定されている**対象業界（軸2）だけを返す — 5分間キャッシュ。
 *
 * ⚠️ 0件の選択肢を出さない（「0件でも出す」例外は都道府県とフェーズだけ。CLAUDE.md）。
 * ⚠️★**`ow_companies` を埋め込まないこと。** `ow_company_target_industries` から
 *    `ow_companies` への FK は**複合FK**で、PostgREST は関係を解決できない
 *    （`Could not find a relationship ...`）。2段に分けて `.in()` で引く。
 *    `ow_industries` 側は単純FKなので埋め込んでよい。
 * ⚠️ 並びは業種マスタの `display_order`。**件数順にしない**（親子の順序が崩れる）。
 */
export const fetchAvailableTargetIndustries = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const supabase = createPublicClient();

    // ① 掲載中の企業だけに絞るため、まず対象の company_id を取る
    const { data: listed, error: listedErr } = await filterListedCompanies(
      supabase.from("ow_companies").select("id")
    );
    if (listedErr) {
      console.error("[fetchAvailableTargetIndustries] 企業の取得に失敗:", listedErr.message);
      return [];
    }
    const listedIds = new Set((listed ?? []).map((r) => r.id as string));
    if (listedIds.size === 0) return [];

    // ② 明細 → 業種（ここは単純FKなので埋め込める）
    const { data: rows, error } = await supabase
      .from("ow_company_target_industries")
      .select("company_id, ow_industries!inner(slug, name, display_order, is_active)");
    if (error) {
      console.error("[fetchAvailableTargetIndustries]", error.message);
      return [];
    }

    const seen = new Map<string, { slug: string; name: string; order: number }>();
    for (const r of (rows ?? []) as any[]) {
      if (!listedIds.has(r.company_id)) continue;
      const i = r.ow_industries as { slug: string; name: string; display_order: number; is_active: boolean } | null;
      if (!i || !i.is_active) continue;
      if (!seen.has(i.slug)) seen.set(i.slug, { slug: i.slug, name: i.name, order: i.display_order ?? 0 });
    }
    return Array.from(seen.values())
      .sort((a, b) => a.order - b.order)
      .map(({ slug, name }) => ({ slug, name }));
  },
  ["available-target-industries"],
  { revalidate: 300 }
);

/**
 * 検索サジェスト用の企業名リスト（id + name）— 5分間キャッシュ。
 *
 * ⚠️ **`/companies` の毎リクエストで全公開企業を引いていた**（2026-08-23 まで）。
 *    検索窓の候補に出すだけで、**訪問者ごとに変わらない**。
 *    `createPublicClient()` は anon キーでセッションを持たないので、
 *    誰が見ても同じ結果になる＝キャッシュしてよい。
 */
export const fetchCompanySuggestions = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const supabase = createPublicClient();
    const { data, error } = await filterListedCompanies(
      supabase.from("ow_companies").select("id, name")
    ).order("name");
    /* ⚠️ error を握り潰さない（CLAUDE.md）。0件と失敗を区別できなくなる */
    if (error) console.error("[fetchCompanySuggestions]", error.message);
    return (data ?? []) as { id: string; name: string }[];
  },
  ["company-suggestions"],
  { revalidate: 300 }
);

/* ⚠️★**「現役社員」プレビューの取得は 2026-08-28 に削除した。復活させないこと。**
 *
 * `createPublicClient()`（anon）で `ow_experiences` を引いていたが、実ユーザーは
 * 全員 `visibility = 'login_only'` なので **RLS が全行を落とし、常に `{}` を返していた**
 * （実測: anon 200/0行 ／ admin 13行。401 でも 42501 でもないので GRANT ではなく RLS）。
 * `/companies` のカードのメンバーアバターは **79社すべてで一度も表示されていない。**
 *
 * ⚠️ **`api/companies/batch/route.ts` では 2026-08-20 に同じ理由で削除済み**だった。
 *    一覧側が取り残しになっていた。
 *
 * ⚠️ **`createAdminClient()` に変えて復活させないこと。** RLS を外すことになり、
 *    `login_only` の氏名と顔写真が未ログインに配られる
 *    （`f9d6d051` で `/companies/[id]` を直したのと同じ事故になる）。
 *    出すなら**件数だけをサーバー、人物はクライアント**（詳細ページと同じ形）。
 */


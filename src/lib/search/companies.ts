import { keepJobsAtRespondingCompanies } from "@/lib/jobs/respondingJobs";
import { PUBLIC_JOB_MATCH } from "@/lib/jobs/publicJobs";
// src/lib/search/companies.ts
import { resolveIndustryKey } from "./industryGroups";
import { isRegisteredUser } from "@/lib/users/registered";
import { COMPANY_SIZE_GROUPS, employeeBandRank, sizeGroupOfBand, type CompanySizeGroup } from "@/lib/constants/employeeBand";
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
import { inChunks } from "@/lib/supabase/paging";
import type { CompanyForCarousel, CompanyBusinessDomain } from "@/types/genre";
import { PHASE_FILTER_MAP } from "@/lib/constants/phase";
import { isCompanyStage } from "@/lib/companies/classification";
import { filterListedCompanies, filterVisibleCompaniesStrict } from "@/lib/companies/visibility";
import { normalizeCompanyName } from "@/lib/companies/normalizeName";
import { splitMulti } from "@/lib/search/companyListParams";
import { PREFECTURES } from "@/lib/utils/location";

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
  foreign?: boolean;   // 外資系のみ表示（2026-10-12 から capital_type = foreign_subsidiary）
  /** ★業種（2026-10-12 / `?ind=`）。値は `ow_industries.slug`。大分類なら小分類と**大分類だけの会社**も含む（提案A） */
  ind?: string;
  /** ★事業ステージ（2026-10-12 / `?stage=`）。値は COMPANY_STAGES の value */
  stage?: string;
  /** ★会社規模（2026-10-10）。4つのまとまり（`COMPANY_SIZE_GROUPS`）。帯が空の企業は当たらない。
   *  ★2026-10-29 から複数選択（カンマ区切り）。業種・事業・都道府県・事業ステージも同じ */
  size?: string;
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
/**
 * ★業種の絞り込みで当てる industry_id（2026-10-12 / `?ind=`）。**一覧と検証用の会社の欄が同じ関数を通る。**
 *   大分類なら、その小分類と大分類そのもの（＝大分類だけの会社も当たる。提案A）。小分類ならそれだけ。
 * ⚠️ 公開側なので有効な業種だけ。解決できなければ空配列（＝該当0。呼び出し側はダミー id で .in() する）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveIndustryFilterIds(db: any, slug: string): Promise<string[]> {
  const { data: ind, error: indErr } = await db.from("ow_industries").select("id, parent_id").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (indErr) console.error("[resolveIndustryFilterIds] 業種の解決に失敗:", indErr.message);
  if (!ind) return [];
  const ids = [ind.id as string];
  if (!ind.parent_id) {
    const { data: kids, error: kidErr } = await db.from("ow_industries").select("id").eq("parent_id", ind.id).eq("is_active", true);
    if (kidErr) console.error("[resolveIndustryFilterIds] 小分類の取得に失敗:", kidErr.message);
    ids.push(...((kids ?? []) as { id: string }[]).map((k) => k.id));
  }
  return ids;
}

/**
 * ★事業（`?industry=`）で当たる会社の id（主以外も当たる）。**一覧と検証用の会社の欄が同じ関数を通る。**
 * ⚠️ 旧 key は resolveIndustryKey で読み替える。⚠️ 公開側なので有効な事業だけ。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveDomainCompanyIds(db: any, industryParam: string): Promise<string[]> {
  const slug = resolveIndustryKey(industryParam);
  const { data, error } = await db
    .from("ow_company_business_domains")
    .select("company_id, ow_business_domains!inner(slug, is_active)")
    .eq("ow_business_domains.slug", slug)
    .eq("ow_business_domains.is_active", true);
  if (error) console.error("[resolveDomainCompanyIds] 事業での絞り込みに失敗:", error.message);
  return Array.from(new Set(((data ?? []) as { company_id: string }[]).map((r) => r.company_id)));
}

export async function searchCompanies(
  params: CompanySearchParams
): Promise<CompanySearchResult> {
  const supabase = createPublicClient();

  // ── DB側ページネーションを使うか判定
  // クライアントソート・キーワードはアプリ側で並べるため、DB ページネーションと併用不可
  /* ⚠️ **アプリ側で並べるものはここに列挙する。** 列挙するとDB側ページネーションが
        無効になり（下の useDbPagination）、全件取ってから並べてページを切る。
     ⚠️ `employees` を足した（2026-08-28）。**DB側の `employee_count DESC` は
        text列の辞書順**で、`約800名` が1位・`約10000名` が下位という並びだった
        （実測。この列は自由記述で、純粋な数値は79社中2社しかない）。 */
  const clientSideSort = params.sort === "disclosure" || params.sort === "employees";
  /* ★★キーワード検索は**社名で当たったものを先に**出す（2026-10-01 / 柴さんの指摘）。
        実測: 「Salesforce」で **WalkMe が先頭・セールスフォースが2番目**だった。
        WalkMe / 富士フイルム / nCino は**説明文**に Salesforce を含むだけ。
     ⚠️ PostgREST では「どの列で当たったか」で並べられないので、
        **既存の「アプリ側で並べるもの」の仕組みに乗せる**（DB 側 range を切る）。
     ⚠️ 全件取ることになるが、キーワード検索の母数は小さい
        （実測: `?q=Salesforce` 4件 / いちばん広い `?q=株式会社` でも85件）。 */
  const keywordSort = !!params.q?.trim();
  /* ⚠️ 募集あり・外資系は 2026-10-09 から DB 側の条件なので、ここには入れない */
  const useDbPagination = !clientSideSort && !keywordSort && params.limit !== undefined;

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
        /* ★正規化どうしの突き合わせ（2026-10-01）。ひらがな・半角カナ・全角ラテン・
              中黒なしを吸収する。⚠️ 空になる語（「株式会社」など）では足さない
              —— `%%` になって全件に当たる。規則は `normalize_company_name()` の1本。 */
        const nk = normalizeCompanyName(safeWord);
        const normCond = nk ? `search_key.ilike.%${nk.replace(/[(),"\\]/g, "")}%,` : "";
        q = q.or(
          `name.ilike.${p},name_en.ilike.${p},brand_name.ilike.${p},slug.ilike.${p},` +
          /* 読み仮名（2026-08-21）。カタカナで打たれたときに拾う。画面には出さない */
          `search_aliases.ilike.${p},` + normCond +
          `description.ilike.${p},industry.ilike.${p},tagline.ilike.${p}`
        );
      }
    }
    if (params.phase) {
      const dbValues = PHASE_FILTER_MAP[params.phase] ?? [params.phase];
      q = q.in("phase", dbValues);
    }
    /* ★会社規模（2026-10-10）。⚠️ まとまり→帯は `COMPANY_SIZE_GROUPS` の1か所。ここに帯を書かない
          ★複数選択（2026-10-29）: 選んだまとまりの帯をすべて当てる（OR） */
    if (params.size) {
      const bands = splitMulti(params.size).flatMap((v) => [...(COMPANY_SIZE_GROUPS.find((x) => x.value === v)?.bands ?? [])]);
      if (bands.length > 0) q = q.in("employee_count_band", bands);
    }
    if (params.workStyle)  q = q.eq("remote_work_status", params.workStyle);
    if (params.location) {
      // branch_locations 配列にも対応（大阪府 → 大阪, 愛知県 → 名古屋|愛知 等）
      // PostgREST injection 対策: メタ文字を除去してからフィルター文字列に埋め込む
      /* ★複数選択（2026-10-29）: 選んだ都道府県のどれかに当たれば出す（OR）。条件を1本の .or() にまとめる */
      const conds: string[] = [];
      for (const loc of splitMulti(params.location)) {
        const safeLocation = loc.replace(/[(),"\\]/g, "");
        if (!safeLocation) continue;
        conds.push(`location.ilike.%${safeLocation}%`);
        // 既知の都道府県: PREF_TO_BRANCH_KEYS の値のみ使用（ユーザー入力を埋め込まない）
        for (const k of PREF_TO_BRANCH_KEYS[loc] ?? []) conds.push(`branch_locations.cs.{"${k}"}`);
      }
      if (conds.length > 0) q = q.or(conds.join(","));
    }
    /* ⚠️ 事業領域での絞り込みは `applyFilters` の外で company_id を解決し、
          `domainCompanyIds` として渡す（下）。ここで `industry`(text) を見ない。 */
    if (domainCompanyIds) q = q.in("id", domainCompanyIds);
    /* ★外資系（2026-10-12 から `capital_type` が正。判断 #20・提案C。is_foreign は読まない） */
    if (params.foreign) q = q.eq("capital_type", "foreign_subsidiary");
    /* ★業種（2026-10-12）。⚠️ 空配列を .in() に渡さない（全件になる）。解決できなければダミー */
    if (industryIds) q = q.in("industry_id", industryIds.length > 0 ? industryIds : ["00000000-0000-0000-0000-000000000000"]);
    /* ★事業ステージ（2026-10-12）。⚠️ 旧 `?phase=` はそのまま効く（被リンクのため） */
    /* ★複数選択（2026-10-29）: 知らない値は落とし、残りのどれかに当たれば出す */
    if (params.stage) {
      const stages = splitMulti(params.stage).filter(isCompanyStage);
      if (stages.length > 0) q = q.in("company_stage", stages);
    }
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

  /* ── 業種（`?ind=`。2026-10-12）────────────────────────────────────────────
     ⚠️ 大分類を選んだら、その小分類の会社と**大分類だけの会社**（まだ小分類が付いていない会社）も出す（提案A）。
     ⚠️ 公開側なので有効な業種だけ（RLS でも anon には有効な行しか見えない）。 */
  /* ★複数選択（2026-10-29）: 選んだ業種それぞれの id をまとめる（OR） */
  const industryIds: string[] | null = params.ind
    ? Array.from(new Set((await Promise.all(splitMulti(params.ind).map((s) => resolveIndustryFilterIds(supabase, s)))).flat()))
    : null;

  if (params.industry) {
    /* ★複数選択（2026-10-29）: 選んだ事業のどれかを持つ会社（OR） */
    const ids = Array.from(new Set((await Promise.all(splitMulti(params.industry).map((s) => resolveDomainCompanyIds(supabase, s)))).flat()));
    domainCompanyIds = ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
  }

  /* ── 顧客の業界（軸2）の絞り込み（`?target=`。2026-09-06 に求職者側へ出した）────
     ⚠️★**事業領域（`?industry=`）とは別の軸。** あちらは「何を作っているか」、
        こちらは「誰に売っているか」。混ぜないこと。値は `ow_industries.slug`。
     ★2026-10-18 から読むのは「主なお客さまの業界」（`ow_company_customer_industries`。企業と運営が入力する）。
        旧「対象業界」（`ow_company_target_industries`）は読まない。
     ⚠️ 新しい表は**大分類だけ**を持つ。小分類の slug（旧表の `construction` など。被リンク・ブックマークに残る）は
        `resolveCustomerIndustryId` で大分類に読み替える。
     ⚠️ 「業界を問わない」会社の「とくに多い業界」も当てる（企業ページの「お客さまの業界」と揃える）。
     ⚠️ 事業領域と同時に指定されたら **積集合**にする（両方の条件を満たすものだけ）。 */
  let targetCompanyIds: string[] | null = null;
  if (params.targetIndustry) {
    const targetId = await resolveCustomerIndustryId(supabase, params.targetIndustry);
    let ids: string[] = [];
    if (targetId) {
      const { data: targetRows, error: targetErr } = await supabase
        .from("ow_company_customer_industries")
        .select("company_id")
        .eq("industry_id", targetId);
      if (targetErr) {
        // ⚠️ 握りつぶさない。空にすると「該当0社」と「取得失敗」が区別できない
        console.error("[getCompanies] 顧客の業界での絞り込みに失敗:", targetErr.message);
      }
      ids = Array.from(new Set((targetRows ?? []).map((r) => r.company_id as string)));
    }
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

  /* ── 募集あり（`?hiring=1`）を DB 側の条件にする（2026-10-09）────────────────
     ⚠️ それまでは全件を取ってからアプリ側で落としており、**その間は DB 側のページ分けが
        効かなかった**（docs/list-filters-20261009.md）。公開求人を持つ企業の id を先に引き、
        事業領域・対象業界と同じ `.in("id", …)` に積集合で足す。
     ⚠️ 求人の条件は `PUBLIC_JOB_MATCH`（下のカードの「募集中 N件」と同じ）。書き写さないこと。
     ⚠️★取得に失敗したら投げる。空として扱うと「募集あり 0社」と出る（0 は事実と違う）。 */
  if (params.hiring) {
    const { data: jobRows, error: jobErr } = await supabase
      .from("ow_jobs")
      .select("company_id")
      .match(PUBLIC_JOB_MATCH);
    if (jobErr) throw jobErr;
    /* ★担当者がいない会社は「募集あり」に入れない（2026-10-27。lib/jobs/respondingJobs.ts） */
    const hiringIds = Array.from(new Set((await keepJobsAtRespondingCompanies(jobRows ?? [], "searchCompanies hiring")).map((r) => r.company_id as string)));
    const base = domainCompanyIds ? domainCompanyIds.filter((id) => hiringIds.includes(id)) : hiringIds;
    domainCompanyIds = base.length > 0 ? base : ["00000000-0000-0000-0000-000000000000"];
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
        "id, slug, name, name_en, tagline, industry, funding_stage:phase, employee_count, employee_count_band, employee_count_as_of, description, is_foreign, " +
        "accepting_casual_meetings, remote_work_status, location, branch_locations, logo_letter, logo_gradient, logo_url, updated_at, " +
        "current_member_count, obog_count, company_features, reality_disclosure",
        useDbPagination ? { count: "exact" } : undefined
      )
  );
  /* ⚠️ ディレクトリの絞り込みは lib/companies/visibility.ts の1本に寄せる。
        .eq("is_published", true) をここに直書きしない。 */
  /* ★**第2キー（`id`）を必ず付ける**（2026-09-07）。`updated_at` だけでは順序が確定せず、
        `.range()` の offset ページングと組み合わさると**同じ企業が2ページに出て、別の企業が
        1ページも出なくなる。**
     ⚠️ これは理屈の話ではなく実測。掲載83社のうち **79社が同一 `updated_at` のグループ**に
        属しており（8グループ・最大21社）、**ページ境界（40件目/41件目）がそのグループの内側**にある。
        修正前の実測: 3ページの合計83枚に対しユニークは **79社** ——
        adobe / indeed / palantir / workday が重複し、
        **braze / clickhouse / okta / qualcomm は一覧に一度も出てこなかった。**
     ⚠️ `id` は uuid なので値の並びに意味は無い。**意味を持たせないこと**が目的で、
        「同値のときに毎回同じ順になる」ことだけを担保している。
     ⚠️ アプリ側ソート（`employees` / `disclosure`）にも効く。`Array.prototype.sort` は
        安定なので、**同値の並びは前段のこのDB順がそのまま残る**。ここが不定だと
        JS 側が安定でも結果は毎回変わる。 */
  /* ★★キーワードがあるときだけ、ディレクトリの軸を外す（2026-10-01 / 柴さんの指示）。
        「一覧には出てこないけど、検索には出てきてほしい」。
     ── 何が変わるか ────────────────────────────────────────────────────────
     ・絞り込みだけ（`?industry=` など。`q` なし）… これまでどおり**掲載中だけ**
     ・キーワードあり（`?q=`）                    … **ページが開ける企業すべて**

     ⚠️★`filterVisibleCompaniesStrict`（`is_published` ＋ `is_test`）に広げる。
        **マスタ全部にはしない。** 検索結果はカードからリンクするので、
        `is_published = false` を混ぜると**404 へのリンクを自分で作る**ことになる。
     ⚠️★これは「中身の無いページを自分から知らせない」（sitemap・フッター・LP）とは
        別。あちらは**こちらから出す**話で、検索は**探しに来た人に答える**話。
        **sitemap・LP・フッター・チップの母集団は掲載中のまま。広げないこと。**
     ⚠️ 掲載中を先に出す（`listing_status` は draft=1 / listed=2 なので降順）。
        これが無いと、新着順の既定で**今日足した非掲載企業が常に先頭に来る。** */
  const hasKeyword = !!params.q?.trim();
  dataQuery = (hasKeyword ? filterVisibleCompaniesStrict(dataQuery) : filterListedCompanies(dataQuery));
  if (hasKeyword) dataQuery = dataQuery.order("listing_status", { ascending: false });
  dataQuery = dataQuery
    .order(orderCol, { ascending: orderAsc })
    .order("id", { ascending: false });

  if (useDbPagination) {
    const offset = params.offset ?? 0;
    const limit  = params.limit!;
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const { data: rawCompanies, count: rawCount, error } = await dataQuery;
  if (error) throw error;
  const totalCount = rawCount ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companyList: CompanyForCarousel[] = (rawCompanies ?? []) as any[];

  // ── Step 2: 求人件数 + 記事件数（表示企業分のみ）
  const companyIds = companyList.map((c) => c.id);
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
    /* ★会社の数・社員の数が増えても黙って切れないよう、会社 id を分けて 1,000 行ずつ最後まで引く（2026-10-19）。
          形は supabase-js と同じ { data, error: { message } } にそろえる（下の処理を変えないため） */
    const asRes = <T,>(r: { data: T[]; error: string | null }) => ({ data: r.data, error: r.error ? { message: r.error } : null });
    const admin = createAdminClient();
    const [activeJobsResult, articlesResult, expResult, hiddenResult, domainsResult] = await Promise.all([
      inChunks(companyIds, (part, from, to) => supabase
        .from("ow_jobs")
        .select("id, company_id, title, salary_min, salary_max")
        .in("company_id", part)
        .match(PUBLIC_JOB_MATCH)
        .order("id").range(from, to), "companies jobs").then(asRes),
      inChunks(companyIds, (part, from, to) => supabase
        .from("ow_articles")
        .select("id, company_id")
        .in("company_id", part)
        .eq("is_published", true)
        .order("id").range(from, to), "companies articles").then(asRes),
      // login_only ユーザーも集計に含めるため adminSupabase を使用（RLS バイパス）
      /* ⚠️★`id`（経歴の id）を落とさないこと（2026-09-18 に追加）。
            下で `ow_company_hidden_experiences` と突き合わせるのに要る。 */
      inChunks(companyIds, (part, from, to) => admin
        .from("ow_experiences")
        .select("id, company_id, user_id, is_current, ow_users!inner(id, auth_id, is_test, visibility)")
        .in("company_id", part)
        .order("id").range(from, to), "companies experiences").then(asRes),
      /* ★運営が企業ページから外した経歴（2026-09-18 に追加）。
         ⚠️★**これを見ないと、企業ページから外した人がカードの「現役社員 N名」に
            残り続ける。** */
      inChunks(companyIds, (part, from, to) => admin
        .from("ow_company_hidden_experiences")
        .select("experience_id")
        .in("company_id", part)
        .order("experience_id").range(from, to), "companies hidden").then(asRes),
      /* 事業領域。⚠️ N+1 にしない（表示企業ぶんを1クエリで引く）。
            並び順は display_order（主が1番）。⚠️ 分けて引くので、下で会社ごとに display_order で並べ直す */
      inChunks(companyIds, (part, from, to) => supabase
        .from("ow_company_business_domains")
        .select("company_id, is_primary, display_order, ow_business_domains(id, name, slug)")
        .in("company_id", part)
        .order("display_order", { ascending: true }).order("company_id").range(from, to), "companies domains")
        .then((r) => asRes({ ...r, data: [...r.data].sort((a, b) => ((a.display_order as number) ?? 0) - ((b.display_order as number) ?? 0)) })),
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

    /* ⚠️ 握り潰さない。取得に失敗したら「非表示は0件」として数えることになり、
          外したはずの人が人数に戻る。 */
    if (hiddenResult.error) {
      console.error("[getCompanies] 非表示経歴の取得に失敗:", hiddenResult.error.message);
    }
    const hiddenExperienceIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((hiddenResult.data ?? []) as any[]).map((r) => r.experience_id as string),
    );

    // 集計: 企業ごとに現役 user_id セット / OB候補 user_id セットを構築
    const currentSets  = new Map<string, Set<string>>();
    const alumniSets   = new Map<string, Set<string>>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (expResult.data ?? []) as any[]) {
      const u = e.ow_users as { id: string; auth_id: string | null; is_test: boolean | null; visibility: string | null } | null;
      if (!u || u.is_test === true || u.visibility === "private") continue;
      /* ★運営が外した経歴は数えない。⚠️ 人単位ではなく**経歴単位**で外す
            （同じ人が同じ会社に複数の在籍期間を持つことがある）。 */
      if (hiddenExperienceIds.has(e.id as string)) continue;
      /* ★本人が登録していない行（auth_id IS NULL）は人数に数えない。
            ⚠️ 「現役社員 N名」は OPINIO が外向きに言う数字なので、
               氏名が出ないカードでも母集合を一覧と揃える。理由は lib/users/registered.ts。 */
      if (!isRegisteredUser(u)) continue;
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

    /* ★担当者がいない会社の求人は「募集中 N件」に数えない（2026-10-27。lib/jobs/respondingJobs.ts） */
    const visibleActiveJobs = await keepJobsAtRespondingCompanies(
      (activeJobsResult.data ?? []) as { company_id: string; title?: string; salary_min?: number | null; salary_max?: number | null }[],
      "searchCompanies jobs",
    );
    visibleActiveJobs.forEach((j: { company_id: string; title?: string; salary_min?: number | null; salary_max?: number | null }) => {
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

  // ── Step 3: カードに出す値を付ける（⚠️ 募集ありの絞り込みは 2026-10-09 から DB 側）
  const companies: CompanyForCarousel[] = companyList
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

  /* ⚠️ 外資系の絞り込みは 2026-10-09 から `applyFilters` の中（DB 側）。
     ⚠️★**「外資系」はフェーズではない。** `phase` に入る値は `lib/constants/phase.ts` の
        英字スラッグだけ。**フェーズの語彙に「外資系」を足さないこと**（資本区分は `capital_type`）。 */
  let filteredCompanies = companies;

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
     ⚠️ 2026-10-10 まで自由記述の `employee_count` から数を取り出して並べていた（同数のグループが
        11組あり、帯の中の順序は画面から説明できなかった）。いまは帯の順だけで並べる。 */
  /* ★2026-10-10 から**帯の順**で並べる（`employeeBandRank`）。画面に出ているのが帯なので、
        並び順の根拠も帯に揃えた。帯の中の順序は前段の順（新着順）のまま。帯が無い企業は末尾。 */
  if (params.sort === "employees") {
    filteredCompanies = [...filteredCompanies].sort(
      (a, b) => employeeBandRank(b.employee_count_band) - employeeBandRank(a.employee_count_band),
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

  /* ★★社名で当たったものを先に出す（2026-10-01）。
        ⚠️ **いちばん最後に掛ける。** `Array.prototype.sort` は安定なので、
           同じ段の中では前段の並び（新着順・開示順など）がそのまま残る。
        ⚠️ 段は2つだけ。① 社名系で一致 ② それ以外（説明文・タグライン・industry）。
           **掲載の有無は段にしない** —— 掲載中を先に出すのは DB 側の
           `listing_status` 降順が既にやっている（同じ段の中で保たれる）。
        ⚠️ 判定は「打った語のどれか1つでも社名系に当たるか」。AND 検索なので
           全語が当たる必要は無い（「Salesforce 営業」で社名に営業は無い）。 */
  if (keywordSort) {
    const words = params.q!.trim().split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
    const nameHit = (c: CompanyForCarousel) => {
      const hay = [c.name, (c as { name_en?: string }).name_en, (c as { brand_name?: string }).brand_name,
                   c.slug, (c as { search_aliases?: string }).search_aliases]
        .filter(Boolean).join(" ").toLowerCase();
      const normHay = normalizeCompanyName(hay) ?? "";
      return words.some((w) => {
        if (hay.includes(w)) return true;
        const nw = normalizeCompanyName(w);
        return !!nw && normHay.includes(nw);
      }) ? 0 : 1;
    };
    /* ★段分け（「社名で一致」／「説明にこの語を含む」）のために印を残す。
          ⚠️ 描画側が同じ判定をやり直さないため。書き写すと必ず割れる。 */
    filteredCompanies = filteredCompanies.map((c) => ({ ...c, nameMatch: nameHit(c) === 0 }));
    filteredCompanies = [...filteredCompanies].sort((a, b) => nameHit(a) - nameHit(b));
  }

  /* ★**DB 側で range を掛けなかった経路は、ここでページを切る**（2026-09-07）。
        `useDbPagination` が false のとき（`hiring` / `foreign` / アプリ側ソート）は
        **全件が入ったまま返っていた。** 呼び出し側（`companies/(list)/page.tsx`）は
        戻り値をそのまま描くので、**3ページとも同じ83社が出ていた**（実測: 各ページ83枚）。
     ⚠️ 欠落は起きない（全件持っているので）が、**ページ送りが無意味**になっていた。
        重複ページングの調査中に見つけたもので、原因は別（片方は順序、こちらは切り忘れ）。
     ⚠️ `totalCount` は**切る前の件数**。切ったあとの数を返すと総数が40になり、
        ページ数の計算（`ceil(totalCount / PAGE_SIZE)`）が崩れる。
     ⚠️ `limit` を渡さない呼び出し（`CompanySearchResults`）は全件が欲しいので切らない。 */
  const resolvedTotal = useDbPagination ? totalCount : filteredCompanies.length;
  const pageOffset = params.offset ?? 0;
  const pagedCompanies =
    !useDbPagination && params.limit !== undefined
      ? filteredCompanies.slice(pageOffset, pageOffset + params.limit)
      : filteredCompanies;

  return {
    companies: pagedCompanies,
    totalCount: resolvedTotal,
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
  /* ★2026-10-04 追加。アクセンチュアの `branch_locations` に入っている値。
        ⚠️★**支社の値を `branch_locations` に入れたら、ここにも足す。**
           足さないと、その都道府県を選んだときに**支社がある会社が出ない**
           （選択肢は47件の固定リストなので、UI 上は何も変わらず空振りだけが起きる）。 */
  "福島": "福島県", "群馬": "群馬県", "熊本": "熊本県",
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
 * 「顧客の業界」（軸2）の選択肢 — 5分間キャッシュ。
 *
 * ★母集団は**「企業ページが見える企業」**（`is_published` かつ非 `is_test`）で、
 *   **ディレクトリ掲載中（`listing_status='listed'`）に絞らない**（2026-09-14）。
 *
 * ⚠️★**`filterListedCompanies` に戻さないこと。** 戻すと、企業を一覧から外すたびに
 *    **選択肢が静かに減る。** 実際、2026-09-14 に61社をディレクトリから外したとき、
 *    掲載中に絞ったままだと **6件 → 1件**（建設・金融・保険・小売・流通・
 *    医療・ヘルスケア・製造業 が消え、残るのは自社の IT・ソフトウェアだけ）になっていた。
 *    柴さんの判断で「企業を落としても選択肢は残す」（A案 / 2026-09-14）。
 *
 * ⚠️ **したがって選んだ結果が0件になりうる。** 絞り込み側（`searchCompanies`）は
 *    掲載中しか返さないため。**これは承知のうえ**（都道府県・フェーズ・事業領域と同じ扱い）。
 *
 * ⚠️ **マスタ全件にはしない。** `ow_industries` の有効な業種は22件（親18＋子4）あるが、
 *    ここが出すのは**どこかの企業に実際に設定されている業種だけ**。
 *    マスタ全件にすると、一度も使われていない業種まで並ぶ。
 *
 * ★2026-10-18 から読むのは「主なお客さまの業界」（`ow_company_customer_industries`。大分類だけ）。
 *    旧「対象業界」（`ow_company_target_industries`）は読まない。
 * ⚠️ 並びは業種マスタの `display_order`。**件数順にしない**（親子の順序が崩れる）。
 */
/**
 * ★会社規模の選択肢（2026-10-10）。**掲載中の企業が1社以上あるまとまりだけ**返す（0件の選択肢は出さない）。
 * ⚠️ 母集団は一覧と同じ「ディレクトリ掲載中」（`filterListedCompanies`）。検証用は visibility 側で落ちる。
 * ⚠️ 取得に失敗したら空配列（チップごと出さない）。0件の選択肢を出すよりよい。
 */
export const fetchAvailableSizeGroups = unstable_cache(
  async (): Promise<{ value: CompanySizeGroup; label: string; count: number }[]> => {
    const supabase = createPublicClient();
    const { data, error } = await filterListedCompanies(
      supabase.from("ow_companies").select("employee_count_band"),
    );
    if (error) {
      console.error("[fetchAvailableSizeGroups]", error.message);
      return [];
    }
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as { employee_count_band: string | null }[]) {
      const g = sizeGroupOfBand(r.employee_count_band);
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return COMPANY_SIZE_GROUPS
      .filter((g) => (counts.get(g.value) ?? 0) > 0)
      .map((g) => ({ value: g.value, label: g.label, count: counts.get(g.value) ?? 0 }));
  },
  ["available-size-groups"],
  { revalidate: 300 }
);

/**
 * ★都道府県ごとの掲載中の会社の数（2026-10-29 / 柴さんの指示）。都道府県のメニューで件数を出し、会社がある県を上に並べるため。
 * ⚠️ 当て方は searchCompanies の都道府県と同じ（本社の所在地にその県名を含む、または支社の地名が PREF_TO_BRANCH_KEYS に当たる）。
 *    片方だけ変えると、メニューの数と押したあとの件数が食い違う。
 * ⚠️ 取れなかったら null（呼び出し側は件数なしの従来の並びに戻す。0 として扱わない）。
 */
export const fetchPrefectureCounts = unstable_cache(
  async (): Promise<Record<string, number> | null> => {
    const supabase = createPublicClient();
    const { data, error } = await filterListedCompanies(
      supabase.from("ow_companies").select("location, branch_locations"),
    );
    if (error) {
      console.error("[fetchPrefectureCounts]", error.message);
      return null;
    }
    const rows = (data ?? []) as { location: string | null; branch_locations: string[] | null }[];
    const out: Record<string, number> = {};
    for (const pref of PREFECTURES) {
      const keys = PREF_TO_BRANCH_KEYS[pref] ?? [];
      out[pref] = rows.filter((r) =>
        (r.location ?? "").toLowerCase().includes(pref.toLowerCase()) ||
        (r.branch_locations ?? []).some((b) => keys.includes(b)),
      ).length;
    }
    return out;
  },
  ["prefecture-counts"],
  { revalidate: 300 }
);

export const fetchAvailableTargetIndustries = unstable_cache(
  async (): Promise<{ slug: string; name: string }[]> => {
    const supabase = createPublicClient();

    /* ① まず対象の company_id を取る。⚠️ **ディレクトリ掲載ではなく「ページが見えるか」**
          で絞る（上の JSDoc 参照）。検証用企業（`is_test`）は除く。 */
    const { data: visible, error: visibleErr } = await filterVisibleCompaniesStrict(
      supabase.from("ow_companies").select("id")
    );
    if (visibleErr) {
      console.error("[fetchAvailableTargetIndustries] 企業の取得に失敗:", visibleErr.message);
      return [];
    }
    const visibleIds = new Set((visible ?? []).map((r) => r.id as string));
    if (visibleIds.size === 0) return [];

    // ② 明細 → 業種。★2026-10-18 から「主なお客さまの業界」（ow_company_customer_industries）を読む
    const { data: rows, error } = await supabase
      .from("ow_company_customer_industries")
      .select("company_id, ow_industries!inner(slug, name, display_order, is_active)");
    if (error) {
      console.error("[fetchAvailableTargetIndustries]", error.message);
      return [];
    }

    const seen = new Map<string, { slug: string; name: string; order: number }>();
    for (const r of (rows ?? []) as any[]) {
      if (!visibleIds.has(r.company_id)) continue;
      const i = r.ow_industries as { slug: string; name: string; display_order: number; is_active: boolean } | null;
      if (!i || !i.is_active) continue;
      if (!seen.has(i.slug)) seen.set(i.slug, { slug: i.slug, name: i.name, order: i.display_order ?? 0 });
    }
    return Array.from(seen.values())
      .sort((a, b) => a.order - b.order)
      .map(({ slug, name }) => ({ slug, name }));
  },
  ["available-customer-industries"],
  { revalidate: 300 }
);

/**
 * ★業種の絞り込みの選択肢（2026-10-12 / `?ind=`）。掲載中の会社が1社以上ある業種だけ（0件の選択肢を出さない）。
 *   大分類は「（すべて）」として出し、件数は**小分類の会社と大分類だけの会社**を足したもの（提案A）。
 * ⚠️ 掲載の判定は filterListedCompanies（一覧と同じ）。⚠️ 公開側なので有効な業種だけ。
 * ⚠️ 取得に失敗したら空（チップを出さない）。
 */
export const fetchIndustryFacets = unstable_cache(
  async (): Promise<{ value: string; label: string; group: string; count: number }[]> => {
    const supabase = createPublicClient();
    const [{ data: cos, error: cErr }, { data: inds, error: iErr }] = await Promise.all([
      filterListedCompanies(supabase.from("ow_companies").select("industry_id")),
      supabase.from("ow_industries").select("id, slug, name, parent_id, display_order").eq("is_active", true),
    ]);
    if (cErr || iErr) {
      console.error("[fetchIndustryFacets]", (cErr ?? iErr)!.message);
      return [];
    }
    const byId = new Map((inds ?? []).map((i) => [i.id as string, i]));
    const direct = new Map<string, number>();
    for (const c of cos ?? []) {
      const id = c.industry_id as string | null;
      if (id && byId.has(id)) direct.set(id, (direct.get(id) ?? 0) + 1);
    }
    const tops = (inds ?? []).filter((i) => !i.parent_id).sort((a, b) => (a.display_order as number) - (b.display_order as number));
    const out: { value: string; label: string; group: string; count: number }[] = [];
    for (const t of tops) {
      const kids = (inds ?? []).filter((i) => i.parent_id === t.id).sort((a, b) => (a.display_order as number) - (b.display_order as number));
      const total = (direct.get(t.id as string) ?? 0) + kids.reduce((n, k) => n + (direct.get(k.id as string) ?? 0), 0);
      if (total === 0) continue;
      out.push({ value: t.slug as string, label: `${t.name}（すべて）`, group: t.name as string, count: total });
      for (const k of kids) {
        const n = direct.get(k.id as string) ?? 0;
        if (n > 0) out.push({ value: k.slug as string, label: k.name as string, group: t.name as string, count: n });
      }
    }
    return out;
  },
  ["industry-facets"],
  { revalidate: 300, tags: ["industries"] }
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

/**
 * `?target=` の slug → 「主なお客さまの業界」の業種 id（2026-10-18）。
 * ⚠️ 新しい表は大分類だけを持つので、小分類の slug（旧「対象業界」の `construction` など）は親の大分類に読み替える。
 * ⚠️ 見つからない・使っていない業種なら null（呼び出し側は0件にする）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveCustomerIndustryId(supabase: any, slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("ow_industries").select("id, parent_id, is_active").eq("slug", slug).maybeSingle();
  if (error) {
    console.error("[resolveCustomerIndustryId]", error.message);
    return null;
  }
  if (!data || data.is_active !== true) return null;
  return (data.parent_id as string | null) ?? (data.id as string);
}

import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { companyDisplayName } from "@/lib/companies/displayName";

/**
 * 「あなたの◯◯の経験が活きる会社」— 職歴の業界 × 企業の対象業界（軸2）の突合。
 *
 * ⚠️★**`vertical` の企業だけを出す。** `horizontal`（業界を問わない）や
 *    `consumer`（消費者向け）を混ぜないこと。混ぜると「あなたの業界だから」という
 *    主張が成り立たなくなる（2026-09-04 の判断）。混ぜたいなら**別の見出し**にする。
 *
 * ⚠️ 遷移データ由来の「◯人が移った」は入れない。`ow_transitions` が5行しかなく、
 *    どの業界ペアも n=1〜4 にしかならない（`/search` の下限は3人）。
 *
 * ── 判定の順序（★この順でないと件数が狂う）─────────────────────────────────
 *   ① 職歴 → 勤務先 → `ow_companies.industry_id` で業界を出す
 *   ② その業界を対象業界に持つ**掲載中の企業**を引く
 *   ③ **本人が在籍した企業を除く**
 *   ④ **自社（OPINIO）を除く**
 *   ⑤ 残りが2社以上のブロックだけ残す
 *
 * ⚠️★**数えるのは除いた後**。先に数えると「2社ある」と判定してから1社になる。
 */

/**
 * 自社の企業レコードの slug。
 *
 * ⚠️★**自社を「あなたの業界の経験が活きる会社」として出さないため。**
 *    IT出身者に対して IT 向けサービスとして自社が並ぶのは、推薦として成立しない。
 *
 * ⚠️ URL（`NEXT_PUBLIC_SITE_URL` とのホスト一致）で判定する案は**採らなかった**
 *    （2026-09-04 / 柴さん）。自社の `url` が変わったときに
 *    **エラーにならず静かに除外が外れる**ため。このリポジトリで繰り返している形。
 *
 * ⚠️ この slug の企業が存在しないと、除外は**無言で効かなくなる**。
 *    `getOwnCompanyId()` が見つからないときに `console.error` を出す。
 */
export const OWN_COMPANY_SLUG = "opinio";

/**
 * 自社の企業 id。**見つからなければ `null` を返し、必ずログを出す。**
 *
 * ⚠️ `unstable_cache` に載せてある。毎リクエストで1問い合わせ増やさないため
 *    （自社のレコードはほぼ変わらない）。
 */
export const getOwnCompanyId = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await createAdminClient()
      .from("ow_companies")
      .select("id")
      .eq("slug", OWN_COMPANY_SLUG)
      .maybeSingle();

    if (error) {
      console.error(`[industryMatch] 自社(${OWN_COMPANY_SLUG})の取得に失敗:`, error.message);
      return null;
    }
    if (!data) {
      /* ⚠️★ここが出たら**除外が効いていない**。slug を変えたか、行を消したか。 */
      console.error(
        `[industryMatch] 自社の企業レコードが見つからない（slug=${OWN_COMPANY_SLUG}）。` +
        `「あなたの業界の経験が活きる会社」から自社を除外できていない`,
      );
      return null;
    }
    return data.id as string;
  },
  ["own-company-id"],
  { revalidate: 3600, tags: ["own-company"] },
);

export type IndustryMatchCompany = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
};

export type IndustryMatchBlock = {
  industryId: string;
  /** ⚠️ `ow_industries` の表示名をそのまま使う。**「業界」を付け足さないこと**（下記） */
  industryName: string;
  /** 経験年数。⚠️ 期間をマージしてから**年単位に丸めた**値（0年はありうる） */
  years: number;
  companies: IndustryMatchCompany[];
};

/** 1画面に出すブロックの上限。⚠️ 3業界以上ある人に画面いっぱい並べない */
export const MAX_INDUSTRY_BLOCKS = 2;
/** このブロックを出す最低社数。⚠️ **除外した後**に数える */
export const MIN_COMPANIES_PER_BLOCK = 2;

/**
 * ★見出しの文言。
 *
 * ⚠️★**`ow_industries` の名前に「業界」を付け足さないこと。**
 *    全22件を実際に並べて確かめたところ、**2件で破綻する**（2026-09-04 実測）:
 *      「**公共・団体業界**での経験が活きます」… 公共・団体は業界ではない
 *      「**その他サービス業界**での経験が活きます」… 「その他」に「業界」が付く
 *    付けない形なら22件すべて自然に読める。
 */
export function industryMatchHeading(industryName: string): string {
  return `${industryName}の経験が活きる会社`;
}

/** 理由文。⚠️ 会社ごとに手書きしない。対象業界データだけで書ける形にする */
export function industryMatchReason(industryName: string): string {
  return `${industryName}向けにサービスを提供しています`;
}

/**
 * 期間をマージして年数を出す。
 *
 * ⚠️★**単純合算しない。** 同一業界で期間が重なると二重に数える。
 *    実測（2026-09-04）では差が出たのは1人・0.1年だが、出向・兼務・グループ内異動が
 *    入れば年単位でずれる。
 * ⚠️ `started_at` は `YYYY-MM` の精度しか無い（オンボーディングは月まで）。
 *    **小数で出さない。** ここで年単位に丸める。
 */
export function mergedYears(spans: { start: Date; end: Date }[]): number {
  if (spans.length === 0) return 0;
  const sorted = [...spans].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start.getTime() <= curEnd.getTime()) {
      if (s.end.getTime() > curEnd.getTime()) curEnd = s.end;
    } else {
      total += curEnd.getTime() - curStart.getTime();
      curStart = s.start;
      curEnd = s.end;
    }
  }
  total += curEnd.getTime() - curStart.getTime();
  return Math.round(total / (365 * 24 * 60 * 60 * 1000));
}

/**
 * ログイン中の本人向けに、ブロックを組み立てる。
 *
 * @param owUserId `ow_users.id`（⚠️ `auth.uid()` ではない）
 * @returns 出せるブロック。**1つも無ければ空配列**（呼び出し側はセクションごと出さない）
 */
export async function fetchIndustryMatchBlocks(owUserId: string): Promise<IndustryMatchBlock[]> {
  const db = createAdminClient();

  /* ① 職歴 → 勤務先 → 業界。⚠️ `company_id` が無い行（自由入力）は業界を辿れない */
  const { data: exps, error: expErr } = await db
    .from("ow_experiences")
    .select("company_id, started_at, ended_at, ow_companies!company_id(id, industry_id)")
    .eq("user_id", owUserId)
    .not("company_id", "is", null);

  if (expErr) {
    console.error("[industryMatch] 職歴の取得に失敗:", expErr.message);
    return [];
  }

  const employerIds = new Set<string>();
  const spansByIndustry = new Map<string, { start: Date; end: Date }[]>();
  for (const row of exps ?? []) {
    const co = (row.ow_companies as unknown) as { id: string; industry_id: string | null } | null;
    if (!co) continue;
    employerIds.add(co.id);
    if (!co.industry_id || !row.started_at) continue;
    const start = new Date(row.started_at as string);
    const end = row.ended_at ? new Date(row.ended_at as string) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const arr = spansByIndustry.get(co.industry_id) ?? [];
    arr.push({ start, end });
    spansByIndustry.set(co.industry_id, arr);
  }
  if (spansByIndustry.size === 0) return [];

  const industryIds = Array.from(spansByIndustry.keys());

  /* ② その業界を対象業界に持つ掲載中の企業。⚠️ vertical だけ（scope は複合FKで保証済み）
     ⚠️★**ここで `ow_companies` を埋め込み（`ow_companies!company_id(...)`）で取らないこと。**
        `ow_company_target_industries` から `ow_companies` への外部キーは
        **複合FK**（`(company_id, target_industry_scope) → (id, target_industry_scope)`）で、
        PostgREST は複合FKを埋め込みの関係として解決できない。実際に踏んだ（2026-09-04）:
          Could not find a relationship between 'ow_company_target_industries' and 'ow_companies'
        ⚠️ **エラーは出るが 200 で返り、`?? []` で受けると「0件」に化ける。**
           ここは `error` を見ているので気づけた（CLAUDE.md「error を握りつぶさない」）。
        → **2段に分けて `.in("id", ...)` で引く。** */
  const { data: targets, error: tErr } = await db
    .from("ow_company_target_industries")
    .select("industry_id, company_id")
    .in("industry_id", industryIds);

  if (tErr) {
    console.error("[industryMatch] 対象業界の取得に失敗:", tErr.message);
    return [];
  }

  const candidateIds = Array.from(new Set((targets ?? []).map((r) => r.company_id as string)));
  if (candidateIds.length === 0) return [];

  /* ⚠️ `.select()` には**1本の文字列リテラル**を渡す（配列 join や `+` の連結だと型が落ちる）。 */
  const { data: companyRows, error: cErr } = await db
    .from("ow_companies")
    .select("id, slug, name, name_en, tagline, logo_url, logo_letter, logo_gradient, listing_status, is_test, is_published")
    .in("id", candidateIds);

  if (cErr) {
    console.error("[industryMatch] 企業の取得に失敗:", cErr.message);
    return [];
  }
  const companyById = new Map((companyRows ?? []).map((c) => [c.id as string, c]));

  const { data: industries, error: iErr } = await db
    .from("ow_industries")
    .select("id, name")
    .in("id", industryIds);
  if (iErr) {
    console.error("[industryMatch] 業種マスタの取得に失敗:", iErr.message);
    return [];
  }
  const industryName = new Map((industries ?? []).map((i) => [i.id as string, i.name as string]));

  const ownCompanyId = await getOwnCompanyId();

  const byIndustry = new Map<string, IndustryMatchCompany[]>();
  for (const row of targets ?? []) {
    const co = companyById.get(row.company_id as string);
    if (!co) continue;
    /* 掲載中のものだけ。⚠️ `filterListedCompanies` と同じ条件をここで書いているのは、
       埋め込みで取っているため（あちらはクエリビルダに当てる形）。条件を変えるなら両方。 */
    if (co.listing_status !== "listed" || co.is_test === true || co.is_published !== true) continue;
    /* ③ 本人が在籍した企業を除く */
    if (employerIds.has(co.id)) continue;
    /* ④ 自社を除く。⚠️ ownCompanyId が null のときは既に console.error が出ている */
    if (ownCompanyId && co.id === ownCompanyId) continue;

    const key = row.industry_id as string;
    const arr = byIndustry.get(key) ?? [];
    arr.push({
      id: co.id,
      slug: co.slug,
      /* ⚠️ 表示名の組み立ては `lib/companies/displayName.ts` に集約されている。
            ここで独自に組まない（3箇所に割れていたのを 2026-08-13 に集約した経緯がある）。 */
      name: companyDisplayName(co.name, co.name_en).displayName,
      tagline: co.tagline,
      logoUrl: co.logo_url,
      logoLetter: co.logo_letter,
      logoGradient: co.logo_gradient,
    });
    byIndustry.set(key, arr);
  }

  /* ⑤ 除いた**後**に数える。2社未満のブロックは出さない */
  const blocks: IndustryMatchBlock[] = [];
  for (const [id, spans] of Array.from(spansByIndustry.entries())) {
    const companies = byIndustry.get(id) ?? [];
    if (companies.length < MIN_COMPANIES_PER_BLOCK) continue;
    const name = industryName.get(id);
    if (!name) continue;   // 名前を出せないなら書かない
    blocks.push({
      industryId: id,
      industryName: name,
      years: mergedYears(spans),
      companies: companies.sort((a, b) => a.name.localeCompare(b.name, "ja")),
    });
  }

  /* 経験年数の長い順。⚠️ 上限を超えたぶんは出さない（画面いっぱいに並べない） */
  return blocks.sort((a, b) => b.years - a.years).slice(0, MAX_INDUSTRY_BLOCKS);
}

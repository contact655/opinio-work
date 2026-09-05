import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import { companyDisplayName } from "@/lib/companies/displayName";
import {
  buildIndustryTree,
  expandIndustryWithAncestors,
  industryAncestorDistance,
  type IndustryNode,
} from "@/lib/companies/industryTree";

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

/** 一致した「企業側の対象業界」の名前。⚠️ 見出しではなく**理由文**に使う */
export type IndustryMatchCompany = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  /**
   * ★この会社が**どの対象業界で**当たったかの表示名（2026-09-05）。
   *
   * ⚠️ 見出し（`industryName`）とは**別物**。祖先展開を入れたので、
   *    「電機・機械」出身の人が「製造業向け」の会社に当たる。
   *    見出しは**本人が申告した業種**、理由文は**会社が言っている対象業界**。
   * ⚠️ 同じ業種のときは見出しと同じ文字列になる（それでよい）。
   */
  matchedIndustryName: string;
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

/**
 * 理由文。⚠️ 会社ごとに手書きしない。対象業界データだけで書ける形にする。
 *
 * ⚠️★渡すのは**会社が言っている対象業界**（`matchedIndustryName`）であって、
 *    見出しの業種ではない。2026-09-05 に業種を2階層にしたので、
 *    「電機・機械の経験が活きる会社」という見出しの下に
 *    「**製造業**向けにサービスを提供しています」と出る組み合わせがある。
 *    **これが繋がりの説明になっている。**
 */
export function industryMatchReason(matchedIndustryName: string): string {
  return `${matchedIndustryName}向けにサービスを提供しています`;
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

  const ownIndustryIds = Array.from(spansByIndustry.keys());

  /* ①.5 ★業種の木を読み、**本人の業種を祖先展開する**（2026-09-05）。
     ⚠️★展開するのは**本人側だけ**。企業の対象業界は展開しない。
        展開すると兄弟に広がり、「電子機器・半導体向け」の企業に
        **電機・機械** 出身の人が当たってしまう。 */
  const { data: allIndustries, error: treeErr } = await db
    .from("ow_industries")
    .select("id, name, slug, parent_id, display_order, description")
    .eq("is_active", true);
  if (treeErr) {
    console.error("[industryMatch] 業種の木の取得に失敗:", treeErr.message);
    return [];
  }
  const tree = buildIndustryTree(
    (allIndustries ?? []).map((r): IndustryNode => ({
      id: r.id as string,
      name: r.name as string,
      slug: r.slug as string,
      parentId: (r.parent_id as string | null) ?? null,
      displayOrder: (r.display_order as number | null) ?? 0,
      description: (r.description as string | null) ?? null,
    })),
  );

  /* 本人の業種 ＋ その祖先。これで「製造業向け」の企業に当たるようになる */
  const industryIds = expandIndustryWithAncestors(tree, ownIndustryIds);

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

  /* ⚠️ 業種名は上で読んだ木から引く（別クエリにしない）。
        祖先ぶんの名前も要るので、木を持っているほうが確実。 */
  const industryName = new Map(
    Array.from(tree.byId.values()).map((n) => [n.id, n.name] as const),
  );

  const ownCompanyId = await getOwnCompanyId();

  /* ★グループ化のキーは **本人が申告した業種**（案A / 2026-09-05）。
        企業側の対象業界（＝当たった相手）ではない。

     ⚠️★見出しに「製造業」と出さないため。祖先展開を入れたので、
        企業側でグループ化すると **本人が申告していない粒度の業種名**が
        「あなたの職歴から（製造業 7年）」として出てしまう。
        年数も本人の業種のまま（親に畳まない）。
     ⚠️ 繋がりは**理由文**で読める（「製造業向けにサービスを提供しています」）。

     ⚠️ 同じ会社が同じブロックに複数回入りうる（対象業界を2つ持つ会社が、
        本人の業種とその親の**両方**に一致する）。そのときは
        **より近いほう**（距離が小さいほう）を理由に採る。 */
  const ownIndustryList = Array.from(spansByIndustry.keys());
  type Hit = { company: IndustryMatchCompany; distance: number };
  const hitsByOwnIndustry = new Map<string, Map<string, Hit>>();

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

    const targetId = row.industry_id as string;
    const targetName = industryName.get(targetId);
    if (!targetName) continue;   // 名前を出せないなら書かない

    for (const ownId of ownIndustryList) {
      /* ★本人の業種から見て、当たった対象業界が **自分自身か祖先** のときだけ採る。
            ⚠️ 兄弟・子には広げない（`null` が返る）。 */
      const distance = industryAncestorDistance(tree, ownId, targetId);
      if (distance === null) continue;

      const bucket = hitsByOwnIndustry.get(ownId) ?? new Map<string, Hit>();
      const prev = bucket.get(co.id);
      if (prev && prev.distance <= distance) continue;   // より近い理由が既にある
      bucket.set(co.id, {
        distance,
        company: {
          id: co.id,
          slug: co.slug,
          /* ⚠️ 表示名の組み立ては `lib/companies/displayName.ts` に集約されている。
                ここで独自に組まない（3箇所に割れていたのを 2026-08-13 に集約した経緯がある）。 */
          name: companyDisplayName(co.name, co.name_en).displayName,
          tagline: co.tagline,
          logoUrl: co.logo_url,
          logoLetter: co.logo_letter,
          logoGradient: co.logo_gradient,
          matchedIndustryName: targetName,
        },
      });
      hitsByOwnIndustry.set(ownId, bucket);
    }
  }

  /* ⑤ ブロックを組む。⚠️ **並べ替え → 重複排除 → 件数で切る** の順。
        件数で先に切ると、重複を除いた後に2社未満になるブロックが残る。 */
  const draft: { industryId: string; industryName: string; years: number; companies: IndustryMatchCompany[] }[] = [];
  for (const [ownId, spans] of Array.from(spansByIndustry.entries())) {
    const name = industryName.get(ownId);
    if (!name) continue;   // 名前を出せないなら書かない
    const companies = Array.from((hitsByOwnIndustry.get(ownId) ?? new Map<string, Hit>()).values())
      .map((h) => h.company)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    draft.push({ industryId: ownId, industryName: name, years: mergedYears(spans), companies });
  }

  /* 経験年数の長い順。⚠️ この順が「先のブロック」を決めるので、重複排除より前に並べる */
  draft.sort((a, b) => b.years - a.years);

  /* ★同じ会社が複数のブロックに出ないようにする。**先のブロックを優先**して2つ目以降から除く */
  const seen = new Set<string>();
  const blocks: IndustryMatchBlock[] = [];
  for (const d of draft) {
    const companies = d.companies.filter((c) => !seen.has(c.id));
    for (const c of companies) seen.add(c.id);
    /* ⑥ 除いた**後**に数える。2社未満のブロックは出さない */
    if (companies.length < MIN_COMPANIES_PER_BLOCK) continue;
    blocks.push({
      industryId: d.industryId,
      industryName: d.industryName,
      years: d.years,
      companies,
    });
  }

  /* ⚠️ 上限を超えたぶんは出さない（画面いっぱいに並べない）。並べ替えは上で済んでいる */
  return blocks.slice(0, MAX_INDUSTRY_BLOCKS);
}

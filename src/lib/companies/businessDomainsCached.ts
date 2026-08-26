import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBusinessDomainOptions, type BusinessDomainOption } from "./businessDomains";

/**
 * 事業領域の選択肢（マスタ12件）をキャッシュして返す。**サーバー専用。**
 *
 * ⚠️ **`businessDomains.ts` に置かないこと。** あちらは
 *    `MAX_BUSINESS_DOMAINS_PER_COMPANY` をクライアント部品（運営の事業領域タブ）が
 *    import しており、`createAdminClient`（service_role）を持ち込むと
 *    **サーバー専用コードがクライアントのバンドルに載る**。
 *    `lib/constants/terms.ts` が同じ理由で切り出されている。
 *
 * ⚠️ キャッシュするのは**フッターが全ページに出る**から。素で引くと
 *    1ページ表示ごとに1クエリ増える。マスタは12行でめったに変わらない。
 *
 * ⚠️ `unstable_cache` の中で **no-store のクライアントを使わないこと**
 *    （CLAUDE.md: ビルドは失敗せず、その項目だけ黙って消えたページが生成される）。
 *    `createAdminClient` は no-store を付けていないのでここで使ってよい。
 *
 * ⚠️ マスタを足す・名前を変える migration を当てたら、最大1時間は古い選択肢が出る。
 *    すぐ反映したいときは `revalidateTag("business-domains")` を呼ぶこと。
 */
export const getBusinessDomainOptions = unstable_cache(
  async (): Promise<BusinessDomainOption[]> =>
    fetchBusinessDomainOptions(createAdminClient(), "getBusinessDomainOptions"),
  ["business-domain-options"],
  { revalidate: 3600, tags: ["business-domains"] },
);

/** 事業領域＋**ディレクトリに掲載中の企業数**。0件のものは含まない。 */
export type BusinessDomainFacet = BusinessDomainOption & { count: number };

/**
 * 絞り込みの選択肢とLPのファセットに使う。**掲載中の企業が1社以上あるものだけ。**
 *
 * ⚠️ **0件の選択肢を出さないこと。** 2026-08-25 まで「ITサービス・受託」が
 *    該当0社のまま選択肢に出続けており、押しても必ず0件だった。
 *
 * ⚠️ 掲載の判定は `filterListedCompanies` と同じ3条件
 *    （is_published / listing_status='listed' / is_test=false）に揃える。
 *    ここだけ条件が違うと「選べるのに0件」「あるのに選べない」が出る。
 *
 * ⚠️ 2クエリで済ませる（N+1 にしない）。フッターが全ページに出るのでキャッシュする。
 */
export const getBusinessDomainFacets = unstable_cache(
  async (): Promise<BusinessDomainFacet[]> => {
    const db = createAdminClient();
    const domains = await fetchBusinessDomainOptions(db, "getBusinessDomainFacets");
    if (domains.length === 0) return [];

    const { data, error } = await db
      .from("ow_company_business_domains")
      .select("domain_id, ow_companies!inner(id, is_published, listing_status, is_test)")
      .eq("ow_companies.is_published", true)
      .eq("ow_companies.listing_status", "listed")
      .eq("ow_companies.is_test", false);

    /* ⚠️ error を握りつぶさない。空で返すと**選択肢が丸ごと消える**（全部0件扱い）。
          取得できないときは件数なしで全件返し、「選択肢が無い」状態を作らない。 */
    if (error) {
      console.error("[getBusinessDomainFacets] 件数の取得に失敗:", error.message);
      return domains.map((d) => ({ ...d, count: 0 }));
    }

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const id = row.domain_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return domains
      .map((d) => ({ ...d, count: counts.get(d.id) ?? 0 }))
      .filter((d) => d.count > 0);
  },
  ["business-domain-facets"],
  { revalidate: 300, tags: ["business-domains"] },
);

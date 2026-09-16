import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";

/**
 * 運営会社（株式会社Opinio）自身の企業レコードを指す。**サーバー専用。**
 *
 * ── なぜ1箇所に置くか（2026-09-16 に切り出し）──────────────────────────────
 * 「自社を出さない」判断が**複数の画面で要る**ことが分かったため。
 *
 *   ① `/mypage` の「◯◯の経験が活きる会社」（`industryMatch.ts`。2026-09-04〜）
 *      IT出身者に IT 向けサービスとして自社が並ぶのは、推薦として成立しない
 *   ② **トップのピックアップ企業**（`lib/lp/pickCompanies.ts`。2026-09-16〜）
 *      運営会社が自社を一番目立つ枠に置く形になり、中立なプラットフォームという
 *      印象を損なう
 *
 * ⚠️★**3つ目が出たときも、ここを import すること。** slug を書き写さない。
 *
 * ⚠️★**「自社を隠す」仕組みではない。** `/companies` `/search` `/companies/[id]`
 *    フッターの事業領域などからは**外していない**。外すのは
 *    「**運営が選んで前に出す枠**」だけ。掲載企業としては普通に出る。
 */

/**
 * 自社の企業レコードの slug。
 *
 * ⚠️ URL（`NEXT_PUBLIC_SITE_URL` とのホスト一致）で判定する案は**採らなかった**
 *    （2026-09-04 / 柴さん）。自社の `url` が変わったときに
 *    **エラーにならず静かに除外が外れる**ため。このリポジトリで繰り返している形。
 *
 * ⚠️ id の直書きにもしない。**環境ごとに id が変わりうる**のと、
 *    slug なら `/companies/opinio` を開けば実在を目で確かめられるため。
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
 * ⚠️ `createAdminClient` は no-store を付けていないので、`unstable_cache` の中で使ってよい
 *    （CLAUDE.md「`unstable_cache` の中で `cache: "no-store"` のクライアントを使わない」）。
 *
 * ⚠️★**呼び出し側は `null` を「除外なし」に倒すこと。** ここで例外を投げると、
 *    自社のレコードが消えた日にトップページごと落ちる。
 *    静かに効かなくなるのは避けたいが、**画面を落とすほうがもっと悪い**ので、
 *    気づく手段は `console.error` に寄せている。
 */
export const getOwnCompanyId = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await createAdminClient()
      .from("ow_companies")
      .select("id")
      .eq("slug", OWN_COMPANY_SLUG)
      .maybeSingle();

    if (error) {
      console.error(`[ownCompany] 自社(${OWN_COMPANY_SLUG})の取得に失敗:`, error.message);
      return null;
    }
    if (!data) {
      /* ⚠️★ここが出たら**除外が効いていない**。slug を変えたか、行を消したか。 */
      console.error(
        `[ownCompany] 自社の企業レコードが見つからない（slug=${OWN_COMPANY_SLUG}）。` +
        `トップのピックアップ企業と「あなたの業界の経験が活きる会社」から自社を除外できていない`,
      );
      return null;
    }
    return data.id as string;
  },
  ["own-company-id"],
  { revalidate: 3600, tags: ["own-company"] },
);

/**
 * 事業領域（`ow_business_domains`）の選択肢と上限。
 *
 * ⚠️ **選択肢をコードに書かないこと。** マスタが唯一の出どころ。
 *    業種（`lib/companies/industries.ts`）と同じ扱いにしてある。
 *
 * ── 業種との違い ────────────────────────────────────────────────────────────
 *   業種   … 単一。全社が必ず1つ持つ。運営・企業側の分類軸
 *   事業領域 … **複数**。IT系の業種のときだけ必須（`ow_industries.requires_business_domain`）。
 *             求職者側の絞り込みは、いずれこちらへ移す
 *
 * ⚠️ 必須かどうかを slug で判定しないこと。**`requires_business_domain` を読む。**
 */

export type BusinessDomainOption = {
  id: string;
  name: string;
  slug: string;
  /** ⚠️ 暫定値には理由が書いてある（「業種特化」は軸2を入れる日に解体する） */
  description: string | null;
};

/** ⚠️ `.select()` には文字列リテラルを渡す（配列を join すると型が落ちる）。 */
export const BUSINESS_DOMAIN_OPTION_COLS = "id, name, slug, description" as const;

/**
 * 1社あたりの上限。
 *
 * ⚠️ **DB では縛っていない。** トリガーや CHECK にすると運営が直せない場面が出る
 *    （例: 4件入っている行を3件に減らす途中）。**API 側で検証する。**
 *    DB が保証するのは「主がちょうど1件」（部分UNIQUE）と「マスタに実在すること」だけ。
 */
export const MAX_BUSINESS_DOMAINS_PER_COMPANY = 3;

/**
 * 有効な事業領域を `display_order` 順で返す。
 *
 * ⚠️ **error を握りつぶさない。** 空配列で返すと、権限やネットワークの失敗が
 *    「選択肢が無い」と区別できなくなる。
 */
export async function fetchBusinessDomainOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  label: string,
): Promise<BusinessDomainOption[]> {
  const { data, error } = await db
    .from("ow_business_domains")
    .select(BUSINESS_DOMAIN_OPTION_COLS)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error(`[${label}] ow_business_domains の取得に失敗:`, error.message);
    return [];
  }
  return (data ?? []) as BusinessDomainOption[];
}

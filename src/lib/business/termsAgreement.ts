import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 企業向け規約の種別。
 *
 * ⚠️ **2026-08-14 に「掲載」と「人材紹介」へ分けた。**
 *    それ以前の同意は `business`（分割前の1本）で記録されている。
 *    `business` は**消さない。** 分割前に同意した企業を未同意に戻さないため、
 *    どちらの判定でも `business` を有効として扱う。
 */
export const TERMS_TYPES = {
  /** 掲載利用規約（/terms/listing）。企業情報の掲載に必要 */
  listing: "listing",
  /** 人材紹介利用規約（/terms/placement）。スカウト・紹介を使うときに必要 */
  placement: "placement",
  /** 分割前の1本（/terms/business）。過去の同意記録のみ */
  legacy: "business",
} as const;

export const TERMS_VERSION = "2026-08-01";

/**
 * その利用者が指定の規約に同意済みか。
 *
 * ⚠️ 分割前の `business` はどちらにも効く。片方だけ通すと、
 *    既に同意している企業が掲載を止められる／紹介を使えなくなる。
 */
export async function hasAgreedTerms(
  authUserId: string,
  type: "listing" | "placement",
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("ow_terms_agreements")
    .select("id")
    .eq("user_id", authUserId)
    .in("terms_type", [type, TERMS_TYPES.legacy])
    .limit(1)
    .maybeSingle();
  /* 握り潰さない。取得に失敗したときに「同意済み」に倒すと、
     同意していない企業に機能を開いてしまう（fail-open にしない）。 */
  if (error) console.error("[hasAgreedTerms]", error.message);
  return !!data;
}

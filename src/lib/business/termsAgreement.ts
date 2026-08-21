import { createAdminClient } from "@/lib/supabase/admin";

/* 定数は `lib/constants/terms.ts` に置いてある。
   ⚠️ このファイルは `createAdminClient`（service_role）を import しているので、
      `"use client"` の部品からは**こちらではなく constants を読むこと。** */
export { TERMS_TYPES, TERMS_VERSION } from "@/lib/constants/terms";
import { TERMS_TYPES } from "@/lib/constants/terms";

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

import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY } from "@/lib/companies/businessDomains";

/*
 * 事業領域の入れ替え。**サーバー専用。**
 *
 * ⚠️★**`businessDomains.ts` に戻さないこと**（2026-09-29 に分けた）。
 *    あちらは定数と型を**クライアントコンポーネントから import している**
 *    （`/admin/companies/[id]/CompanyDetailClient.tsx` と `/biz/company/CompanyEditClient.tsx`）。
 *    `createAdminClient` を同じファイルに置くと、そのバンドルに service role の
 *    経路が混ざる。
 * ⚠️ `server-only` パッケージは**このリポジトリに入っていない**ので付けていない。
 *    ビルドでは落ちないので、**クライアントから import しないのは規約で守る。**
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetBusinessDomainsResult =
  | { ok: true; count: number }
  | { ok: false; error: string; status: number };

/**
 * 事業領域を入れ替える。**運営（/admin）と企業（/biz）の両方がここを通る。**
 *
 * ⚠️★**検証と RPC 呼び出しをルートに書き写さないこと**（2026-09-29 に共通化）。
 *    それまで `PUT /api/admin/companies/[id]/business-domains` の中にだけあり、
 *    `/biz` 側を足すときに**同じ規則を2箇所に持つ**ところだった。割れると
 *    「運営からは3件入るのに企業からは4件入る」のような食い違いになる。
 *    **違うのは「誰が呼べるか」だけで、規則は同じ。** 認可は呼び出し側で行う。
 *
 * ⚠️★**全置換。** 差分（追加/削除）を受けない。「主がちょうど1件」を保つには、
 *    送られた集合をそのまま作り直すのが一番素直で、途中状態（主が0件 / 2件）が
 *    生まれない。
 *
 * ⚠️★**DELETE と INSERT を呼び出し側から2回叩かないこと。** supabase-js の呼び出しは
 *    1回ずつ別トランザクションなので、DELETE のあと INSERT が落ちると
 *    **その企業の分類が消えたまま残る。** RPC `set_company_business_domains` が
 *    1トランザクションで入れ替える。
 *
 * ⚠️ **上限（3件）はここで見る。** DB で縛ると運営が直せない場面が出る。
 *    RPC が守るのは「マスタに実在すること」と「主がちょうど1件」だけ。
 *
 * ⚠️★**キャッシュを捨てるのは呼び出し側の責任にしない。** ここで両方呼ぶ。
 *    `revalidateTag("business-domains")` **だけでは足りない**（あのタグが付いているのは
 *    選択肢と facet の件数だけで、`searchCompanies` の絞り込みクエリには付いていない）。
 *    実測（2026-09-04）: 付け替えても `?industry=collab` が 8社のまま出続け、
 *    次のデプロイまで直らなかった。
 */
export async function setCompanyBusinessDomains(
  companyId: string,
  body: { domain_ids?: unknown; primary_domain_id?: unknown },
  label: string,
): Promise<SetBusinessDomainsResult> {
  const domainIds = body.domain_ids;
  if (!Array.isArray(domainIds)) {
    return { ok: false, error: "domain_ids は配列で送ってください。", status: 400 };
  }
  if (!domainIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return { ok: false, error: "domain_ids の形式が不正です。", status: 400 };
  }

  /* 重複はここで落とす。RPC 側でも落とすが、**上限を数えるのは重複を除いた後**
     でないと「同じ領域を3回送れば3件扱い」になってしまう。 */
  const unique = Array.from(new Set(domainIds));
  if (unique.length > MAX_BUSINESS_DOMAINS_PER_COMPANY) {
    return { ok: false, error: `事業領域は ${MAX_BUSINESS_DOMAINS_PER_COMPANY} 件までです。`, status: 400 };
  }

  const primaryRaw = body.primary_domain_id;
  const primaryId = typeof primaryRaw === "string" && primaryRaw ? primaryRaw : null;
  if (primaryId !== null && !UUID_RE.test(primaryId)) {
    return { ok: false, error: "primary_domain_id の形式が不正です。", status: 400 };
  }

  /* ⚠️ 「主が集合の中にあるか」は RPC も見るが、ここでも見る。
        画面に返すメッセージを日本語で揃えたいのと、RPC まで行かずに弾けるため。 */
  if (unique.length === 0 && primaryId !== null) {
    return { ok: false, error: "事業領域を選んでいないときは、主を指定できません。", status: 400 };
  }
  if (unique.length > 0 && primaryId === null) {
    return { ok: false, error: "主の事業領域を1つ選んでください。", status: 400 };
  }
  if (primaryId !== null && !unique.includes(primaryId)) {
    return { ok: false, error: "主の事業領域は、選んだ事業領域の中から指定してください。", status: 400 };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_company_business_domains", {
    p_company_id: companyId,
    p_domain_ids: unique,
    p_primary_domain_id: primaryId,
  });

  if (error) {
    /* ⚠️ error を握りつぶさない。RPC の RAISE は 22023（invalid_parameter_value）で
          上げているので、それは利用者に見せてよい 400。それ以外は 500。 */
    console.error(`[${label}] set_company_business_domains:`, error.message);
    if (error.code === "22023") return { ok: false, error: error.message, status: 400 };
    return { ok: false, error: "Internal server error", status: 500 };
  }

  await revalidateCompanyPages(companyId);
  revalidateTag("business-domains");

  return { ok: true, count: (data as number | null) ?? 0 };
}

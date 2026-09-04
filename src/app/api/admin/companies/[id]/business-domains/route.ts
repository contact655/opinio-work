import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY } from "@/lib/companies/businessDomains";

/**
 * PUT /api/admin/companies/[id]/business-domains — 事業領域の入れ替え
 *
 * body: { domain_ids: string[], primary_domain_id: string | null }
 *
 * ⚠️ **全置換。** 差分（追加/削除）を受けない。
 *    「主がちょうど1件」を保つには、送られた集合をそのまま作り直すのが一番素直で、
 *    途中状態（主が0件 / 2件）が生まれない。
 *
 * ⚠️ **DELETE と INSERT をここから2回叩かないこと。** supabase-js の呼び出しは
 *    1回ずつ別トランザクションなので、DELETE のあと INSERT が落ちると
 *    **その企業の分類が消えたまま残る**。RPC `set_company_business_domains` が
 *    1トランザクションで入れ替える。
 *
 * ⚠️ **上限（3件）はここで見る。** DB で縛ると運営が直せない場面が出る。
 *    RPC が守るのは「マスタに実在すること」と「主がちょうど1件」だけ。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { domain_ids?: unknown; primary_domain_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domainIds = body.domain_ids;
  if (!Array.isArray(domainIds)) {
    return NextResponse.json({ error: "domain_ids は配列で送ってください。" }, { status: 400 });
  }
  if (!domainIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return NextResponse.json({ error: "domain_ids の形式が不正です。" }, { status: 400 });
  }

  /* 重複はここで落とす。RPC 側でも落とすが、**上限を数えるのは重複を除いた後**
     でないと「同じ領域を3回送れば3件扱い」になってしまう。 */
  const unique = Array.from(new Set(domainIds));
  if (unique.length > MAX_BUSINESS_DOMAINS_PER_COMPANY) {
    return NextResponse.json(
      { error: `事業領域は ${MAX_BUSINESS_DOMAINS_PER_COMPANY} 件までです。` },
      { status: 400 },
    );
  }

  const primaryRaw = body.primary_domain_id;
  const primaryId =
    typeof primaryRaw === "string" && primaryRaw ? primaryRaw : null;
  if (primaryId !== null && !UUID_RE.test(primaryId)) {
    return NextResponse.json({ error: "primary_domain_id の形式が不正です。" }, { status: 400 });
  }

  /* ⚠️ 「主が集合の中にあるか」は RPC も見るが、ここでも見る。
        画面に返すメッセージを日本語で揃えたいのと、RPC まで行かずに弾けるため。 */
  if (unique.length === 0 && primaryId !== null) {
    return NextResponse.json(
      { error: "事業領域を選んでいないときは、主を指定できません。" },
      { status: 400 },
    );
  }
  if (unique.length > 0 && primaryId === null) {
    return NextResponse.json({ error: "主の事業領域を1つ選んでください。" }, { status: 400 });
  }
  if (primaryId !== null && !unique.includes(primaryId)) {
    return NextResponse.json(
      { error: "主の事業領域は、選んだ事業領域の中から指定してください。" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_company_business_domains", {
    p_company_id: params.id,
    p_domain_ids: unique,
    p_primary_domain_id: primaryId,
  });

  if (error) {
    /* ⚠️ error を握りつぶさない。RPC の RAISE は 22023（invalid_parameter_value）で
            上げているので、それは利用者に見せてよい 400。それ以外は 500。 */
    console.error(`[PUT /api/admin/companies/${params.id}/business-domains]`, error.message);
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* ★キャッシュを捨てる（2026-09-04 追加）。
     ⚠️★**これが無いと、運営が付け替えても `/companies` の絞り込みが古いまま。**
      `?industry=` の結果は `createPublicClient` 経由の fetch キャッシュ（Data Cache）に
      載っており、`createPublicClient` は**意図して `no-store` にしていない**
      （cookies() を呼ばないので ISR/fetch キャッシュを効かせる設計）。
      実測（2026-09-04）: 事業領域を付け替えても `?industry=collab` が 8社のまま出続け、
      **次のデプロイまで直らなかった**。
     ⚠️ `revalidateTag("business-domains")` **だけでは足りない。** あのタグが付いているのは
      選択肢と facet の件数（`businessDomainsCached.ts`）だけで、
      **`searchCompanies` の絞り込みクエリには付いていない。** 両方呼ぶ。
     ⚠️ **migration でデータを変えた場合はここを通らない**（sitemap と同じ穴）。
      そのときはデプロイで直る、と割り切っている。 */
  revalidatePath("/companies");
  revalidateTag("business-domains");

  return NextResponse.json({ success: true, count: data ?? 0 });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/isAdmin";
import {
  MAX_TARGET_INDUSTRIES_PER_COMPANY,
  isTargetIndustryScope,
} from "@/lib/companies/targetIndustries";

/**
 * PUT /api/admin/companies/[id]/target-industries — 対象業界（軸2）の入れ替え
 *
 * body: { scope: "vertical" | "horizontal" | null,
 *         industry_ids: string[], primary_industry_id: string | null }
 *
 * ⚠️ **全置換。** 差分（追加/削除）を受けない。途中状態（主が0件 / 2件）を作らないため。
 *
 * ⚠️★**DELETE / UPDATE / INSERT をここから別々に叩かないこと。**
 *    supabase-js の呼び出しは1回ずつ別トランザクションで、途中で落ちると
 *    中途半端に残る。RPC `set_company_target_industries` が1トランザクションでやる。
 *    RPC の中の**順序も固定**（明細を消す → scope を書く → 明細を入れる）。
 *    複合FK の ON UPDATE RESTRICT があるので、逆順は必ず落ちる（実測済み）。
 *
 * ⚠️ **上限（3件）はここで見る。** DB で縛ると運営が直せない場面が出る
 *    （4件入っている行を3件に減らす途中など）。事業領域と同じ方針。
 *
 * ⚠️ 入力は運営だけ。`/biz` からは呼べない（RPC の EXECUTE を service_role にしか
 *    配っておらず、`target_industry_scope` の列 GRANT も配っていない）。
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

  let body: { scope?: unknown; industry_ids?: unknown; primary_industry_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  /* ── scope（3値）───────────────────────────────────────────────────────
     ⚠️ 未確認は **null**。`"unknown"` のような文字列を受けない
        （DB の CHECK は 2値 + NULL。ここで語彙を増やすと3層が割れる）。 */
  const scopeRaw = body.scope;
  if (scopeRaw !== null && scopeRaw !== undefined && !isTargetIndustryScope(scopeRaw)) {
    return NextResponse.json(
      { error: "scope は vertical / horizontal / null のいずれかです。" },
      { status: 400 },
    );
  }
  const scope = isTargetIndustryScope(scopeRaw) ? scopeRaw : null;

  const industryIds = body.industry_ids;
  if (!Array.isArray(industryIds)) {
    return NextResponse.json({ error: "industry_ids は配列で送ってください。" }, { status: 400 });
  }
  if (!industryIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return NextResponse.json({ error: "industry_ids の形式が不正です。" }, { status: 400 });
  }

  /* ⚠️ 重複はここで落とす。**上限を数えるのは重複を除いた後**でないと
        「同じ業界を3回送れば3件扱い」になる。 */
  const unique = Array.from(new Set(industryIds));
  if (unique.length > MAX_TARGET_INDUSTRIES_PER_COMPANY) {
    return NextResponse.json(
      { error: `対象業界は ${MAX_TARGET_INDUSTRIES_PER_COMPANY} 件までです。` },
      { status: 400 },
    );
  }

  const primaryRaw = body.primary_industry_id;
  const primaryId = typeof primaryRaw === "string" && primaryRaw ? primaryRaw : null;
  if (primaryId !== null && !UUID_RE.test(primaryId)) {
    return NextResponse.json({ error: "primary_industry_id の形式が不正です。" }, { status: 400 });
  }

  /* ⚠️ 以下は RPC も見るが、ここでも見る。画面に返す文言を揃えたいのと、
        RPC まで行かずに弾けるため。**片方だけにしないこと**（RPC 側は
        直接 SQL で叩かれたときの最後の砦で、こちらは利用者向けの説明）。 */
  if (scope !== "vertical" && unique.length > 0) {
    return NextResponse.json(
      { error: "「業界を問わない」「未確認」のときは対象業界を指定できません。" },
      { status: 400 },
    );
  }
  if (scope === "vertical" && unique.length === 0) {
    return NextResponse.json(
      { error: "「特定の業界に張っている」を選んだときは、対象業界を1つ以上選んでください。" },
      { status: 400 },
    );
  }
  if (unique.length === 0 && primaryId !== null) {
    return NextResponse.json(
      { error: "対象業界を選んでいないときは、主を指定できません。" },
      { status: 400 },
    );
  }
  if (unique.length > 0 && primaryId === null) {
    return NextResponse.json({ error: "主の対象業界を1つ選んでください。" }, { status: 400 });
  }
  if (primaryId !== null && !unique.includes(primaryId)) {
    return NextResponse.json(
      { error: "主の対象業界は、選んだ対象業界の中から指定してください。" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_company_target_industries", {
    p_company_id: params.id,
    p_scope: scope,
    p_industry_ids: unique,
    p_primary_industry_id: primaryId,
  });

  if (error) {
    /* ⚠️ error を握りつぶさない。RPC の RAISE は 22023 で上げているので、
          それは利用者に見せてよい 400。それ以外は 500。 */
    console.error(`[PUT /api/admin/companies/${params.id}/target-industries]`, error.message);
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: data ?? 0 });
}

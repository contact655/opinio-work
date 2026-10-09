import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { MAX_APPROACH_BLOCKED_COMPANIES } from "@/lib/constants/approachRange";
import { loadApproachRangeState } from "@/lib/approaches/range";

export const dynamic = "force-dynamic";

/**
 * ★声かけを受け取らない企業（2026-10-10 / 段2）。
 * ⚠️ 「ブロック中の企業」（`ow_scout_blocks`。候補者検索にも出なくなる）とは別。
 *    こちらは声かけだけを止める。候補者検索には出る。
 * ⚠️ 追加すると、その企業からの承認待ちの声かけも受け手の一覧から消える（`listIncomingApproaches`）。
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function me(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[approach-range/blocks] me:", error.message);
  return (data?.id as string | undefined) ?? null;
}

/** ⚠️ 受け取らない企業が変わると、合計の社数も選択肢ごとの社数も変わるので、一式を返す */
async function respond(owUserId: string) {
  const state = await loadApproachRangeState(owUserId);
  if (!state) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { companyId?: unknown };
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  if (!UUID.test(companyId)) return NextResponse.json({ error: "企業を選んでください" }, { status: 400 });

  const db = createAdminClient();
  /* ⚠️ マスタの軸（`/api/companies/lookup` と同じ。掲載の有無は問わない） */
  const { data: company, error: cErr } = await db.from("ow_companies").select("id, is_test").eq("id", companyId).maybeSingle();
  if (cErr) {
    console.error("[approach-range/blocks] company:", cErr.message);
    return NextResponse.json({ error: "追加できませんでした" }, { status: 500 });
  }
  /* ⚠️ 検証用の企業は、検証用の本人だけが入れられる（声かけの判定の is_test 一致と同じ考え方） */
  const { data: self, error: sErr } = await db.from("ow_users").select("is_test").eq("id", owUserId).maybeSingle();
  if (sErr) {
    console.error("[approach-range/blocks] self:", sErr.message);
    return NextResponse.json({ error: "追加できませんでした" }, { status: 500 });
  }
  if (!company || (company.is_test === true && self?.is_test !== true)) {
    return NextResponse.json({ error: "企業が見つかりません" }, { status: 400 });
  }

  const { count, error: nErr } = await db.from("ow_approach_blocked_companies")
    .select("company_id", { count: "exact", head: true }).eq("user_id", owUserId);
  if (nErr) {
    console.error("[approach-range/blocks] count:", nErr.message);
    return NextResponse.json({ error: "追加できませんでした" }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_APPROACH_BLOCKED_COMPANIES) {
    return NextResponse.json({ error: `受け取らない企業は${MAX_APPROACH_BLOCKED_COMPANIES}社までです` }, { status: 400 });
  }

  const { error } = await db.from("ow_approach_blocked_companies")
    .upsert({ user_id: owUserId, company_id: companyId }, { onConflict: "user_id,company_id", ignoreDuplicates: true });
  if (error) {
    console.error("[approach-range/blocks] insert:", error.message);
    return NextResponse.json({ error: "追加できませんでした" }, { status: 500 });
  }
  return respond(owUserId);
}

export async function DELETE(req: NextRequest) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!UUID.test(companyId)) return NextResponse.json({ error: "企業を選んでください" }, { status: 400 });
  const r = await mutateOne(
    createAdminClient().from("ow_approach_blocked_companies").delete().eq("user_id", owUserId).eq("company_id", companyId),
    "approach blocked delete", { returning: "company_id" },
  );
  if (!r.ok) return NextResponse.json({ error: "解除できませんでした" }, { status: r.status });
  return respond(owUserId);
}

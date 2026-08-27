import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET: ブロック中の企業（自動＋手動）を返す。
 *
 * ⚠️ `scout_enabled` は 2026-08-27 に返すのをやめた（フェーズ3）。
 *    スカウトの送信可否は `ow_profiles.career_stance` が決める。
 *    ⚠️ **PUT も削除した。** この列を書く経路はもう無い。
 *       列は残っているが、読む側も書く側もいない。**新しい参照を足さないこと。**
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [blockedResult, manualBlocksResult] = await Promise.all([
    /* ⚠️ 引数名は関数と**完全に一致**させる。RPC は名前が違うだけで 404（PGRST202）になる。
          2026-08-20 まで `candidate_id` で呼んでおり、**ずっと404だった**。
          関数側も規約に合わせて `p_auth_user_id` に改名済み（20260820200000）。 */
    admin.rpc("get_blocked_companies", { p_auth_user_id: user.id }),
    // manual blocks — need the id for DELETE
    admin.from("ow_scout_blocks").select("id, company_id").eq("candidate_id", user.id),
  ]);

  /* ⚠️ **error を捨てない**（2026-08-20）。ここは `?? []` で受けているので、
        RPC が 404（PGRST202・引数名違い）でも権限エラーでも「0件」に見える。
        実際 `candidate_id` という名前で呼んでいて **404 のまま素通りしていた**
        （関数の引数は `p_candidate_id`）。直すのは別タスクだが、まず**見えるようにする**。 */
  if (blockedResult.error) {
    console.error("[scout-settings] get_blocked_companies:", blockedResult.error.message);
  }
  if (manualBlocksResult.error) {
    console.error("[scout-settings] ow_scout_blocks:", manualBlocksResult.error.message);
  }

  // Build a lookup: company_id → block record id (for manual blocks)
  const manualBlockIdMap = new Map<string, string>();
  for (const row of (manualBlocksResult.data ?? [])) {
    if (row.company_id) manualBlockIdMap.set(row.company_id as string, row.id as string);
  }

  const blocks = (blockedResult.data ?? []).map((b: any) => ({
    id: b.block_reason === "manual" && b.company_id ? (manualBlockIdMap.get(b.company_id as string) ?? null) : null,
    company_id: (b.company_id as string | null) ?? null,
    company_name: (b.company_name as string) ?? "不明な企業",
    block_reason: (b.block_reason as "experience" | "manual"),
  }));

  return NextResponse.json({ blocks });
}


// POST: add a manual block
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id } = body as { company_id?: string };
  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("ow_scout_blocks").upsert({ candidate_id: user.id, company_id }, { onConflict: "candidate_id,company_id" });

  return NextResponse.json({ ok: true });
}

// DELETE: remove a manual block
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const blockId = searchParams.get("id");
  if (!blockId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("ow_scout_blocks").delete().eq("id", blockId).eq("candidate_id", user.id);

  return NextResponse.json({ ok: true });
}

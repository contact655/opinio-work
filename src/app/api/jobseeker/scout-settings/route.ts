import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { mutateOne } from "@/lib/supabase/mutate";

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

  /* ★社名は**表示名に畳んでから返す**（2026-09-14）。
        ⚠️ RPC が返すのは `ow_companies.name`（＝「アドビ株式会社」）だが、
           求職者側の画面はどこも表示名（「Adobe」）で出している。
           候補のピッカーは `/api/companies/lookup` 経由で畳まれているので、
           **ここを生のままにすると同じ画面で社名が食い違う。**
        ⚠️ `companyDisplayName` には `name_en` が要るが RPC は返さないので、
           **id でまとめて1回引く**（N+1 にしない）。
        ⚠️ 引けなかったら RPC の `name` に倒す。**「不明な企業」にしない** ——
           社名は取れているのに、畳む材料が無いだけ。 */
  const blockCompanyIds = Array.from(new Set(
    (blockedResult.data ?? []).map((b: any) => b.company_id as string | null).filter(Boolean) as string[]
  ));
  const nameById = new Map<string, string>();
  if (blockCompanyIds.length > 0) {
    const { data: nameRows, error: nameErr } = await admin
      .from("ow_companies")
      .select("id, name, name_en")
      .in("id", blockCompanyIds);
    // ⚠️ 握りつぶさない。失敗しても RPC の名前で出せるので、一覧は消さない
    if (nameErr) console.error("[scout-settings] 社名の解決に失敗:", nameErr.message);
    for (const r of nameRows ?? []) {
      nameById.set(
        r.id as string,
        companyDisplayName(r.name as string, r.name_en as string | null).displayName,
      );
    }
  }

  const blocks = (blockedResult.data ?? []).map((b: any) => ({
    id: b.block_reason === "manual" && b.company_id ? (manualBlockIdMap.get(b.company_id as string) ?? null) : null,
    company_id: (b.company_id as string | null) ?? null,
    company_name:
      (b.company_id ? nameById.get(b.company_id as string) : null)
      ?? (b.company_name as string)
      ?? "不明な企業",
    block_reason: (b.block_reason as "experience" | "manual"),
  }));

  return NextResponse.json({ blocks });
}


/**
 * POST: 手動のブロックを1件足す。
 *
 * ⚠️★**戻り値を捨てない**（2026-09-14 に修正）。それまで
 *    `await admin.from(...).upsert(...)` と書いて**結果を丸ごと捨てていた**ので、
 *    FK 違反（実在しない `company_id`）でも不正な uuid でも **`{ok:true}` を返していた。**
 *    画面は「追加できませんでした」を出さず、一覧に出てこないだけになる。
 *    ⚠️ `try/catch` では捕まらない —— supabase-js はエラーを**戻り値**で返す。
 *
 * ⚠️ `ow_scout_blocks` は **UNIQUE (candidate_id, company_id)** を持つので、
 *    `onConflict` 付きの upsert は**必ず1行**（挿入か更新）になる。だから `mutateOne`。
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { company_id } = body as { company_id?: string };
  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const admin = createAdminClient();
  const r = await mutateOne(
    admin
      .from("ow_scout_blocks")
      .upsert({ candidate_id: user.id, company_id }, { onConflict: "candidate_id,company_id" }),
    "スカウトのブロック追加",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE: 手動のブロックを1件外す。
 *
 * ⚠️★**戻り値を捨てない**（2026-09-14 に修正）。POST と同じ理由。
 *    加えてここは `.eq("candidate_id", user.id)` が**他人の行を消させない唯一の壁**で、
 *    捨てていると「**他人の id を渡して 0行 → `{ok:true}`**」になっていた
 *    （実際には消えていないので害は無いが、**弾いたことが誰にも分からない**）。
 *
 * ⚠️ 0行は 404（`mutateOne`）。二重クリックでは `busyCompanyId` が止めるので、
 *    404 が出るのは**本当に対象が無いとき**だけ。
 */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const blockId = searchParams.get("id");
  if (!blockId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const r = await mutateOne(
    admin.from("ow_scout_blocks").delete().eq("id", blockId).eq("candidate_id", user.id),
    "スカウトのブロック解除",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ ok: true });
}

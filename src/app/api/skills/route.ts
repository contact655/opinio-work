import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 標準スキルのマスタ一覧（2026-08-27）。**公開。認証は要らない。**
 * `ow_skills` は `USING (true)` で anon にも開いているマスタなので、隠すものが無い。
 *
 * ⚠️ 形は `/api/languages` に揃えてある。**片方を直すときはもう片方も見ること。**
 * ⚠️ `tool_id` は返さない。画面でも `/search` でも使わない列で、
 *    返すと「使ってよい値」に見える。
 */
export async function GET() {
  const { data, error } = await createClient()
    .from("ow_skills")
    .select("id, label, category, aliases")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  /* ⚠️ error を握りつぶさない。`?? []` だけで受けると「0件」に化け、
        ピッカーが「選択肢なし」になった理由が分からなくなる */
  if (error) {
    console.error("[GET /api/skills]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ skills: data ?? [] });
}

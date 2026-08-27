import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 言語マスタの一覧（2026-08-27）。**公開。認証は要らない。**
 * `ow_languages` は `USING (true)` で anon にも開いているマスタなので、隠すものが無い。
 *
 * ⚠️ **`iso_639_1` は返さない。** 画面にも `/search` にも使わない列で、
 *    返すと「使ってよい値」に見える。`it`（イタリア語）が「IT業界」に当たるなど
 *    2文字コードは誤爆源になる（migration の冒頭を参照）。
 *
 * ⚠️ 未ログインでも読める。RLS は `USING (true)`、GRANT は anon にもある。
 */
export async function GET() {
  const { data, error } = await createClient()
    .from("ow_languages")
    .select("id, label, aliases")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  /* ⚠️ error を握りつぶさない。`?? []` だけで受けると「0件」に化け、
        ピッカーが「選択肢なし」になった理由が分からなくなる */
  if (error) {
    console.error("[GET /api/languages]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ languages: data ?? [] });
}

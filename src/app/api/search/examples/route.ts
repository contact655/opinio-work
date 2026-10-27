import { NextResponse } from "next/server";
import { getTransitionExamples } from "@/lib/search/transitionExamples";

/**
 * ★ヘッダーの検索の「こんなことばで探せます」に足す、移動の例文（2026-10-27）。
 *   いまのデータで当てはまる人が3人以上いる文だけ（lib/search/transitionExamples.ts）。人数や中身は返さない。文だけ
 * ⚠️ force-dynamic（GET のルートは既定でキャッシュされる。CLAUDE.md）。中身は unstable_cache で1時間持つ
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const examples = await getTransitionExamples();
  return NextResponse.json({ examples }, { headers: { "Cache-Control": "public, max-age=600" } });
}

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { COMPANY_REASON_RANKINGS_TAG, rebuildCompanyReasonRankings } from "@/lib/joinDecision/server";

export const dynamic = "force-dynamic";
/* ★キャッシュしない。⚠️ 外さないこと（rebuild-transitions の「9日間 200 を返しながら何もしていなかった」と同じ層） */
export const fetchCache = "force-no-store";

/**
 * ★会社ごとの入社の決め手の上位3つを入れ直す（毎月1日・2026-11-02）。
 *   ⚠️ 300秒ごとの再計算はやめた。企業ページはこの結果（ow_company_reason_rankings）を読むだけ。
 *   ⚠️ 回答が10人（MIN_REASON_COUNT）以上の会社だけ。人数は保存しない。
 *   スケジュールは vercel.json（毎月1日 0:00 UTC ＝ 日本時間 9:00）。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Supabase env not configured", { status: 500 });
  }
  try {
    const r = await rebuildCompanyReasonRankings(createNoStoreAdminClient());
    if (!r.ok) {
      console.error("[cron/rebuild-reason-rankings]", r.error);
      return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
    }
    revalidateTag(COMPANY_REASON_RANKINGS_TAG);
    console.log(`[cron/rebuild-reason-rankings] ${r.companies}社・${r.rows}行`);
    return NextResponse.json(r);
  } catch (e) {
    console.error("[cron/rebuild-reason-rankings] 例外:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

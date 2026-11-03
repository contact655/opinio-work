import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { expireTalkRequests } from "@/lib/talk/server";

export const dynamic = "force-dynamic";
/* ★キャッシュしない。⚠️ dynamic だけでは supabase-js の fetch キャッシュが止まらない（rebuild-transitions の「9日間」）。二重にしてある */
export const fetchCache = "force-no-store";

/**
 * ★返事の無いまま14日たった「話を聞く」依頼を、自動で辞退にする（2026-11-03 / 毎日）。
 *   中身は lib/talk/server.ts の expireTalkRequests。受け手の一覧から消し、送った側にだけ「今回はお話しできないようです」と出す。
 * ⚠️ この cron はメールを送らない。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  /* ⚠️ 長さが違うと timingSafeEqual が投げるので、先に長さを見る */
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Supabase env not configured", { status: 500 });
  }
  const r = await expireTalkRequests(createNoStoreAdminClient());
  if ("error" in r) {
    console.error("[cron/expire-talk-requests]", r.error);
    return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  }
  console.log(`[cron/expire-talk-requests] 自動で辞退 ${r.expired} 件 ／ 返事ありに直した ${r.answered} 件`);
  return NextResponse.json({ ok: true, ...r });
}

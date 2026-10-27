import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { deliverPendingInterests, sweepInterestReplies } from "@/lib/interest/server";

export const dynamic = "force-dynamic";
/**
 * ★★キャッシュしない（外さないこと）。lib/interest/server.ts は admin クライアントで読むので、
 *    宣言が無いと Next の fetch キャッシュに載り、**前回の結果を再生し続ける**（check-test-leftovers の注記と同じ）。
 */
export const fetchCache = "force-no-store";

/**
 * ★「話を聞いてみたい」の日次の確認（2026-10-27 / 話を聞きたい人 フェーズ1a）。
 *   ① 担当者の登録待ち（awaiting_contact）で、会社に担当者が付いたもの → 押してから90日以内なら届けて本人に知らせる。
 *      過ぎたものは届けず、もう一度押すか本人に聞く（expired）
 *   ② 届けたもの（delivered）→ 企業から返事があれば replied。14日たっても無ければ no_reply にして本人に知らせる（1回だけ）
 * ⚠️ 判定は lib/interest/server.ts の1か所。ここに条件を書き写さない。
 * ⚠️ 担当者の承諾（/api/biz/members/invite/accept など）の直後にも①を呼んでいる。ここは取りこぼしを拾う役。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const startedAt = Date.now();
    const pending = await deliverPendingInterests();
    const replies = await sweepInterestReplies();
    const durationMs = Date.now() - startedAt;
    console.log(`[cron/interest-followup] pending=${JSON.stringify(pending)} replies=${JSON.stringify(replies)} ${durationMs}ms`);
    return NextResponse.json({ ok: true, pending, replies, durationMs, checkedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/interest-followup]", e);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { loadInterestWaiting } from "@/lib/admin/interestWaiting";
import { sendEmail } from "@/lib/notify/email";
import { weeklySavedCompaniesAdminTemplate } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";
/** ★キャッシュしない（外さないこと）。check-test-leftovers の注記と同じ理由で、前回の結果を再生し続けないようにする */
export const fetchCache = "force-no-store";

/**
 * ★週1回（月曜 9:00 JST ＝ 月曜 0:00 UTC。vercel.json の "0 0 * * 1"）の運営向けまとめ（2026-10-27 / 柴さんの指示）。
 *   「今週の『保存』が多い企業（担当者なし）」。中身は /admin/interests と同じ（lib/admin/interestWaiting.ts の1か所）。
 * ⚠️ 名前は載せない。⚠️ 保存が0件の週は送らない（「今週も0件でした」を送ると読まれなくなる）。
 * ⚠️ 取得に失敗したときは送らずに 500 を返す（0件に化けさせない。ログに出す）。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const startedAt = Date.now();
  const rows = await loadInterestWaiting();
  const durationMs = Date.now() - startedAt;
  if (rows === null) {
    console.error("[cron/weekly-saved-companies] 取得に失敗した（0件ではない）");
    return NextResponse.json({ ok: false, error: "failed", durationMs }, { status: 500 });
  }
  const withSaves = rows.filter((r) => r.count > 0);
  if (withSaves.length === 0) {
    console.log(`[cron/weekly-saved-companies] 0件のため送らない ${durationMs}ms`);
    return NextResponse.json({ ok: true, sent: false, companies: 0, durationMs, checkedAt: new Date().toISOString() });
  }
  await sendEmail(weeklySavedCompaniesAdminTemplate({
    rows: withSaves.map((r) => ({ name: r.name, count: r.count, firstAt: r.firstAt, isTest: r.isTest })),
  }));
  console.log(`[cron/weekly-saved-companies] companies=${withSaves.length} ${durationMs}ms`);
  return NextResponse.json({ ok: true, sent: true, companies: withSaves.length, durationMs, checkedAt: new Date().toISOString() });
}

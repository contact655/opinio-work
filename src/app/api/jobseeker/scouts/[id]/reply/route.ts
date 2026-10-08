import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ★★スカウトは廃止した（2026-10-08）。返答の受け口も閉じた。**410 を返すだけ。**
 * ⚠️ 受信実績は0件だった（`ow_scouts` 0行。2026-10-08 実測）。
 * ⚠️ 詳細は `src/app/api/biz/scouts/route.ts` の冒頭。
 */
export async function POST() {
  return NextResponse.json({ error: "スカウト機能は終了しました。" }, { status: 410 });
}

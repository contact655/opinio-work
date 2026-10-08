import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ★★スカウトは廃止した（2026-10-08 / 柴さんの判断）。**410 を返すだけ。復活させないこと。**
 *
 * 企業が一方的に送る機能は持たず、OPINIO が根拠をそろえて出す「提案」
 * （`/biz/proposals`。双方が「会いたい」と答えたらつながる）に一本化した。
 *
 * ⚠️ 送信実績は0件だった（`ow_scouts` 0行。2026-10-08 実測）。
 * ⚠️ ルートごと消さずに 410 を返すのは、古いクライアントから叩かれたときに
 *    404（存在しない）ではなく「終了した」と分かるようにするため。
 * ⚠️ 表・トリガー・列の DROP は `supabase/pending/` に置いてある（未適用）。
 * ⚠️★`can_send_scout()` と `ow_scout_blocks` は**消さない。** 名前に反して中身は
 *    「この企業にこの候補者を見せてよいか」で、候補者検索と提案が使っている。
 */
function gone() {
  return NextResponse.json(
    { error: "スカウト機能は終了しました。候補者とは「提案」からつながれます。" },
    { status: 410 },
  );
}

export async function GET() {
  return gone();
}

export async function POST() {
  return gone();
}

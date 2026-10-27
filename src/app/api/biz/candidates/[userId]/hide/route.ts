import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ⚠️★候補者の「見送り」は 2026-10-28 に廃止した（柴さんの指示）。画面からボタンを外し、一覧から隠す処理もやめた。
 *   古い画面から呼ばれたときのために 410 を返すだけにしてある。
 * ⚠️ 既存の記録（ow_candidate_hidden）は消さない（DELETE も 410。記録を書き換えない）。表も残してある。
 */
const GONE = { error: "GONE", message: "「見送り」は終了しました。" };

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}

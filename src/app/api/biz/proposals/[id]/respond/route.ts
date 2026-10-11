import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ★企業の返答（会う／今回は見送る）は 2026-10-11 に廃止した（柴さんの指示）。
 *   求職者が「話を聞いてみたい」と答えたら、どの企業でもその場で会話を作る（lib/evidence/respond.ts）。
 * ⚠️ 古い画面から呼ばれても何も書かない。戻さないこと。
 */
const gone = () => NextResponse.json({ error: "この操作は終了しました" }, { status: 410 });
export async function POST() {
  return gone();
}

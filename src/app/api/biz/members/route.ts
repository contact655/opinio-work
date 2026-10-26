import { NextResponse } from "next/server";

/**
 * ⚠️★2026-10-26 に廃止した（フェーズ1a-1）。410 を返すだけ。
 *
 * このルートは既にアカウントがある人を、**本人の承諾なしに**担当者として直接追加していた
 * （`ow_company_admins` に is_active=true の行を作る）。画面からは呼ばれていなかったが、
 * API を直接叩けば同じことができた。
 *
 * 担当者を増やす入口は **`POST /api/biz/members/invite`** だけ。相手にアカウントがあってもなくても
 * 招待の行（is_active=false）を作り、本人が承諾したときだけ有効になる。
 * ⚠️ 直接追加する経路を作り直さないこと。
 */
export async function POST() {
  return NextResponse.json(
    { error: "メンバーの追加は招待から行ってください。相手が承諾すると担当者になります。", code: "GONE" },
    { status: 410 },
  );
}

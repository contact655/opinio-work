import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ⚠️★「掲載を依頼する」は 2026-10-28 に廃止した（柴さんの判断。公開は企業、停止は運営）。
 *   企業は POST /api/biz/company/listing で自分で公開する（lib/companies/listing.ts）。
 *   古い画面から呼ばれたときのために 410 を返すだけにしてある。
 * ⚠️ ow_companies.listing_requested_at の列とデータは残してある（もう書かない）。
 */
export async function POST() {
  return NextResponse.json(
    { error: "GONE", message: "「掲載を依頼する」は終了しました。企業ページの編集画面の「公開する」から公開できます。" },
    { status: 410 },
  );
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchIndustryOptions } from "@/lib/companies/industries";

/**
 * GET /api/industries — 業種の選択肢（有効なものだけ）。
 *
 * ⚠️★**選択肢を作り直さない。** 実体は `fetchIndustryOptions` 1本で、
 *    サーバーコンポーネント（`/biz/companies/add/new`）と同じものを返す。
 *    ここに独自の絞り込みや並び替えを書くと、画面ごとに選択肢が割れる。
 *
 * ⚠️ 認証は要らない（業種マスタは公開情報で、anon にも
 *    `is_active = true` の読み取りポリシーがある）。
 *    ただし**企業データではない**ので、ここから企業の情報は一切返さない。
 */
export async function GET() {
  const industries = await fetchIndustryOptions(createAdminClient(), "api/industries");
  /* ⚠️ 空で返ってきたら、それは取得失敗の可能性がある（`fetchIndustryOptions` は
        error を console.error に出したうえで空配列を返す）。**200 で空を返さない。**
        選択肢が空だと画面は「業種が1つも無い」状態になり、
        利用者には「壊れている」と「まだ無い」の区別が付かない。 */
  if (industries.length === 0) {
    return NextResponse.json({ error: "業種の取得に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ industries });
}

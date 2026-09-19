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
/**
 * ★★キャッシュしない（2026-09-20 に追加）。
 *
 * ⚠️★**宣言が無いと Next 14 は GET のルートハンドラをキャッシュする。**
 *    2026-09-20 に業種の小分類を29件足したとき、**DB には53行あるのに
 *    この API は古い22行を返し続けた**（`Cache-Control: no-cache` を付けたときだけ
 *    51行が返って気づいた）。
 *    ⚠️ その状態だと、小分類を足しても**画面には出ない**。運営が業種マスタを
 *       足す日にコード変更が無ければ、デプロイのきっかけも無い
 *       （CLAUDE.md「コード変更が1行も無い migration はデプロイのきっかけ自体が発生しない」）。
 *
 * ⚠️ `revalidate` の秒数ではなく `force-dynamic` にしたのは、
 *    **業種マスタが変わるのは運営が足した瞬間だけ**で、頻度が極端に低いから。
 *    キャッシュで守るほどのアクセスが無い（選択肢は1画面でしか使わない）。
 * ⚠️★**この宣言を外さないこと。** 外すと「足したのに出ない」に戻る。
 */
export const dynamic = "force-dynamic";

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

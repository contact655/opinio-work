/**
 * LINE公式アカウント（Opinio Agent）への導線。**このリポジトリでの置き場はここだけ。**
 * 各ページに URL を直書きしないこと。
 *
 * ⚠️★**正は別リポジトリ**（`opinio-corporate/lib/line.ts`。2026-10-02 に導入）。
 *    リポジトリをまたいで import できないので、同じ値をここに写してある（2026-10-04）。
 *    **ID を変えるときは両方を同時に直すこと。** 片方だけだと、図鑑から古いアカウントへ飛ぶ。
 */
export const LINE_BASIC_ID = "@209tfsyc";
export const LINE_ADD_FRIEND_URL = `https://line.me/R/ti/p/${LINE_BASIC_ID}`;

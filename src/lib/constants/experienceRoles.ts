/**
 * 1つの経歴に紐づけられる職種の上限。
 *
 * ⚠️ **UI と API の両方がここを見る。** 片方だけ増やすと
 *    「選べたのに保存されない（API が切り捨てる）」か
 *    「保存できるのに選べない」のどちらかになる。
 *
 * ⚠️ この定数を route.ts の中に置かないこと。Next.js の App Router は
 *    route ファイルからの任意の export を許さず、`npm run build` の
 *    型生成（.next/types）で落ちる（2026-08-14 に実際に踏んだ）。
 */
export const MAX_ROLES_PER_EXPERIENCE = 5;

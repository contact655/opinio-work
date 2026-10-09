/**
 * メッセージ（DM）の上限（2026-08-27）。
 *
 * ⚠️ **route の中に数字を書き写さないこと。** UI と API が同じ定数を見る
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 *    ⚠️ どちらも**行数ではなく長さと件数**の制約なので、DB の CHECK は張っていない
 *       （濃度の制約は UI と API の2層。同じく CLAUDE.md）。
 */

/** 1通の本文の長さ。⚠️ `/api/dm/message` の既存の上限と同じ値にしてある */
export const MAX_DM_LENGTH = 5000;

/**
 * 一度に選べる宛先の数。
 *
 * ⚠️ **すでにある会話にしか送れない**ので、無差別な一斉送信にはならない。
 *    それでも上限を置くのは、1回のリクエストで DB への書き込みが宛先ぶん走るため。
 */
export const MAX_BULK_RECIPIENTS = 20;

/* ── ★メッセージのお願い（2026-10-09 / 段階3）──────────────────────────────────
      DM の最初の1通は「お願い」として届き、受け手が承認するまで続きは送れない。
      ⚠️ 判定は `lib/conversations/messageRequest.ts` の1か所。route に数字を書き写さない。
      ⚠️ 件数の上限（濃度）なので、DB の CHECK は張らない。UI と API の2層で守る。 */

/** お願いの本文の長さ。⚠️ `/api/dm/start` の既存の上限と同じ値 */
export const MAX_MESSAGE_REQUEST_LENGTH = 2000;

/** 1日（日本時間の0時区切り）に送れる新しいお願いの数 */
export const MESSAGE_REQUEST_DAILY_LIMIT = 10;

/**
 * 承認待ちのまま並べられるお願いの数。
 * ⚠️★**断られたものも数える。** 送り手には断られたことを伝えない決まりなので、
 *    断られた分だけ枠が空くと、枠の増減から断られたことが分かってしまう。
 */
export const MESSAGE_REQUEST_OPEN_LIMIT = 20;

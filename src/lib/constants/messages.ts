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
/* ⚠️ 2026-10-17 から、個人どうしの最初の1通は「ひとこと」100字（FIRST_NOTE_MAX / lib/constants/messageTopics.ts）。
   この値は企業からのメッセージの本文の上限（APPROACH_BODY_MAX）と揃えるために残してある */
export const MAX_MESSAGE_REQUEST_LENGTH = 2000;

/**
 * ★「メッセージを送る」（キャリア相談ではない最初の1通。あいさつ・お礼・連絡など）の本文の長さ（2026-10-20）。
 *   キャリア相談の「ひとこと」（FIRST_NOTE_MAX = 100）より長くしてある。テーマを選ばない代わりに、用件を本文で伝えるため。
 *   ⚠️ 返信までは1通だけ・1日10件・返事待ち20件の決まりはキャリア相談と同じ（messageRequest.ts）
 */
export const GENERAL_FIRST_MESSAGE_MAX = 500;

/** 1日（日本時間の0時区切り）に送れる新しいお願いの数 */
export const MESSAGE_REQUEST_DAILY_LIMIT = 10;

/**
 * 承認待ちのまま並べられるお願いの数。
 * ⚠️★**断られたものも数える。** 送り手には断られたことを伝えない決まりなので、
 *    断られた分だけ枠が空くと、枠の増減から断られたことが分かってしまう。
 */
export const MESSAGE_REQUEST_OPEN_LIMIT = 20;

/* ── ★返信が無くても、もう1通（2026-10-22 / 柴さんの判断・A案）────────────────────────
      個人どうしの返事待ちのメッセージに、追いのメッセージを1通だけ足せる。1通目から3日あける。
      ⚠️ 企業からのメッセージ（ow_company_approaches）には効かない。あちらは「返信があるまで同じ人へ続けて送れない」のまま
      ⚠️ 判定は lib/conversations/messageRequest.ts の pendingFollowUpState の1か所。画面に数字を書き写さない */

/** 返事待ちのあいだに、最初の1通のほかに送れる数 */
export const PENDING_FOLLOW_UP_MAX = 1;
/** 1通目から何日あければ送れるか */
export const PENDING_FOLLOW_UP_AFTER_DAYS = 3;
/** 追いのメッセージの本文の長さ（「メッセージを送る」の1通目と同じ） */
export const PENDING_FOLLOW_UP_MAX_LENGTH = GENERAL_FIRST_MESSAGE_MAX;

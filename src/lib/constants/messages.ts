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
 * ★返事待ちにできる新しい相手の数（2026-11-05 に 20 → 5 / 柴さんの指示）。
 *   値は ow_settings の `message_request_open_limit` で運営が変えられる（無い・壊れていればこの値）。読むのは openRequestLimit。
 * ⚠️★**黙って見送られたものも数える。** 送り手には断られたことを伝えない決まりなので、
 *    見送られた分だけ枠が空くと、枠の増減から断られたことが分かってしまう。
 *    ⚠️ 代わりに、送ってから MESSAGE_REQUEST_OPEN_WINDOW_DAYS 日たった返事待ちは数えない（時間で戻るので、断られたかは分からない）。
 *    返信（「今回は難しいです」のワンタップ返信を含む）があれば、その時点で枠が戻る。
 */
export const MESSAGE_REQUEST_OPEN_LIMIT = 5;

/** ow_settings のキー */
export const MESSAGE_REQUEST_OPEN_LIMIT_SETTING_KEY = "message_request_open_limit";

/** 返事待ちを枠に数える日数。これより古い返事待ちは数えない */
export const MESSAGE_REQUEST_OPEN_WINDOW_DAYS = 14;

/** 設定の値を上限にする。1〜100 の整数でなければ既定の値（⚠️ 0 や空で送れなくなる形にしない） */
export function openRequestLimit(settingValue: string | null | undefined): number {
  if (typeof settingValue !== "string" || !/^\d+$/.test(settingValue.trim())) return MESSAGE_REQUEST_OPEN_LIMIT;
  const n = Number(settingValue.trim());
  return n >= 1 && n <= 100 ? n : MESSAGE_REQUEST_OPEN_LIMIT;
}

/** これより後に送った返事待ちだけを数える（境目ちょうどは数えない） */
export function openRequestWindowStart(now: Date): Date {
  return new Date(now.getTime() - MESSAGE_REQUEST_OPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** その返事待ちを枠に数えるか（DB の絞り込み gt openRequestWindowStart と同じ境目） */
export function isCountedPending(requestedAt: string, now: Date): boolean {
  const t = new Date(requestedAt).getTime();
  return !Number.isNaN(t) && t > openRequestWindowStart(now).getTime();
}

/* ── ★返信が無くても、続けて送れる（2026-10-22 に A案「3日後にもう1通」で入れ、2026-10-23 に回数と日数の制限を外した / 柴さんの指示）──
      個人どうしの返事待ちのメッセージに、送り手は返信を待たずに何通でも足せる。
      ⚠️ 企業からのメッセージ（ow_company_approaches）には効かない。あちらは「返信があるまで同じ人へ続けて送れない」のまま
      ⚠️ 判定は lib/conversations/messageRequest.ts の pendingFollowUpState の1か所 */

/** 返事待ちのあいだに足すメッセージの本文の長さ（「メッセージを送る」の1通目と同じ） */
export const PENDING_FOLLOW_UP_MAX_LENGTH = GENERAL_FIRST_MESSAGE_MAX;

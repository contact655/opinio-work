/**
 * ★集計の母数に入れてよい人か（2026-10-26 / フェーズ1a-2）。**集計はすべてここを通す。**
 *
 * 外す人:
 *   - 本人が登録していない（`auth_id` が null。運営が履歴書から起こした行など）
 *   - 検証用（`is_test`）・システム（`is_system`）・`@seed.internal`
 *   - プロフィールが非公開（`visibility = 'private'`）
 *   - ★**統計利用を停止した人**（`ow_users.statistics_opt_out`。規約 第13条の4 第5項
 *     「速やかに当該ユーザーの情報を統計処理の対象から除外します」）
 *
 * 「除く」とは、**件数にも中身にも数えない**こと。割合の分母にも、決め手の集計にも、
 * 遷移（人の流れ）にも入れない。
 *
 * ⚠️★**人数の下限（`MIN_AGGREGATE_COUNT`）は、ここで外したあとで数える。**
 * ⚠️★`statistics_opt_out` は anon / authenticated に SELECT を配っていない列。
 *    読めるのは admin クライアントだけなので、**集計は admin クライアントで行う**
 *    （セッションで引くとクエリごと 403 になり、`?? []` で受けると「0件」に化ける）。
 * ⚠️★select から `statistics_opt_out` を落とさないこと。undefined になると
 *    停止した人が**黙って数えられる**（型では気づけない）。`AGGREGATE_USER_COLUMNS` を使う。
 * ⚠️ これは**集計**の判定。人を1人ずつ並べる一覧（企業ページの社員カード・検索の人の結果）は
 *    統計ではないので、この判定では外さない（公開範囲の判定が別にある）。
 *
 * 純粋な関数（DB に触らない）。`node --test` からも読める。
 */

/** ★埋め込みの select に入れる列。`ow_users!user_id(${AGGREGATE_USER_COLUMNS})` の形で使う */
export const AGGREGATE_USER_COLUMNS = "auth_id, is_test, is_system, visibility, statistics_opt_out" as const;

export type AggregateUser = {
  auth_id: string | null;
  is_test: boolean | null;
  is_system: boolean | null;
  visibility: string | null;
  statistics_opt_out: boolean | null;
  email?: string | null;
};

export function isAggregatableUser(u: AggregateUser | null | undefined): boolean {
  if (!u) return false;
  if (u.auth_id == null) return false;
  if (u.is_test === true) return false;
  if (u.is_system === true) return false;
  if (u.visibility === "private") return false;
  /* ⚠️ `=== false` で見ない。列を取り忘れて undefined のときに数えてしまう向きを避けるため、
        「true なら外す」に加えて、undefined も外す（取得漏れを数えない向きに倒す）。 */
  if (u.statistics_opt_out !== false) return false;
  if (typeof u.email === "string" && u.email.toLowerCase().endsWith("@seed.internal")) return false;
  return true;
}

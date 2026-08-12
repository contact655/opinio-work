/**
 * 経歴エディタが**往復させる**列のリスト。
 *
 * ── なぜ1箇所に置くか（2026-08-12）──────────────────────────────────────────
 * `CareerHistoryEditor` は draft の値をそのまま PUT で送り、
 * `PUT /api/jobseeker/experiences/[id]` は**送られなかった列を null に上書きする**。
 * したがって初期取得の SELECT で1列でも取り忘れると、
 * **利用者が別の項目を直して保存した瞬間にその列が消える。**
 *
 * 同じ事故を3回起こしている。
 *
 *   2026-08-06  salary_man        … 入力UIを消したとき（PUT を条件付きにして回避）
 *   2026-08-12  勤務地・理由5列    … 追加時に SELECT へ入れて回避（気づけたのは偶然）
 *   2026-08-12  department / rank / visibility 3列 … **実際に消える状態だった**
 *
 * 3件目は department(7件) と rank(8件) が null になるだけでなく、
 * `visibility_company` / `visibility_company_profile` / `visibility_reason` が
 * `?? "real"` / `?? true` の既定値に化けていた。
 * 「会社名を含めない」「入社理由を公開しない」を選んだ人の設定が、
 * 別項目を直して保存しただけで**公開側に反転する**状態だった（実データ8行が該当）。
 *
 * ⚠️ **経歴に列を足すときに触る4箇所**
 *      ① このファイル（SELECT の列リスト）
 *      ② PUT / POST の update / insert オブジェクト
 *      ③ `Stint` 型（CareerHistoryEditor.tsx）
 *      ④ `draftFromStint()` と `StintDraft` / `EMPTY_DRAFT`
 *    ①だけ足しても draft に載らなければ意味がない。④まで通すこと。
 *
 * ⚠️ **`?? 既定値` で埋めないこと。** DB が NOT NULL の列（visibility 系）は
 *    「取れなかった＝取得漏れ」なので、既定値に倒すとこの事故が再発したときに
 *    黙って通ってしまう。`Stint` 側で必須にして型で落とす。
 */

/**
 * 初期取得で SELECT する列。**admin クライアントで読むこと。**
 * `join_reason` と理由データ3種は authenticated の列単位 GRANT が無いので、
 * session クライアントで select するとクエリごと 403 になる。
 *
 * ⚠️ **年収4列（salary_man / salary_base / salary_bonus / salary_stock）は意図的に入れていない。**
 *    2026-08-06 に入力UIを撤去し authenticated から SELECT 権限も剥奪した。
 *    PUT 側も `"salary_x" in body` のときだけ書く形なので、
 *    取らない＝消えるではない。ここに足すと撤去した意図と食い違う。
 */
/*
  ⚠️ **1本の文字列リテラル + `as const` で書くこと。**
     配列を `.join()` すると型が `string` に落ち、supabase-js が select 文字列を
     型解決できなくなって行の型が `GenericStringError` に化ける
     （2026-08-12 に実際に踏んだ。tsc が20件以上のエラーを出す）。
     見た目より型が通ることを優先する。
*/
export const EXPERIENCE_EDITOR_COLS =
  "id, company_id, company_text, company_anonymized, role_category_id, role_title, department, rank, started_at, ended_at, is_current, description, join_reason, employment_type, display_order, visibility_company, visibility_company_profile, visibility_salary, visibility_reason, prefecture, remote_work_status, join_reasons, join_reason_primary, leave_reasons" as const;

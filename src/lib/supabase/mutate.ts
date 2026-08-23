/**
 * 0行更新をエラーとして扱うための小さなヘルパー。
 *
 * ── なぜ要るか ────────────────────────────────────────────────────────────
 * **supabase-js の update / delete は、0行に一致しても `error` が null で返る。**
 * `.select()` を付けずに `error` だけを見ていると、
 * 「更新されなかった」を「成功した」と読んでしまう。
 *
 * これまでに3回踏んでいる。**いずれも画面はエラーを出さなかった。**
 *   ・2026-08-11 企業ロゴURLの一括更新 … RLS の `ow_companies_own_update` が
 *     `auth.uid() = user_id` を要求し、その列は85社中2社にしか入っていないため
 *     **83社で0行更新**。入力欄は保存されたように見えていた
 *   ・2026-08-23 `PATCH /api/biz/company` … 同じ理由で **85社で保存されていない**
 *   ・2026-08-23 `ow_job_roles` の入れ替え … 書き込みポリシーが1本も無く、
 *     **DELETE は黙って0行 / INSERT は 403**。しかも `try/catch` で囲まれていたが
 *     **supabase-js は例外を投げない**ので捕まらず、派生値だけが書かれていた
 *
 * ⚠️ **いずれもコードの書き方ではなく RLS の条件が原因。**
 *    アプリを読んでも気づけない。**行数を見る以外に検知する方法が無い。**
 *
 * ⚠️ **`try/catch` は効かない。** supabase-js はエラーを戻り値で返す。
 *    囲っても素通りする。
 *
 * ── 使い方 ────────────────────────────────────────────────────────────────
 * ```ts
 * // 1行だけ変わるはず（見つからなければエラー）
 * const r = await mutateOne(
 *   supabase.from("ow_companies").update({ tagline }).eq("id", companyId)
 * );
 * if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
 *
 * // 複数行が変わりうる（0行はエラー）
 * const r = await mutateMany(supabase.from("ow_job_roles").insert(rows), "職種の登録",
 *                            { returning: "job_id" });
 *
 * // 0行でも正常（消したいものが元から無い等）
 * const r = await mutateAllowNone(
 *   supabase.from("ow_job_roles").delete().eq("job_id", jobId),
 *   "職種の入替（掃除）", { returning: "job_id" },
 * );
 * ```
 *
 * ⚠️ **`.select()` は呼び出し側で書かない。** このヘルパーが付ける。
 *    素で `.select()` を書くと**引数なしになりがちで、全列を返してしまう**
 *    （列単位 GRANT を剥がした列があると 403 になる。CLAUDE.md の既知の罠）。
 *    既定は `.select("id")`。
 *
 * ⚠️ **`id` 列を持たない表がある。** 中間テーブルは複合主キーのことが多い。
 *    そのときは `returning` に実在する列を渡すこと。
 *      `ow_job_roles`      … 主キーは **(job_id, role_id)**。`id` 列は無い
 *      `ow_company_genres` … 主キーは **(company_id, genre_id)**。`id` 列は無い
 *    ⚠️ **返す列は「行数を数えるため」だけに使う。** 中身は見ないので主キーの
 *       一部で足りる。**列を増やさないこと**（GRANT に弾かれる）。
 */

import type { PostgrestError } from "@supabase/supabase-js";

export type MutateResult =
  | { ok: true; count: number }
  | { ok: false; count: number; error: string; code?: string; status: number };

/** ヘルパーの共通オプション。`returning` は**行数を数えるために返す列**。 */
export type MutateOptions = { returning?: string };

/** supabase-js のクエリビルダのうち、`.select()` を生やせるもの */
type SelectableBuilder = {
  select: (columns: string) => PromiseLike<{
    data: unknown[] | null;
    error: PostgrestError | null;
  }>;
};

async function run(
  builder: SelectableBuilder,
  opts: { allowNone: boolean; label: string; returning: string },
): Promise<MutateResult> {
  const { data, error } = await builder.select(opts.returning);

  if (error) {
    /* ⚠️ error は握り潰さない（CLAUDE.md）。呼び出し側が拾わなくてもログに残す。 */
    console.error(`[mutate] ${opts.label}:`, error.message, error.code ?? "");
    return {
      ok: false,
      count: 0,
      error: error.message,
      code: error.code,
      // 42501 は権限・RLS 拒否。それ以外は 500 に倒す
      status: error.code === "42501" ? 403 : 500,
    };
  }

  const count = data?.length ?? 0;
  if (count === 0 && !opts.allowNone) {
    /* ⚠️ **ここが本題。** 0行は「対象が見つからない」か「RLS に弾かれた」。
          呼び出し側からは区別できないので 404 に倒し、ログに残す。 */
    console.error(`[mutate] ${opts.label}: 0行更新（対象が無いか RLS が拒否した）`);
    return {
      ok: false,
      count: 0,
      error: "対象が見つかりませんでした",
      status: 404,
    };
  }
  return { ok: true, count };
}

/**
 * **ちょうど1行変わるはず**の更新・削除。
 * 0行ならエラー。2行以上は**エラーにせず警告だけ出す**
 * （条件の書き漏れを知らせるが、処理は止めない）。
 */
export async function mutateOne(
  builder: SelectableBuilder,
  label = "mutateOne",
  opts: MutateOptions = {},
): Promise<MutateResult> {
  const r = await run(builder, {
    allowNone: false, label, returning: opts.returning ?? "id",
  });
  if (r.ok && r.count > 1) {
    console.warn(`[mutate] ${label}: ${r.count}行が変わった（1行のつもりだった）`);
  }
  return r;
}

/** **1行以上変わるはず**の更新・削除・挿入。0行ならエラー。 */
export async function mutateMany(
  builder: SelectableBuilder,
  label = "mutateMany",
  opts: MutateOptions = {},
): Promise<MutateResult> {
  return run(builder, { allowNone: false, label, returning: opts.returning ?? "id" });
}

/**
 * **0行でも正常**な更新・削除。
 *
 * ⚠️ **これを既定にしないこと。** 使ってよいのは
 * 「消したいものが元から無くてよい」場合だけ（入れ替え前の掃除など）。
 * 迷ったら `mutateMany` を使い、0行が出たら理由を調べる。
 *
 * ⚠️ **ただし「掃除」でも RLS 拒否は見逃さない。** `error` が返れば
 * `ok: false` になる（0行と 403 は別物として扱う）。
 */
export async function mutateAllowNone(
  builder: SelectableBuilder,
  label = "mutateAllowNone",
  opts: MutateOptions = {},
): Promise<MutateResult> {
  return run(builder, { allowNone: true, label, returning: opts.returning ?? "id" });
}

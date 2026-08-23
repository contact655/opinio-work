/**
 * 0行更新をエラーとして扱うための小さなヘルパー。
 *
 * ── なぜ要るか ────────────────────────────────────────────────────────────
 * **supabase-js の update / delete は、0行に一致しても `error` が null で返る。**
 * `.select()` を付けずに `error` だけを見ていると、
 * 「更新されなかった」を「成功した」と読んでしまう。
 *
 * これまでに2回踏んでいる。**どちらも画面はエラーを出さなかった。**
 *   ・2026-08-11 企業ロゴURLの一括更新 … RLS の `ow_companies_own_update` が
 *     `auth.uid() = user_id` を要求し、その列は85社中2社にしか入っていないため
 *     **83社で0行更新**。入力欄は保存されたように見えていた
 *   ・2026-08-23 `PATCH /api/biz/company` … 同じ理由で **85社で保存されていない**
 *
 * ⚠️ **どちらも「コードの書き方」ではなく「RLS の条件」が原因。**
 *    アプリを読んでも気づけない。**行数を見る以外に検知する方法が無い。**
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
 * const r = await mutateMany(supabase.from("ow_job_roles").delete().eq("job_id", jobId));
 *
 * // 0行でも正常（消したいものが元から無い等）
 * const r = await mutateAllowNone(supabase.from("ow_job_roles").delete().eq("job_id", jobId));
 * ```
 *
 * ⚠️ **`.select()` は呼び出し側で書かない。** このヘルパーが付ける。
 *    素で `.select()` を書くと**引数なしになりがちで、全列を返してしまう**
 *    （列単位 GRANT を剥がした列があると 403 になる。CLAUDE.md の既知の罠）。
 *    ここでは常に `.select("id")` に固定している。
 *
 * ⚠️ **`id` 列が無い表には使えない。** その場合は呼び出し側で
 *    `.select("<主キー列>")` を書いて件数を見ること。
 */

import type { PostgrestError } from "@supabase/supabase-js";

export type MutateResult =
  | { ok: true; count: number }
  | { ok: false; count: number; error: string; code?: string; status: number };

/** supabase-js のクエリビルダのうち、`.select()` を生やせるもの */
type SelectableBuilder = {
  select: (columns: string) => PromiseLike<{
    data: unknown[] | null;
    error: PostgrestError | null;
  }>;
};

async function run(
  builder: SelectableBuilder,
  { allowNone, label }: { allowNone: boolean; label: string },
): Promise<MutateResult> {
  const { data, error } = await builder.select("id");

  if (error) {
    /* ⚠️ error は握り潰さない（CLAUDE.md）。呼び出し側が拾わなくてもログに残す。 */
    console.error(`[mutate] ${label}:`, error.message, error.code ?? "");
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
  if (count === 0 && !allowNone) {
    /* ⚠️ **ここが本題。** 0行は「対象が見つからない」か「RLS に弾かれた」。
          呼び出し側からは区別できないので 404 に倒し、ログに残す。 */
    console.error(`[mutate] ${label}: 0行更新（対象が無いか RLS が拒否した）`);
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
): Promise<MutateResult> {
  const r = await run(builder, { allowNone: false, label });
  if (r.ok && r.count > 1) {
    console.warn(`[mutate] ${label}: ${r.count}行が変わった（1行のつもりだった）`);
  }
  return r;
}

/** **1行以上変わるはず**の更新・削除。0行ならエラー。 */
export async function mutateMany(
  builder: SelectableBuilder,
  label = "mutateMany",
): Promise<MutateResult> {
  return run(builder, { allowNone: false, label });
}

/**
 * **0行でも正常**な更新・削除。
 *
 * ⚠️ **これを既定にしないこと。** 使ってよいのは
 * 「消したいものが元から無くてよい」場合だけ（入れ替え前の掃除など）。
 * 迷ったら `mutateMany` を使い、0行が出たら理由を調べる。
 */
export async function mutateAllowNone(
  builder: SelectableBuilder,
  label = "mutateAllowNone",
): Promise<MutateResult> {
  return run(builder, { allowNone: true, label });
}

/* ★サーバー専用 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FitAxisValue } from "@/lib/fitAxes/axes";

/**
 * 本人の「相性のものさし」を読む（2026-10-15）。ページと「あなたに合う会社」の入口が同じ関数を使う。
 * ⚠️ 本人の分だけ。企業向けに読む経路を作らないこと（並び順への反映はプライバシーポリシーの改定後）。
 * @returns 取得に失敗したら null（「未作成」と区別する。0件に見せない）
 */
export type SavedFitAxes = {
  values: Record<string, FitAxisValue>;
  updatedAt: string | null;
  axesVersion: number | null;
};

export async function loadFitAxes(owUserId: string): Promise<SavedFitAxes | null> {
  const { data, error } = await createAdminClient()
    .from("ow_fit_axis_answers")
    .select("axis_key, value, axes_version, updated_at")
    .eq("user_id", owUserId);
  if (error) {
    console.error("[fitAxes/load]", error.message);
    return null;
  }
  const values: Record<string, FitAxisValue> = {};
  let updatedAt: string | null = null;
  let axesVersion: number | null = null;
  for (const r of data ?? []) {
    values[r.axis_key as string] = (r.value as FitAxisValue) ?? null;
    if (!updatedAt || (r.updated_at as string) > updatedAt) updatedAt = r.updated_at as string;
    axesVersion = r.axes_version as number;
  }
  return { values, updatedAt, axesVersion };
}

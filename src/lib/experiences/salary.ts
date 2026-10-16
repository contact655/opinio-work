import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone } from "@/lib/supabase/mutate";

/**
 * ★職歴ごとの年収（`ow_experience_salaries`）の読み書き（2026-10-16 / フェーズ2）。**API はここだけを呼ぶ。**
 *
 * ⚠️★表は **RLS 有効・ポリシー0本・anon / authenticated に権限なし**。service role で読み書きする。
 *    ＝ **RLS が守ってくれない。** 本人の職歴かを確かめるのは呼び出し側の `requireOwnExperience`
 *    （`lib/experiences/reasonAnswers.ts`）。**通さずに呼ばないこと。**
 * ⚠️★`ow_experiences.salary_man` などの旧列は**読まない・書かない**（DROP はしていない）。
 *    旧列は「ログインした人なら他人の行も読める」表にあり、列の GRANT だけで守られていた。
 * ⚠️★年収を他の利用者・企業・運営の画面に出す経路を足さないこと。出し先は本人の編集画面だけ。
 */

/** 本人の職歴 id → 年収（万円）。値の無い職歴はキーごと無い。⚠️ 取得に失敗したら null（{} と区別する） */
export async function loadOwnSalaries(owUserId: string): Promise<Record<string, number> | null> {
  const admin = createAdminClient();
  const { data: exps, error: eErr } = await admin.from("ow_experiences").select("id").eq("user_id", owUserId);
  if (eErr) { console.error("[salary] ow_experiences:", eErr.message); return null; }
  const ids = (exps ?? []).map((r) => r.id as string);
  if (ids.length === 0) return {};
  const { data, error } = await admin
    .from("ow_experience_salaries").select("experience_id, amount_man").in("experience_id", ids);
  if (error) { console.error("[salary] ow_experience_salaries:", error.message); return null; }
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { experience_id: string; amount_man: number }[]) out[r.experience_id] = r.amount_man;
  return out;
}

/** 1件の職歴の年収を保存する。null なら消す。⚠️ 本人確認は呼び出し側で済ませること */
export async function saveSalary(experienceId: string, amountMan: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (amountMan === null) {
    const r = await mutateAllowNone(
      admin.from("ow_experience_salaries").delete().eq("experience_id", experienceId),
      "salary delete", { returning: "experience_id" },
    );
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }
  const { error } = await admin
    .from("ow_experience_salaries")
    .upsert({ experience_id: experienceId, amount_man: amountMan, updated_at: new Date().toISOString() }, { onConflict: "experience_id" });
  if (error) { console.error("[salary] upsert:", error.message); return { ok: false, error: "保存に失敗しました" }; }
  return { ok: true };
}

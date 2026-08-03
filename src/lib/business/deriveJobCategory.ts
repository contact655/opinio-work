import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ow_job_roles の primary ロール名から ow_jobs.job_category を派生させる。
 *
 * job_category は 2026-08-03 まで biz の「職種カテゴリ」セレクト（7値の固定リスト）が
 * 書いていたが、その語彙が職種ページ側と噛み合わず求人が到達不能になっていたため
 * 入力欄を廃止した。職種の正は ow_job_roles ひとつ。
 *
 * それでも列を即座に落とさないのは、job_category を**表示ラベルとして**読んでいる箇所が
 * まだ残っているため（mypage のバッジ、admin 一覧、週次メール、検索サジェスト等）。
 * ここで primary ロール名を書き込んでおけば、それらは移行前でも正しい値を出せる。
 *
 * ⚠️ これは移行期間中の派生値であって、入力でも第二の正でもない。
 *    読み側の移行が終わったら、この関数ごと列を落とす。
 */
export async function syncJobCategoryFromRoles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  jobRoles: { roleId: string; isPrimary: boolean }[]
): Promise<void> {
  try {
    const primary = jobRoles.find((r) => r.isPrimary) ?? jobRoles[0];
    if (!primary) return;

    const { data, error } = await supabase
      .from("ow_roles")
      .select("name")
      .eq("id", primary.roleId)
      .maybeSingle();

    // 「値が無い」ことを「ある値」に置き換えない。取れなければ何も書かない
    if (error || !data?.name) {
      if (error) console.error("[syncJobCategoryFromRoles]", error.message);
      return;
    }

    const { error: upErr } = await supabase
      .from("ow_jobs")
      .update({ job_category: data.name as string })
      .eq("id", jobId);
    if (upErr) console.error("[syncJobCategoryFromRoles] update", upErr.message);
  } catch (e) {
    console.error("[syncJobCategoryFromRoles]", e);
  }
}

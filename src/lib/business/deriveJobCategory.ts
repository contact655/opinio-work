import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ow_job_roles の primary ロールから ow_jobs.job_category と role_category_id を同期させる。
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
 *
 * ── role_category_id も一緒に更新する理由（2026-08-06 追加）────────────────
 * それまで biz の保存パスは role_category_id を一切更新しておらず、
 * migration の一括投入時の古い値が残り続けていた
 * （20260803114812 の migration コメント参照。当時 (2) と (3) が5件で矛盾していた）。
 * ADMIN 側の職種編集（updateJobRoles）だけ直しても、企業が保存した瞬間にまた食い違う。
 * 主ロールで揃える。
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

    // 「値が無い」ことを「ある値」に置き換えない。job_category は書かない。
    // ただし role_category_id は主ロールの id そのものなので、名前が引けなくても揃える
    if (error || !data?.name) {
      if (error) console.error("[syncJobCategoryFromRoles]", error.message);
      const { error: idErr } = await supabase
        .from("ow_jobs")
        .update({ role_category_id: primary.roleId })
        .eq("id", jobId);
      if (idErr) console.error("[syncJobCategoryFromRoles] role_category_id", idErr.message);
      return;
    }

    const { error: upErr } = await supabase
      .from("ow_jobs")
      .update({ job_category: data.name as string, role_category_id: primary.roleId })
      .eq("id", jobId);
    if (upErr) console.error("[syncJobCategoryFromRoles] update", upErr.message);
  } catch (e) {
    console.error("[syncJobCategoryFromRoles]", e);
  }
}

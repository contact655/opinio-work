import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateOne } from "@/lib/supabase/mutate";

/**
 * 求人の「自社での呼び方」を ow_company_job_roles に溜め、ow_jobs から指す。
 *
 * ── なぜ（2026-08-06）──────────────────────────────────────────────────────
 * 標準職種（ow_roles）は検索・集計のための共通軸で、会社が実際に使っている呼称とは
 * 一致しない。呼称を標準職種の名前に混ぜると検索軸が壊れるので、別レイヤに置く。
 * **表示は自社呼称・検索は標準職種**。ここで両者を混ぜないこと。
 *
 * 会社に呼称を別画面（/biz/organization）で登録させるのは動線として重く、実際に0行のまま
 * 使われていない。求人を作る流れの中で1行入力させて、自動で溜めるのがこの関数。
 *
 * ⚠️ ow_company_job_roles には UNIQUE (company_id, name) がある。
 *    同時実行で INSERT が衝突しうるので 23505 を握って取り直す
 *    （既存 API の src/app/api/biz/job-roles/route.ts と同じ流儀）。
 * ⚠️ 論理削除済み（deleted_at あり）の同名行は**復活させる**。
 *    会社がもう一度その呼称を使うと言っているので、別行を作る理由がない。
 * ⚠️ standard_role_id は毎回いまの主ロールで上書きする。会社の最新の意図を採る。
 */
export async function syncCompanyJobRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: {
    jobId: string;
    companyId: string;
    /** フォームから来る生の値。未指定なら何もしない（呼称を触らない更新のため） */
    rawName: unknown;
    jobRoles: { roleId: string; isPrimary: boolean }[];
  }
): Promise<void> {
  const { jobId, companyId, rawName, jobRoles } = args;

  // undefined は「この保存では呼称に触れていない」。null / "" は「消す」
  if (rawName === undefined) return;

  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (!name) {
    const { error } = await supabase
      .from("ow_jobs")
      .update({ company_job_role_id: null })
      .eq("id", jobId);
    if (error) console.error("[syncCompanyJobRole] clear", error.message);
    return;
  }

  const primaryRoleId =
    jobRoles.find((r) => r.isPrimary)?.roleId ?? jobRoles[0]?.roleId ?? null;

  const roleId = await upsertCompanyJobRole(supabase, companyId, name, primaryRoleId);
  if (!roleId) return; // upsert 側でログ済み。ow_jobs は触らない

  const { error } = await supabase
    .from("ow_jobs")
    .update({ company_job_role_id: roleId })
    .eq("id", jobId);
  if (error) console.error("[syncCompanyJobRole] link", error.message);
}

/** (company_id, name) で引いて、無ければ作る。id を返す。失敗したら null */
async function upsertCompanyJobRole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  companyId: string,
  name: string,
  standardRoleId: string | null
): Promise<string | null> {
  // ⚠️ deleted_at で絞らない。論理削除済みの同名行も拾って復活させる。
  //    絞ると INSERT に回って UNIQUE 違反になる。
  const found = await supabase
    .from("ow_company_job_roles")
    .select("id")
    .eq("company_id", companyId)
    .eq("name", name)
    .maybeSingle();

  if (found.error) {
    console.error("[syncCompanyJobRole] select", found.error.message);
    return null;
  }

  if (found.data?.id) {
    const res = await mutateOne(
      supabase.from("ow_company_job_roles")
        .update({ standard_role_id: standardRoleId, deleted_at: null })
        .eq("id", found.data.id),
      "syncCompanyJobRole update",
    );
    if (!res.ok) {
      console.error("[syncCompanyJobRole] update", res.error);
      return null;
    }
    return found.data.id as string;
  }

  const inserted = await supabase
    .from("ow_company_job_roles")
    .insert({
      company_id: companyId,
      name,
      standard_role_id: standardRoleId,
      display_order: 0,
    })
    .select("id")
    .single();

  if (!inserted.error) return inserted.data.id as string;

  // 同時実行で先を越された。取り直して更新する
  if (inserted.error.code === "23505") {
    const again = await supabase
      .from("ow_company_job_roles")
      .select("id")
      .eq("company_id", companyId)
      .eq("name", name)
      .maybeSingle();
    if (again.error || !again.data?.id) {
      console.error("[syncCompanyJobRole] refetch after 23505", again.error?.message ?? "not found");
      return null;
    }
    const res2 = await mutateOne(
      supabase.from("ow_company_job_roles")
        .update({ standard_role_id: standardRoleId, deleted_at: null })
        .eq("id", again.data.id),
      "syncCompanyJobRole update after 23505",
    );
    if (!res2.ok) console.error("[syncCompanyJobRole] update after 23505", res2.error);
    return again.data.id as string;
  }

  console.error("[syncCompanyJobRole] insert", inserted.error.message);
  return null;
}

import { createNoStoreAdminClient } from "@/lib/supabase/noStore";

/**
 * 求人の職種を「表示用にどう出すか」を決める唯一の場所。
 *
 * ── ルール（2026-08-06）────────────────────────────────────────────────────
 *   会社呼称（ow_company_job_roles.name） ?? 標準職種名（ow_roles.name）
 *
 * ⚠️ job_category にはフォールバックしない。あれは移行期間中の派生値で、
 *    「職種の正は ow_job_roles」という方針に反する。職種タグが1件も無い求人は
 *    表示する職種が無い（null）が正しい。空文字や job_category で埋めない。
 * ⚠️ 呼称が論理削除されていたら（deleted_at あり）呼称は使わない。
 *    会社が「もう使っていない」と言っている名前を出し続けない。
 * ⚠️ 運営が見る面（ADMIN）では呼称を使わない。標準職種名で揃える。
 *    会社ごとに違う名前で並ぶと、運営側で職種を横断して見られなくなる。
 * ⚠️ 検索・フィルタ・集計はこの関数を通さない。標準職種（roleIds）のまま。
 *    ここに絞り込みを混ぜると、会社が呼称を変えた瞬間に検索結果が変わる。
 */
export function pickRoleLabel(args: {
  companyRoleName?: string | null;
  companyRoleDeletedAt?: string | null;
  standardRoleName?: string | null;
}): string | null {
  const { companyRoleName, companyRoleDeletedAt, standardRoleName } = args;
  const alias = companyRoleDeletedAt ? null : companyRoleName?.trim() || null;
  return alias ?? (standardRoleName?.trim() || null);
}

export type JobRoleLabel = {
  /** 表示用。会社呼称 ?? 標準職種名 */
  label: string | null;
  /** 標準職種名。ADMIN と、呼称と併記したいとき（biz の一覧）に使う */
  standardRoleName: string | null;
  /** 会社呼称（論理削除済みなら null） */
  companyRoleName: string | null;
};

/**
 * 求人 id の配列から表示用の職種名をまとめて引く。
 *
 * ⚠️ ow_job_roles の主ロールを標準職種名にする。role_category_id は
 *    migration の一括投入のままで biz UI が更新しないため使わない。
 */
export async function fetchJobRoleLabels(
  jobIds: string[]
): Promise<Map<string, JobRoleLabel>> {
  const admin = createNoStoreAdminClient();
  const out = new Map<string, JobRoleLabel>();
  const ids = Array.from(new Set(jobIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const [jobsRes, rolesRes] = await Promise.all([
    admin
      .from("ow_jobs")
      .select("id, company_job_role_id, ow_company_job_roles!company_job_role_id(name, deleted_at)")
      .in("id", ids),
    admin.from("ow_job_roles").select("job_id, role_id, is_primary").in("job_id", ids),
  ]);

  if (jobsRes.error) console.error("[fetchJobRoleLabels] jobs", jobsRes.error.message);
  if (rolesRes.error) console.error("[fetchJobRoleLabels] job_roles", rolesRes.error.message);

  // job_id → 主ロールの role_id（is_primary が無ければ先頭）
  const primaryRoleId = new Map<string, string>();
  for (const r of rolesRes.data ?? []) {
    const jid = r.job_id as string;
    if (r.is_primary === true || !primaryRoleId.has(jid)) primaryRoleId.set(jid, r.role_id as string);
  }

  const roleIds = Array.from(new Set(primaryRoleId.values()));
  const roleNames = new Map<string, string>();
  if (roleIds.length > 0) {
    const { data, error } = await admin.from("ow_roles").select("id, name").in("id", roleIds);
    if (error) console.error("[fetchJobRoleLabels] roles", error.message);
    for (const r of data ?? []) roleNames.set(r.id as string, r.name as string);
  }

  for (const j of jobsRes.data ?? []) {
    const jid = j.id as string;
    const cjr = j.ow_company_job_roles as unknown as { name: string; deleted_at: string | null } | null;
    const standardRoleName = roleNames.get(primaryRoleId.get(jid) ?? "") ?? null;
    const companyRoleName = cjr?.deleted_at ? null : cjr?.name ?? null;
    out.set(jid, {
      label: pickRoleLabel({ companyRoleName: cjr?.name, companyRoleDeletedAt: cjr?.deleted_at, standardRoleName }),
      standardRoleName,
      companyRoleName,
    });
  }
  return out;
}

/**
 * 会社呼称を id → {name, deleted_at} で全件引く。
 *
 * ⚠️ 全件取る。2026-08-06 時点で 1 行しかなく、求人ごとに引くと N+1 になる。
 *    数百行を超えたら company_id で絞ること。
 * ⚠️ no-store クライアントを使う理由は createNoStoreAdminClient のコメントを参照。
 */
export async function fetchCompanyRoleMap(): Promise<Map<string, { name: string; deleted_at: string | null }>> {
  const { data, error } = await createNoStoreAdminClient()
    .from("ow_company_job_roles")
    .select("id, name, deleted_at");
  if (error) console.error("[fetchCompanyRoleMap]", error.message);
  return new Map(
    (data ?? []).map((r) => [r.id as string, { name: r.name as string, deleted_at: r.deleted_at as string | null }])
  );
}

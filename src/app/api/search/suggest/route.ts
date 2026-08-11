import { createClient } from "@/lib/supabase/server";
import { fetchJobRoleLabels } from "@/lib/jobs/roleLabel";
import { getRoleAliases, getRoleTree, getJobRoleMap } from "@/lib/supabase/queries";
import { expandWithAncestors } from "@/lib/roles/jobRoles";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** サジェストで返す求人の上限。ドロップダウンに収まる数 */
const JOB_LIMIT = 4;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);

  if (!q || q.length < 1) {
    return NextResponse.json({ companies: [], jobs: [] });
  }

  const supabase = createClient();
  // PostgREST injection 対策: .or() 文字列に埋め込む前にメタ文字を除去
  const safeQ = q.replace(/[(),%]/g, "");
  const pattern = `%${safeQ}%`;
  const needle = safeQ.toLowerCase();

  /*
    職種辞書で当たった求人を拾う。

    ── なぜ（2026-08-07）──────────────────────────────────────────────────
    以前は `title.ilike` と **`job_category.ilike`** だけで検索していた。
    job_category は**廃止予定の派生値**で、統合のたびに書き換わる。
    実際 2026-08-07 に job_category を主ロール名へ再派生させたところ、
    「セールスエンジニア」が 3件 → 0件、「アーキテクト」が 2件 → 0件になった
    （どちらも統合先の別名としては残っているのに、辞書を見ていないので当たらない）。
    **統合するたびに検索語が失われる構造**だった。

    ⚠️ /jobs の本検索と**同じ getRoleAliases() を使う**。2つ目の辞書を作らない。
       辞書は「職種名＋別名」で、roleIds はその語が指す職種そのものだけ。
       求人側の roleIds に祖先が入っているので、
       「営業」→ 営業配下すべて / 「エンタープライズセールス」→ その職種だけ
       が同じ1本の判定で成立する（queries.ts の getRoleAliases のコメント参照）。

    ⚠️ title.ilike は残す。求人タイトルの直接一致は有効
       （英語タイトルに日本語で当てるのは辞書側の仕事）。
    ⚠️ job_category.ilike は外した。廃止予定の列への依存をここで断つ。
  */
  const [aliases, roleTree, jobRoleMap] = await Promise.all([
    getRoleAliases(),
    getRoleTree(),
    getJobRoleMap(),
  ]);

  const matchedRoleIds = new Set<string>();
  for (const a of aliases) {
    if (a.alias.toLowerCase().includes(needle)) {
      for (const id of a.roleIds) matchedRoleIds.add(id);
    }
  }

  const roleMatchedJobIds: string[] = [];
  if (matchedRoleIds.size > 0) {
    jobRoleMap.forEach((roleIds, jobId) => {
      const expanded = expandWithAncestors(roleTree, roleIds);
      if (expanded.some((id) => matchedRoleIds.has(id))) roleMatchedJobIds.push(jobId);
    });
  }

  const [{ data: companies }, { data: titleJobs }, { data: roleJobs }] = await Promise.all([
    supabase
      .from("ow_companies")
      .select("id, slug, name, industry, logo_letter, logo_gradient")
      .ilike("name", pattern)
      .eq("is_published", true)
      .limit(4),
    supabase
      .from("ow_jobs")
      .select("id, title, job_category")
      .ilike("title", pattern)
      .eq("status", "published")
      .limit(JOB_LIMIT),
    roleMatchedJobIds.length > 0
      ? supabase
          .from("ow_jobs")
          .select("id, title, job_category")
          .in("id", roleMatchedJobIds.slice(0, 200))
          .eq("status", "published")
          .limit(JOB_LIMIT)
      : Promise.resolve({ data: [] as { id: string; title: string; job_category: string | null }[] }),
  ]);

  // タイトル一致を先に、職種一致で埋める。id で重複を除く
  const seen = new Set<string>();
  const jobs: { id: string; title: string; job_category: string | null }[] = [];
  for (const j of [...(titleJobs ?? []), ...(roleJobs ?? [])]) {
    const id = j.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    jobs.push(j as { id: string; title: string; job_category: string | null });
    if (jobs.length >= JOB_LIMIT) break;
  }

  /*
    表示する職種名を会社呼称 ?? 標準職種名に差し替える。
    ⚠️ 呼称の取得は fetchJobRoleLabels の中で service role のクライアントを使う。
       ow_company_job_roles の RLS は「その会社の管理者だけ」なので、
       上の createClient（ユーザーセッション）ではエラーも出さず null になる。
  */
  const roleLabels = await fetchJobRoleLabels(jobs.map((j) => j.id));

  return NextResponse.json({
    companies: companies ?? [],
    jobs: jobs.map((j) => ({ ...j, roleLabel: roleLabels.get(j.id)?.label ?? null })),
  });
}

import { createClient } from "@/lib/supabase/server";
import { fetchJobRoleLabels } from "@/lib/jobs/roleLabel";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  const [
    { data: companies },
    { data: jobs },
  ] = await Promise.all([
    supabase
      .from("ow_companies")
      .select("id, slug, name, industry, logo_letter, logo_gradient")
      .ilike("name", pattern)
      .eq("is_published", true)
      .limit(4),
    supabase
      .from("ow_jobs")
      .select("id, title, job_category")
      .or(`title.ilike.${pattern},job_category.ilike.${pattern}`)
      .in("status", ["published", "active"])
      .limit(4),
  ]);

  /*
    表示する職種名を会社呼称 ?? 標準職種名に差し替える。
    ⚠️ 上の .or(job_category.ilike) は**検索条件なので触っていない**。
       ここでやるのは、当たった求人をどう表示するかだけ。
    ⚠️ 呼称の取得は fetchJobRoleLabels の中で service role のクライアントを使う。
       ow_company_job_roles の RLS は「その会社の管理者だけ」なので、
       上の createClient（ユーザーセッション）ではエラーも出さず null になる。
  */
  const roleLabels = await fetchJobRoleLabels((jobs ?? []).map((j) => j.id as string));

  return NextResponse.json({
    companies: companies ?? [],
    jobs: (jobs ?? []).map((j) => ({ ...j, roleLabel: roleLabels.get(j.id as string)?.label ?? null })),
  });
}

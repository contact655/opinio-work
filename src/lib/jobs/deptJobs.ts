import { getJobs, getRoleTree } from "@/lib/supabase/queries";

/**
 * 部門ページ（`/jobs/dept/[slug]`）に出る求人を、slug ごとにまとめて返す。
 *
 * ── なぜ共通にするか ────────────────────────────────────────────────────────
 * ⚠️★**sitemap と画面が別々に数えると必ずずれる。**
 *    CLAUDE.md「判定は同じ関数を呼ぶ。一覧側で条件を書き直さないこと」と同じ理由。
 *    ずれると「sitemap には載っているのに中身が0件」「noindex なのに sitemap にある」
 *    という、外から見て矛盾した状態になる。
 *
 * ⚠️ `getJobs()` は `roleIds` に**具体職種＋その祖先**を入れているので、
 *    大分類の UUID が含まれているかを見るだけでよい（祖先展開をここでやり直さない）。
 *
 * ⚠️ `getJobs()` は `unstable_cache`（revalidate 300）なので、
 *    sitemap と画面で2回呼んでも実クエリは増えない。
 */
export async function getDeptJobs(): Promise<Map<string, Awaited<ReturnType<typeof getJobs>>["jobs"]>> {
  const [{ jobs }, tree] = await Promise.all([getJobs(), getRoleTree()]);
  const out = new Map<string, Awaited<ReturnType<typeof getJobs>>["jobs"]>();
  for (const r of tree.topLevel) {
    if (!r.slug) continue;
    out.set(r.slug, jobs.filter((j) => (j.roleIds ?? []).includes(r.id)));
  }
  return out;
}

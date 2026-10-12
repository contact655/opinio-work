import "server-only";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import { companyDisplayName } from "@/lib/companies/displayName";

/**
 * ★検証用の会社と、その公開中の求人（検証用アカウントにだけ出す。2026-10-12 / 柴さんの指示）。
 *   /companies と /jobs の一覧の上に置く。行き先は /t/companies・/t/jobs（動的・noindex）。
 * ⚠️ 見ている人が検証用でなければ何も描かない（判定はサーバー。未ログイン・実在の利用者には出さない）。
 * ⚠️ 通常の一覧・検索・件数には混ぜない（混ぜると絞り込みや件数の判定を全部書き換えることになる）。
 * ⚠️ 対象は「ページ表示（is_published）かつ is_test」の会社だけ。求人は「公開中かつ is_test」だけ（下書きは出さない）。
 */
export async function TestCompaniesSection({ kind }: { kind: "companies" | "jobs" }) {
  if (!(await viewerIsTestUser())) return null;
  const admin = createAdminClient();
  const [{ data: companies, error: ce }, { data: jobs, error: je }] = await Promise.all([
    admin.from("ow_companies").select("id, slug, name, name_en")
      .eq("is_published", true).eq("is_test", true).order("name"),
    admin.from("ow_jobs").select("id, slug, title, company_id")
      .eq("status", "published").eq("is_test", true).order("published_at", { ascending: false }),
  ]);
  if (ce) console.error("[TestCompaniesSection] companies:", ce.message);
  if (je) console.error("[TestCompaniesSection] jobs:", je.message);
  const list = companies ?? [];
  if (list.length === 0) return null;
  const jobsBy = new Map<string, { id: string; slug: string | null; title: string }[]>();
  for (const j of jobs ?? []) {
    const arr = jobsBy.get(j.company_id as string) ?? [];
    arr.push({ id: j.id as string, slug: (j.slug as string | null) ?? null, title: (j.title as string) ?? "" });
    jobsBy.set(j.company_id as string, arr);
  }
  /* 求人一覧では、公開中の求人がある会社だけ */
  const rows = kind === "jobs" ? list.filter((c) => jobsBy.has(c.id as string)) : list;
  if (rows.length === 0) return null;

  return (
    <div className="mx-auto page-gutter" style={{ maxWidth: "var(--max-w-page)" }}>
    <section data-state="test-companies-section" aria-label="検証用の会社"
      style={{ margin: "16px 0", padding: "12px 16px", background: "#fff", border: "1px dashed var(--line)", borderRadius: 12 }}>
      <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>検証用の会社</h2>
      <p style={{ margin: "2px 0 8px", fontSize: 12, color: "var(--ink-mute)" }}>
        検証用アカウントでログインしているため表示しています（一般の利用者には表示されません）
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((c) => {
          const name = companyDisplayName(c.name as string, c.name_en as string | null).displayName;
          const js = jobsBy.get(c.id as string) ?? [];
          return (
            <li key={c.id as string} style={{ fontSize: 13, lineHeight: 1.7, minWidth: 0 }}>
              <Link href={`/t/companies/${(c.slug as string | null) ?? c.id}`} style={{ fontWeight: 700, color: "var(--royal)" }}>{name}</Link>
              {js.length > 0 && (
                <span style={{ color: "var(--ink-mute)" }}>
                  {"　"}
                  {js.map((j, i) => (
                    <span key={j.id}>
                      {i > 0 && "・"}
                      <Link href={`/t/jobs/${j.slug ?? j.id}`} style={{ color: "var(--ink-soft)" }}>{j.title}</Link>
                    </span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
    </div>
  );
}

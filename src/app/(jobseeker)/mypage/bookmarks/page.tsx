import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchJobRoleLabels } from "@/lib/jobs/roleLabel";
import BookmarksClient, { type Bookmark } from "./BookmarksClient";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/bookmarks");

  const admin = createAdminClient();
  const { data: owUserRows } = await admin
    .from("ow_users").select("id").eq("auth_id", user.id).limit(1);
  const owUserId = owUserRows?.[0]?.id;

  let companyBookmarks: Bookmark[] = [];
  let jobBookmarks: Bookmark[] = [];

  if (owUserId) {
    const { data: bmarks } = await admin
      .from("ow_bookmarks")
      .select("id, target_id, target_type")
      .eq("user_id", owUserId)
      .in("target_type", ["company", "job"])
      .order("created_at", { ascending: false });

    if (bmarks && bmarks.length > 0) {
      const companyBmarks = bmarks.filter((b) => b.target_type === "company");
      const jobBmarks = bmarks.filter((b) => b.target_type === "job");

      if (companyBmarks.length > 0) {
        const ids = companyBmarks.map((b) => b.target_id as string);
        const { data: companies } = await admin
          .from("ow_companies").select("id, name, industry, employee_count").in("id", ids);
        if (companies) {
          const map = new Map(companies.map((c) => [c.id, c]));
          companyBookmarks = companyBmarks.flatMap((b) => {
            const c = map.get(b.target_id as string);
            if (!c) return [];
            return [{
              id: b.id as string, type: "company" as const,
              title: c.name as string,
              meta: [c.industry, c.employee_count ? `${c.employee_count}名` : null].filter(Boolean).join(" / "),
              badge_label: (c.industry as string) ?? "企業",
              href: `/companies/${c.id}`,
            }];
          });
        }
      }

      if (jobBmarks.length > 0) {
        const ids = jobBmarks.map((b) => b.target_id as string);
        const { data: jobs } = await admin
          .from("ow_jobs").select("id, title, job_category, company_id").in("id", ids);
        if (jobs) {
          // 職種の表示は会社呼称 ?? 標準職種名。job_category は使わない
          const roleLabels = await fetchJobRoleLabels(jobs.map((j) => j.id as string));
          const companyIds = Array.from(new Set(jobs.map((j) => j.company_id as string)));
          const { data: companies } = await admin
            .from("ow_companies").select("id, name").in("id", companyIds);
          const cMap = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
          const jMap = new Map(jobs.map((j) => [j.id, j]));
          jobBookmarks = jobBmarks.flatMap((b) => {
            const j = jMap.get(b.target_id as string);
            if (!j) return [];
            return [{
              id: b.id as string, type: "job" as const,
              title: j.title as string,
              meta: [cMap.get(j.company_id as string), roleLabels.get(j.id as string)?.label].filter(Boolean).join(" / "),
              badge_label: roleLabels.get(j.id as string)?.label ?? "求人",
              href: `/jobs/${j.id}`,
            }];
          });
        }
      }
    }
  }

  return <BookmarksClient companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} />;
}

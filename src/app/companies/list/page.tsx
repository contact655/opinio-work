import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";
import CompanyListClient from "./CompanyListClient";

export const dynamic = "force-dynamic";

async function getCompanies() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `*, ow_jobs(id), ow_company_culture_tags(tag_category, tag_value)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function CompanyListPage({
  searchParams,
}: {
  searchParams: { category?: string; phase?: string; workstyle?: string; location?: string; q?: string };
}) {
  const companies = await getCompanies();

  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen bg-white">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CompanyListClient
            companies={companies}
            initialCategory={searchParams.category || ""}
            initialPhase={searchParams.phase || ""}
            initialWorkstyle={searchParams.workstyle || ""}
            initialLocation={searchParams.location || ""}
            initialQuery={searchParams.q || ""}
          />
        </div>
      </main>
      <JobseekerFooter />
    </>
  );
}

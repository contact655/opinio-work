import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import CompanyExplorer from "./CompanyExplorer";

export const dynamic = "force-dynamic";

async function getCompanies() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_companies")
    .select(
      `*, ow_jobs(id, title, job_category), ow_company_culture_tags(tag_category, tag_value)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const companies = await getCompanies();
  const validViews = ["list", "grid", "grid5", "section"];
  const initialView = validViews.includes(searchParams.view || "")
    ? (searchParams.view as "list" | "grid" | "grid5" | "section")
    : "list";

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <CompanyExplorer companies={companies} initialView={initialView} />
      </main>
      <Footer />
    </>
  );
}

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

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <CompanyExplorer companies={companies} />
      </main>
      <Footer />
    </>
  );
}

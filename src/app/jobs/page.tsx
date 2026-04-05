import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import JobsClient from "./JobsClient";

export const dynamic = "force-dynamic";

async function getJobs() {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_jobs")
    .select("*, ow_companies(id, name, logo_url, url, industry)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; category?: string; style?: string; salary?: string; view?: string };
}) {
  const jobs = await getJobs();

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <JobsClient jobs={jobs} initialParams={searchParams} />
      </main>
      <Footer />
    </>
  );
}

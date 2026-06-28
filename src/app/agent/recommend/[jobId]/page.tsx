import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAgencyByContactEmail } from "@/lib/business/agents";
import { RecommendClient } from "./RecommendClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "候補者を推薦 | エージェントポータル | OPINIO" },
};

export default async function AgentRecommendPage({
  params,
}: {
  params: { jobId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/agent/auth");
  }

  const agencyData = await fetchAgencyByContactEmail(user.email);
  if (!agencyData) {
    redirect("/agent/auth");
  }

  // Verify this job is assigned to the agent's agency
  const isAssigned = agencyData.assignedJobs.some((j) => j.id === params.jobId);
  if (!isAssigned) {
    redirect("/agent/dashboard");
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("ow_jobs")
    .select("id, title, ow_companies!company_id(name)")
    .eq("id", params.jobId)
    .maybeSingle();

  if (!job) redirect("/agent/dashboard");

  const companyName = (job.ow_companies as unknown as { name: string } | null)?.name ?? "";

  return (
    <RecommendClient
      jobId={params.jobId}
      jobTitle={job.title}
      companyName={companyName}
      agencyName={agencyData.agency.agencyName}
    />
  );
}

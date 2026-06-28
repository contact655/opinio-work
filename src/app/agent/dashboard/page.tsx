import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAgencyByContactEmail } from "@/lib/business/agents";
import { AgentDashboardClient } from "./AgentDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "ダッシュボード | エージェントポータル | OPINIO" },
};

export default async function AgentDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/agent/auth");
  }

  const agencyData = await fetchAgencyByContactEmail(user.email);
  if (!agencyData) {
    redirect("/agent/auth");
  }

  return (
    <AgentDashboardClient
      agencyName={agencyData.agency.agencyName}
      assignedJobs={agencyData.assignedJobs}
      candidates={agencyData.candidates}
    />
  );
}

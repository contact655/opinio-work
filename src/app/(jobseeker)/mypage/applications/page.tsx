import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ApplicationsClient, { type Application } from "./ApplicationsClient";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/applications");

  const admin = createAdminClient();
  const { data: owUser } = await admin
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();

  let applications: Application[] = [];

  if (owUser) {
    const { data } = await admin
      .from("ow_job_applications")
      .select(
        `*,
        ow_jobs(id, slug, title, job_category, salary_min, salary_max, location,
          ow_companies(id, name, logo_url,
            ow_company_office_photos(image_url, caption)
          )
        )`
      )
      .eq("user_id", owUser.id)
      .order("created_at", { ascending: false });
    applications = (data as Application[]) ?? [];
  }

  return <ApplicationsClient initialApplications={applications} />;
}

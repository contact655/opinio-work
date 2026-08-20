import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ApplicationsClient, { type Application } from "./ApplicationsClient";
import type { Metadata } from "next";

/* ⚠️ **ログイン後のページにもタイトルを付ける。** 付けないとサイト既定の
      「IT/SaaS業界の転職・求人情報 | OPINIO」になり、**タブを何枚開いても全部同じ名前**で
      見分けがつかない。2026-08-20 の実測で /mypage 配下の3ページが該当した。
   ⚠️ `absolute` にする（ルートの template が `| OPINIO` を足すため）。 */
export const metadata: Metadata = {
  title: { absolute: "応募した募集 | OPINIO" },
  robots: { index: false, follow: false },
};


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

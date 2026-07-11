import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { Suspense } from "react";
import ReviewsClient from "./ReviewsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "口コミ・給与 | OPINIO",
  description: "IT/SaaS企業の社員・OBによるリアルな口コミと給与データ。",
};

export default async function ReviewsPage() {
  const admin = createAdminClient();

  const [{ data: reviews }, { data: salaries }, { data: companies }] = await Promise.all([
    admin
      .from("ow_company_reviews")
      .select("company_id, rating_overall, employment_status, pros")
      .eq("is_approved", true),
    admin
      .from("ow_salary_reports")
      .select("company_id, job_type, years_of_experience, annual_salary, employment_status")
      .eq("is_approved", true),
    admin
      .from("ow_companies")
      .select("id, name, industry, phase, logo_gradient, logo_letter, logo_url")
      .eq("is_published", true),
  ]);

  return (
    <Suspense fallback={null}>
      <ReviewsClient
        reviews={reviews ?? []}
        salaries={salaries ?? []}
        companies={companies ?? []}
      />
    </Suspense>
  );
}

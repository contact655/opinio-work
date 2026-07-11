import { createAdminClient } from "@/lib/supabase/admin";
import ReviewsAdminClient from "./ReviewsAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "口コミ審査 | OPINIO Admin" },
};

export default async function AdminReviewsPage() {
  const admin = createAdminClient();

  const { data: reviews } = await admin
    .from("ow_company_reviews")
    .select("id, company_id, employment_status, rating_overall, rating_culture, rating_growth, rating_wlb, rating_compensation, rating_leadership, rating_business, rating_welfare, pros, cons, job_type, is_approved, created_at, ow_companies(id, name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return <ReviewsAdminClient initialReviews={(reviews ?? []) as Parameters<typeof ReviewsAdminClient>[0]["initialReviews"]} />;
}

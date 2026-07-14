import { createAdminClient } from "@/lib/supabase/admin";
import ReviewsAdminClient from "./ReviewsAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "口コミ審査 | OPINIO Admin" },
};

export default async function AdminReviewsPage() {
  const admin = createAdminClient();

  const [{ data: reviews }, { data: companies }, { data: reports }] = await Promise.all([
    admin
      .from("ow_company_reviews")
      .select("id, company_id, employment_status, rating_overall, rating_culture, rating_growth, rating_wlb, rating_compensation, rating_leadership, rating_business, rating_welfare, pros, cons, job_type, is_approved, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("ow_companies").select("id, name"),
    admin
      .from("ow_review_reports")
      .select("id, review_id, reason, detail, contact_email, resolved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const companyMap = Object.fromEntries((companies ?? []).map(c => [c.id, { id: c.id, name: c.name as string }]));
  const enriched = (reviews ?? []).map(r => ({
    ...r,
    ow_companies: companyMap[r.company_id] ?? null,
    ow_users: null as { name: string } | null,
  }));

  return (
    <ReviewsAdminClient
      initialReviews={enriched as Parameters<typeof ReviewsAdminClient>[0]["initialReviews"]}
      initialReports={(reports ?? []) as Parameters<typeof ReviewsAdminClient>[0]["initialReports"]}
    />
  );
}

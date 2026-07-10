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
    .select("*, ow_companies(id, name), ow_users(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return <ReviewsAdminClient initialReviews={(reviews ?? []) as Parameters<typeof ReviewsAdminClient>[0]["initialReviews"]} />;
}

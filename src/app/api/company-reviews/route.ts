import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// GET /api/company-reviews?company_id=xxx
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ reviews: [], summary: null });

  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("ow_company_reviews")
    .select("id, employment_status, rating_overall, rating_culture, rating_growth, rating_wlb, rating_compensation, rating_leadership, rating_business, rating_welfare, pros, cons, job_type, created_at")
    .eq("company_id", companyId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  const list = reviews ?? [];

  const pick = (key: string) => list.map((r) => (r as Record<string, unknown>)[key]).filter((v) => typeof v === "number") as number[];

  // サマリー計算（null軸は除外）
  const summary = list.length === 0 ? null : {
    count: list.length,
    avg_overall:      avg(list.map((r) => r.rating_overall)),
    avg_culture:      avg(pick("rating_culture")),
    avg_growth:       avg(pick("rating_growth")),
    avg_wlb:          avg(pick("rating_wlb")),
    avg_compensation: avg(pick("rating_compensation")),
    avg_leadership:   avg(pick("rating_leadership")),
    avg_business:     avg(pick("rating_business")),
    avg_welfare:      avg(pick("rating_welfare")),
  };

  return NextResponse.json({ reviews: list, summary });
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// POST /api/company-reviews
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: owUser } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const {
    company_id, employment_status, rating_overall,
    rating_culture, rating_growth, rating_wlb, rating_compensation,
    rating_leadership, rating_business, rating_welfare,
    pros, cons, job_type,
  } = body;

  if (!company_id || !employment_status || !rating_overall) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_company_reviews")
    .upsert({
      company_id,
      user_id: owUser.id,
      employment_status,
      rating_overall,
      rating_culture:      rating_culture      || null,
      rating_growth:       rating_growth       || null,
      rating_wlb:          rating_wlb          || null,
      rating_compensation: rating_compensation || null,
      rating_leadership:   rating_leadership   || null,
      rating_business:     rating_business     || null,
      rating_welfare:      rating_welfare      || null,
      pros: pros || null,
      cons: cons || null,
      job_type: job_type || null,
      is_approved: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,user_id" });

  if (error) {
    if (error.code === "P0004") return NextResponse.json({ error: "P0004" }, { status: 401 });
    if (error.code === "P0005") return NextResponse.json({ error: "P0005" }, { status: 403 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

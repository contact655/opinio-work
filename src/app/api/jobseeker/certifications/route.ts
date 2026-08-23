import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseCertificationBody, CERTIFICATION_COLS } from "@/lib/api/certificationInput";

export const dynamic = "force-dynamic";

/**
 * 資格の一覧・追加（2026-08-24）。
 * ⚠️ 形は `api/jobseeker/awards` に揃えてある。片方を直すときはもう片方も見ること。
 * ⚠️ 検証は `lib/api/certificationInput.ts` に置き、POST と PUT で共有する。
 */

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// GET /api/jobseeker/certifications
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ certifications: [] });

  const { data, error } = await supabase
    .from("ow_user_certifications")
    .select(CERTIFICATION_COLS)
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  /* ⚠️ error を握りつぶさない。`?? []` だけで受けると権限エラーが「0件」に化ける */
  if (error) {
    console.error("[GET /api/jobseeker/certifications]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ certifications: data ?? [] });
}

// POST /api/jobseeker/certifications
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseCertificationBody(body);
  if (input instanceof NextResponse) return input;

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: maxRow } = await supabase
    .from("ow_user_certifications")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_certifications")
    .insert({ user_id: owUserId, ...input, sort_order: nextSortOrder })
    .select(CERTIFICATION_COLS)
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/certifications]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

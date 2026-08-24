import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseLanguageBody, LANGUAGE_COLS } from "@/lib/api/languageInput";

export const dynamic = "force-dynamic";

/**
 * 言語の一覧・追加（2026-08-24）。
 * ⚠️ 形は `api/jobseeker/certifications` に揃えてある。片方を直すときはもう片方も見ること。
 * ⚠️ 検証は `lib/api/languageInput.ts` に置き、POST と PUT で共有する。
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

// GET /api/jobseeker/languages
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ languages: [] });

  const { data, error } = await supabase
    .from("ow_user_languages")
    .select(LANGUAGE_COLS)
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  /* ⚠️ error を握りつぶさない。`?? []` だけで受けると権限エラーが「0件」に化ける */
  if (error) {
    console.error("[GET /api/jobseeker/languages]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ languages: data ?? [] });
}

// POST /api/jobseeker/languages
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

  const input = parseLanguageBody(body);
  if (input instanceof NextResponse) return input;

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: maxRow } = await supabase
    .from("ow_user_languages")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_languages")
    .insert({ user_id: owUserId, ...input, sort_order: nextSortOrder })
    .select(LANGUAGE_COLS)
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/languages]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

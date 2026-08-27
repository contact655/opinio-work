import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parseLanguageBody, checkLanguageLimit, LANGUAGE_COLS } from "@/lib/api/languageInput";

export const dynamic = "force-dynamic";

/**
 * 言語の一覧・追加（2026-08-24）。
 * ⚠️ 形は `api/jobseeker/certifications` に揃えてある。片方を直すときはもう片方も見ること。
 * ⚠️ 検証は `lib/api/languageInput.ts` に置き、POST と PUT で共有する。
 */

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error) {
    console.error("[api/jobseeker/languages resolveOwUserId]", error.message);
    return null;
  }
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

  /* ⚠️ マスタに存在するかまで見るので await。**同じ関数を PUT でも通す。** */
  const input = await parseLanguageBody(supabase, body);
  if (input instanceof NextResponse) return input;

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ★上限。⚠️ **追加のときだけ。** PUT で呼ぶと上限に達した人が既存の行を直せなくなる。 */
  const overLimit = await checkLanguageLimit(supabase, owUserId);
  if (overLimit) return overLimit;

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
    /* 23505 = unique (user_id, language_id)。**既に登録している**ので 409 */
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "DUPLICATE_LANGUAGE", message: "その言語はすでに登録されています。" },
        { status: 409 }
      );
    }
    console.error("[POST /api/jobseeker/languages]", insertError.code, insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// auth_id → ow_users.id（他の jobseeker ルートと同じパターン）
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

// GET /api/jobseeker/experience-story-sections?experience_id=xxx
// 指定した experience に属するセクション一覧を sort_order 順で返す
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const experienceId = url.searchParams.get("experience_id");
  if (!experienceId) {
    return NextResponse.json(
      { error: "MISSING_PARAM", message: "experience_id クエリパラメータが必要です。" },
      { status: 400 }
    );
  }

  // RLS の SELECT は USING(true) のためフィルタだけで取得できるが、
  // experience_id が自分のものか ownership 確認は RLS の INSERT/UPDATE/DELETE が担う。
  // GET は公開データとして扱う(ow_experience_stories の SELECT 方針と統一)。
  const { data, error } = await supabase
    .from("ow_story_sections")
    .select("id, experience_id, name, sort_order, created_at")
    .eq("experience_id", experienceId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/experience-story-sections]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data ?? [] });
}

// POST /api/jobseeker/experience-story-sections
// 新規セクション作成。ownership は DB の RLS(ow_story_sections_insert_own)が保証。
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

  const experienceId = typeof body.experience_id === "string" ? body.experience_id.trim() : null;
  if (!experienceId) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "experience_id は必須です。" },
      { status: 400 }
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELD", message: "name は必須です。" },
      { status: 400 }
    );
  }
  if (name.length > 50) {
    return NextResponse.json(
      { error: "INVALID_LENGTH", message: "name は 50 文字以内にしてください。" },
      { status: 400 }
    );
  }

  // ownership 確認: experience_id が自分のものか
  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: ownExp } = await supabase
    .from("ow_experiences")
    .select("id")
    .eq("id", experienceId)
    .eq("user_id", owUserId)
    .maybeSingle();
  if (!ownExp) {
    return NextResponse.json(
      { error: "EXPERIENCE_NOT_FOUND", message: "指定した experience_id が見つかりません。" },
      { status: 404 }
    );
  }

  // sort_order: この experience のセクション内で MAX + 1
  const { data: maxRow } = await supabase
    .from("ow_story_sections")
    .select("sort_order")
    .eq("experience_id", experienceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_story_sections")
    .insert({ experience_id: experienceId, name, sort_order: nextSortOrder })
    .select("id, experience_id, name, sort_order, created_at")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/experience-story-sections]", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

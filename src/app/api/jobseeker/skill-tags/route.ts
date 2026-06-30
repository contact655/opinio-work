import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// auth_id → ow_users.id（experiences ルートと同じパターン）
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

// GET /api/jobseeker/skill-tags — 自分のスキルタグ一覧（sort_order 昇順）
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ tags: [] });

  const { data, error } = await supabase
    .from("ow_user_skill_tags")
    .select("id, label, category, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/skill-tags]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ tags: data ?? [] });
}

// POST /api/jobseeker/skill-tags — タグ追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawLabel = typeof body.label === "string" ? body.label.trim() : "";

  // バリデーション 1: 文字数（1-50字）
  if (rawLabel.length < 1 || rawLabel.length > 50) {
    return NextResponse.json(
      { error: "INVALID_LABEL_LENGTH", message: "タグは1〜50字で入力してください。" },
      { status: 400 }
    );
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // バリデーション 2: 重複チェック
  const { data: existing } = await supabase
    .from("ow_user_skill_tags")
    .select("id")
    .eq("user_id", owUserId)
    .eq("label", rawLabel)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "DUPLICATE_LABEL", message: "同じタグがすでに登録されています。" },
      { status: 409 }
    );
  }

  // バリデーション 3: 上限チェック（15個ソフトリミット）
  const { count } = await supabase
    .from("ow_user_skill_tags")
    .select("id", { count: "exact", head: true })
    .eq("user_id", owUserId);

  if ((count ?? 0) >= 15) {
    return NextResponse.json(
      { error: "LIMIT_EXCEEDED", message: "スキルタグは最大15個まで登録できます。" },
      { status: 400 }
    );
  }

  // sort_order: 現在の MAX + 1（レコードなしなら 1）
  const { data: maxRow } = await supabase
    .from("ow_user_skill_tags")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const rawCategory = typeof body.category === "string" ? body.category.trim().slice(0, 50) : null;

  // INSERT
  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_skill_tags")
    .insert({ user_id: owUserId, label: rawLabel, category: rawCategory, sort_order: nextSortOrder })
    .select("id, label, category, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/skill-tags]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// auth_id → ow_users.id（educations ルートと同じパターン）
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

// GET /api/jobseeker/certifications — 自分の資格一覧（sort_order 昇順）
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ certifications: [] });

  const { data, error } = await supabase
    .from("ow_user_certifications")
    .select("id, name, issuer, issued_at, expires_at, no_expiry, sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/certifications]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ certifications: data ?? [] });
}

// POST /api/jobseeker/certifications — 資格追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: unknown;
    issuer?: unknown;
    issued_at?: unknown;
    expires_at?: unknown;
    no_expiry?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  // バリデーション 1: name（1-100字 必須）
  if (name.length < 1 || name.length > 100) {
    return NextResponse.json(
      { error: "INVALID_NAME_LENGTH", message: "資格名は1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  // バリデーション 2: issuer（100字以内 任意）
  const issuer = typeof body.issuer === "string" ? body.issuer.trim() : null;
  if (issuer !== null && issuer.length > 100) {
    return NextResponse.json(
      { error: "INVALID_ISSUER_LENGTH", message: "発行機関は100字以内で入力してください。" },
      { status: 400 }
    );
  }

  const issued_at  = typeof body.issued_at  === "string" && body.issued_at  ? body.issued_at  : null;
  const no_expiry  = body.no_expiry === true;
  const expires_at = no_expiry ? null : (typeof body.expires_at === "string" && body.expires_at ? body.expires_at : null);

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // sort_order: 現在の MAX + 1
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
    .insert({
      user_id: owUserId,
      name,
      issuer: issuer || null,
      issued_at,
      expires_at,
      no_expiry,
      sort_order: nextSortOrder,
    })
    .select("id, name, issuer, issued_at, expires_at, no_expiry, sort_order")
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/certifications]", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

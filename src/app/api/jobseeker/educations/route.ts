import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// auth_id → ow_users.id（skill-tags ルートと同じパターン）
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

// GET /api/jobseeker/educations — 自分の学歴一覧（sort_order 昇順）
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ educations: [] });

  const { data, error } = await supabase
    .from("ow_user_educations")
    .select(`
      id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order,
      school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)
    `)
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[GET /api/jobseeker/educations]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ educations: data ?? [] });
}

// POST /api/jobseeker/educations — 学歴追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    school?: unknown;
    faculty?: unknown;
    degree?: unknown;
    enrolled_at?: unknown;
    graduated_at?: unknown;
    is_current?: unknown;
    school_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const school = typeof body.school === "string" ? body.school.trim() : "";

  // バリデーション 1: school（1-100字 必須）
  if (school.length < 1 || school.length > 100) {
    return NextResponse.json(
      { error: "INVALID_SCHOOL_LENGTH", message: "学校名は1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  // バリデーション 2: faculty（100字以内 任意）
  const faculty = typeof body.faculty === "string" ? body.faculty.trim() : null;
  if (faculty !== null && faculty.length > 100) {
    return NextResponse.json(
      { error: "INVALID_FACULTY_LENGTH", message: "学部・学科は100字以内で入力してください。" },
      { status: 400 }
    );
  }

  // バリデーション 3: degree enum
  const VALID_DEGREES = ["小学校卒", "中学校卒", "高校卒", "専門卒", "短大卒", "学士", "修士", "博士", "その他"] as const;
  const degree = typeof body.degree === "string" && (VALID_DEGREES as readonly string[]).includes(body.degree)
    ? body.degree
    : null;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  const enrolled_at = typeof body.enrolled_at === "string" && DATE_RE.test(body.enrolled_at) ? body.enrolled_at : null;
  const is_current = body.is_current === true;
  const graduated_at = is_current ? null : (typeof body.graduated_at === "string" && DATE_RE.test(body.graduated_at) ? body.graduated_at : null);

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // 上限チェック: 1ユーザー30件まで
  const { count: eduCount } = await supabase
    .from("ow_user_educations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", owUserId);
  if ((eduCount ?? 0) >= 30) {
    return NextResponse.json({ error: "学歴の登録上限（30件）に達しています" }, { status: 400 });
  }

  // sort_order: 現在の MAX + 1
  const { data: maxRow } = await supabase
    .from("ow_user_educations")
    .select("sort_order")
    .eq("user_id", owUserId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  // school_id: UUID 形式の場合のみ採用
  const school_id = typeof body.school_id === "string" && UUID_RE.test(body.school_id) ? body.school_id : null;

  const { data: inserted, error: insertError } = await supabase
    .from("ow_user_educations")
    .insert({
      user_id: owUserId,
      school,
      faculty: faculty || null,
      degree,
      enrolled_at,
      graduated_at,
      is_current,
      sort_order: nextSortOrder,
      school_id,
    })
    .select(`
      id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order,
      school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)
    `)
    .single();

  if (insertError) {
    console.error("[POST /api/jobseeker/educations]", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}

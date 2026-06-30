import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/educations/[id] — 学歴更新
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const school = typeof body.school === "string" ? body.school.trim() : "";

  // バリデーション 1: school
  if (school.length < 1 || school.length > 100) {
    return NextResponse.json(
      { error: "INVALID_SCHOOL_LENGTH", message: "学校名は1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  // バリデーション 2: faculty
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

  // school_id: body に明示的に含まれる場合のみ更新(undefined = 変更なし、null = クリア、UUID string = セット)
  const updatePayload: Record<string, unknown> = {
    school,
    faculty: faculty || null,
    degree,
    enrolled_at,
    graduated_at,
    is_current,
  };
  if ("school_id" in body) {
    updatePayload.school_id = typeof body.school_id === "string" && UUID_RE.test(body.school_id) ? body.school_id : null;
  }

  const { data: updated, error } = await supabase
    .from("ow_user_educations")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("user_id", owUser.id)
    .select(`
      id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order,
      school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)
    `)
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/educations/[id]]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/educations/[id] — 学歴削除
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabase
    .from("ow_user_educations")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUser.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/educations/[id]]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

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

  const enrolled_at = typeof body.enrolled_at === "string" && body.enrolled_at ? body.enrolled_at : null;
  const is_current = body.is_current === true;
  const graduated_at = is_current ? null : (typeof body.graduated_at === "string" && body.graduated_at ? body.graduated_at : null);

  // school_id: body に明示的に含まれる場合のみ更新(undefined = 変更なし、null = クリア、string = セット)
  const updatePayload: Record<string, unknown> = {
    school,
    faculty: faculty || null,
    degree,
    enrolled_at,
    graduated_at,
    is_current,
  };
  if ("school_id" in body) {
    updatePayload.school_id = typeof body.school_id === "string" ? body.school_id : null;
  }

  // RLS の update_own が他人のレコード更新を自動的に弾く
  const { data: updated, error } = await supabase
    .from("ow_user_educations")
    .update(updatePayload)
    .eq("id", params.id)
    .select(`
      id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order,
      school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)
    `)
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/educations/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/educations/[id] — 学歴削除
// RLS（ow_user_educations_delete_own）が他人のレコードへの操作を自動的に弾く
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_educations")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/educations/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

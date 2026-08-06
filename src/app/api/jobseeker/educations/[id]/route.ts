import { createClient } from "@/lib/supabase/server";
import { normalizeYm, isBlankYm } from "@/lib/utils/ym";
import { DEGREES } from "@/lib/constants/careerOptions";
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
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
  /* ⚠️ 許容値は careerOptions.ts の1箇所に置く。不正値は 400（黙って null にしない） */
  if (!isBlankYm(body.degree) && !(DEGREES as readonly string[]).includes(body.degree as string)) {
    return NextResponse.json({ error: "INVALID_DEGREE", message: "学位の値が不正です。" }, { status: 400 });
  }
  const degree = isBlankYm(body.degree) ? null : (body.degree as string);

  /* ⚠️ 空と不正を区別する。空は null（任意項目）、不正は 400。
        黙って null にすると「入力させたのに保存しない」に戻る。
        クライアントは YYYY-MM-DD を送るが、以前の正規表現は YYYY-MM しか通さず
        入学年月・卒業年月が丸ごと捨てられていた（2026-08-07 に判明）。 */
  const enrolled_at = normalizeYm(body.enrolled_at);
  if (enrolled_at === undefined) {
    return NextResponse.json({ error: "INVALID_ENROLLED_AT", message: "入学年月の形式が正しくありません。" }, { status: 400 });
  }
  const is_current = body.is_current === true;
  const graduatedRaw = is_current ? null : normalizeYm(body.graduated_at);
  if (graduatedRaw === undefined) {
    return NextResponse.json({ error: "INVALID_GRADUATED_AT", message: "卒業年月の形式が正しくありません。" }, { status: 400 });
  }
  const graduated_at = graduatedRaw;

  // school_id: body に明示的に含まれる場合のみ更新(undefined = 変更なし、null = クリア、UUID string = セット)
  const updatePayload: {
    school: string;
    faculty: string | null;
    degree: string | null;
    enrolled_at: string | null;
    graduated_at: string | null;
    is_current: boolean;
    school_id?: string | null;
  } = {
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

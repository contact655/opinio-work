import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_SCHOOL_NAME_LENGTH = 200;
const MAX_SCHOOL_NAME_KANA_LENGTH = 200;

// POST /api/jobseeker/school-requests — ow_schools マスターへの学校追加リクエスト
export async function POST(req: Request) {
  // 1. 認証チェック
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. body パース
  let body: { school_name?: unknown; school_name_kana?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3. school_name バリデーション
  const { school_name, school_name_kana } = body;

  if (typeof school_name !== "string" || school_name.trim().length === 0) {
    return NextResponse.json(
      { error: "school_name is required" },
      { status: 400 }
    );
  }

  const trimmedSchoolName = school_name.trim();
  if (trimmedSchoolName.length > MAX_SCHOOL_NAME_LENGTH) {
    return NextResponse.json(
      { error: "school_name is too long" },
      { status: 400 }
    );
  }

  // 4. school_name_kana バリデーション（任意）
  let trimmedSchoolNameKana: string | null = null;
  if (school_name_kana !== undefined && school_name_kana !== null) {
    if (typeof school_name_kana !== "string") {
      return NextResponse.json(
        { error: "school_name_kana must be a string" },
        { status: 400 }
      );
    }
    const trimmed = school_name_kana.trim();
    if (trimmed.length > MAX_SCHOOL_NAME_KANA_LENGTH) {
      return NextResponse.json(
        { error: "school_name_kana is too long" },
        { status: 400 }
      );
    }
    trimmedSchoolNameKana = trimmed.length > 0 ? trimmed : null;
  }

  // 5. auth_id → ow_users.id 引き当て（既存の educations ルートと同じパターン）
  const { data: userRecord } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 6. INSERT（status / created_at は DEFAULT で自動セット）
  const { data, error } = await supabase
    .from("ow_school_requests")
    .insert({
      requested_by: userRecord.id,
      school_name: trimmedSchoolName,
      school_name_kana: trimmedSchoolNameKana,
    })
    .select("id, school_name, school_name_kana, status, created_at")
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/school-requests]", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}

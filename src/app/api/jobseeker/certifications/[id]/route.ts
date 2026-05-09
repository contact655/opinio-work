import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/certifications/[id] — 資格更新
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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

  // バリデーション 1: name
  if (name.length < 1 || name.length > 100) {
    return NextResponse.json(
      { error: "INVALID_NAME_LENGTH", message: "資格名は1〜100字で入力してください。" },
      { status: 400 }
    );
  }

  // バリデーション 2: issuer
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

  // RLS の update_own が他人のレコード更新を自動的に弾く
  const { data: updated, error } = await supabase
    .from("ow_user_certifications")
    .update({
      name,
      issuer: issuer || null,
      issued_at,
      expires_at,
      no_expiry,
    })
    .eq("id", params.id)
    .select("id, name, issuer, issued_at, expires_at, no_expiry, sort_order")
    .single();

  if (error) {
    console.error("[PUT /api/jobseeker/certifications/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/jobseeker/certifications/[id] — 資格削除
// RLS（ow_user_certifications_delete_own）が他人のレコードへの操作を自動的に弾く
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("ow_user_certifications")
    .delete()
    .eq("id", params.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/certifications/[id]]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

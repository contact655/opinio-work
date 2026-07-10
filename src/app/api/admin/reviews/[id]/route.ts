import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/reviews/[id] — 承認
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const body = await req.json();
  const { error } = await admin
    .from("ow_company_reviews")
    .update({ is_approved: body.is_approved, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/reviews/[id] — 削除
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_reviews")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

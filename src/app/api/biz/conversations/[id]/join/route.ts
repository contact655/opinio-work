import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const conversationId = params.id;
  const supabase = createClient();

  // ── Auth check ─────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Resolve ow_users.id from auth.uid() ───────────────────────────────────
  const { data: meUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!meUser) {
    return NextResponse.json({ error: "user not found" }, { status: 403 });
  }

  // ── Get conversation + company_id ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error: convError } = await (supabase as any)
    .from("ow_conversations")
    .select("id, company_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError || !conv) {
    return NextResponse.json(
      { error: "conversation not found" },
      { status: 404 }
    );
  }
  if (!conv.company_id) {
    return NextResponse.json(
      { error: "non-company conversation" },
      { status: 400 }
    );
  }

  // ── Verify caller belongs to this company (ow_company_admins) ─────────────
  const { data: adminLink } = await supabase
    .from("ow_company_admins")
    .select("id")
    .eq("user_id", meUser.id)
    .eq("company_id", conv.company_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!adminLink) {
    return NextResponse.json(
      { error: "not authorized for this company" },
      { status: 403 }
    );
  }

  // ── Idempotency: already a participant? ────────────────────────────────────
  const { data: existing } = await supabase
    .from("ow_conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", meUser.id)
    .is("left_at", null)
    .maybeSingle();

  if (existing) {
    revalidatePath("/biz/conversations");
    revalidatePath(`/biz/conversations/${conversationId}`);
    return NextResponse.json({ ok: true, alreadyJoined: true });
  }

  // ── INSERT new participant ─────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from("ow_conversation_participants")
    .insert({
      conversation_id: conversationId,
      user_id: meUser.id,
      role: "company_admin",
    });

  if (insertError) {
    console.error("[conversations/join POST] insert error:", insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  revalidatePath("/biz/conversations");
  revalidatePath(`/biz/conversations/${conversationId}`);

  return NextResponse.json({ ok: true });
}

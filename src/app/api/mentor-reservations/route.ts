import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify/email";
import {
  mentorReservationAdminTemplate,
  mentorReservationUserTemplate,
} from "@/lib/notify/templates";

export const dynamic = "force-dynamic";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

// POST /api/mentor-reservations — submit mentor consultation request (authenticated)
export async function POST(req: Request) {
  const supabase = createClient();
  const owUserId = await resolveOwUserId(supabase);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    mentor_id,
    themes,
    current_situation,
    questions,
    background,
    preferred_days,
    preferred_times,
    contact_email,
    preferred_platform,
  } = body;

  if (!mentor_id || typeof mentor_id !== "string") {
    return NextResponse.json({ error: "mentor_id required" }, { status: 400 });
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return NextResponse.json({ error: "Valid contact_email required" }, { status: 400 });
  }
  if (!current_situation || typeof current_situation !== "string" || !current_situation.trim()) {
    return NextResponse.json({ error: "current_situation required" }, { status: 400 });
  }
  if (!questions || typeof questions !== "string" || !questions.trim()) {
    return NextResponse.json({ error: "questions required" }, { status: 400 });
  }

  // Verify mentor exists and is available
  const { data: mentor } = await supabase
    .from("ow_mentors")
    .select("id, is_available")
    .eq("id", mentor_id)
    .maybeSingle();

  if (!mentor) {
    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  }
  if (!mentor.is_available) {
    return NextResponse.json({ error: "Mentor is not currently accepting consultations" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("ow_mentor_reservations")
    .insert({
      user_id: owUserId,
      mentor_id,
      mentor_user_id: null,
      themes: Array.isArray(themes) ? themes : [],
      current_situation: (current_situation as string).trim(),
      questions: (questions as string).trim(),
      background: background && typeof background === "string" ? background.trim() : null,
      preferred_days: Array.isArray(preferred_days) ? preferred_days : [],
      preferred_times: Array.isArray(preferred_times) ? preferred_times : [],
      contact_email: (contact_email as string).trim(),
      preferred_platform: preferred_platform && typeof preferred_platform === "string"
        ? preferred_platform
        : null,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/mentor-reservations]", error.message);
    return NextResponse.json({ error: "Failed to submit reservation" }, { status: 500 });
  }

  // ── Notify (best-effort, T5) ──────────────────────────────────────────────
  const { data: mentorForNotify } = await supabase
    .from("ow_mentors")
    .select("name")
    .eq("id", mentor_id as string)
    .maybeSingle();

  if (mentorForNotify) {
    await notify(
      mentorReservationAdminTemplate({
        mentorName: mentorForNotify.name,
        contactEmail: (contact_email as string).trim(),
        themes: Array.isArray(themes) ? (themes as string[]) : [],
        currentSituation: (current_situation as string).trim(),
        questions: (questions as string).trim(),
      })
    );
    await notify(
      mentorReservationUserTemplate({
        to: (contact_email as string).trim(),
        mentorName: mentorForNotify.name,
      })
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

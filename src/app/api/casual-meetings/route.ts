import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { notify } from "@/lib/notify/email";
import {
  casualMeetingAdminTemplate,
  casualMeetingUserTemplate,
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

const VALID_INTENTS = ["info_gathering", "good_opportunity", "within_6", "within_3"];

// POST /api/casual-meetings — submit casual meeting request (authenticated)
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
    company_id, contact_email, job_id,
    share_profile, intent, interest_reason, questions, preferred_format,
  } = body;

  if (!company_id || typeof company_id !== "string") {
    return NextResponse.json({ error: "company_id required" }, { status: 400 });
  }
  if (!contact_email || typeof contact_email !== "string" || !contact_email.includes("@")) {
    return NextResponse.json({ error: "Valid contact_email required" }, { status: 400 });
  }
  if (intent && !VALID_INTENTS.includes(intent as string)) {
    return NextResponse.json({ error: "Invalid intent value" }, { status: 400 });
  }

  // App-level check: company must accept casual meetings
  const { data: company } = await supabase
    .from("ow_companies")
    .select("accepting_casual_meetings")
    .eq("id", company_id)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!company.accepting_casual_meetings) {
    return NextResponse.json(
      { error: "This company is not currently accepting casual meeting requests" },
      { status: 403 }
    );
  }

  const { data: meeting, error } = await supabase
    .from("ow_casual_meetings")
    .insert({
      user_id: owUserId,
      company_id,
      contact_email,
      job_id: job_id || null,
      share_profile: share_profile !== false,
      intent: intent || null,
      interest_reason: interest_reason || null,
      questions: questions || null,
      preferred_format: preferred_format || null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    console.error("[POST /api/casual-meetings]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Notify (best-effort, T3) ──────────────────────────────────────────────
  const { data: companyForNotify } = await supabase
    .from("ow_companies")
    .select("name")
    .eq("id", company_id as string)
    .maybeSingle();

  if (companyForNotify) {
    await notify(
      casualMeetingAdminTemplate({
        companyName: companyForNotify.name,
        contactEmail: contact_email as string,
        intent: (intent as string | null) ?? null,
        interestReason: (interest_reason as string | null) ?? null,
        questions: (questions as string | null) ?? null,
      })
    );
    await notify(
      casualMeetingUserTemplate({
        to: contact_email as string,
        companyName: companyForNotify.name,
      })
    );
  }

  return NextResponse.json({ id: meeting.id, status: meeting.status });
}

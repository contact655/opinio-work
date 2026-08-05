import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { createConversation } from "@/lib/conversations/createConversation";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationRecipients } from "@/lib/notify/recipients";
import {
  casualMeetingAdminTemplate,
  casualMeetingUserTemplate,
  casualMeetingCompanyAdminTemplate,
} from "@/lib/notify/templates";
import { insertActivity } from "@/lib/business/activities";

export const dynamic = "force-dynamic";

async function resolveOwUserId(supabase: ReturnType<typeof createClient>): Promise<{ owUserId: string | null; email: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { owUserId: null, email: null };
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  return { owUserId: data?.id ?? null, email: user.email ?? null };
}

const VALID_INTENTS = ["info_gathering", "good_opportunity", "within_6", "within_3"];

// POST /api/casual-meetings — submit casual meeting request (authenticated)
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 10, windowSec: 3600, prefix: "meeting" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

  const supabase = createClient();
  const { owUserId, email: authEmail } = await resolveOwUserId(supabase);
  if (!owUserId || !authEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    company_id, job_id,
    share_profile, intent, interest_reason, questions, preferred_format,
  } = body;

  if (!company_id || typeof company_id !== "string") {
    return NextResponse.json({ error: "company_id required" }, { status: 400 });
  }

  // contact_email は request body ではなく認証済みセッションのメールを使用（H-1修正）
  const contact_email = authEmail;

  if (intent && !VALID_INTENTS.includes(intent as string)) {
    return NextResponse.json({ error: "Invalid intent value" }, { status: 400 });
  }
  // 入力長制限
  if (typeof interest_reason === "string" && interest_reason.length > 2000) {
    return NextResponse.json({ error: "interest_reason は2000文字以内で入力してください" }, { status: 400 });
  }
  if (typeof questions === "string" && questions.length > 2000) {
    return NextResponse.json({ error: "questions は2000文字以内で入力してください" }, { status: 400 });
  }
  if (typeof preferred_format === "string" && preferred_format.length > 500) {
    return NextResponse.json({ error: "preferred_format は500文字以内で入力してください" }, { status: 400 });
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

  // 重複申込チェック（H-2修正）
  const { data: existing } = await supabase
    .from("ow_casual_meetings")
    .select("id")
    .eq("user_id", owUserId)
    .eq("company_id", company_id)
    .not("status", "in", '("declined","completed")')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_applied", id: existing.id }, { status: 409 });
  }

  const { data: meeting, error } = await supabase
    .from("ow_casual_meetings")
    .insert({
      user_id: owUserId,
      company_id,
      contact_email,
      job_id: (job_id && typeof job_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job_id)) ? job_id : null,
      share_profile: share_profile !== false,
      intent: typeof intent === "string" ? intent : null,
      interest_reason: typeof interest_reason === "string" ? interest_reason : null,
      questions: typeof questions === "string" ? questions : null,
      preferred_format: typeof preferred_format === "string" ? preferred_format : null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    console.error("[POST /api/casual-meetings]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── Activity: casual_meeting_applied (best-effort) ─────────────────────
  await insertActivity(supabase, {
    company_id: company_id as string,
    actor_user_id: owUserId,
    type: "casual_meeting_applied",
    description: "カジュアル面談の申し込みがありました",
    target_type: "casual_meeting",
    target_id: meeting.id,
  });

  // ── 対話生成 (best-effort, Y2) ───────────────────────────────────────────
  try {
    await createConversation(supabase, {
      kind: "company",
      candidateUserId: owUserId,
      companyId: company_id,
    });
  } catch (e) {
    console.error("[casual-meetings] createConversation failed:", e);
  }

  // ── Notify (best-effort, T3) ──────────────────────────────────────────────
  const { data: companyForNotify } = await supabase
    .from("ow_companies")
    .select("name")
    .eq("id", company_id as string)
    .maybeSingle();

  if (companyForNotify) {
    // OPINIO 運営への通知
    await notify(
      casualMeetingAdminTemplate({
        companyName: companyForNotify.name,
        contactEmail: contact_email,
        intent: (intent as string | null) ?? null,
        interestReason: (interest_reason as string | null) ?? null,
        questions: (questions as string | null) ?? null,
      })
    );
    // 申込者本人への確認メール
    await notify(
      casualMeetingUserTemplate({
        to: contact_email,
        companyName: companyForNotify.name,
      })
    );

    /*
      企業への通知。
      ⚠️ 宛先は getCompanyNotificationRecipients に集約している。ここで引かないこと。
         2026-08-05 まで ow_company_admins を直接引いており、応募・スカウトと
         宛先の取り方が3通りに割れていた。
      ⚠️ notification_emails が設定されていればそちらが優先される（上書き）。
         全85社が null の現時点では、従来どおり企業の管理者に届く。
    */
    const companyEmails = await getCompanyNotificationRecipients(
      company_id as string,
      "casual-meetings",
    );
    for (const email of companyEmails) {
      await notify(
        casualMeetingCompanyAdminTemplate({
          to: email,
          companyName: companyForNotify.name,
          contactEmail: contact_email,
          intent: (intent as string | null) ?? null,
          interestReason: (interest_reason as string | null) ?? null,
          questions: (questions as string | null) ?? null,
        })
      );
    }
  }

  return NextResponse.json({ id: meeting.id, status: meeting.status });
}

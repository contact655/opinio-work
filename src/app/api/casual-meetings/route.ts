import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { createConversation } from "@/lib/conversations/createConversation";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";

/** ⚠️ UUID 以外を DB に投げない（`22P02` になり、`?? []` 側では「0件」に化ける） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { isCasualMeetingOpen } from "@/lib/company/casualMeeting";
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
    intent, interest_reason, questions, preferred_format,
    requested_user_id,
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
  /* ⚠️ 生のフラグで判定しない（2026-08-11）。宛先が無ければ受け付けない。
        画面側（lib/company/casualMeeting.ts）と同じ判定をここでも通すこと。
        ここだけフラグのままにすると、CTA が出ていない企業に API 直叩きで送れてしまう。 */
  if (!(await isCasualMeetingOpen(company_id, company.accepting_casual_meetings))) {
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

  /* ── 指名された「話を聞きたい人」（2026-08-25）────────────────────────────
        ⚠️★**クライアントの値をそのまま入れない。** 申込画面でも確認しているが、
           API は直接叩けるので**ここでも確かめ直す**。確かめないと、
           掲載していない人・別会社の人を指名として記録できてしまう。
        ⚠️ 条件は公開側と同じ2つ（公開中 ＋ その企業に在籍中の経歴）。
        ⚠️ 不正な値は**黙って null に落とす**（400 で申込ごと止めない）。
           指名は任意で、企業宛の申込としては成立するため。 */
  let requestedUserId: string | null = null;
  if (typeof requested_user_id === "string" && UUID_RE.test(requested_user_id)) {
    const [{ data: member }, { data: exp }] = await Promise.all([
      supabase.from("ow_company_members").select("user_id")
        .eq("company_id", company_id).eq("user_id", requested_user_id)
        .eq("is_public", true).eq("display_consent", true).maybeSingle(),
      supabase.from("ow_experiences").select("id")
        .eq("company_id", company_id).eq("user_id", requested_user_id)
        .eq("is_current", true).limit(1).maybeSingle(),
    ]);
    if (member && exp) requestedUserId = requested_user_id;
    else console.warn("[POST /api/casual-meetings] 指名が無効なので落とした:", requested_user_id);
  }

  const { data: meeting, error } = await supabase
    .from("ow_casual_meetings")
    .insert({
      user_id: owUserId,
      company_id,
      contact_email,
      job_id: (job_id && typeof job_id === "string" && UUID_RE.test(job_id)) ? job_id : null,
      intent: typeof intent === "string" ? intent : null,
      interest_reason: typeof interest_reason === "string" ? interest_reason : null,
      questions: typeof questions === "string" ? questions : null,
      preferred_format: typeof preferred_format === "string" ? preferred_format : null,
      status: "pending",
      requested_user_id: requestedUserId,
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
    const companyEmails = await getCompanyNotificationTarget(
      company_id as string,
      "casual-meetings",
    );
    for (const email of companyEmails.to) {
      await notify(
        casualMeetingCompanyAdminTemplate({
          to: email,
          companyName: companyForNotify.name,
          contactEmail: contact_email,
          intent: (intent as string | null) ?? null,
          interestReason: (interest_reason as string | null) ?? null,
          questions: (questions as string | null) ?? null,
          /* ⚠️ 印は同じ判定から出す */
          viaOps: companyEmails.viaOps,
        })
      );
    }
  }

  return NextResponse.json({ id: meeting.id, status: meeting.status });
}

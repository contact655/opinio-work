import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";
import { notify } from "@/lib/notify/email";
import { meetingStatusTemplate } from "@/lib/notify/templates";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

type Action = "status" | "memo" | "assign_to_me" | "mark_read";

// DB CHECK constraint (migration 031): only these 5 values are valid
const VALID_MEETING_STATUSES = new Set([
  "pending", "company_contacted", "scheduled", "completed", "declined",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const meetingId = params.id;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: Action; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // 権限チェック: admin のみ面談を操作できる
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  if (body.action === "status") {
    if (!body.value) {
      return NextResponse.json({ error: "value required" }, { status: 400 });
    }
    if (!VALID_MEETING_STATUSES.has(body.value)) {
      return NextResponse.json(
        { error: `status must be one of: ${Array.from(VALID_MEETING_STATUSES).join(", ")}` },
        { status: 400 }
      );
    }

    // UPDATE + 0-rows detection (Commit W/X lesson: RLS silent block)
    const { data: updated, error } = await supabase
      .from("ow_casual_meetings")
      .update({ status: body.value, updated_at: now })
      .eq("id", meetingId)
      .eq("company_id", ctx.companyId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[meetings PATCH status]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!updated) {
      // 0 rows: RLS blocked the UPDATE or meetingId not found
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Activity: meeting_scheduled / meeting_completed (best-effort)
    if (body.value === "scheduled" || body.value === "completed") {
      const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
      const [ctx, mtgRow] = await Promise.all([
        getCompanyContext(supabase, user.id, cookieCompanyId),
        supabase.from("ow_casual_meetings").select("company_id").eq("id", meetingId).maybeSingle(),
      ]);
      const owUserId = ctx?.owUserId ?? null;
      if (mtgRow.data?.company_id) {
        const isScheduled = body.value === "scheduled";
        await insertActivity(supabase, {
          company_id: mtgRow.data.company_id,
          actor_user_id: owUserId,
          type: isScheduled ? "meeting_scheduled" : "meeting_completed",
          description: isScheduled
            ? "カジュアル面談の日程が確定しました"
            : "カジュアル面談が完了しました",
          target_type: "casual_meeting",
          target_id: meetingId,
        });
      }
    }

    // Notify user (best-effort, T4): company_contacted / scheduled / declined
    const NOTIFY_STATUSES = new Set(["company_contacted", "scheduled", "declined"]);
    if (NOTIFY_STATUSES.has(body.value)) {
      const { data: mtgNotify } = await supabase
        .from("ow_casual_meetings")
        .select("contact_email, ow_companies!inner(name)")
        .eq("id", meetingId)
        .maybeSingle();

      if (mtgNotify?.contact_email) {
        const companyName =
          (mtgNotify.ow_companies as unknown as { name: string } | null)?.name ?? "";
        await notify(
          meetingStatusTemplate({
            to: mtgNotify.contact_email,
            companyName,
            status: body.value as "company_contacted" | "scheduled" | "declined",
          })
        );
      }
    }
  }

  else if (body.action === "memo") {
    const { data: updated, error } = await supabase
      .from("ow_casual_meetings")
      .update({ company_internal_memo: (body.value ?? "").slice(0, 2000), updated_at: now })
      .eq("id", meetingId)
      .eq("company_id", ctx.companyId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[meetings PATCH memo]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  else if (body.action === "assign_to_me") {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (!owUser) {
      return NextResponse.json({ error: "ow_users not found" }, { status: 404 });
    }
    const { data: updated, error } = await supabase
      .from("ow_casual_meetings")
      .update({ assignee_user_id: owUser.id, updated_at: now })
      .eq("id", meetingId)
      .eq("company_id", ctx.companyId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[meetings PATCH assign_to_me]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  else if (body.action === "mark_read") {
    const { data: updated, error } = await supabase
      .from("ow_casual_meetings")
      .update({ company_read_at: now })
      .eq("id", meetingId)
      .eq("company_id", ctx.companyId)
      .is("company_read_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[meetings PATCH mark_read]", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

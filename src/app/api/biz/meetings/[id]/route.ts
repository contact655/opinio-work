import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwUserId } from "@/lib/business/company";
import { insertActivity } from "@/lib/business/activities";

type Action = "status" | "memo" | "assign_to_me" | "mark_read";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const meetingId = params.id;
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

  if (body.action === "status") {
    if (!body.value) {
      return NextResponse.json({ error: "value required" }, { status: 400 });
    }
    const { error } = await supabase
      .from("ow_casual_meetings")
      .update({ status: body.value, updated_at: now })
      .eq("id", meetingId);
    if (error) {
      console.error("[meetings PATCH status]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Activity: meeting_scheduled / meeting_completed (best-effort)
    if (body.value === "scheduled" || body.value === "completed") {
      const [owUserId, mtgRow] = await Promise.all([
        getOwUserId(supabase, user.id),
        supabase.from("ow_casual_meetings").select("company_id").eq("id", meetingId).maybeSingle(),
      ]);
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
  }

  else if (body.action === "memo") {
    const { error } = await supabase
      .from("ow_casual_meetings")
      .update({ company_internal_memo: body.value ?? "", updated_at: now })
      .eq("id", meetingId);
    if (error) {
      console.error("[meetings PATCH memo]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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
    const { error } = await supabase
      .from("ow_casual_meetings")
      .update({ assignee_user_id: owUser.id, updated_at: now })
      .eq("id", meetingId);
    if (error) {
      console.error("[meetings PATCH assign_to_me]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  else if (body.action === "mark_read") {
    const { error } = await supabase
      .from("ow_casual_meetings")
      .update({ company_read_at: now })
      .eq("id", meetingId)
      .is("company_read_at", null);
    if (error) {
      console.error("[meetings PATCH mark_read]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

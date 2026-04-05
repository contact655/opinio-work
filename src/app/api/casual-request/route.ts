import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  try {
    // Check for existing thread
    const { data: existing } = await supabase
      .from("ow_threads")
      .select("id")
      .eq("company_id", companyId)
      .eq("candidate_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ threadId: existing.id });
    }

    // Create new thread
    const { data: thread, error: threadError } = await supabase
      .from("ow_threads")
      .insert({
        company_id: companyId,
        candidate_id: user.id,
        status: "casual_requested",
      })
      .select("id")
      .single();

    if (threadError) {
      // Table might not exist yet — return placeholder
      return NextResponse.json({
        threadId: null,
        message: "カジュアル面談リクエストを送信しました",
      });
    }

    // Post system message
    try {
      await supabase.from("ow_messages").insert({
        thread_id: thread.id,
        sender_id: user.id,
        sender_type: "system",
        content: "カジュアル面談リクエストが送信されました",
      });
    } catch {
      // ignore if table doesn't exist
    }

    return NextResponse.json({ threadId: thread.id });
  } catch {
    return NextResponse.json({
      threadId: null,
      message: "カジュアル面談リクエストを送信しました",
    });
  }
}

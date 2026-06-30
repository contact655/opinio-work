import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolveOwUserId } from "@/lib/supabase/resolveOwUserId";
import { createConversation } from "@/lib/conversations/createConversation";
import { notify } from "@/lib/notify/email";
import {
  applicationAdminTemplate,
  applicationUserTemplate,
} from "@/lib/notify/templates";
import { insertActivity } from "@/lib/business/activities";

export const dynamic = "force-dynamic";

// POST /api/applications — 求人応募
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { job_id, phone, message } = body as {
    job_id?: string;
    phone?: string;
    message?: string;
  };

  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  if (typeof message === "string" && message.length > 3000) {
    return NextResponse.json({ error: "メッセージは3000文字以内で入力してください" }, { status: 400 });
  }
  if (typeof phone === "string" && phone.length > 30) {
    return NextResponse.json({ error: "電話番号は30文字以内で入力してください" }, { status: 400 });
  }

  // 重複応募チェック（race condition 軽減: UI 側でも button disable）
  const { data: existing } = await supabase
    .from("ow_job_applications")
    .select("id")
    .eq("user_id", owUserId)
    .eq("job_id", job_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_applied", id: existing.id }, { status: 409 });
  }

  // name + email を auth.users から取得
  const name: string = (user.user_metadata?.name as string | undefined) ?? user.email ?? "名前未設定";
  const email: string = user.email ?? "";

  const { data: inserted, error } = await supabase
    .from("ow_job_applications")
    .insert({
      job_id,
      user_id: owUserId,
      name,
      email,
      phone: phone ?? null,
      message: message ?? null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error) {
    // 23505 = unique_violation: race condition が UNIQUE 制約を突き抜けた場合
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_applied" }, { status: 409 });
    }
    console.error("[POST /api/applications]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // ── Activity: application_received (best-effort) ─────────────────────────
  try {
    const { data: jobInfo } = await supabase
      .from("ow_jobs")
      .select("title, company_id")
      .eq("id", job_id as string)
      .maybeSingle();
    if (jobInfo?.company_id) {
      await insertActivity(supabase, {
        company_id: jobInfo.company_id,
        actor_user_id: owUserId,
        type: "application_received",
        description: `「${jobInfo.title}」への応募がありました`,
        target_type: "job_application",
        target_id: inserted.id,
      });
    }
  } catch (e) {
    console.warn("[applications] insertActivity failed:", e);
  }

  // ── Notify (best-effort, T1) ──────────────────────────────────────────────
  const { data: jobForNotify } = await supabase
    .from("ow_jobs")
    .select("title, company_id, ow_companies!inner(name)")
    .eq("id", job_id as string)
    .maybeSingle();

  // ── 対話生成 (best-effort, Y2) ───────────────────────────────────────────
  // notify より前に実行することで、notify が throw しても対話生成は実行済み。
  // §4-9: notify 処理自体の best-effort 化は Phase η 前で対処予定。
  try {
    const companyId = jobForNotify?.company_id;
    if (!companyId) {
      console.error("[applications] company_id not found for job", job_id);
    } else {
      await createConversation(supabase, {
        kind: "company",
        candidateUserId: owUserId,
        companyId,
      });
    }
  } catch (e) {
    console.error("[applications] createConversation failed:", e);
  }

  if (jobForNotify) {
    const companyName =
      (jobForNotify.ow_companies as unknown as { name: string } | null)?.name ?? "";
    await notify(
      applicationAdminTemplate({
        companyName,
        jobTitle: jobForNotify.title,
        applicantName: name,
        applicantEmail: email,
        message: (message as string | undefined) ?? null,
      })
    );
    if (email) {
      await notify(
        applicationUserTemplate({
          to: email,
          companyName,
          jobTitle: jobForNotify.title,
        })
      );
    }
  }

  return NextResponse.json({ id: inserted.id, status: inserted.status }, { status: 201 });
}

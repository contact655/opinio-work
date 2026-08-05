import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveOwUserId } from "@/lib/supabase/resolveOwUserId";
import { createConversation } from "@/lib/conversations/createConversation";
import { notify } from "@/lib/notify/email";
import {
  applicationAdminTemplate,
  applicationUserTemplate,
  applicationCompanyTemplate,
} from "@/lib/notify/templates";
import { insertActivity } from "@/lib/business/activities";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// POST /api/applications — 求人応募
export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 10, windowSec: 3600, prefix: "apply" });
  if (!allowed) return NextResponse.json({ error: "リクエストが多すぎます。しばらくしてから再試行してください。" }, { status: 429 });

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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!job_id || typeof job_id !== "string" || !UUID_RE.test(job_id)) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  if (typeof message === "string" && message.length > 3000) {
    return NextResponse.json({ error: "メッセージは3000文字以内で入力してください" }, { status: 400 });
  }
  if (typeof phone === "string" && phone.length > 30) {
    return NextResponse.json({ error: "電話番号は30文字以内で入力してください" }, { status: 400 });
  }

  // 求人の存在・公開状態チェック
  const { data: job } = await supabase
    .from("ow_jobs")
    .select("id, status")
    .eq("id", job_id)
    .maybeSingle();
  if (!job || job.status !== "published") {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
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
    .select("title, company_id, ow_companies!inner(name, notification_emails)")
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

    /*
      ③ 企業宛（ow_companies.notification_emails）
      ⚠️ 2026-08-05 に追加。それまで応募の通知は運営と応募者の2通だけで、
         企業には何も届いていなかった。notification_emails は /biz/company で
         入力・保存できるのに、送信処理から一度も読まれていなかった。
      ⚠️ 空（null / 空配列）なら送らない。エラーにもしない。
         2026-08-05 時点で全85社が null なので、この経路は繋がっているが宛先が無い。
         企業が /biz/company で設定するまで届かない。宛先を勝手に補完しないこと
         （ow_company_admins のメールに落とすと、本人が受け取ると決めていない宛先に送る）。
      ⚠️ notify() は失敗を飲み込むので、1件失敗しても残りと応募処理は止まらない。
    */
    const rawEmails = (jobForNotify.ow_companies as unknown as { notification_emails?: string[] | null } | null)?.notification_emails;
    const companyEmails = Array.from(new Set(
      (Array.isArray(rawEmails) ? rawEmails : [])
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter((e) => e.includes("@")),
    ));
    if (companyEmails.length === 0) {
      console.info("[applications] notification_emails is empty; company not notified", jobForNotify.company_id);
    }
    for (const to of companyEmails) {
      await notify(
        applicationCompanyTemplate({
          to,
          jobTitle: jobForNotify.title,
          applicantName: name,
          applicantEmail: email,
          message: (message as string | undefined) ?? null,
        })
      );
    }
  }

  return NextResponse.json({ id: inserted.id, status: inserted.status }, { status: 201 });
}

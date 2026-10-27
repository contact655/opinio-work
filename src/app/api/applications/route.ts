import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import { NextRequest, NextResponse } from "next/server";
import { resolveOwUserId } from "@/lib/supabase/resolveOwUserId";
import { openCompanyConversation } from "@/lib/conversations/openReason";
import { notify } from "@/lib/notify/email";
import {
  applicationAdminTemplate,
  applicationUserTemplate,
  applicationCompanyTemplate,
} from "@/lib/notify/templates";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { notifyCompanySlack } from "@/lib/notify/slack";
import { insertActivity } from "@/lib/business/activities";
import { checkRateLimit } from "@/lib/rateLimit";
import { isJobApplicationOpen, APPLICATION_CLOSED_MESSAGE } from "@/lib/jobs/application";

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
  let { data: job } = await supabase
    .from("ow_jobs")
    .select("id, status, company_id")
    .eq("id", job_id)
    .maybeSingle();
  /* ★検証用アカウントは、検証用の会社の公開中の求人にも応募できる（2026-10-12）。
        ow_jobs の RLS は検証用の求人を誰にも返さないので、応募者が検証用のときだけ admin で
        「公開中かつ検証用」の求人を引き直す。⚠️ 検証用でない人には引き直さない（存在も分からない）。 */
  let jobDb = supabase;
  if (!job && (await viewerIsTestUser())) {
    const admin = createAdminClient();
    const { data: testJob } = await admin
      .from("ow_jobs")
      .select("id, status, company_id")
      .eq("id", job_id)
      .eq("status", "published")
      .eq("is_test", true)
      .eq("company_suspended", false)
      .maybeSingle();
    if (testJob) { job = testJob; jobDb = admin as unknown as typeof supabase; }
  }
  if (!job || job.status !== "published") {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  /* ⚠️ status だけでは足りない（2026-08-11）。**応募が届く先があるか**を必ず見る。
        画面側（lib/jobs/application.ts）と同じ判定をここでも通すこと。
        ここを飛ばすと、CTA が出ていない求人に API 直叩きで応募できてしまう。
        面談（/api/casual-meetings）で同じ形を先に踏んでいる。 */
  if (!(await isJobApplicationOpen(job.company_id as string))) {
    return NextResponse.json({ error: APPLICATION_CLOSED_MESSAGE }, { status: 403 });
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
    const { data: jobInfo } = await jobDb
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
  const { data: jobForNotify } = await jobDb
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
      /* ★サーバー（admin）が「開いてよい理由」を確かめてから作る（2026-10-09 / 段階2）。
            ⚠️ セッションのクライアントで create_conversation を呼ばない（権限を外した）。
            ⚠️ 判定は `lib/conversations/openReason.ts` の1か所。応募は本人発なので転職意欲は見ない */
      await openCompanyConversation({ candidateOwUserId: owUserId, companyId, source: "application" });
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
      ③ 企業宛。
      ⚠️ 2026-08-05 に追加。それまで応募の通知は運営と応募者の2通だけで、
         企業には何も届いていなかった。
      ⚠️ 宛先の解決は getCompanyNotificationRecipients に集約している。ここで引かない。
         空配列なら送らない（エラーにしない）。
      ⚠️ notify() は失敗を飲み込むので、1件失敗しても残りと応募処理は止まらない。
    */
    const companyEmails = jobForNotify.company_id
      ? await getCompanyNotificationTarget(jobForNotify.company_id, "applications")
      : { to: [], viaOps: false };
    /* ★運営の受け皿（③ viaOps）には送らない（2026-10-27 / 柴さんの決定）。応募者の名前・メール・志望動機を
          運営宛てに流さない。⚠️ 応募は担当者がいる会社にしか受けない（isJobApplicationOpen）ので、通常はここに来ない。
          担当者が admin 以外の権限だけで通知先も未設定の会社だと ③ に落ちうるため、ここでも止める */
    if (companyEmails.viaOps) {
      console.warn(`[applications] 会社の宛先が無く運営に回る形だったので、応募の通知を送らない company=${jobForNotify.company_id}`);
    }
    for (const to of companyEmails.viaOps ? [] : companyEmails.to) {
      await notify(
        applicationCompanyTemplate({
          to,
          jobTitle: jobForNotify.title,
          applicantName: name,
          applicantEmail: email,
          message: (message as string | undefined) ?? null,
          /* ⚠️ 印は同じ判定から出す。ここでアドレスを見て判定し直さない */
          viaOps: companyEmails.viaOps,
        })
      );
    }
  }

  /* ★会社の Slack にも知らせる（2026-10-12）。条件（設定・オンオフ・30分まとめ・一時停止）は slack.ts の1か所 */
  if (jobForNotify?.company_id) {
    await notifyCompanySlack({ companyId: jobForNotify.company_id as string, kind: "application", threadKey: "application",
      candidateOwUserId: owUserId, path: "/biz/applications", source: "applications" });
  }

  return NextResponse.json({ id: inserted.id, status: inserted.status }, { status: 201 });
}

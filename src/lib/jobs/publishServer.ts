import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { buildJobPostedRow } from "@/lib/feed/systemPosts";
import { revalidateJobPages } from "@/lib/companies/revalidate";
import { insertActivity } from "@/lib/business/activities";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { sendEmail } from "@/lib/notify/email";
import { jobStoppedCompanyTemplate } from "@/lib/notify/templates";
import { JOB_PUBLISH_COLUMNS, missingForPublishFromRow } from "./publishRequirements";
import { WORDING_COLUMNS, checkWording, wordingFieldsFromRow, type WordingHit } from "./wordingCheck";
import { decidePublish, isCompanyListedForJobs, type PublishDecision } from "./publishGate";

/**
 * ★求人の公開・停止をサーバーで行う（2026-10-12 / 柴さんの指示）。**状態を published にする経路はここだけ。**
 *   - requestPublish … 企業の「公開する」。判定は publishGate.ts の decidePublish（画面と同じ関数）
 *   - markPublished  … 公開の書き込み。企業の即時公開・運営の承認・運営の再公開の**全経路が通る**。
 *                      published_at（初回だけ）・停止の記録の消去・活動ログ・フィードの「求人を公開しました」・キャッシュの破棄
 *   - stopJob        … 運営の停止。理由を記録し、企業にメールで知らせる（アプリ内は求人管理の画面に理由を出す）
 * ⚠️ 書き込みは admin クライアント。企業が直接 published を書けないこと（guard_job_status_transition・RLS）は変えていない。
 * ⚠️ 呼び出し側で、その求人が自社のもの（企業）／運営であること（運営）を確かめてから呼ぶ。
 */

const LOAD_COLS = `${JOB_PUBLISH_COLUMNS}, ${WORDING_COLUMNS}, company_id, status, published_at, stopped_at` as const;

export type PublishResult =
  | { ok: true; decision: PublishDecision }
  | { ok: false; status: number; error: string };

/** 企業の「公開する」「再開する」「再開を依頼する」。published にするか、pending_review（運営が停止した求人の再開依頼）にするか、断る */
export async function requestPublish(jobId: string, companyId: string, actorOwUserId: string): Promise<PublishResult> {
  const db = createAdminClient();
  const [{ data: row, error: jErr }, { count: roleCount, error: rErr }, { data: co, error: cErr }] = await Promise.all([
    db.from("ow_jobs").select(LOAD_COLS).eq("id", jobId).eq("company_id", companyId).maybeSingle(),
    db.from("ow_job_roles").select("job_id", { count: "exact", head: true }).eq("job_id", jobId),
    db.from("ow_companies").select("is_published, listing_status").eq("id", companyId).maybeSingle(),
  ]);
  if (jErr || rErr || cErr) {
    console.error("[publishServer] 読み込み:", jErr?.message ?? rErr?.message ?? cErr?.message);
    return { ok: false, status: 500, error: "公開に必要な項目を確認できませんでした。時間をおいてもう一度お試しください。" };
  }
  if (!row) return { ok: false, status: 404, error: "求人が見つかりません" };
  const r = row as unknown as Record<string, unknown>;
  if (r.status === "published") return { ok: true, decision: { kind: "publish" } };

  const decision = decidePublish({
    missing: missingForPublishFromRow(r, roleCount ?? 0),
    hits: checkWording(wordingFieldsFromRow(r)),
    companyListed: isCompanyListedForJobs(co as { is_published?: boolean; listing_status?: string } | null),
    /* ⚠️ 旧「差し戻し」（rejected）も停止と同じに扱う（運営が止めたもの。stopped_at を持たない） */
    stopped: r.stopped_at != null || r.status === "rejected",
  });

  if (decision.kind === "publish") {
    const w = await markPublished(jobId, { actorOwUserId, actorCompanyId: companyId });
    if (!w.ok) return w;
  } else if (decision.kind === "review") {
    const now = new Date().toISOString();
    const u = await mutateOne(
      db.from("ow_jobs").update({ status: "pending_review", submitted_at: now, updated_at: now }).eq("id", jobId).eq("company_id", companyId),
      "運営が停止した求人の再開を依頼する",
    );
    if (!u.ok) return { ok: false, status: 500, error: "公開できませんでした。時間をおいてもう一度お試しください。" };
    await revalidateJobPages(jobId);
  }
  return { ok: true, decision };
}

/** ★公開の書き込み（全経路共通）。⚠️ 判定はしない（呼び出し側で済ませる） */
export async function markPublished(jobId: string, opts: { actorOwUserId: string | null; actorCompanyId?: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const { data: cur, error: curErr } = await db.from("ow_jobs").select("company_id, title, published_at").eq("id", jobId).maybeSingle();
  if (curErr || !cur) {
    console.error("[publishServer] 公開前の読み込み:", curErr?.message ?? "no row");
    return { ok: false, status: 404, error: "求人が見つかりません" };
  }
  const now = new Date().toISOString();
  const u = await mutateOne(
    db.from("ow_jobs").update({
      status: "published",
      /* ★初めて公開した日時。⚠️ 再公開で上書きしない */
      published_at: (cur.published_at as string | null) ?? now,
      updated_at: now,
      stopped_reason: null, stopped_at: null, stopped_by: null,
      rejection_reason: null, rejection_reviewer: null, rejection_date: null,
    }).eq("id", jobId),
    "求人を公開する",
  );
  if (!u.ok) return { ok: false, status: 500, error: "公開できませんでした。時間をおいてもう一度お試しください。" };

  const companyId = cur.company_id as string;
  if (opts.actorCompanyId) {
    await insertActivity(db, {
      company_id: companyId, actor_user_id: opts.actorOwUserId, type: "job_published",
      description: `求人「${(cur.title as string | null) ?? "—"}」を公開しました`, target_type: "job", target_id: jobId,
    });
  }
  /* ★フィードの「求人を公開しました」。⚠️ 1求人1件（2回目以降は 23505 で入らない） */
  try {
    const { data: co } = await db.from("ow_companies").select("name, brand_name").eq("id", companyId).maybeSingle();
    const { error: feedErr } = await db.from("ow_posts").insert(buildJobPostedRow(jobId, companyId, co ?? {}, { title: cur.title as string | null }));
    if (feedErr && feedErr.code !== "23505") console.error("[publishServer] feed job_posted:", feedErr.message);
  } catch (e) {
    console.error("[publishServer] feed job_posted:", e);
  }
  await revalidateJobPages(jobId);
  return { ok: true };
}

/** ★運営の停止。status = private ＋ 停止の記録。企業にメールで知らせる（失敗しても停止は成立。ログは出す）
 *  ★kind = "decline_reopen" … 再開の依頼（pending_review）を見送る。停止中に戻し、理由を更新する（2026-10-12） */
export async function stopJob(jobId: string, reason: string, adminOwUserId: string | null, kind: "stop" | "decline_reopen" = "stop"): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = reason.trim();
  if (!text) return { ok: false, error: "停止の理由を入力してください" };
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("ow_jobs").update({
    status: "private", stopped_reason: text.slice(0, 1000), stopped_at: now, stopped_by: adminOwUserId, updated_at: now,
  }).eq("id", jobId).select("company_id, title");
  if (error || !data || data.length !== 1) {
    console.error("[publishServer] 停止:", error?.message ?? `rows=${data?.length ?? 0}`);
    return { ok: false, error: "停止できませんでした" };
  }
  await revalidateJobPages(jobId);
  try {
    const companyId = data[0].company_id as string;
    const target = await getCompanyNotificationTarget(companyId, "job-stopped");
    for (const to of target.to) {
      await sendEmail(jobStoppedCompanyTemplate({ to, jobTitle: (data[0].title as string | null) ?? "求人", reason: text, jobId, viaOps: target.viaOps, kind }));
    }
  } catch (e) {
    console.error("[publishServer] 停止の通知:", e instanceof Error ? e.message : e);
  }
  return { ok: true };
}

export type { WordingHit };

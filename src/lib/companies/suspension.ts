import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidateCompanyPages, revalidateJobPages } from "@/lib/companies/revalidate";
import { publishedAtPatch } from "@/lib/companies/publishedAt";
import { greetingName } from "@/lib/constants/personName";
import { emailCompanyAdmins, emailOps } from "@/lib/notify/companyEmail";
import { companySuspensionCompanyTemplate, unsuspendRequestAdminTemplate } from "@/lib/notify/templates";

/**
 * ★会社ページの停止（運営だけ）と、企業からの停止解除の依頼（2026-10-28 / 柴さんの判断）。
 *   **停止の列（suspended_*・unsuspend_requested_at）を書くのはこのファイルだけ。**
 *
 * ── 停止すると ─────────────────────────────────────────────────────────────
 *   ・停止前の is_published / listing_status を suspended_prev_* に退避し、is_published = false・listing_status = 'draft' にする
 *     ⚠️ is_published を直接見ている経路（約30か所）を取りこぼさないため。RLS とヘルパーの suspended_at 条件は二重の守り
 *   ・DB のトリガーがその会社の募集の company_suspended を true にする → 求職者に出なくなる（PUBLIC_JOB_MATCH）
 *   ・企業は停止中に公開へ戻せない（DB の guard_company_approval が 42501 で止める）。内容の編集はできる
 *   ・候補者を探す・メッセージを送るも止まる（scoutGate.ts の hasScoutAccess が isSuspended を見る）
 * ── 解除すると ─────────────────────────────────────────────────────────────
 *   ・suspended_prev_* の状態に戻す
 * ⚠️ 書き込みは admin クライアント。呼び出し側で「運営か」「その企業の担当者か」を確かめてから呼ぶこと。
 * ⚠️ 履歴（ow_moderation_actions）は best-effort。失敗しても操作は成立（ログは出す）。
 */

export const SUSPENSION_REASON_MAX = 1000;
export const UNSUSPEND_MESSAGE_MAX = 500;

type Result = { ok: true } | { ok: false; status: number; error: string };

async function logAction(row: { target_type: "company" | "job"; target_id: string; action: string; reason: string | null; actor_user_id: string | null; actor_company_id?: string | null }) {
  const { error } = await createAdminClient().from("ow_moderation_actions").insert(row);
  if (error) console.error("[moderation] 履歴:", error.message);
}

/** 停止・解除のあとで、その会社のページと求人のキャッシュを落とす */
async function revalidateCompanyAndJobs(companyId: string) {
  await revalidateCompanyPages(companyId);
  const { data: jobs, error } = await createAdminClient().from("ow_jobs").select("id, slug").eq("company_id", companyId).eq("status", "published");
  if (error) console.error("[moderation] 求人の取得:", error.message);
  for (const j of jobs ?? []) await revalidateJobPages(j.id as string, { slug: (j.slug as string | null) ?? null, companyId });
}

/** 運営: 停止する。理由は必須（企業に送る） */
export async function suspendCompany(companyId: string, reason: string, adminOwUserId: string | null): Promise<Result> {
  const text = reason.trim();
  if (!text) return { ok: false, status: 400, error: "停止の理由を入力してください" };
  if (text.length > SUSPENSION_REASON_MAX) return { ok: false, status: 400, error: `理由は${SUSPENSION_REASON_MAX}文字以内で入力してください` };
  const db = createAdminClient();
  const { data: cur, error: cErr } = await db.from("ow_companies").select("is_published, listing_status, suspended_at").eq("id", companyId).maybeSingle();
  if (cErr) {
    console.error("[moderation] 停止の前:", cErr.message);
    return { ok: false, status: 500, error: "企業を確認できませんでした" };
  }
  if (!cur) return { ok: false, status: 404, error: "企業が見つかりません" };
  if (cur.suspended_at) return { ok: false, status: 409, error: "すでに停止中です" };
  const now = new Date().toISOString();
  const u = await mutateOne(
    db.from("ow_companies").update({
      suspended_at: now, suspended_by: adminOwUserId, suspension_reason: text,
      suspended_prev_is_published: cur.is_published === true,
      suspended_prev_listing_status: cur.listing_status ?? "draft",
      is_published: false, listing_status: "draft", unsuspend_requested_at: null, updated_at: now,
    }).eq("id", companyId).is("suspended_at", null),
    "会社ページを停止する",
  );
  if (!u.ok) return { ok: false, status: u.status, error: "停止できませんでした" };
  await logAction({ target_type: "company", target_id: companyId, action: "suspend", reason: text, actor_user_id: adminOwUserId });
  await revalidateCompanyAndJobs(companyId);
  await emailCompanyAdmins(companyId, "company-suspended", (to, companyName) =>
    companySuspensionCompanyTemplate({ to, companyName, kind: "suspend", reason: text }));
  return { ok: true };
}

/** 運営: 停止を解除する。停止前の公開の状態に戻す。メモは任意（企業にも送る） */
export async function unsuspendCompany(companyId: string, adminOwUserId: string | null, note: string | null): Promise<Result> {
  const text = note?.trim() ? note.trim().slice(0, SUSPENSION_REASON_MAX) : null;
  const db = createAdminClient();
  const { data: cur, error: cErr } = await db.from("ow_companies")
    .select("suspended_at, suspended_prev_is_published, suspended_prev_listing_status, published_at").eq("id", companyId).maybeSingle();
  if (cErr) {
    console.error("[moderation] 解除の前:", cErr.message);
    return { ok: false, status: 500, error: "企業を確認できませんでした" };
  }
  if (!cur) return { ok: false, status: 404, error: "企業が見つかりません" };
  if (!cur.suspended_at) return { ok: false, status: 409, error: "停止中ではありません" };
  const now = new Date().toISOString();
  /* ⚠️ 退避が無い（ありえないが）ときは、ページは開け・一覧には載せない側に戻す */
  const prevPublished = cur.suspended_prev_is_published ?? true;
  const prevListing = (cur.suspended_prev_listing_status as string | null) ?? "draft";
  const u = await mutateOne(
    db.from("ow_companies").update({
      suspended_at: null, suspended_by: null, suspension_reason: null,
      suspended_prev_is_published: null, suspended_prev_listing_status: null, unsuspend_requested_at: null,
      is_published: prevPublished, listing_status: prevListing,
      ...publishedAtPatch(cur.published_at as string | null, prevPublished, now),
      updated_at: now,
    }).eq("id", companyId).not("suspended_at", "is", null),
    "会社ページの停止を解除する",
  );
  if (!u.ok) return { ok: false, status: u.status, error: "解除できませんでした" };
  await logAction({ target_type: "company", target_id: companyId, action: "unsuspend", reason: text, actor_user_id: adminOwUserId });
  await revalidateCompanyAndJobs(companyId);
  await emailCompanyAdmins(companyId, "company-unsuspended", (to, companyName) =>
    companySuspensionCompanyTemplate({ to, companyName, kind: "unsuspend", reason: text }));
  return { ok: true };
}

/** 企業: 停止解除を依頼する（運営に知らせる）。依頼中は二重に受け付けない */
export async function requestUnsuspend(p: { companyId: string; owUserId: string; message: string | null }): Promise<Result & { requestedAt?: string }> {
  const message = p.message?.trim() ? p.message.trim() : null;
  if (message && message.length > UNSUSPEND_MESSAGE_MAX) return { ok: false, status: 400, error: `メッセージは${UNSUSPEND_MESSAGE_MAX}文字以内で入力してください` };
  const db = createAdminClient();
  const { data: cur, error: cErr } = await db.from("ow_companies").select("name, suspended_at, unsuspend_requested_at").eq("id", p.companyId).maybeSingle();
  if (cErr) {
    console.error("[moderation] 解除依頼の前:", cErr.message);
    return { ok: false, status: 500, error: "企業を確認できませんでした" };
  }
  if (!cur) return { ok: false, status: 404, error: "企業が見つかりません" };
  if (!cur.suspended_at) return { ok: false, status: 400, error: "停止中ではありません" };
  if (cur.unsuspend_requested_at) return { ok: false, status: 409, error: "すでに停止解除の依頼を受け付けています" };
  const now = new Date().toISOString();
  const u = await mutateOne(
    db.from("ow_companies").update({ unsuspend_requested_at: now }).eq("id", p.companyId).is("unsuspend_requested_at", null).not("suspended_at", "is", null),
    "停止解除の依頼",
  );
  if (!u.ok) return { ok: false, status: u.status, error: "依頼できませんでした" };
  await logAction({ target_type: "company", target_id: p.companyId, action: "unsuspend_requested", reason: message, actor_user_id: p.owUserId, actor_company_id: p.companyId });
  const { data: who } = await db.from("ow_users").select("name, email").eq("id", p.owUserId).maybeSingle();
  await emailOps("unsuspend-request", unsuspendRequestAdminTemplate({
    companyId: p.companyId, companyName: (cur.name as string | null) ?? "（社名不明）",
    requesterName: greetingName(who?.name as string | null | undefined), requesterEmail: (who?.email as string | null) ?? null, message,
  }));
  return { ok: true, requestedAt: now };
}

/** 募集の停止・再開の見送りも同じ履歴に残す（publishServer.ts の stopJob から呼ぶ） */
export async function logJobModeration(jobId: string, action: "suspend" | "decline_reopen" | "unsuspend", reason: string | null, adminOwUserId: string | null) {
  await logAction({ target_type: "job", target_id: jobId, action, reason, actor_user_id: adminOwUserId });
}

import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { canUse, toPlanType } from "@/lib/constants/plans";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { countNew, ensureLastViewed, isNotifyFrequency } from "@/lib/business/savedSearchServer";
import { parseSavedFilters } from "@/lib/business/savedSearch";
import { savedSearchAlertTemplate } from "@/lib/notify/templates";
import { sendEmail } from "@/lib/notify/email";
import type { Candidate } from "@/lib/business/candidates/model";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * ★保存した条件の新着のお知らせ（2026-10-10 / 候補者探し 段3）。
 * 毎日 23:00 UTC（＝日本時間の朝8時。vercel.json）。毎朝のものは毎回、毎週のものは**日本時間の月曜**だけ。
 *
 * ⚠️★送るのは**条件を作った人だけ**。作った人がその企業の有効な担当者でなくなったら送らない（条件は残す）。
 * ⚠️★件数は画面と同じ関数（`loadCompanyCandidates` → `filterCandidates` → `isNewSince`）。
 *    見える人（can_send_scout）だけ・登録日か本人の編集日が基準より後の人だけ。
 * ⚠️ 基準は「作った人の前回見た日時」と「前回のお知らせ」の遅いほう（同じ人を毎朝重ねて数えない）。
 * ⚠️★新着が0人の日は送らない。メールに氏名・経歴を入れない（テンプレートの注記）。
 * ⚠️ 企業の審査が済んでいない・候補者検索が使えないプランの企業には送らない（画面と同じゲート）。
 * ⚠️ dev では `sendEmail` が送らずログに出す（lib/notify/email.ts の skipInDev）。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET not configured", { status: 500 });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return new Response("Unauthorized", { status: 401 });

  const db = createNoStoreAdminClient();
  const jstWeekday = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCDay(); // 1 = 月曜
  const freqs = jstWeekday === 1 ? ["daily", "weekly"] : ["daily"];

  const { data: searches, error } = await db.from("ow_saved_candidate_searches")
    .select("id, name, filters, owner_user_id, company_id, notify_frequency, last_notified_at")
    .in("notify_frequency", freqs);
  if (error) {
    console.error("[cron/saved-search-alerts]", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const summary = { checked: 0, sent: 0, zero: 0, skippedOwnerInactive: 0, skippedCompany: 0, failed: 0 };
  const candidatesCache = new Map<string, Candidate[] | null>();
  for (const s of searches ?? []) {
    summary.checked++;
    if (!isNotifyFrequency(s.notify_frequency)) continue;
    const companyId = s.company_id as string, ownerId = s.owner_user_id as string;

    /* 作った人がその企業の有効な担当者か */
    const { data: adm } = await db.from("ow_company_admins").select("id").eq("company_id", companyId).eq("user_id", ownerId).eq("is_active", true).maybeSingle();
    if (!adm) { summary.skippedOwnerInactive++; continue; }
    /* 企業のゲート（審査済み・候補者検索が使える） */
    const [{ data: co }, { data: plan }] = await Promise.all([
      db.from("ow_companies").select("is_approved").eq("id", companyId).maybeSingle(),
      db.from("ow_company_plans").select("plan_type").eq("company_id", companyId).eq("status", "active").maybeSingle(),
    ]);
    const planType = toPlanType((plan?.plan_type as string | null) ?? null);
    if (co?.is_approved !== true || !canUse(planType, "candidateSearch")) { summary.skippedCompany++; continue; }

    const key = `${companyId}:${ownerId}`;
    if (!candidatesCache.has(key)) {
      try {
        candidatesCache.set(key, (await loadCompanyCandidates({ companyId, viewerOwUserId: ownerId, planType })).candidates);
      } catch (e) {
        console.error("[cron/saved-search-alerts] candidates:", e);
        candidatesCache.set(key, null);
      }
    }
    const candidates = candidatesCache.get(key);
    if (!candidates) { summary.failed++; continue; }

    const lastViewed = (await ensureLastViewed([s.id as string], ownerId)).get(s.id as string) ?? new Date().toISOString();
    const lastNotified = (s.last_notified_at as string | null) ?? null;
    const since = lastNotified && lastNotified > lastViewed ? lastNotified : lastViewed;
    const count = countNew(candidates, parseSavedFilters(s.filters), since);
    if (count === 0) { summary.zero++; continue; }

    const { data: owner } = await db.from("ow_users").select("email").eq("id", ownerId).maybeSingle();
    const to = ((owner?.email as string | null) ?? "").trim();
    if (!to) { summary.failed++; continue; }
    await sendEmail(savedSearchAlertTemplate({ to, searchId: s.id as string, searchName: s.name as string, count }));
    const { error: upErr } = await db.from("ow_saved_candidate_searches").update({ last_notified_at: new Date().toISOString() }).eq("id", s.id as string);
    if (upErr) console.error("[cron/saved-search-alerts] last_notified_at:", upErr.message);
    summary.sent++;
    console.log(`[cron/saved-search-alerts] 送った: 条件 ${s.id} 新着 ${count}名`);
  }
  console.log("[cron/saved-search-alerts]", JSON.stringify({ freqs, ...summary }));
  return Response.json({ ok: true, freqs, ...summary });
}

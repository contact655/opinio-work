/* ★サーバー専用 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify/email";
import { forYouInterestOpsTemplate } from "@/lib/notify/templates";
import { OPS_NOTIFY_DAILY_SOFT_LIMIT } from "@/lib/forYou/weights";

/**
 * ★担当者のいない企業への「興味あり」を運営に知らせる。**通知の組み立てと送信はここの1か所だけ。**
 *
 * いまは1件ずつメールする（柴さんの判断・2026-10-15）。
 * ⚠️★1日に `OPS_NOTIFY_DAILY_SOFT_LIMIT`（10件）を超えるようになったら、**この関数の中身を
 *    「記録だけして、まとめての通知（日次の cron など）に回す」形に変える。** 呼び出し側（react.ts）は変えない。
 *    いまは超えたときに警告のログを出すだけ。
 * ⚠️ 運営は受け取るが取り次がない（2026-09-15 の取り決め。lib/notify/recipients.ts の③）。
 * ⚠️ dev ではメールを送らない（lib/notify/email.ts の skipInDev）。
 * ⚠️ best-effort。失敗しても「興味あり」の記録は取り消さない（ログに出す）。
 *
 * @returns 送った（送ろうとした）ら true。`ops_notified_at` を書くかの判断に使う
 */
export async function notifyOpsForYouInterest(params: {
  companyId: string;
  companyName: string;
  candidateUserId: string;
  /** 合う会社から押したときの順位。企業ページから押したときは null */
  rank: number | null;
  reasons: string[];
  /** どこから押したか（lib/interest/constants.ts の InterestSource） */
  source?: string;
}): Promise<boolean> {
  const db = createAdminClient();
  try {
    const { data: cand, error } = await db
      .from("ow_users").select("name, is_test").eq("id", params.candidateUserId).maybeSingle();
    if (error) console.error("[forYou/notifyOps] ow_users:", error.message);

    /* 今日（日本時間）すでに何件知らせたか。⚠️ 数えるだけ。止めない */
    const todayJst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const since = new Date(`${todayJst}T00:00:00+09:00`).toISOString();
    const { count, error: cErr } = await db
      .from("ow_for_you_reactions").select("user_id", { count: "exact", head: true })
      .gte("ops_notified_at", since);
    if (cErr) console.error("[forYou/notifyOps] 今日の件数:", cErr.message);
    if ((count ?? 0) >= OPS_NOTIFY_DAILY_SOFT_LIMIT) {
      console.warn(`[forYou/notifyOps] 今日の運営への通知が ${count} 件を超えた。まとめての通知への切り替えを検討すること`);
    }

    await notify(forYouInterestOpsTemplate({
      companyId: params.companyId,
      companyName: params.companyName,
      candidateName: (cand?.name as string | null) ?? null,
      rank: params.rank,
      reasons: params.reasons,
      source: params.source ?? "for_you",
      candidateIsTest: cand?.is_test === true,
    }));
    console.log(`[forYou/notifyOps] 運営に知らせた company=${params.companyId}`);
    return true;
  } catch (e) {
    console.error("[forYou/notifyOps]", e instanceof Error ? e.message : e);
    return false;
  }
}

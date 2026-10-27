import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";

/**
 * ★運営の操作（停止・解除・スカウト機能の許可など）を企業へメールする（2026-10-28）。
 *   宛先は応募の通知と同じ規則（`getCompanyNotificationTarget`。企業の宛先 → 有効な管理者）。
 * ⚠️ 企業に宛先が無く運営に回るときは送らない（運営が自分で押した操作を運営に知らせても意味が無い）。
 *    企業は画面（停止の理由・スカウト機能の状態）で分かる。
 * ⚠️ 検証用の企業（is_test）には送らない（`notifyCompanyStatus` と同じ）。
 * ⚠️ best-effort。失敗しても操作は成功として扱う（ログは出す）。
 */
export async function emailCompanyAdmins(
  companyId: string,
  source: string,
  build: (to: string, companyName: string) => { to: string; subject: string; html: string },
): Promise<void> {
  try {
    const { data: co, error } = await createAdminClient().from("ow_companies").select("name, is_test").eq("id", companyId).maybeSingle();
    if (error || !co) {
      console.error(`[emailCompanyAdmins:${source}] company:`, error?.message ?? "not found");
      return;
    }
    if (co.is_test === true) return;
    const target = await getCompanyNotificationTarget(companyId, source);
    if (target.viaOps) {
      console.info(`[emailCompanyAdmins:${source}] 企業に宛先が無いので送らない company=${companyId}`);
      return;
    }
    for (const to of target.to) await sendEmail(build(to, (co.name as string | null) ?? "貴社"));
  } catch (e) {
    console.error(`[emailCompanyAdmins:${source}]`, e);
  }
}

/** 運営宛のメール（best-effort）。⚠️ 失敗しても記録は残っているので呼び出し側は成功として扱う */
export async function emailOps(source: string, mail: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await sendEmail(mail);
  } catch (e) {
    console.error(`[emailOps:${source}]`, e);
  }
}

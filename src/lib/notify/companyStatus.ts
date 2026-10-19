import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { companyApprovedTemplate, companyListedTemplate } from "@/lib/notify/templates";
import { companyDisplayName } from "@/lib/companies/displayName";
/**
 * ★審査の完了・企業ページの公開を企業へメールする（2026-10-19）。
 *   企業の画面は「審査が完了次第メールでご連絡します」と書いているが、それまで1通も送っていなかった。
 * ⚠️ 宛先は応募の通知と同じ規則（`getCompanyNotificationTarget`）。企業に宛先が無く運営に回るときは送らない
 *    （運営が自分で押した操作を運営に知らせても意味が無い）。
 * ⚠️ 検証用の企業（is_test）には送らない。
 * ⚠️ best-effort。失敗しても承認・掲載は成功として扱う（ログは出す）。
 */
export async function notifyCompanyStatus(companyId: string, kind: "approved" | "listed"): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: co, error } = await admin.from("ow_companies").select("name, name_en, slug, is_test").eq("id", companyId).maybeSingle();
    if (error || !co) {
      console.error(`[notifyCompanyStatus:${kind}] company:`, error?.message ?? "not found");
      return;
    }
    if (co.is_test === true) return;
    const target = await getCompanyNotificationTarget(companyId, `admin-${kind}`);
    if (target.viaOps) {
      console.info(`[notifyCompanyStatus:${kind}] 企業に宛先が無いので送らない company=${companyId}`);
      return;
    }
    const companyName = companyDisplayName(co.name as string, (co.name_en as string | null) ?? null).displayName;
    const companyPath = `/companies/${encodeURIComponent((co.slug as string | null) ?? companyId)}`;
    for (const to of target.to) {
      await sendEmail(kind === "approved"
        ? companyApprovedTemplate({ to, companyName })
        : companyListedTemplate({ to, companyName, companyPath }));
    }
  } catch (e) {
    console.error(`[notifyCompanyStatus:${kind}]`, e);
  }
}

/* ⚠️ 呼ぶのは「状態が変わったとき」だけ（呼び出し側が切り替える前の値と比べる）。
      経路: admin/companies/actions.ts の updateApproval・updateListingStatus、PUT /api/admin/companies/[id] */

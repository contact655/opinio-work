import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { TEST_JOB_LISTED_NOTE } from "@/lib/jobs/publicJobs";
import { listIncomingApproaches } from "@/lib/approaches/server";
import MypageLayout from "../_components/MypageLayout";
import ApproachesClient, { type IncomingApproachView } from "./ApproachesClient";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "企業からのメッセージリクエスト | OPINIO" },
  robots: { index: false, follow: false },
};

/**
 * ★企業からの「声かけ」（2026-10-09）。求職者が「話してみる」「今回は見送る」を答える。
 *
 * ⚠️ 何を出すかは `listIncomingApproaches`（まだ答えていない・30日以内・いま見せてよい企業）。
 * ⚠️★理由と本文は承認前でも全文見せる（2026-10-09 / 柴さんの判断）。承認で区切るのは2通目以降だけ。
 * ⚠️★見送っても企業には伝わらないことを画面に書く（押す前に分かるように）。
 * ⚠️ 認証は middleware（`/mypage/` 配下）が見る。
 */
export default async function MypageApproachesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=%2Fmypage%2Fapproaches");
  const db = createAdminClient();
  const { data: me, error: meErr } = await db.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[mypage/approaches] ow_users:", meErr.message);
  if (!me) redirect("/auth?next=%2Fmypage%2Fapproaches");

  const list = await listIncomingApproaches(me.id as string);
  /* ★運営会社（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();
  const items: IncomingApproachView[] | null = list === null ? null : list.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    reason: a.reason,
    body: a.body,
    senderName: a.senderName,
    companyName: companyDisplayName(a.company.name, a.company.nameEn).displayName,
    /* ★見ている人と会社がどちらも検証用なら、社名は文字だけ（企業ページは開かない。`companyLinkStateFor`） */
    companyHref: a.company.linkState === "open" ? `/companies/${a.company.slug ?? a.company.id}` : null,
    isOwnCompany: ownCompanyId !== null && a.company.id === ownCompanyId,
    logoUrl: a.company.logoUrl,
    logoLetter: a.company.logoLetter,
    logoGradient: a.company.logoGradient,
    job: a.job ? {
      title: a.job.title,
      href: a.job.state === "open" ? `/jobs/${a.job.slug ?? a.job.id}` : null,
      /* ★見ている人と企業がどちらも検証用なら、掲載中として扱う（リンクはしない。`jobListingStateFor`） */
      note: a.job.state === "open_test" ? TEST_JOB_LISTED_NOTE : null,
    } : null,
  }));

  return (
    <MypageLayout activeKey="dashboard">
      <ApproachesClient items={items} />
    </MypageLayout>
  );
}

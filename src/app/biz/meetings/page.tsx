import { listCompanyMeetings } from "@/lib/meetings/server";
import { formatMeetingDateTime, MEETING_FORMATS } from "@/lib/constants/meetings";
import { PipelineClient } from "./PipelineClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { BizNoTenantPage } from "@/components/business/BizNoTenantPage";
import { getTenantContext } from "@/lib/business/dashboard";
import { createClient } from "@/lib/supabase/server";
import { fetchMeetingsForCompany } from "@/lib/business/meetings";
import { fetchApplicationsForCompany } from "@/lib/business/applications";

export const dynamic = "force-dynamic";

export const metadata = {
  /* ★サイドバーの名前に揃えた（2026-09-21）。それまで「採用パイプライン」で、
        同じ画面がサイドバー・タイトル・タブで3つの名前を持っていた */
  title: { absolute: "選考管理 | OPINIO Business" },
};

export default async function BizMeetingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const ctx = await getTenantContext();
  if (!ctx) return <BizNoTenantPage />;

  const supabase = createClient();
  const [meetings, applications] = await Promise.all([
    /* ⚠️ admin クライアントを渡す。応募者の birth_date（年齢表示）を読むが、
          2026-08-06 に authenticated から ow_users.birth_date の SELECT 権限を剥がした。
          自社の面談だけに絞る条件（company_id = ctx.tenantId）は関数側にあり、
          その会社の担当者であることは getTenantContext で確認済み。 */
    fetchMeetingsForCompany(createAdminClient(), ctx.tenantId),
    /* ★応募者の連絡先は全プラン共通で返す（2026-10-08 に有料ゲートを外した） */
    fetchApplicationsForCompany(supabase, ctx.tenantId),
  ]);

  // conversationId を applications と meetings に付与
  /* ★面談にも付ける（2026-09-21）。「返信する」「日程を調整する」がその人との会話を直接開く。
        ⚠️ どちらも ow_users.id（applications.userId / meetings.applicantUserId） */
  const userIds = Array.from(new Set([
    ...applications.map((a) => a.userId),
    ...meetings.map((m) => m.applicantUserId ?? ""),
  ].filter(Boolean)));
  const convMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: convs } = await supabase
      .from("ow_conversations")
      .select("id, candidate_user_id")
      .eq("company_id", ctx.tenantId)
      .in("candidate_user_id", userIds);
    for (const c of convs ?? []) {
      if (c.candidate_user_id) convMap.set(c.candidate_user_id as string, c.id as string);
    }
  }
  const appsWithConv = applications.map((a) => ({
    ...a,
    conversationId: convMap.get(a.userId) ?? undefined,
  }));
  const meetingsWithConv = meetings.map((m) => ({
    ...m,
    conversationId: m.applicantUserId ? convMap.get(m.applicantUserId) : undefined,
  }));

  /* ★空状態の文言を分けるためだけに数える（2026-08-31）。
        ⚠️ 件数は使わない。**あるか無いか**だけ。`head: true` で行は取らない。
        ⚠️ 失敗したら false に倒す。「待てば来ます」と言うより
           「公開しましょう」のほうが害が小さい（fail-closed）。 */
  const { count: publishedJobCount, error: pubErr } = await supabase
    .from("ow_jobs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", ctx.tenantId)
    .eq("status", "published");
  if (pubErr) console.error("[biz/meetings] published job count:", pubErr.message);
  const hasPublishedJobs = (publishedJobCount ?? 0) > 0;

  /* ★面談の受付状態（2026-10-08）。空状態の文言を出し分けるためだけに使う。
        ⚠️ 失敗したら `accepting: null`（＝不明）。「受け付けていない」に倒さない。
        ⚠️ ページの公開状態は `ctx.isPublished`（`is_published`）。
        ⚠️★admin クライアントで引く。`ow_companies` の SELECT は RLS が `is_published = true`
           で絞るので、セッションで引くと**非公開の会社（まさに案内が要る会社）だけ**
           行が取れず「不明」になる。会社 id は `getTenantContext` で所属確認済みの1件だけ。 */
  const { data: acceptRow, error: acceptErr } = await createAdminClient()
    .from("ow_companies")
    .select("accepting_casual_meetings")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  if (acceptErr) console.error("[biz/meetings] accepting_casual_meetings:", acceptErr.message);
  const acceptance = {
    accepting: typeof acceptRow?.accepting_casual_meetings === "boolean"
      ? (acceptRow.accepting_casual_meetings as boolean) : null,
    pageVisible: ctx.isPublished,
  };

  const initialTab = searchParams.tab === "applications" ? "applications" : "meetings";

  /* ★決まった面談（2026-10-10 / 段4）。⚠️ 取れなければ null（並べない。0件とは言わない） */
  const scheduledRaw = await listCompanyMeetings(ctx.tenantId, { upcoming: true });
  const scheduled = scheduledRaw?.map((m) => ({
    id: m.id, conversationId: m.conversationId, candidateName: m.candidateName,
    whenText: formatMeetingDateTime(m.startsAt), formatLabel: MEETING_FORMATS[m.format], duration: m.duration, origin: m.origin,
  })) ?? null;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      variant="fullBleed"
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      <PipelineClient
        meetings={meetingsWithConv}
        applications={appsWithConv}
        tenantName={ctx.tenantName}
        currentUser={{
          owUserId: ctx.currentOwnId,
          name: ctx.userName,
          initial: ctx.userName.charAt(0),
          gradient: ctx.currentOwnerGradient,
        }}
        initialTab={initialTab}
        hasPublishedJobs={hasPublishedJobs}
        acceptance={acceptance}
        scheduled={scheduled}
      />
    </BusinessLayout>
  );
}

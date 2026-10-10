import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { isCompanyReviewed, COMPANY_REVIEW_BLOCKED_MESSAGE } from "@/lib/business/scoutGate";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { getCandidateProfileForCompany } from "@/lib/business/candidates/profile";
import { getApproachQuota, listApproachableJobs, listApproachSenders } from "@/lib/approaches/server";
import { getBizDisclosure, BIZ_SCORE_ITEM_HREF } from "@/lib/business/bizDisclosure";
import { BIZ_SCORE_ITEM_LABELS, DISCLOSURE_BIZ_MAX } from "@/lib/utils/disclosureScore";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import ApproachComposeClient from "./ApproachComposeClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "声かけを書く | OPINIO Business" } };

/**
 * ★声かけを書く（2026-10-10 / 候補者探し 段4・キャンバス3）。
 *
 * ⚠️★送れるかは**一覧と同じ判定**（`loadCompanyCandidates` → `can_send_company_approach()` と `companyApproachStatus`）。
 *    送れない相手には理由を出さない。送り済みなら状態を出す。ここで条件を組み立てない。
 * ⚠️ 実際に送れるかは送信の API（`sendApproach`）が**選んだ送り手で**もう一度決める。
 * ⚠️ プロフィールから引用できるのは、企業に見せている中身だけ（`getCandidateProfileForCompany`。伏せた社名は出さない）。
 */
export default async function ApproachComposePage({ searchParams }: { searchParams?: { candidate?: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <BusinessLayout userName="担当者" hasCompany={false}>
        <p style={{ padding: 40, fontSize: 14, color: "var(--error)" }}>企業アカウントが見つかりませんでした。ログインし直してください。</p>
      </BusinessLayout>
    );
  }
  const layoutProps = {
    userName: ctx.userName, tenantName: ctx.tenantName, tenantLogoGradient: ctx.logoGradient,
    tenantLogoLetter: ctx.logoLetter, memberships: ctx.allCompanies, currentTenantId: ctx.tenantId,
  };
  const message = (text: string) => (
    <BusinessLayout {...layoutProps}>
      <div style={{ maxWidth: 640, margin: "48px auto", padding: "0 16px" }}>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>{text}</p>
        <Link href="/biz/candidates" style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>候補者を探す →</Link>
      </div>
    </BusinessLayout>
  );
  if (!isCompanyReviewed(ctx)) return message(COMPANY_REVIEW_BLOCKED_MESSAGE);
  if (!canUse(ctx.planType, "companyApproach")) return message("声かけは、ご利用のプランでは使えません。");
  const candidateId = searchParams?.candidate ?? "";
  if (!/^[0-9a-f-]{36}$/.test(candidateId)) return message("声をかける相手が指定されていません。");

  const loaded = await loadCompanyCandidates({ companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, planType: ctx.planType, onlyOwUserId: candidateId });
  const c = loaded.candidates.find((x) => x.id === candidateId);
  /* ⚠️ 理由を出さない（見えない・受け取っていない・範囲外を区別させない） */
  if (!c || !c.approach) return message("この方には、いま声をかけられません。");
  if (c.approach.sent) {
    return message(`${c.approach.sent.senderName ? `${c.approach.sent.senderName}さん` : "担当者"}がすでに声をかけています。同じ方へは送ってから一定の期間、再び声をかけられません。`);
  }
  if (!c.approach.eligible) return message("この方には、いま声をかけられません。");

  const db = createAdminClient();
  const [profile, quota, senders, jobs, disclosure, co] = await Promise.all([
    getCandidateProfileForCompany(candidateId),
    getApproachQuota(ctx.tenantId),
    listApproachSenders(ctx.tenantId, ctx.currentOwnId),
    listApproachableJobs(ctx.tenantId),
    getBizDisclosure(ctx.tenantId),
    db.from("ow_companies").select("name, name_en, logo_url, logo_letter, logo_gradient").eq("id", ctx.tenantId).maybeSingle(),
  ]);
  if (!profile || !senders) return message("読み込めませんでした。時間をおいてもう一度お試しください。");

  /* ★プロフィールから引用する候補（企業に見せている中身だけ）。⚠️ 伏せた社名は使わない（職種だけにする） */
  const quotes: { label: string; text: string }[] = [];
  for (const e of profile.experiences) {
    const role = e.roleTitle || e.roleName;
    if (!role) continue;
    const text = e.companyMasked ? `${role}としてのご経験` : `${e.company}での${role}のご経験`;
    quotes.push({ label: e.companyMasked ? role : `${e.company}・${role}`, text });
  }
  for (const s of [...(c.autoSkills ?? []).map((a) => a.label), ...profile.skills]) {
    if (!quotes.some((q) => q.label === s)) quotes.push({ label: s, text: `${s}のスキル` });
  }
  for (const r of c.desiredRoleNames) quotes.push({ label: `関心: ${r}`, text: `${r}への関心` });

  const companyName = co.data ? companyDisplayName(co.data.name as string, (co.data.name_en as string | null) ?? null).displayName : ctx.tenantName;

  return (
    <BusinessLayout {...layoutProps}>
      <ApproachComposeClient
        candidate={{ id: c.id, name: c.name, headline: c.headline, currentRole: c.currentRole, currentCompany: c.currentCompany }}
        quotes={quotes.slice(0, 20)}
        quota={quota}
        senders={senders}
        defaultSenderId={ctx.currentOwnId}
        jobs={jobs}
        company={{
          name: companyName,
          logoUrl: (co.data?.logo_url as string | null) ?? null,
          logoLetter: (co.data?.logo_letter as string | null) ?? null,
          logoGradient: (co.data?.logo_gradient as string | null) ?? null,
        }}
        disclosure={disclosure ? {
          biz: disclosure.biz, max: DISCLOSURE_BIZ_MAX,
          missing: disclosure.bizMissing.map((k) => ({ label: BIZ_SCORE_ITEM_LABELS[k], href: BIZ_SCORE_ITEM_HREF[k] })),
        } : null}
      />
    </BusinessLayout>
  );
}

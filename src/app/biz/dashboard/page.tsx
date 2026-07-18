import Link from "next/link";
import { BusinessLayout } from "@/components/business/BusinessLayout";
import { CompanyCard } from "@/components/business/CompanyCard";
import { JobStatusCards } from "@/components/business/JobStatusCards";
import { TeamMembers } from "@/components/business/TeamMembers";
import {
  getTenantContext,
  getJobStatusCounts,
} from "@/lib/business/dashboard";
import { fetchTeamMembersForDashboard } from "@/lib/business/team";
import { fetchCompanyForTenant } from "@/lib/business/company";
import { calcDisclosureScore, scoreLabel, scoreColor } from "@/lib/utils/disclosureScore";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "ホーム | OPINIO Business" },
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName}>
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid var(--line)",
        padding: 40,
        textAlign: "center",
        maxWidth: "var(--max-w-form)", margin: "60px auto",
      }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          企業アカウントを追加しますか？
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 22 }}>
          このアカウントには企業が紐付いていません。<br />
          新しく企業を登録するか、招待リンクから参加してください。
        </p>
        <Link
          href="/biz/companies/add/new"
          style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            background: "var(--royal)", color: "#fff", textDecoration: "none",
          }}
        >
          企業を新規登録する →
        </Link>
      </div>
    </BusinessLayout>
  );
}

export default async function BizDashboardPage() {
  const ctx = await getTenantContext();

  if (!ctx) {
    return <NoTenantPage />;
  }

  const supabase = createClient();
  const [jobStatusCounts, teamMembers, companyRaw] = await Promise.all([
    getJobStatusCounts(ctx.tenantId),
    fetchTeamMembersForDashboard(supabase, ctx.tenantId),
    fetchCompanyForTenant(supabase, ctx.tenantId, []),
  ]);

  const disclosureScore = companyRaw ? calcDisclosureScore({
    realityNotFor: companyRaw.realityDisclosure.notFor,
    realityTurnoverReasons: companyRaw.realityDisclosure.turnoverReasons,
    realityOnboardingGaps: companyRaw.realityDisclosure.onboardingGaps,
    avgOvertimeHours: companyRaw.avgOvertimeHours,
    paidLeaveRate: companyRaw.paidLeaveRate,
    tagline: companyRaw.tagline,
    aboutMarkdown: companyRaw.descriptionMarkdown,
    whyJoin: companyRaw.whyJoin,
    fitPositives: companyRaw.fitPositives,
    fitNegatives: companyRaw.fitNegatives,
  }) : null;

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      memberships={ctx.allCompanies}
      currentTenantId={ctx.tenantId}
    >
      {/* ── 審査中バナー（未承認企業のみ） ── */}
      {!ctx.isPublished && (
        <div style={{
          background: "var(--warm-soft)", border: "1px solid #FCD34D",
          borderRadius: 12, padding: "14px 18px", marginBottom: 16,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 3 }}>
              運営審査中です
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
              承認後、候補者検索・スカウト送信・求人公開をご利用いただけます。審査が完了次第メールでご連絡します。
            </div>
          </div>
        </div>
      )}

      {/* ── Company card ── */}
      <CompanyCard
        tenantId={ctx.tenantId}
        tenantName={ctx.tenantName}
        logoGradient={ctx.logoGradient}
        logoLetter={ctx.logoLetter}
      />

      {/* ── 開示充実度スコア ── */}
      {disclosureScore && (
        <div style={{
          background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
          padding: "18px 22px", marginTop: 16,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ flex: "0 0 auto" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: `conic-gradient(${scoreColor(disclosureScore.total)} ${disclosureScore.total * 3.6}deg, var(--line) 0deg)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 800, color: scoreColor(disclosureScore.total) }}>
                  {disclosureScore.total}
                </span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>開示充実度スコア</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, color: scoreColor(disclosureScore.total), background: "var(--bg-tint)", border: `1px solid ${scoreColor(disclosureScore.total)}` }}>
                {scoreLabel(disclosureScore.total)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-soft)" }}>
              <span>リアル開示 {disclosureScore.reality}/40</span>
              <span>数値 {disclosureScore.numbers}/20</span>
              <span>プロフィール {disclosureScore.profile}/40</span>
            </div>
          </div>
          <Link href="/biz/company" style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            {disclosureScore.total < 80 ? "開示を充実させる →" : "企業情報を確認 →"}
          </Link>
        </div>
      )}

      {/* ── スタートガイド（求人0件の場合のみ表示） ── */}
      {ctx.isPublished && jobStatusCounts.active === 0 && jobStatusCounts.draft === 0 && (
        <div style={{
          background: "linear-gradient(135deg,var(--royal-50) 0%,#f0f4ff 100%)",
          border: "1px solid var(--royal-100)", borderRadius: 16,
          padding: "24px 26px", marginTop: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>スタートガイド</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>最初の求人を公開して候補者との接点を作りましょう</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { done: ctx.isPublished, label: "企業情報を入力する", href: "/biz/company", hint: "取材済み・開示情報が候補者の判断材料になります" },
              { done: false, label: "求人を作成する", href: "/biz/jobs", hint: "ポジション・給与・業務内容を登録しましょう" },
              { done: false, label: "求人を公開する", href: "/biz/jobs", hint: "公開後すぐ候補者に表示されます" },
              { done: false, label: "カジュアル面談の受付を開始する", href: "/biz/company", hint: "「面談受付中」バッジが企業ページに表示されます" },
            ].map(({ done, label, href, hint }) => (
              <Link key={label} href={href} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 10, background: "#fff", border: `1px solid ${done ? "#A7F3D0" : "var(--line)"}`, textDecoration: "none", transition: "border-color .15s" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "var(--success)" : "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {done
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: done ? 500 : 700, color: done ? "var(--ink-mute)" : "var(--ink)", textDecoration: done ? "line-through" : "none", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{hint}</div>
                </div>
                {!done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 4 }}><path d="M9 18l6-6-6-6"/></svg>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 2-col: JobStatusCards + TeamMembers ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}>
        <JobStatusCards counts={jobStatusCounts} />
        <TeamMembers members={teamMembers} />
      </div>

      {/* ── Job performance ── */}
      <section style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "22px 26px",
        marginTop: 16,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
        }}>
          <div style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 15, fontWeight: 600, color: "var(--ink)",
            display: "flex", alignItems: "baseline", gap: 8,
          }}>
            求人パフォーマンス
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9, fontWeight: 700,
              color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
            }}>Job Performance</span>
          </div>
          <Link href="/biz/jobs" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            求人管理へ →
          </Link>
        </div>
      </section>
    </BusinessLayout>
  );
}

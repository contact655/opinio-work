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
import { calcDisclosureScore, scoreLabel, scoreColor, scoreTextColor, bizScoreOnTotalScale, DISCLOSURE_BIZ_MAX, DISCLOSURE_INTERVIEW_MAX, BIZ_SCORE_ITEM_LABELS, type BizScoreItem } from "@/lib/utils/disclosureScore";
import { getBizTodoCounts } from "@/lib/business/navBadges";
import { DashboardCardHeading } from "@/components/business/DashboardCardHeading";
import { createClient } from "@/lib/supabase/server";
import { companyHasApproachRoles } from "@/lib/approaches/range";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPublicCompanyPage } from "@/lib/companies/visibility";
import { checkPublishable } from "@/lib/companies/publishable";
import { countUnconfirmedMaterialItems } from "@/lib/companyMaterials/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "ホーム | OPINIO Business" },
};

async function NoTenantPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.email ? user.email.split("@")[0] : "ご担当者";
  return (
    <BusinessLayout userName={userName} hasCompany={false}>
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

/** ★「まだ入れていない項目」の行き先（2026-09-21）。ラベルは disclosureScore.ts の1箇所 */
const BIZ_SCORE_ITEM_HREF: Record<BizScoreItem, string> = {
  tagline: "/biz/company",
  description: "/biz/company",
  photo: "/biz/company",
  benefits: "/biz/company",
  job: "/biz/jobs",
  story: "/biz/posts",
};

export default async function BizDashboardPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const isFirstMember = searchParams?.welcome === "1";
  const ctx = await getTenantContext();

  if (!ctx) {
    return <NoTenantPage />;
  }

  const supabase = createClient();
  const adminSupabase = createAdminClient();
  const [jobStatusCounts, teamMembers, companyRaw, scoreData, todo, classification, unconfirmedMaterials, hasApproachRoles] = await Promise.all([
    getJobStatusCounts(ctx.tenantId),
    fetchTeamMembersForDashboard(supabase, ctx.tenantId),
    fetchCompanyForTenant(supabase, ctx.tenantId, []),
    // スコア計算に必要な取材側フィールド（複数テーブル集計）
    (async () => {
      const tid = ctx.tenantId;
      const [companyFields, photoCnt, storyCnt, toolCnt] = await Promise.all([
        adminSupabase.from("ow_companies").select(
          "description, culture_description, customer_cases, market_customer_size, capital_type, branch_locations, org_teams"
        ).eq("id", tid).maybeSingle(),
        adminSupabase.from("ow_company_office_photos").select("id", { count: "exact", head: true }).eq("company_id", tid),
        adminSupabase.from("ow_company_posts").select("id", { count: "exact", head: true }).eq("company_id", tid).eq("is_published", true),
        adminSupabase.from("ow_company_tools").select("id", { count: "exact", head: true }).eq("company_id", tid),
      ]);
      return {
        fields: companyFields.data,
        photoCount: photoCnt.count ?? 0,
        storyCount: storyCnt.count ?? 0,
        toolCount: toolCnt.count ?? 0,
      };
    })(),
    /* ★「やること」。メッセージと提案はサイドバーのバッジと同じ関数で数える */
    getBizTodoCounts({ owUserId: ctx.currentOwnId, companyId: ctx.tenantId }),
    /* ★スタートガイドの「企業情報を入力する」の完了判定（2026-10-08）。
          掲載に必要な項目（業種＋必須の事業領域）が埋まっているか。
          ⚠️ `{ kind: "admin" }` を渡す＝**規約同意は見ない**（同意は設定タブの話で、
             企業情報の入力とは別）。⚠️ 判定は公開ゲートと同じ関数。書き写さない。 */
    checkPublishable(ctx.tenantId, { kind: "admin" }),
    /* ★企業資料の未確定の項目（2026-10-09 / 依頼②）。⚠️ 取れなかったら null */
    countUnconfirmedMaterialItems(ctx.tenantId),
    /* ★声かけを受け取る範囲で「職種」を選んでいる人に届くか（2026-10-10 / 段2）。⚠️ 取れなかったら null */
    companyHasApproachRoles(ctx.tenantId),
  ]);

  /* ★★スタートガイド（2026-10-08 に完了判定を実データへ合わせた / 柴さんの指示）。
        それまで「求人を作成」「公開」「面談受付」は **`done: false` の固定**で、
        「企業情報を入力する」は `is_published`（ページが見えるか）で判定していた。
        Third Box では**受付中なのに「受付を開始する」が未完了**のまま出ていた。
     ⚠️ 判定はここ1箇所。下のカードと「やること」の件数が同じ配列を見る。 */
  const totalJobs = (jobStatusCounts.active ?? 0) + (jobStatusCounts.review ?? 0)
    + (jobStatusCounts.draft ?? 0) + (jobStatusCounts.rejected ?? 0) + (jobStatusCounts.private ?? 0);
  const guideItems = [
    {
      done: classification.ok,
      label: "企業情報を入力する",
      href: "/biz/company",
      hint: classification.ok
        ? "掲載に必要な項目（業種・事業領域）は入っています"
        : "業種と事業領域（掲載に必要な項目）を入れましょう",
    },
    { done: totalJobs > 0, label: "求人を作成する", href: "/biz/jobs", hint: "ポジション・給与・業務内容を登録しましょう" },
    { done: (jobStatusCounts.active ?? 0) > 0, label: "求人を公開する", href: "/biz/jobs", hint: "運営の確認が済むと候補者に表示されます" },
    /* ⚠️ `companyRaw` が取れなかったときは未完了に倒す（完了と嘘をつかない） */
    { done: companyRaw?.acceptingCasualMeetings === true, label: "カジュアル面談の受付を開始する", href: "/biz/company", hint: "「面談受付中」バッジが企業ページに表示されます" },
  ];
  const guideRemaining = guideItems.filter((g) => !g.done).length;
  /* ⚠️ 承認前は出さない（従来どおり）。全部済んだら出さない */
  const showGuide = ctx.isApproved && guideRemaining > 0;

  /* ★やること（2026-09-21）。**件数が1以上のものだけ**出す。
        ⚠️ 並びは「相手を待たせているもの」から。差し戻しは運営からの指摘なので最後。
        ⚠️ 「審査中の求人」は入れない —— 運営の対応待ちで、企業側にできることが無い。 */
  const todoItems = [
    { key: "messages", label: "未読のメッセージ", count: todo.messages, href: "/biz/conversations" },
    { key: "proposals", label: "答えていない提案", count: todo.proposals, href: "/biz/proposals" },
    { key: "meetings", label: "未確認の面談申込", count: todo.meetings, href: "/biz/meetings" },
    { key: "rejected", label: "差し戻された求人", count: jobStatusCounts.rejected ?? 0, href: "/biz/jobs?status=rejected" },
    /* ★未完了のスタートガイド（2026-10-08）。それまで「やること: 対応が必要なものは
          ありません」の下に未完了のガイドが並んでいて、2つが矛盾して見えた。
          ⚠️ 件数は上の `guideItems` と同じ配列から数える。 */
    { key: "guide", label: "スタートガイドの未完了", count: showGuide ? guideRemaining : 0, href: "#start-guide" },
    /* ★企業資料の未確定の項目（2026-10-09）。確定するまで求職者には出ない。
          ⚠️ 取得に失敗したら 1件として出す（0 にすると壊れているのに要対応が消える）。 */
    { key: "materials", label: unconfirmedMaterials === null ? "企業資料（件数を確認できませんでした）" : "未確定の項目（企業資料）",
      count: unconfirmedMaterials === null ? 1 : unconfirmedMaterials, href: "/biz/materials" },
  ].filter((t) => t.count > 0);

  const disclosureScore = companyRaw ? calcDisclosureScore({
    tagline: companyRaw.tagline,
    description: scoreData.fields?.description ?? null,
    photoCount: scoreData.photoCount,
    benefitsCount: companyRaw.benefitsTags.length,
    hasPublishedJob: (jobStatusCounts.active ?? 0) > 0,
    hasPublishedStory: scoreData.storyCount > 0,
    cultureDescription: scoreData.fields?.culture_description ?? null,
    customerCases: Array.isArray(scoreData.fields?.customer_cases) ? scoreData.fields.customer_cases : null,
    marketCustomerSize: scoreData.fields?.market_customer_size as string[] | null ?? null,
    capitalType: scoreData.fields?.capital_type ?? null,
    branchLocations: scoreData.fields?.branch_locations as string[] | null ?? null,
    orgTeams: Array.isArray(scoreData.fields?.org_teams) ? scoreData.fields.org_teams : null,
    toolCount: scoreData.toolCount,
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
      {/* ── 1人目バナー（企業開設直後のみ） ── */}
      {isFirstMember && (
        <div style={{
          background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
          borderRadius: 14,
          padding: "22px 24px",
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 5 }}>
              {ctx.tenantName} の企業アカウントを開設しました
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
              あなたはこの企業の最初の人事担当者です。まず企業情報を充実させると、候補者への信頼感が高まります。
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" as const }}>
              <Link href="/biz/company" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "8px 16px", borderRadius: 8,
                background: "#fff", color: "#001233",
                fontSize: 12, fontWeight: 700, textDecoration: "none",
              }}>
                企業情報を入力する →
              </Link>
              <Link href="/biz/members" style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "8px 16px", borderRadius: 8,
                background: "rgba(255,255,255,0.12)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                fontSize: 12, fontWeight: 600, textDecoration: "none",
              }}>
                メンバーを招待する
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── 審査中バナー（未承認企業のみ） ── */}
      {!ctx.isApproved && (
        <div style={{
          background: "var(--warm-soft)", border: "1px solid #FCD34D",
          borderRadius: 12, padding: "14px 18px", marginBottom: 16,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warm-ink)", marginBottom: 3 }}>
              運営審査中です
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
              承認後、候補者検索・求人公開をご利用いただけます。審査が完了次第メールでご連絡します。
            </div>
          </div>
        </div>
      )}

      {/* ── ★やること（2026-09-21）── */}
      <section data-state={todoItems.length > 0 ? "has-todo" : "empty"} style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        padding: "18px 22px", marginBottom: 16,
      }}>
        <DashboardCardHeading title="やること" />
        {todoItems.length === 0 ? (
          /* ⚠️ 0件でもカードは消さない。「確かめた結果、無い」ことを伝える */
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            今すぐ対応が必要なものはありません
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {todoItems.map((t, i) => (
              <li key={t.key}>
                <Link href={t.href} className="biz-todo-row" style={{ borderTop: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{t.label}</span>
                  <span style={{
                    minWidth: 22, height: 22, padding: "0 7px", borderRadius: 100,
                    background: "var(--error)", color: "#fff",
                    fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{t.count > 99 ? "99+" : t.count}</span>
                  <span aria-hidden="true" style={{ color: "var(--ink-mute)" }}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <style>{`
          .biz-todo-row { display: flex; align-items: center; gap: 12px; padding: 11px 4px; font-size: 13px; font-weight: 600; color: var(--ink); text-decoration: none; }
          .biz-todo-row:hover { background: var(--bg-tint); }
        `}</style>
      </section>

      {/* ── 企業ページ（企業カード＋開示充実度を1枚に。2026-09-21）── */}
      <CompanyCard
        /* ★公開ページが無いなら「公開ページを見る」を出さない（2026-09-20）。
              判定は `hasPublicCompanyPage` の1箇所。ここに条件を書かない。 */
        hasPublicPage={hasPublicCompanyPage({ isPublished: ctx.isPublished })}
        tenantId={ctx.tenantId}
        tenantName={ctx.tenantName}
        logoGradient={ctx.logoGradient}
        logoLetter={ctx.logoLetter}
      >
        {disclosureScore && (() => {
          /* ★★企業入力（/45）を主表示にした（2026-10-08 / 柴さんの指示）。
                それまでは合計（/95）だけを「開示充実度 5」と出し、20点未満に「未入力」を
                付けていた。分母が無く、入力済みなのに「未入力」と並んで意味が取れなかった。
             ⚠️★取材の点数（/50）は**別の行**に分ける。企業が自分では動かせないので、
                合計に混ぜると「何をすれば上がるか」が読めない。
             ⚠️ ラベルと色は合計の閾値を使い回す（`bizScoreOnTotalScale`）。 */
          const tierScore = bizScoreOnTotalScale(disclosureScore.biz);
          return (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div aria-hidden="true" style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: `conic-gradient(${scoreColor(tierScore)} ${disclosureScore.biz * (360 / DISCLOSURE_BIZ_MAX)}deg, var(--line) 0deg)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 800, color: scoreTextColor(tierScore) }}>
                  {disclosureScore.biz}
                </span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  開示充実度（企業入力） {disclosureScore.biz} / {DISCLOSURE_BIZ_MAX}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 100, color: scoreTextColor(tierScore), background: "var(--bg-tint)", border: `1px solid ${scoreColor(tierScore)}` }}>
                  {scoreLabel(tierScore)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 4 }}>
                取材で入る項目 {disclosureScore.interview} / {DISCLOSURE_INTERVIEW_MAX}（OPINIO の取材で埋まります）
              </div>
              {/* ★企業が自分で入れられる項目のうち、まだのものだけを出す（2026-09-21）。
                     ⚠️ 取材で埋まる項目は出さない。企業には動かせない数字で、
                        「50/50」「0/50」を見せても次の行動にならない。 */}
              {disclosureScore.bizMissing.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>自分で入力できる項目はすべて入っています</div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
                  まだ入れていない項目（{disclosureScore.bizMissing.length}）：
                  {disclosureScore.bizMissing.map((k, i) => (
                    <span key={k}>
                      {i > 0 && "・"}
                      <Link href={BIZ_SCORE_ITEM_HREF[k]} style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                        {BIZ_SCORE_ITEM_LABELS[k]}
                      </Link>
                    </span>
                  ))}
                </div>
              )}
              {/* ★求人も職種の登録も無い企業は、職種で範囲を指定している求職者に声かけが届かない
                     （2026-10-10 / 柴さんの指示。文言はそのまま）。⚠️ 取れなかったとき（null）は出さない */}
              {hasApproachRoles === false && (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 4 }}>
                  <Link href="/biz/jobs" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>求人</Link>
                  か
                  <Link href="/biz/organization?tab=roles" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>職種</Link>
                  を登録すると、声かけできる相手が増えます
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </CompanyCard>

      {/* ── ロゴ未設定バナー ── */}
      {companyRaw && !companyRaw.logoUrl && ctx.isPublished && (
        <div style={{
          background: "#fff", border: "1.5px dashed #FDBA74",
          borderRadius: 12, padding: "14px 18px", marginTop: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* プレビュー：ロゴなしグラデーション四角 */}
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: ctx.logoGradient ?? "linear-gradient(135deg,#002366,#3B5FD9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff",
          }}>
            {ctx.logoLetter ?? ctx.tenantName[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warm-ink)", marginBottom: 3 }}>
              企業ロゴが未設定です
            </div>
            <div style={{ fontSize: 11, color: "#78350F", lineHeight: 1.6 }}>
              ロゴを設定すると求人カードの信頼感が大幅にアップします。LinkedInやIndeedでは
              ロゴ有りの企業は応募率が最大2倍になるというデータがあります。
            </div>
          </div>
          <Link
            href="/biz/company"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 16px", borderRadius: 8, flexShrink: 0,
              fontSize: 12, fontWeight: 700,
              background: "var(--warm-strong)", color: "#fff", textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ロゴを設定する →
          </Link>
        </div>
      )}

      {/* ── スタートガイド（承認済みで、未完了が1つ以上あるときだけ表示。2026-10-08） ── */}
      {showGuide && (
        <div id="start-guide" style={{
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
            {guideItems.map(({ done, label, href, hint }) => (
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
      {/* ⚠️ 375px では1列に畳む（globals.css の `.biz-2col`）。
             畳まないと各カラムが 163px になり、見出しが1文字ずつ折り返す。 */}
      <div className="biz-2col" style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 16,
      }}>
        <JobStatusCards counts={jobStatusCounts} />
        <TeamMembers members={teamMembers} />
      </div>

    </BusinessLayout>
  );
}

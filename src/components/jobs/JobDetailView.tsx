import { laborLines } from "@/lib/jobs/laborTerms";
import { enterTestViewMode, jobPath, companyPath, TEST_COMPANY_NOTICE } from "@/lib/jobs/testViewMode";
/**
 * src/components/jobs/JobDetailView.tsx
 *
 * 求人詳細の本体。**公開ページとプレビューで同じものを描く。**
 *
 * ★2026-11-26 に構成を作り直した（柴さんの指示。フェーズ0は docs/phase0-job-detail-20261126.md）。
 *   同日、企業詳細と同じ部品にそろえた（components/detail/*）:
 *     パンくず → 冒頭のカード（DetailHero）→ ページ内タブ（DetailSectionNav）
 *     → 2カラム（左: セクションごとのカード4枚＝仕事内容／募集要項／選考フロー／会社概要
 *                右: 行動カード（貼り付く）・この会社で働く人・この会社の他の募集）
 *   1023px 以下はサイドバーのカードを本文の下に同じ順で並べる（同じ部品。マークアップを2つ持たない）。
 *   ⚠️ 値が無い項目・セクション・タブは出さない。「未登録」「なし」などの空の表示を足さないこと。
 *   ⚠️ 貼り付くのはサイドバーの一番上の行動カードだけ。他のカードは流れる。
 *
 * ⚠️★**`/jobs/[id]` は ISR（`revalidate = 60`）で応答がキャッシュ共有される。**
 *    だからあのページに「閲覧者が管理者なら下書きも見せる」という分岐を足してはいけない
 *    ——**プレビューが他人に配られる。** プレビューを別ルートにしてあるのはこのため
 *    （`/biz/jobs/[id]/preview` は `force-dynamic` ＋ noindex）。
 *    同じ理由で、人（採用担当・配属先マネージャー・社員）はブラウザから取りに行く（JobSidePeople）。
 *
 * ⚠️ ここを部品にしたのは「公開ページとプレビューが別物になる」のを防ぐため。
 *    プレビュー側にJSXをコピーしない。**差が出たらプレビューの意味が無くなる。**
 */
import Link from "next/link";
import { DetailSide } from "@/components/detail/DetailSide";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getJobBySlugOrId, getJobForPreview, getCompanyBySlugOrId, getRoleTree, resolvePublishedCompanyHref } from "@/lib/supabase/queries";

const getJobBySlugOrIdCached = cache(getJobBySlugOrId);
/* ⚠️ 企業詳細ページと同じ形（`companies/[id]/page.tsx` の `getCompanyBySlugOrIdCached`）。
      `cache()` で包むのは、metadata と本体で2回呼んでも1回で済ませるため。 */
const getCompanyForJobCached = cache(getCompanyBySlugOrId);
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { JobMobileStickyBar } from "@/components/jobs/JobMobileStickyBar";
import { JobInlineShare } from "@/components/jobs/JobShareButton";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { DefinitionRows, specLines } from "@/components/detail/DefinitionRows";
import { DetailHero, HeroChip } from "@/components/detail/DetailHero";
import { SectionCard } from "@/components/detail/SectionCard";
import { DetailSectionNav } from "@/components/detail/DetailSectionNav";
import { JobSidePeople } from "@/components/jobs/JobSidePeople";
import { getSalesSegmentLabel, getHunterFarmerLabel } from "@/lib/constants/salesFields";
import { isBusinessRole } from "@/lib/roles/jobRoles";
import { fmtMan, payLabel, payNegotiableText } from "@/lib/utils/salary";
import { SCHEMA_EMPLOYMENT_TYPE } from "@/lib/constants/schemaEmploymentType";
import { formatEmployeeSize } from "@/lib/constants/employeeBand";
import { Markdown } from "@/components/common/Markdown";
import { jobPointLines } from "@/lib/jobs/jobPoints";
import { MEETING_CTA_BG, MEETING_CTA_FG, MEETING_CTA_SHADOW_RGB } from "@/lib/constants/meetingCta";
import ViewBeacon from "@/components/views/ViewBeacon";
import { getOwnCompanyId } from "@/lib/companies/ownCompany";
import { OwnCompanyNote } from "@/components/companies/OwnCompanyNote";
import { jobDateRows, shortAddress } from "@/lib/jobs/heroFacts";

// ─── 見た目の部品（このページだけ） ─────────────────────────────────────────

/** サイドバーのカードの見出し */
function SideTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{children}</h2>;
}

/** 箇条書き（点は小さい丸）。⚠️ 項目が0件なら呼び出し側でセクションごと出さない */
function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 15, lineHeight: 1.9, color: "var(--ink)" }}>
          <span aria-hidden style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: "var(--ink-mute)", transform: "translateY(-3px)" }} />
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** 年収の範囲（万円）。⚠️ 数字の途中で折り返さないよう nowrap の塊にする */
function salaryRange(min: number, max: number): string | null {
  if (min && max) return `${fmtMan(min)}〜${fmtMan(max)}万円`;
  if (min) return `${fmtMan(min)}万円〜`;
  if (max) return `〜${fmtMan(max)}万円`;
  return null;
}

/** 「話を聞いてみたい」「応募する」。冒頭のカードとサイドバーの行動カードで同じものを使う */
function MainActions({ casualHref, applyHref }: { casualHref?: string; applyHref?: string }) {
  if (!casualHref && !applyHref) return null;
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44,
    padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
  };
  return (
    <>
      {/* ⚠️ カジュアル面談の色はサイト全体の決まり（ui-conventions「色の役割」: オレンジはカジュアル面談だけ）。
             色は lib/constants/meetingCta.ts から取る。呼び出し側に直書きしない */}
      {casualHref && (
        <Link href={casualHref} data-state="cta-meeting" style={{ ...base, background: MEETING_CTA_BG, color: MEETING_CTA_FG, boxShadow: `0 3px 10px rgba(${MEETING_CTA_SHADOW_RGB},0.3)` }}>
          話を聞いてみたい
        </Link>
      )}
      {applyHref && (
        <Link href={applyHref} data-state="cta-apply" style={casualHref
          ? { ...base, background: "#fff", color: "var(--royal)", border: "1.5px solid var(--royal)" }
          : { ...base, background: "var(--royal)", color: "#fff" }}>
          応募する
        </Link>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function JobDetailView({
  id,
  preview = false,
  testMode = false,
}: {
  /** slug または UUID。`preview` のときは UUID のみ */
  id: string;
  /** ⚠️ **`/biz/jobs/[id]/preview` だけが true にする。**
   *  下書き・非公開・テスト求人も描画し、slug への 308 リダイレクトを止める。 */
  preview?: boolean;
  /** ★検証用アカウント専用（/t/jobs/[id]。2026-10-12）。id は確かめ済みの検証用の公開中の求人の UUID。
   *  リンクを /t/… に向け、上部に灰色の一行を出し、閲覧を数えない */
  testMode?: boolean;
}) {
  if (testMode) enterTestViewMode();
  const result = preview || testMode
    ? await getJobForPreview(id)
    : await getJobBySlugOrIdCached(id);
  if (!result) notFound();

  const { job, company, relatedJobs, resolvedId, slug: jobSlug } = result;

  // ⚠️ 企業ページへのリンクは env に関係なく is_published を見る。
  //    「求人は公開企業にしか紐づかない」は今そうなっているだけで、
  //    企業を非公開に戻せば崩れる（CLAUDE.md の原則）。null ならテキスト表示にする。
  const companyHref = testMode ? companyPath(company.slug ?? company.id) : await resolvePublishedCompanyHref(company.slug ?? company.id);
  /* カジュアル面談の申込は /companies/[id]/casual-meeting（動的。検証用アカウントには検証用の会社も通す）。/t の下には無い */
  const casualBase = testMode ? `/companies/${company.slug ?? company.id}` : companyHref;
  /* ★運営会社か（2026-10-10）。⚠️ null（見つからない）は「運営会社でない」に倒す */
  const ownCompanyId = await getOwnCompanyId();
  const isOwnCompany = ownCompanyId !== null && ownCompanyId === company.id;

  // UUID → slug 308 redirect
  /* ⚠️ プレビューでは slug へ飛ばさない。下書きは slug を持たないし、
        飛ばすと公開ページ（404）に着く。 */
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  /* ⚠️ testMode は呼び出し側（/t/jobs/[id]）が解決済みの UUID を渡すので、ここで slug へ飛ばすと同じ URL に戻って止まらない */
  if (!preview && !testMode && isUUID && jobSlug) { permanentRedirect(jobPath(jobSlug)); }

  const jobId = resolvedId;

  // ビジネス職（OTE・担当セグメントの表示対象）かどうかは ow_roles で判定する。
  // 旧実装は job_category のフリーテキストを Set 照合していたため、
  // 「エンタープライズ営業」は該当するのに「営業」は該当しない、といった穴があった。
  const jobRoleTree = await getRoleTree();
  const isBusinessJob = isBusinessRole(jobRoleTree, job.roleIds);


  /* ⚠️ `detail`（設立・所在地・カバー画像）はここからしか取れない。企業詳細ページと同じ関数（`unstable_cache` 付き）。
     ⚠️★人（採用担当・配属先マネージャー・チームメンバー・社員）はここで引かない（2026-11-26）。
        JobSidePeople がブラウザから取りに行く。ISR の HTML は全員に共有されるので、ここで描くと
        「ログインユーザーのみ」の人の名前まで未ログインの人に配られる。 */
  const companyResult = await getCompanyForJobCached(job.company_id);
  const companyDetail = companyResult?.detail ?? null;

  /* ⚠️ ブックマーク状態はここで引かない（2026-08-09）。引くと `auth.getUser()` が要り、
        ルートが動的化して `revalidate` が効かなくなる。BookmarkButton が自分で取りに行く。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。 */

  /* ★「話を聞いてみたい」「応募する」の行き先。ヘッダーカード・締めの応募ブロック・下の固定バーで同じ値を使う。
     ⚠️ 面談の可否は accepting_casual_meetings（isCasualMeetingOpen で宛先・担当者まで見た値）。
        申込ページ本体と API も同じ値しか見ないので、ここで別の判定をしない（2026-08-06 に統一）。
     ⚠️ 応募の可否は application_open（lib/jobs/application.ts）。 */
  const casualHref = companyHref && company.accepting_casual_meetings ? `${casualBase}/casual-meeting?job_id=${job.id}` : undefined;
  const applyHref = company.application_open ? `/jobs/${job.id}/apply` : undefined;

  /* ── 冒頭のカード ──（⚠️ カバー画像は描かない。2026-11-26 時点で持つ会社は0社。DetailHero の注記） */
  const dateRows = jobDateRows(job.published_at, job.updated_at);
  const metaItems = [
    ...dateRows.map((r) => `${r.key} ${r.value}`),
    ...(job.urgency === "hot" ? ["積極採用中"] : []),
  ];
  const salaryText = salaryRange(job.salary_min, job.salary_max);
  const payText = salaryText
    ? `${payLabel(job.employment_type) === "報酬" ? "報酬" : "年収"} ${salaryText}`
    : job.salary_negotiable ? payNegotiableText(job.employment_type) : null;
  const oteText = isBusinessJob ? salaryRange(job.ote_min ?? 0, job.ote_max ?? 0) : null;

  /* ── 募集要項の表 ──
     ⚠️ 労働条件（laborLines）は行ごとに振り分ける。**振り分け先の無い行は最後に自分の見出しで出す**
        （項目を足したときに画面から黙って消えないように） */
  const labor = job.labor ? laborLines(job.labor) : [];
  const usedLabor = new Set<string>();
  const laborVal = (label: string) => {
    const hits = labor.filter((l) => l.label === label);
    if (hits.length === 0) return null;
    usedLabor.add(label);
    return hits.map((h) => h.value).join("\n");
  };
  /* ★福利厚生は1行に1項目（2026-11-26 / 柴さんの指示）。先頭に記号を付けない。補足があれば括弧で続ける */
  const benefitLines = (company.benefits ?? [])
    .map((b) => ({ value: b.detail ? `${b.name}（${b.detail}）` : b.name }));
  const specRows = [
    /* ★応募要件は募集要項の表の先頭に入れた（2026-11-26。本文のカードを4枚にしたため） */
    { label: "必須の要件", value: job.required_skills.length > 0 ? <Bullets items={job.required_skills} /> : null },
    { label: "歓迎の要件", value: job.preferred_skills.length > 0 ? <Bullets items={job.preferred_skills} /> : null },
    { label: "雇用形態", value: specLines([
      { value: job.employment_type },
      { label: "契約期間", value: laborVal("契約期間") },
      { label: "契約の更新", value: laborVal("契約の更新") },
      { label: "試用期間", value: job.probation_period },
    ]) },
    { label: "給与", value: specLines([
      { value: payText },
      { label: "OTE（目標達成時）", value: oteText },
      { label: "固定残業代", value: laborVal("固定残業代") },
      { value: job.salary_note },
    ]) },
    ...(isBusinessJob ? [{ label: "担当領域", value: specLines([
      { value: [...(job.sales_segment ?? []).map(getSalesSegmentLabel), job.sales_hunter_farmer ? getHunterFarmerLabel(job.sales_hunter_farmer) : null].filter(Boolean).join("・") },
      { label: "インセンティブ", value: job.incentive_note },
    ]) }] : []),
    { label: "勤務地", value: specLines([
      { value: job.location },
      { label: "働き方", value: job.work_style },
    ]) },
    { label: "勤務時間", value: specLines([
      { value: job.work_hours },
      { label: "休憩", value: laborVal("休憩時間") },
      { label: "時間外労働", value: laborVal("時間外労働") },
    ]) },
    { label: "休日・休暇", value: job.holidays },
    { label: "手当・福利厚生", value: specLines([
      { label: "社会保険", value: laborVal("社会保険") },
      ...benefitLines,
    ]) },
    { label: "受動喫煙対策", value: laborVal("受動喫煙防止の措置") },
    { label: "変更の範囲", value: specLines([
      { label: "就業場所", value: laborVal("就業場所の変更の範囲") },
      { label: "業務", value: laborVal("業務の変更の範囲") },
    ]) },
  ];
  for (const l of labor) {
    if (!usedLabor.has(l.label)) specRows.push({ label: l.label, value: l.value });
  }

  /* ── 会社概要の表 ── ⚠️ 値が無い行は DefinitionRows が落とす */
  const companyRows = [
    { label: "会社名", value: company.name },
    { label: "事業内容", value: company.about },
    { label: "設立", value: companyDetail?.established ?? null },
    { label: "従業員数", value: formatEmployeeSize(company.employee_count_band, company.employee_count_as_of) ?? company.employee_count ?? null },
    { label: "所在地", value: companyDetail?.headquartersAddress ?? companyDetail?.hq ?? null },
  ];

  const points = jobPointLines(job.highlight);
  const hasActions = !!casualHref || !!applyHref;
  const hasOverview = points.length > 0 || !!job.overview;
  const hasSpec = specRows.some((r) => r.value);
  const hasCompanyRows = companyRows.some((r) => r.value);

  /* ★要点チップ（年収・勤務地・雇用形態・働き方）。値があるものだけ */
  const heroChips = [
    payText && <HeroChip key="pay" strong icon={<><circle cx="12" cy="12" r="9"/><path d="M8 7l4 5 4-5M12 12v6M9 13h6M9 16h6"/></>}>{payText}</HeroChip>,
    oteText && <HeroChip key="ote" icon={<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>}>OTE {oteText}</HeroChip>,
    shortAddress(job.location) && <HeroChip key="loc" icon={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>}>{shortAddress(job.location)}</HeroChip>,
    job.employment_type && <HeroChip key="emp" icon={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></>}>{job.employment_type}</HeroChip>,
    job.work_style && <HeroChip key="ws" icon={<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>}>{job.work_style}</HeroChip>,
  ].filter(Boolean);

  /* ★サイドバーの行動カード：想定年収 → 勤務地・雇用形態・働き方 → ボタン */
  const actionPay = salaryText
    ? { label: payLabel(job.employment_type) === "報酬" ? "想定報酬" : "想定年収", value: salaryText }
    : job.salary_negotiable ? { label: payLabel(job.employment_type) === "報酬" ? "報酬" : "年収", value: payNegotiableText(job.employment_type) } : null;
  const actionFacts = [shortAddress(job.location), job.employment_type, job.work_style].filter((v): v is string => !!v);

  /* ★ページ内タブ。中身の無いセクションは出さない */
  const navItems = [
    ...(hasOverview ? [{ id: "job-overview", label: "仕事内容" }] : []),
    ...(hasSpec ? [{ id: "job-spec", label: "募集要項" }] : []),
    ...(job.selection_flow.length > 0 ? [{ id: "job-selection", label: "選考フロー" }] : []),
    ...(hasCompanyRows ? [{ id: "job-company", label: "会社概要" }] : []),
  ];

  const otherJobs = relatedJobs;

  return (
    <>
      {testMode && (
        <p data-state="test-company-notice" style={{ margin: 0, padding: "8px 16px", textAlign: "center", fontSize: 12.5, color: "var(--ink-mute)", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
          {TEST_COMPANY_NOTICE}
        </p>
      )}
      {/* ★閲覧を数える（2026-10-09 / 段階D）。⚠️ プレビュー（/biz）では数えない */}
      {!preview && !testMode && <ViewBeacon type="job" id={job.id} />}
      {(() => {
        // published_at が null の求人は JSON-LD を出力しない。
        // created_at フォールバックは使用しない（2026-06-12 のデータ移行日が全件に入るため）。
        if (!job.published_at) return null;

        // description: catch_copy + overview + required_skills を結合。空なら出力しない。
        const descParts: string[] = [];
        if (job.highlight) descParts.push(`<p>${job.highlight}</p>`);
        if (job.overview) descParts.push(`<p>${job.overview}</p>`);
        if (job.required_skills.length > 0) {
          descParts.push(`<p>必須要件</p><ul>${job.required_skills.map((s) => `<li>${s}</li>`).join("")}</ul>`);
        }
        const description = descParts.join("");
        if (!description) return null;

        const isFullRemote = job.work_style.includes("フルリモート");

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: job.role,
          identifier: {
            "@type": "PropertyValue",
            name: company.name,
            value: jobSlug ?? jobId,
          },
          hiringOrganization: {
            "@type": "Organization",
            name: company.name,
            sameAs: `https://opinio.jp/companies/${company.slug ?? job.company_id}`,
          },
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressCountry: "JP",
              addressLocality: job.location || "東京",
            },
          },
          ...(isFullRemote ? {
            jobLocationType: "TELECOMMUTE",
            applicantLocationRequirements: { "@type": "Country", name: "JP" },
          } : {}),
          baseSalary: job.salary_min ? {
            "@type": "MonetaryAmount",
            currency: "JPY",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salary_min * 10000,
              ...(job.salary_max ? { maxValue: job.salary_max * 10000 } : {}),
              unitText: "YEAR",
            },
          } : undefined,
          datePosted: job.published_at,
          ...(job.expires_at ? { validThrough: job.expires_at } : {}),
          /* ⚠️ 不明を FULL_TIME に倒さない（2026-08-07）。
             schema.org の employmentType は決まった英語の語彙で、
             日本語の「正社員」を入れても解釈されない。
             写せない値・未設定のときは**項目ごと出さない**。 */
          ...(SCHEMA_EMPLOYMENT_TYPE[job.employment_type ?? ""]
            ? { employmentType: SCHEMA_EMPLOYMENT_TYPE[job.employment_type ?? ""] }
            : {}),
          description,
          url: `https://opinio.jp/jobs/${jobSlug ?? jobId}`,
        };

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
          />
        );
      })()}
      {/* パンくず: 募集 ＞ 会社名 ＞ 題名。★767px 以下は題名を1行で省略する（.jd-crumb。globals.css） */}
      <nav aria-label="パンくずリスト" style={{ padding: "12px 0 0" }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-4 md:px-12">
          <div className="jd-crumb" style={{ fontSize: 12.5, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>募集</Link>
            <span aria-hidden>›</span>
            {companyHref
              ? <Link href={companyHref} className="jd-crumb-company" title={company.name} style={{ color: "var(--ink-mute)" }}>{company.name}</Link>
              : <span className="jd-crumb-company" title={company.name}>{company.name}</span>}
            <span aria-hidden>›</span>
            <span aria-current="page" className="jd-crumb-current" style={{ color: "var(--ink-soft)" }} title={job.role}>{job.role}</span>
          </div>
        </div>
      </nav>

      <div className="jd-page">
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-4 pt-3 pb-4 md:px-12">
          {/* ── 冒頭のカード（企業詳細と同じ部品） ── */}
          <DetailHero
            state="job-header"
            logo={
              <CompanyLogo name={company.name} logoUrl={company.logo_url} logoLetter={company.logo_letter}
                logoGradient={company.gradient} size={88} borderRadius={16}
                style={{ border: "1px solid var(--line)" }} />
            }
            category={companyHref
              ? <Link href={companyHref} style={{ color: "var(--royal)", textDecoration: "none" }}>{company.name}</Link>
              : <span>{company.name}</span>}
            /* ★運営会社の開示（2026-10-10）。会社名のすぐ下に1行 */
            note={isOwnCompany ? <OwnCompanyNote style={{ marginTop: 4 }} /> : undefined}
            title={job.role}
            chips={heroChips.length > 0 ? <>{heroChips}</> : undefined}
            meta={metaItems}
            actions={<>
              <MainActions casualHref={casualHref} applyHref={applyHref} />
              <BookmarkButton targetType="job" targetId={job.id} label="保存" variant="inline" />
              <JobInlineShare jobId={job.id} jobTitle={job.role} companyName={company.name} />
            </>}
          />
        </div>

        {/* 下の固定バー（1023px 以下）。冒頭のカードを過ぎたら出す */}
        <JobMobileStickyBar casualHref={casualHref} applyHref={applyHref} />

        {/* ★ページ内タブ（企業詳細と同じ部品。2026-11-26）。⚠️ 数字は入れない・中身の無いタブは出さない */}
        <DetailSectionNav items={navItems} />

        {/* ★`cd-body` は左右の余白（--cd-pad-x）と見出しの位置合わせ（scroll-margin）。企業詳細と共通 */}
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="cd-body px-4 pt-5 pb-10 md:px-12 md:pb-12">
          {/* ── 2カラム（1024px 以上）／1カラム ──
                 ⚠️ 1fr ではなく minmax(0,1fr)（長い英数字で列が広がり、375px ではみ出すのを防ぐ）。
                 ★本文はセクションごとに1枚のカード（2026-11-26 / 柴さんの指示）：仕事内容／募集要項／選考フロー／会社概要 */}
          <div className="dt-cols">
            <div className="dt-stack" data-state="job-body">
              {hasOverview && (
                <SectionCard id="job-overview" state="job-overview" title="仕事内容">
                  {points.length > 0 && (
                    <div data-state="job-points" style={{ marginBottom: job.overview ? 22 : 0 }}>
                      <h3 className="dt-h3">この募集のポイント</h3>
                      <Bullets items={points} />
                    </div>
                  )}
                  {/* ⚠️ 本文の「■」「【】」の見出しは小見出し（h3・16px）として出す。文字は変えない（■も消さない）。
                         ⚠️ 折りたたまない（全文を出す。2026-11-26） */}
                  {job.overview && <Markdown jobBody>{job.overview}</Markdown>}
                </SectionCard>
              )}

              {hasSpec && (
                <SectionCard id="job-spec" state="job-spec" title="募集要項">
                  <DefinitionRows rows={specRows} ariaLabel="募集要項" />
                </SectionCard>
              )}

              {job.selection_flow.length > 0 && (
                <SectionCard id="job-selection" state="job-selection" title="選考フロー">
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9, color: "var(--ink)" }}>
                    {job.selection_flow.map((s, i) => (
                      <span key={i}>
                        {i > 0 && <span aria-hidden style={{ margin: "0 8px", color: "var(--ink-mute)" }}>→</span>}
                        <span style={{ whiteSpace: "nowrap" }}>{s.name}</span>
                      </span>
                    ))}
                  </p>
                  {/* ⚠️ カジュアル面談を受け付けない会社では書かない（申し込めないのに案内することになる） */}
                  {casualHref && (
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>※カジュアル面談は選考とは別に実施します。</p>
                  )}
                  {job.selection_note && (
                    <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, whiteSpace: "pre-line" }}>{job.selection_note}</p>
                  )}
                </SectionCard>
              )}

              {hasCompanyRows && (
                <SectionCard id="job-company" state="job-company" title="会社概要">
                  <DefinitionRows rows={companyRows} ariaLabel="会社概要" />
                  {companyHref && (
                    <p style={{ margin: "14px 0 0" }}>
                      <Link href={companyHref} data-state="job-company-link" style={{ fontSize: 14, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>企業ページを見る →</Link>
                    </p>
                  )}
                </SectionCard>
              )}
            </div>

            {/* ── サイドバー（1023px 以下は本文の下に同じ順で並ぶ） ── */}
            <DetailSide ariaLabel="この募集の条件と担当者">
              {/* ★行動カード（2026-11-26）。1024px 以上は欄全体（DetailSide）がヘッダーとタブの下に貼り付く */}
              {(actionPay || actionFacts.length > 0 || hasActions) && (
                <div className="jd-card jd-side-card dt-action" data-state="job-action-card">
                  {actionPay && (
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-mute)" }}>{actionPay.label}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>{actionPay.value}</div>
                      {oteText && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>OTE {oteText}</div>}
                    </div>
                  )}
                  {actionFacts.length > 0 && (
                    <ul style={{ margin: actionPay ? "12px 0 0" : 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {actionFacts.map((f) => (
                        <li key={f} style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, overflowWrap: "anywhere" }}>{f}</li>
                      ))}
                    </ul>
                  )}
                  {hasActions && (
                    <div className="dt-action-btns">
                      <MainActions casualHref={casualHref} applyHref={applyHref} />
                    </div>
                  )}
                </div>
              )}
              {/* ★「この募集に関わる人」と「この会社で働く人」（2026-11-26）。どちらもブラウザで取りに行く。
                     0人ならカードごと消えるので、枠も部品の中に持たせる */}
              <JobSidePeople jobId={job.id} companyId={job.company_id} companyHref={companyHref} preview={preview}
                peopleTitle={<SideTitle>この会社で働く人</SideTitle>} />
              {otherJobs.length > 0 && (
                <div className="jd-card jd-side-card" data-state="job-other-jobs">
                  <SideTitle>この会社の他の募集</SideTitle>
                  <div>
                    {otherJobs.map((rj, i) => (
                      <Link key={rj.id} href={jobPath(rj.slug ?? rj.id)} style={{
                        display: "block", padding: "10px 0", textDecoration: "none",
                        borderTop: i === 0 ? undefined : "1px solid var(--line-soft)",
                      }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{rj.role}</span>
                        {salaryRange(rj.salary_min, rj.salary_max) && (
                          <span style={{ display: "block", fontSize: 13, color: "var(--ink-soft)", marginTop: 2, whiteSpace: "nowrap" }}>{salaryRange(rj.salary_min, rj.salary_max)}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </DetailSide>
          </div>
        </div>
      </div>

      {/* ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（ハイドレーションが壊れる）。
             .dt-* は企業詳細も同じ定義を持つ（globals.css）。ここには募集だけの見た目を置く */}
      <style>{`
        .jd-page { background: var(--bg-tint); }
        .dt-h3 { margin: 0 0 8px; font-size: 16px; font-weight: 700; color: var(--ink); line-height: 1.6; }
        .dt-action-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .dt-action-btns a { width: 100%; }
      `}</style>
    </>
  );
}

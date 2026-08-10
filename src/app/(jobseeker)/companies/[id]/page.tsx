import type { Metadata } from "next";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type React from "react";
import { permanentRedirect } from "next/navigation";
import {
  getCompanyBySlugOrId,
  getCompaniesForList,
  getCompanyPhotosCached,
  getCompanyRecruitersCached,
  getArticlesByCompanyCached,
  getCompanyEmployeesCached,
  getCompanyToolsCached,
  getCompanyStoriesCached,
  getPublicAmbassadorsCached,
} from "@/lib/supabase/queries";
import type { CompanyTool } from "@/lib/supabase/queries";
import { InfoCard } from "./InfoCard";
import { SecTitle } from "./SecTitle";
import { CompanyEmployeeSections } from "./CompanyEmployeeSections";
import { AV_GRADIENTS } from "./avatarGradients";
import ToolsSectionClient from "./ToolsSectionClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStageCfg } from "@/lib/utils/stageCfg";
import type { CompanyPhoto, CompanyRecruiter } from "@/lib/supabase/queries";
import type { Article } from "@/app/articles/mockArticleData";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { PhotoCarousel } from "./PhotoCarousel";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import BookmarkButton, { CompanyStickyNav, RecentlyViewedTracker, ShareButton, FollowButton } from "./CompanyDetailClient";
import OrgTeamsSectionClient from "./OrgTeamsSectionClient";
import CustomerCasesClient from "./CustomerCasesClient";
import { ReadingProgress } from "@/components/jobseeker/ReadingProgress";
import { BackToTop } from "@/components/jobseeker/BackToTop";
import { fmtMan } from "@/lib/utils/salary";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";

// Deduplicate getCompanyBySlugOrId calls within a single request
// (generateMetadata and CompanyDetailPage both call it)
const getCompanyBySlugOrIdCached = cache(getCompanyBySlugOrId);



// 5分間 ISR キャッシュ
export const revalidate = 60;

/*
 * ⚠️ **これが無いと `revalidate` が効かない**（2026-08-09 実測。詳細は CLAUDE.md）。
 *    動的セグメントは generateStaticParams を持つものだけがキャッシュされる。
 *
 * ⚠️ 足す前に、このページから no-store の読み取りに到達しないか確認すること。
 *    到達するとビルドは成功したまま、その項目だけ消えたページが生成される。
 *    2026-08-09 時点では到達しないことを確認済み。
 */
export async function generateStaticParams() {
  /* ⚠️ `getCompanies()` は使えない。内部で Cookie を読む `createClient()` を使っており、
        ビルド時（リクエスト外）に `cookies was called outside a request scope` で落ちる。
        admin クライアントを使う `getCompaniesForList()` を通すこと。 */
  const companies = await getCompaniesForList();
  return companies.map((c) => ({ id: c.slug ?? c.id }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyBySlugOrIdCached(params.id);
  if (!result) notFound();
  const { company, slug } = result;

  const canonicalId = slug ?? params.id;
  // 「カジュアル面談受付中」「カジュアル面談で現場の声を聞けます」は 2026-08-03 に削除。
  // 面談前提の説明はプラットフォーム側では使わない方針。掲載企業ぶん全ページの
  // meta description になるので、外向きの文言としては最も露出が大きい。
  //
  // ⚠️ employee_count は数値ではなく自由記述で、「約200名」「3500名以上」のように
  //    単位まで含んだ文字列が入る（2026-08-03 時点で値のある全社が「名」を含む）。
  //    以前は一律 `+ "名規模"` していたため「3500名以上名規模」「約200名名規模」と
  //    全社の meta description が二重になっていた。値はそのまま使う。
  const size = company.employee_count?.toString().trim() || null;
  const description = company.tagline
    ? `${company.tagline}｜${company.industry ?? "IT/SaaS"}業界${size ? `・${size}` : ""}。企業情報と求人をOPINIOで確認。`
    : `${company.name}の企業情報・求人・組織文化をOPINIOで確認。`;

  const ogImageUrl = `/api/og?type=company&name=${encodeURIComponent(company.name)}&sub=${encodeURIComponent(company.tagline ?? "")}&badge=${encodeURIComponent(company.industry ?? "IT/SaaS")}`;

  return {
    title: { absolute: `${company.name} — 企業情報・求人 | OPINIO` },
    description,
    alternates: { canonical: `/companies/${canonicalId}` },
    // 「カジュアル面談」は 2026-08-03 に削除（面談前提の説明はプラットフォーム側では使わない）
    keywords: [company.name, company.industry ?? "", "企業情報", "求人", "IT転職", "SaaS転職"].filter(Boolean),
    openGraph: {
      title: `${company.name} | OPINIO`,
      description,
      type: "website",
      url: `/companies/${canonicalId}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: company.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${company.name} | OPINIO`,
      description,
      images: [ogImageUrl],
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/* ⚠️ ブックマーク／フォローの状態は props で渡さない（2026-08-09）。
      各ボタンが useCompanyViewerState で自分で取る。
      ここに閲覧者依存の props を足すと、それを作るためにサーバーで
      認証を読むことになり、ページの ISR が壊れる。 */
function Hero({
  company,
  detail,
  recruiters,
  coverPhotoUrl,
}: {
  company: Company;
  detail: CompanyDetail;
  recruiters: CompanyRecruiter[];
  coverPhotoUrl?: string | null;
}) {
  const displayBrand = (company.brand_name ?? company.name_en ?? company.name)
    .replace(/^(株式会社|有限会社|合同会社|一般社団法人|一般財団法人)\s*/, "").trim();
  const initial = displayBrand.charAt(0).toUpperCase() || company.name.charAt(0).toUpperCase();
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 30;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      {/* Gradient cover band */}
      <div style={{
        height: 200,
        background: (coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) ? `url(${coverPhotoUrl}) center/cover no-repeat` : company.gradient,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: (coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) ? "linear-gradient(160deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.5) 100%)" : "linear-gradient(160deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.32) 100%)" }} />
        {/* Decorative circles + large initial watermark (gradient only) */}
        {!(coverPhotoUrl && /^https:\/\/[a-z]+\.supabase\.co\//.test(coverPhotoUrl)) && <>
          <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -30, bottom: -80, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          {/* ⑩ Large initial watermark */}
          <div style={{
            position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
            fontSize: 120, fontWeight: 900, color: "rgba(255,255,255,0.10)",
            fontFamily: "Inter, sans-serif", lineHeight: 1, userSelect: "none", pointerEvents: "none",
            letterSpacing: "-0.05em",
          }}>
            {initial}
          </div>
        </>}
      </div>
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 pb-7 md:px-12"
      >
        <div
          style={{
            display: "flex",
            gap: "var(--space-8)",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* Left: logo + info */}
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
            {/* Logo — overlaps cover band */}
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              companyUrl={company.url}
              size={96}
              borderRadius={18}
              style={{
                marginTop: -56,
                position: "relative",
                zIndex: 1,
                border: "4px solid #fff",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
              }}
            />
            <div style={{ paddingTop: "var(--space-3)" }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  marginBottom: "var(--space-2)",
                  fontWeight: 700,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase" as const,
                  fontFamily: "Inter, var(--font-inter), sans-serif",
                }}
              >
                {company.industry}
              </div>
              {(() => {
                const enName = company.name_en
                  ? company.name_en
                      .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, '')
                      .replace(/\s+Co\.,?\s*Ltd\.?$/i, '')
                      .replace(/\s*,\s*Inc\.?$/i, '')
                      .replace(/\s+Inc\.?$/i, '')
                      .replace(/\s+Corp\.?$/i, '')
                      .trim() || null
                  : null;
                return (
                  <>
                    <h1
                      style={{
                        fontFamily: enName ? 'Inter, sans-serif' : 'var(--font-noto-serif)',
                        fontWeight: 800,
                        fontSize: "clamp(26px, 3vw, 40px)",
                        color: "var(--ink)",
                        marginBottom: enName ? "var(--space-1)" : "var(--space-2)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.18,
                      }}
                    >
                      {enName ?? company.name}
                    </h1>
                    {enName && (
                      <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-mute)", marginBottom: "var(--space-2)", fontWeight: 400 }}>
                        {company.name}
                      </div>
                    )}
                  </>
                );
              })()}
              <p
                style={{
                  fontSize: "var(--text-md)",
                  color: "#1e293b",
                  lineHeight: 1.75,
                  letterSpacing: "0.01em",
                  marginBottom: "var(--space-4)",
                  maxWidth: 560,
                  fontWeight: 500,
                }}
              >
                {company.tagline}
              </p>
              {/* Row 1: ジャンルチップ + フェーズバッジ + 採用中 + 更新日 */}
              {(company.genres.length > 0 || company.phase || company.job_count > 0 || isFresh) && (
                <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  {company.genres.map((g) => (
                    <span
                      key={g.id}
                      style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                        fontSize: "var(--text-xs)", fontWeight: 700,
                        background: "var(--royal-50)",
                        color: "var(--royal)",
                        border: "1px solid var(--royal-100)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                  {(() => {
                    const sc = getStageCfg(company.phase);
                    if (!sc) return null;
                    return (
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                        fontSize: "var(--text-xs)", fontWeight: sc.fontWeight ?? 700,
                        background: sc.bg, color: sc.color,
                        border: `1px solid ${sc.border}`,
                        letterSpacing: "0.02em",
                      }}>
                        {sc.label}
                      </span>
                    );
                  })()}
                  {company.job_count > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                      fontSize: "var(--text-xs)", fontWeight: 600,
                      background: "var(--success-soft)", color: "var(--success)", border: "1px solid #A7F3D0",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px rgba(5,150,105,0.6)", flexShrink: 0 }} />
                      採用中 {company.job_count}件
                    </span>
                  )}
                  {isFresh && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-2)", borderRadius: 999,
                      fontSize: "var(--text-xs)", fontWeight: 500,
                      background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)",
                    }}>
                      {freshLabel}
                    </span>
                  )}
                </div>
              )}

              {/* Row 2: アクションボタン（話を聞く dominant + 気になる + フォロー ghost） */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {company.accepting_casual_meetings && (
                  <Link href={`/companies/${company.id}/casual-meeting`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "10px 22px", borderRadius: 100, fontSize: 14, fontWeight: 800,
                      background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
                      textDecoration: "none",
                      boxShadow: "0 3px 10px rgba(245,158,11,0.35)",
                    }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "cta-pulse 1.8s ease-in-out infinite", display: "inline-block", flexShrink: 0 }} />
                    <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
                  </Link>
                )}
                <BookmarkButton
                  companyName={company.name}
                  companyId={company.id}
                  variant="pill"
                />
                <FollowButton companyId={company.id} />
              </div>

              {/* ⑨ Perk chips removed — work style info is shown in stats strip below */}

              {/* ③ SNS リンク + 共有ボタン（1行に統合） */}
              {(company.x_url || company.linkedin_url || detail.url || company.careers_url) && (
                <div style={{ display: "flex", gap: 6, marginTop: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                  {/* X: icon-only circle */}
                  {company.x_url && (
                    <a href={company.x_url} target="_blank" rel="noopener noreferrer" title="X (Twitter)"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: "#000", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.263 5.632 5.9-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {/* LinkedIn: icon-only circle */}
                  {company.linkedin_url && (
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn"
                      style={{ width: 30, height: 30, borderRadius: "50%", background: "#0A66C2", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                    </a>
                  )}
                  {detail.url && (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 8, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      公式サイト
                    </a>
                  )}
                  {company.careers_url && (
                    <a href={company.careers_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 8, background: "var(--warm-soft)", color: "#92400E", border: "1px solid #FDE68A", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                      採用情報
                    </a>
                  )}
                  {/* 共有: ShareButtonをここに統合 */}
                  <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0, marginLeft: 4 }} />
                  <ShareButton companyName={company.name} companyId={company.id} />
                </div>
              )}
            </div>
          </div>

        </div>


        {/* Recruiter strip */}
        {recruiters.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            paddingTop: "var(--space-4)", marginTop: "var(--space-4)", borderTop: "1px solid var(--line-soft)",
          }}>
            <div style={{ display: "flex" }}>
              {recruiters.slice(0, 3).map((r, i) => (
                <div key={r.id} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: r.avatar_color ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                  border: "2.5px solid #fff",
                  marginLeft: i === 0 ? 0 : -10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: "var(--text-xs)", fontWeight: 700,
                  boxShadow: "0 0 0 1px var(--line)",
                  position: "relative", zIndex: 3 - i,
                }}>
                  {r.avatar_initial || (r.name ?? "採").charAt(0)}
                </div>
              ))}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)" }}>
              採用担当: <strong style={{ color: "var(--ink)" }}>{recruiters.slice(0, 2).map(r => r.name ?? "担当者").join(" · ")}</strong>
              {recruiters.length > 2 && ` 他${recruiters.length - 2}名`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// TabsBar removed — replaced by CompanyStickyNav (scroll-spy version)

function AboutSection({
  detail,
  photos,
}: {
  detail: CompanyDetail;
  photos: CompanyPhoto[];
}) {
  return (
    <section
      id="about"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header with subtle gradient */}
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
        >
          企業について
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6) 32px var(--space-6)" }}>

        {/* オフィス写真グリッド */}
        <PhotoCarousel photos={photos} />

        {/* ① 会社概要 */}
        {detail.about && (
          <div style={{ marginBottom: detail.culture_description ? "var(--space-4)" : "var(--space-6)" }}>
            {detail.about.split("\n").filter(line => line.trim()).map((line, i) => (
              <p key={i} style={{ margin: i > 0 ? "14px 0 0" : 0, fontSize: 15, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>
                {line.trim()}
              </p>
            ))}
          </div>
        )}

        {/* ② 組織文化の説明文（見出しなし、本文直後に統合） */}
        {detail.culture_description && (
          <p style={{ margin: 0, marginBottom: "var(--space-6)", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, fontFamily: "var(--font-noto-sans)" }}>
            {detail.culture_description}
          </p>
        )}


      </div>
    </section>
  );
}

// ─── ProductsCultureSection ────────────────────────────────────────────────────

// ─── ProductsClientsSection ───────────────────────────────────────────────────

/** 製品名から（...）形式のサブタイトルを分離する */
function parseProductName(raw: string): { name: string; sub: string | null } {
  const m = raw.match(/^(.+?)（(.+?)）\s*$/);
  if (m) return { name: m[1].trim(), sub: m[2].trim() };
  const m2 = raw.match(/^(.+?)\((.+?)\)\s*$/);
  if (m2) return { name: m2[1].trim(), sub: m2[2].trim() };
  return { name: raw, sub: null };
}

/** キーワードベースで製品カードのスタイルを決める（カテゴリ別カラー） */
function productStyle(name: string): { bg: string; border: string; color: string; icon: React.ReactNode } {
  const n = name.toLowerCase();
  // Sales/CRM → royal blue
  const ROYAL = { bg: "var(--royal-50)", border: "var(--royal-100)", color: "var(--royal)" };
  // Marketing → warm amber
  const WARM = { bg: "#FEF3C7", border: "#FDE68A", color: "#92400E" };
  // Analytics/Data → purple
  const PURPLE = { bg: "#F3E8FF", border: "#DDD6FE", color: "#7C3AED" };
  // Service/Support/CS → green
  const GREEN = { bg: "#D1FAE5", border: "#A7F3D0", color: "#065F46" };
  // AI/ML → indigo
  const INDIGO = { bg: "#EEF2FF", border: "#C7D2FE", color: "#4338CA" };
  // Integration/API/Platform → slate
  const SLATE = { bg: "#F1F5F9", border: "#CBD5E1", color: "#475569" };
  // Cloud/Platform → sky
  const SKY = { bg: "#E0F2FE", border: "#BAE6FD", color: "#0369A1" };

  if (/(crm|sales|営業|セールス)/.test(n))
    return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> };
  if (/(market|マーケ|メール|email)/.test(n))
    return { ...WARM, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> };
  if (/(analytic|data|分析|レポ|insight|tableau|bi)/.test(n))
    return { ...PURPLE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> };
  if (/(service|support|サービス|サポート|cs|カスタマ|success)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> };
  if (/(platform|cloud|クラウド|プラットフォーム)/.test(n))
    return { ...SKY, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg> };
  if (/(ai|ml|機械学習|人工知能|llm|gpt|agentforce|einstein)/.test(n))
    return { ...INDIGO, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> };
  if (/(integrat|api|連携|インテグレ|mule|slack|コラボ)/.test(n))
    return { ...SLATE, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> };
  if (/(hr|human|採用|人事|タレント|talent|commerce|ec|financial)/.test(n))
    return { ...GREEN, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg> };
  return { ...ROYAL, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> };
}

// ─── ⑦ 資本関係・グループ ────────────────────────────────────────────────────

const CAPITAL_TYPE_LABELS: Record<string, string> = {
  foreign_subsidiary:   "外資系日本法人",
  japanese_independent: "日系独立",
  japanese_group:       "日系グループ会社",
  other:                "その他",
};


function ProductsClientsSection({ detail }: { detail: CompanyDetail }) {
  const hasProducts = detail.main_products && detail.main_products.length > 0;
  const hasCases    = detail.customer_cases && detail.customer_cases.length > 0;
  const hasCustomers = detail.main_customers && detail.main_customers.length > 0;

  if (!hasProducts && !hasCases && !hasCustomers) return null;

  // id は "products-clients" のまま（CompanyCardList.tsx 等の外部参照があるため変更不可）
  return (
    <section
      id="products-clients"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          }
        >
          製品・導入事例
        </SecTitle>
      </div>

      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

        {/* ── 製品・サービス ── */}
        {hasProducts && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>主な製品・サービス</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{detail.main_products!.length}製品</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <style>{`
              .products-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-2);
              }
              @media (min-width: 640px) {
                .products-grid { grid-template-columns: repeat(3, 1fr); }
              }
              @media (min-width: 900px) {
                .products-grid { grid-template-columns: repeat(5, 1fr); }
              }
            `}</style>
            <div className="products-grid">
              {detail.main_products!.map((raw, i) => {
                const { name } = parseProductName(raw);
                const s = productStyle(name);
                return (
                  <div
                    key={i}
                    style={{
                      background: "#fff",
                      border: `1px solid var(--line)`,
                      borderRadius: 10,
                      padding: "10px var(--space-3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 56,
                    }}
                  >
                    {/* アイコン */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {s.icon}
                    </div>
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.35, fontFamily: "var(--font-noto-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 区切り線 ── */}
        {hasProducts && (hasCases || hasCustomers) && (
          <div style={{ height: 1, background: "var(--line)", margin: "8px 0 4px" }} />
        )}

        {/* ── 主な導入事例 ── */}
        {hasCases && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-4)" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", whiteSpace: "nowrap" as const }}>主な導入事例</h3>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>{detail.customer_cases!.length}社</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <CustomerCasesClient cases={detail.customer_cases!} defaultCollapsed={detail.customer_cases!.length > 3} />
          </div>
        )}

        {/* ── 主な顧客タグ（customer_cases がない場合のフォールバック） ── */}
        {!hasCases && hasCustomers && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--royal)", fontFamily: "var(--font-noto-sans)", letterSpacing: "0.02em" }}>
                主な顧客
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                {detail.main_customers!.length} 社
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {detail.main_customers!.map((c, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 14px",
                    borderRadius: 100,
                    background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    color: "var(--royal)",
                    fontFamily: "var(--font-noto-sans)",
                    lineHeight: 1.4,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


// ─── Benefits Section ─────────────────────────────────────────────────────────


function BenefitsSection({ detail }: { detail: CompanyDetail }) {
  // UNSET_STYLE removed — replaced by inline "カジュアル面談でご確認ください" badges

  const hasBenefits = !!(detail.benefits && detail.benefits.length > 0);
  if (!hasBenefits) return null;

  return (
    <section
      id="benefits"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        >
          福利厚生
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>

      {/* ── 福利厚生 ── */}
      {/* Benefit keyword → emoji mapping */}
      {(() => {
        // SVGベースの福利厚生アイコン（キーワード → SVG）
        type BenefitIconDef = { svg: React.ReactNode; color: string; bg: string; border: string };
        function getBenefitIconDef(benefit: string): BenefitIconDef {
          const b = benefit;
          const royal: BenefitIconDef = {
            color: "var(--royal)", bg: "var(--royal-50)", border: "var(--royal-100)",
            svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
          };
          if (b.includes("リモート") || b.includes("在宅") || b.includes("テレワーク") || b.includes("フルリモート"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> };
          if (b.includes("フレックス") || b.includes("時差出勤"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> };
          if (b.includes("副業") || b.includes("兼業"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> };
          if (b.includes("ストックオプション") || b.includes("SO") || b.includes("持株"))
            return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> };
          if (b.includes("書籍") || b.includes("学習") || b.includes("研修") || b.includes("勉強会") || b.includes("資格"))
            return { color: "#5b21b6", bg: "#ede9fe", border: "#ddd6fe", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> };
          if (b.includes("育休") || b.includes("産休") || b.includes("子育て") || b.includes("保育"))
            return { color: "#9a3412", bg: "#ffedd5", border: "#fed7aa", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> };
          if (b.includes("食事") || b.includes("ランチ") || b.includes("社食"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> };
          if (b.includes("健康") || b.includes("医療") || b.includes("保険"))
            return { ...royal, svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> };
          if (b.includes("確定拠出") || b.includes("退職金"))
            return { color: "#065f46", bg: "#d1fae5", border: "#a7f3d0", svg: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> };
          // default: checkmark
          return royal;
        }
        const BENEFIT_CATEGORIES = [
          { key: "work_style", label: "働き方", keywords: ["リモート", "在宅", "テレワーク", "フルリモート", "フレックス", "時差", "副業", "兼業"] },
          /* ⚠️ 「株式」を足した（2026-08-08）。ラベルが「報酬・株式」なのに
                キーワードに無く、「RSU（譲渡制限付き株式）」がその他に落ちていた。 */
          { key: "rewards",    label: "報酬・株式", keywords: ["ストックオプション", "SO", "持株", "株式", "確定拠出", "退職金", "給与", "賞与", "インセンティブ"] },
          { key: "growth",     label: "学習・成長", keywords: ["書籍", "学習", "研修", "勉強会", "資格", "セミナー"] },
          /* ⚠️ 「育児」「介護」を足した（2026-08-08）。ラベルが「育児・家族」なのに
                キーワードは「育休」だけで、「育児・介護休暇制度」がその他に落ちていた。 */
          { key: "family",     label: "育児・家族", keywords: ["育休", "産休", "育児", "介護", "子育て", "保育"] },
          { key: "health",     label: "食事・健康", keywords: ["食事", "ランチ", "社食", "健康", "医療", "保険"] },
        ];
        function categorize(b: string) {
          for (const cat of BENEFIT_CATEGORIES) {
            if (cat.keywords.some(kw => b.includes(kw))) return cat.key;
          }
          return "other";
        }
        const grouped = new Map<string, string[]>();
        if (detail.benefits) {
          for (const b of detail.benefits) {
            const key = categorize(b);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(b);
          }
        }
        return (
      <div>
        {detail.benefits && detail.benefits.length > 0 ? (
          /* ⚠️ カテゴリごとに見出しを付ける（2026-08-08）。
                categorize() と grouped は前から計算されていたのに使われておらず、
                全件を平坦に並べていた。
             ⚠️ **1件も欠けさせない。** どのキーワードにも当たらない値は
                categorize() が "other" を返すので、必ず最後に「その他」として出す
                （カテゴリ定義だけを回すと、その値が画面から消える）。
             ⚠️ 1件も無いカテゴリは見出しごと出さない。 */
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[...BENEFIT_CATEGORIES, { key: "other", label: "その他", keywords: [] }]
              .filter((cat) => (grouped.get(cat.key)?.length ?? 0) > 0)
              .map((cat) => (
                <div key={cat.key}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
                    letterSpacing: "0.04em", marginBottom: 8,
                  }}>
                    {cat.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                    {(grouped.get(cat.key) ?? []).map((b) => {
                      const def = getBenefitIconDef(b);
                      return (
                        <InfoCard
                          key={b}
                          icon={<span style={{ display: "flex", alignItems: "center", transform: "scale(1.5)" }}>{def.svg}</span>}
                          label={b}
                          color={def.color}
                          bg={def.bg}
                          border={def.border}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            fontSize: "var(--text-xs)", color: "var(--ink-soft)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            カジュアル面談でご確認ください
          </div>
        )}
      </div>
        );
      })()}

      </div>
    </section>
  );
}

// ─── Tools Section ───────────────────────────────────────────────────────────

function ToolsSection({ tools }: { tools: CompanyTool[] }) {
  if (tools.length === 0) return null;

  return (
    <section
      id="tools"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          }
        >
          ツール
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
        <ToolsSectionClient tools={tools} />
      </div>
    </section>
  );
}

// ─── Employee Voices Section ─────────────────────────────────────────────────

function JobEmbedCard({
  job,
  catName,
  companyHQ,
}: {
  job: import("@/app/companies/[id]/mockDetailData").JobItem;
  catName: string;
  companyHQ: string;
}) {
  const hasSalary = (job.salaryMin && job.salaryMin > 0) || (job.salaryMax && job.salaryMax > 0);
  const salaryDisplay = hasSalary
    ? (job.salaryMin && job.salaryMax
      ? `${fmtMan(job.salaryMin)}〜${fmtMan(job.salaryMax)}万円`
      : job.salaryMin ? `${fmtMan(job.salaryMin)}万円〜` : `〜${fmtMan(job.salaryMax)}万円`)
    : "応相談";

  // Location: hide if same city as company HQ
  const jobLoc = job.location?.trim() || "";
  const showLoc = jobLoc && jobLoc !== companyHQ && !companyHQ.includes(jobLoc) && !jobLoc.includes(companyHQ);
  const isRemote = jobLoc.includes("リモート") || jobLoc.includes("在宅") || jobLoc.includes("フルリモート");

  // Days-ago badge
  function daysAgoBadge(): string | null {
    if (job.publishedAt) {
      const d = Math.floor((Date.now() - new Date(job.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (d === 0) return "今日";
      if (d <= 7) return `${d}日前`;
      return null;
    }
    if (job.is_new) return "新着";
    return null;
  }
  const badge = daysAgoBadge();

  const href = job.id ? `/jobs/${job.slug ?? job.id}` : "#jobs";

  return (
    <Link
      href={href}
      style={{ textDecoration: "none", display: "block" }}
      className="job-embed-card"
    >
      <div style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "#fff",
        padding: "14px 16px",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        {/* Left accent bar by category */}
        <div style={{ width: 3, borderRadius: 2, background: "var(--royal)", flexShrink: 0, alignSelf: "stretch", opacity: 0.5 }} />
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, flex: 1, minWidth: 0 }}>
              {job.title}
            </div>
            {/* Salary */}
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              {hasSalary ? (
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                  {salaryDisplay}
                </span>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>応相談</span>
              )}
            </div>
          </div>
          {/* Catch copy / description fallback */}
          {(job.catchCopy || job.description) && (
            <p style={{
              margin: "0 0 7px", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.55,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
            }}>
              {job.catchCopy || (job.description ? job.description.slice(0, 100) : "")}
            </p>
          )}
          {/* Meta pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              fontSize: 12, padding: "2px 8px", borderRadius: 4,
              background: "var(--royal-50)", color: "var(--royal)",
              border: "1px solid var(--royal-100)", fontWeight: 600,
            }}>{catName}</span>
            {showLoc && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 12, padding: "2px 7px", borderRadius: 4,
                background: isRemote ? "#f0fdf4" : "var(--bg-tint)",
                color: isRemote ? "var(--success)" : "var(--ink-mute)",
                border: `1px solid ${isRemote ? "#A7F3D0" : "var(--line)"}`,
                fontWeight: 500,
              }}>
                {isRemote ? "🏠" : "📍"} {jobLoc}
              </span>
            )}
            {/* ④ 勤務形態 + 雇用形態 */}
            {job.workStyle && (() => {
              const WS: Record<string, string> = { full_remote: "フルリモート", hybrid: "ハイブリッド", on_site: "出社" };
              const label = WS[job.workStyle] ?? job.workStyle;
              return (
                <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, background: "var(--success-soft,#ECFDF5)", color: "var(--success)", border: "1px solid #A7F3D0", fontWeight: 600 }}>{label}</span>
              );
            })()}
            {job.employmentType && (
              <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 4, background: "var(--bg-tint)", color: "var(--ink-mute)", border: "1px solid var(--line)", fontWeight: 500 }}>{job.employmentType}</span>
            )}
            {job.urgency === "hot" && (
              <span style={{
                fontSize: 12, padding: "2px 7px", borderRadius: 4,
                background: "#FEE2E2", color: "#DC2626",
                border: "1px solid #FECACA", fontWeight: 700,
              }}>🔥 HOT</span>
            )}
            {badge && (
              <span style={{
                fontSize: 12, padding: "2px 7px", borderRadius: 4,
                background: "var(--success-soft,#ECFDF5)", color: "var(--success)",
                border: "1px solid #A7F3D0", fontWeight: 700,
              }}>{badge}</span>
            )}
          </div>
        </div>
        {/* Arrow */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 3 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </Link>
  );
}

function JobsSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  const totalJobs = detail.jobs.reduce((sum, cat) => sum + cat.total, 0);
  const companyHQ = detail.hq || "";

  // Sort items: salary-disclosed first
  function sortItems(items: typeof detail.jobs[0]["items"]) {
    return [...items].sort((a, b) => {
      const aHas = (a.salaryMin && a.salaryMin > 0) || (a.salaryMax && a.salaryMax > 0) ? 1 : 0;
      const bHas = (b.salaryMin && b.salaryMin > 0) || (b.salaryMax && b.salaryMax > 0) ? 1 : 0;
      return bHas - aHas;
    });
  }

  // ── 0 件 ────────────────────────────────────────────────────────────────────
  if (totalJobs === 0) {
    return (
      <section
        id="jobs"
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: "var(--space-6)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div style={{ padding: "var(--space-6) 32px var(--space-4)", borderBottom: "1px solid var(--line-soft)" }}>
          <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>}>
            募集中の案件
          </SecTitle>
        </div>
        <div style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--ink-soft)", padding: "24px 0", margin: 0 }}>
            現在、公開中の募集はありません。
          </p>
          {company.accepting_casual_meetings && (
            <Link href={`/companies/${company.id}/casual-meeting`} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff",
              textDecoration: "none", boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
            }}>
              カジュアル面談でまず話してみる
            </Link>
          )}
        </div>
      </section>
    );
  }

  // Limit: top 3 categories × 3 items each
  const displayCats = detail.jobs.slice(0, 3).map(cat => ({
    ...cat,
    displayItems: sortItems(cat.items).slice(0, 3),
  }));

  return (
    <>
    <section
      id="jobs"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-2)",
      }}>
        <SecTitle icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>} iconColor="warm">
          募集中の求人
          <span style={{ fontSize: "var(--text-xs)", color: "#D97706", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
            {company.job_count}件
          </span>
        </SecTitle>
        <Link
          href={`/companies/${company.id}/jobs`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 14px", borderRadius: 8,
            background: "#FEF3C7", color: "#92400E",
            border: "1px solid #FDE68A",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          すべての求人を検索（{company.job_count}件）
        </Link>
      </div>

      <div style={{ padding: "20px 24px 28px", background: "var(--bg-tint)" }}>
        {/* Categories */}
        {displayCats.map((cat, ci) => (
          <div key={cat.cat} style={{ marginBottom: ci < displayCats.length - 1 ? 20 : 0 }}>
            {/* Flat category header */}
            {detail.jobs.length > 1 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
                  {cat.cat}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                  color: "var(--ink-mute)", background: "var(--bg-tint)",
                  border: "1px solid var(--line)", padding: "1px 7px", borderRadius: 100,
                }}>
                  {cat.total}件
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line-soft)" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cat.displayItems.map((job, ji) => (
                <JobEmbedCard
                  key={job.id ?? `${ci}-${ji}`}
                  job={job}
                  catName={cat.cat}
                  companyHQ={companyHQ}
                />
              ))}
            </div>
          </div>
        ))}

        {/* ⚠️ ここにあった「N件すべての求人を見る」は 2026-08-08 に削除した。
               リンク先の /companies/[id]/jobs は 2026-07-01（ca81d23a）に
               「orphan page」として**ルートごと削除**されており、404 だった。
               このセクションの上に求人が全件並んでいるので、リンク先を作り直すより
               既にある導線に寄せる（記事CTA で /jobs?company= をやめたのと同じ判断）。
            ⚠️ 求人が増えて一覧が必要になったら、`/jobs?company=` を実装するのが筋。
               消えたルートを復活させると企業ページの求人セクションと内容が重複する。 */}
      </div>
    </section>
    </>
  );
}

function RecruitersSection({
  recruiters,
}: {
  recruiters: CompanyRecruiter[];
}) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        <SecTitle
          iconColor="green"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            </svg>
          }
        >
          採用担当者
        </SecTitle>
      </div>
      <div style={{ padding: "var(--space-6)" }}>
      <div className="employee-grid">
        {recruiters.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: 12,
              padding: "var(--space-4)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "#fff",
              alignItems: "center",
            }}
          >
            {/* アバター 48px circular */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                flexShrink: 0,
                background: r.avatar_color ?? AV_GRADIENTS[i % AV_GRADIENTS.length],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 16,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              {r.avatar_initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* 1行目: 名前 */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </div>
              {/* 2行目: 部門 › 職種 */}
              {(r.department || r.role_title) && (
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[r.department, r.role_title].filter(Boolean).join(" › ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--space-4)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--bg-tint)",
          borderRadius: 8,
          fontSize: "var(--text-xs)",
          color: "var(--ink-soft)",
          lineHeight: 1.7,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        カジュアル面談を申し込むと、上記担当者から連絡が届きます。
      </div>
      </div>
    </section>
  );
}

// ─── Company Posts Section ────────────────────────────────────────────────────

type PublicAmbassador = {
  id: string;
  user_id: string;
  role_title: string | null;
  ow_users: { name: string | null; avatar_color: string | null; avatar_url: string | null } | null;
};

type AmbassadorInfo = { memberId: string };

type CompanyPost = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  cover_image_url: string | null;
  published_at: string | null;
};

const POST_CATEGORY_LABEL: Record<string, string> = {
  culture: "カルチャー",
  product: "プロダクト",
  team: "チーム",
  event: "イベント",
  other: "その他",
};

function CompanyPostsSection({ posts }: { posts: CompanyPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section
      id="posts"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <SecTitle
          iconColor="purple"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          }
        >
          企業からの投稿
        </SecTitle>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "var(--purple)",
          background: "var(--purple-soft)", border: "1px solid #e9d5ff",
          padding: "2px 10px", borderRadius: 100, fontFamily: "Inter, sans-serif",
          flexShrink: 0,
        }}>
          {posts.length}件
        </span>
      </div>
      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((post) => {
          const catLabel = post.category ? (POST_CATEGORY_LABEL[post.category] ?? post.category) : null;
          const bodyPreview = post.body ? post.body.replace(/[#*`>\-]/g, "").trim().slice(0, 120) : null;
          return (
            <div key={post.id} style={{
              border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
              background: "#fff", display: "flex", flexDirection: "column", gap: 0,
            }}>
              {post.cover_image_url && (
                <div style={{ position: "relative", height: 160, background: "var(--bg-tint)", flexShrink: 0 }}>
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              )}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {catLabel && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 100,
                    background: "var(--purple-soft)", color: "var(--purple)",
                    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                    width: "fit-content",
                  }}>
                    {catLabel}
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.5, fontFamily: "var(--font-noto-serif)" }}>
                  {post.title}
                </h3>
                {bodyPreview && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                    {bodyPreview}
                    {post.body && post.body.length > 120 ? "…" : ""}
                  </p>
                )}
                {post.published_at && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                    {new Date(post.published_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Company Articles Section ─────────────────────────────────────────────────

function CompanyArticlesSection({ articles, company }: { articles: Article[]; company: Company }) {
  const displayed = articles.slice(0, 3);

  return (
    <section
      id="articles"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      {/* Section header */}
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <SecTitle
          iconColor="default"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
        >
          OPINIO 取材記事
        </SecTitle>
        {articles.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            padding: "2px 10px", borderRadius: 100, fontFamily: "Inter, sans-serif",
            flexShrink: 0,
          }}>
            {articles.length}件
          </span>
        )}
      </div>
      <div style={{ padding: "var(--space-6)" }}>
        {articles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-mute)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>まだ取材記事がありません</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>OPINIO編集部による取材記事が順次公開されます</div>
          </div>
        ) : (
          <>
            {articles.length === 1 ? (
              /* ── 1件の時: 左60%記事 + 右40% CTAパネル ── */
              (() => {
                const article = articles[0];
                const badge = TYPE_BADGE[article.type];
                const authorName = article.subject?.name ?? article.subjects?.[0]?.name;
                return (
                  <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
                    {/* 左: 記事カード (60%) */}
                    <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none", display: "block", flex: "0 0 60%", minWidth: 0 }}>
                      <div className="article-card" style={{
                        border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden",
                        background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s", height: "100%",
                      }}>
                        <div style={{
                          height: 140,
                          background: article.eyecatch_gradient,
                          display: "flex", flexDirection: "column", justifyContent: "flex-end",
                          padding: "12px 16px",
                          position: "relative",
                        }}>
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,15,60,0.50)" }} />
                          <div style={{ position: "absolute", top: 12, left: 14, zIndex: 1 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 100, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700 }}>
                              {badge.label}
                            </span>
                          </div>
                          <div style={{ position: "absolute", top: 12, right: 14, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif", fontWeight: 600, zIndex: 1 }}>
                            {article.read_min} min
                          </div>
                          <p style={{ position: "relative", zIndex: 1, margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 14, fontWeight: 800, lineHeight: 1.55, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.35)" }}>
                            {article.title}
                          </p>
                        </div>
                        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {authorName ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--royal-50)", border: "2px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                                {authorName.slice(0, 1)}
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{authorName}</span>
                            </div>
                          ) : <div />}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 7, background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            記事を読む
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                    {/* 右: もっと知るパネル (40%) */}
                    <div style={{ flex: "0 0 40%", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "Inter, sans-serif", marginBottom: 2 }}>
                        もっと知る
                      </div>
                      {[
                        { href: "#jobs", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>, label: "求人を見る", sub: `${company.job_count > 0 ? company.job_count + "件掲載中" : ""}` },
                        { href: `/companies/${company.id}/casual-meeting`, icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: "カジュアル面談", sub: "選考なし・無料" },
                        { href: "/articles", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, label: "他の取材記事", sub: "OPINIO記事一覧" },
                      ].map(({ href, icon, label, sub }) => (
                        <a key={label} href={href} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, background: "#fff", border: "1px solid var(--line)", transition: "border-color 0.15s, background 0.15s" }} className="article-side-cta">
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--royal)", flexShrink: 0 }}>
                            {icon}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
                            {sub && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 1 }}>{sub}</div>}
                          </div>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2.5} strokeLinecap="round" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── 2件以上: リスト表示 ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {displayed.map((article) => {
                  const badge = TYPE_BADGE[article.type];
                  const icon  = TYPE_EYECATCH_ICON[article.type];
                  return (
                    <Link key={article.slug} href={`/articles/${article.slug}`} style={{ textDecoration: "none" }}>
                      <div
                        style={{
                          border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
                          background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s",
                          display: "flex", flexDirection: "row", alignItems: "stretch",
                        }}
                        className="article-card"
                      >
                        <div style={{
                          width: 110, flexShrink: 0,
                          background: article.eyecatch_gradient,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative",
                        }}>
                          {/* Royal overlay */}
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,35,102,0.18)", mixBlendMode: "multiply" }} />
                          <span style={{ fontSize: 32, opacity: 0.3, position: "relative", zIndex: 1 }}>{icon}</span>
                          <div style={{ position: "absolute", bottom: 7, right: 7, fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Inter, sans-serif", fontWeight: 500, zIndex: 1 }}>
                            {article.read_min} min
                          </div>
                        </div>
                        <div style={{ padding: "12px 16px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 100, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0 }}>
                              {badge.label}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 13, fontWeight: 700, lineHeight: 1.6, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>
                            {article.title}
                          </p>
                          {(article.subject?.name ?? (article.subjects && article.subjects[0]?.name)) && (
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                              {article.subject?.name ?? article.subjects?.[0]?.name}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", paddingRight: 14, color: "var(--ink-mute)", flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            {articles.length > 1 && (
              <div style={{ marginTop: "var(--space-4)", textAlign: "right" }}>
                <Link href="/articles" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)",
                  textDecoration: "none", fontFamily: "Inter, sans-serif",
                }}>
                  記事一覧を見る ({articles.length}件)
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── MobileBottomCTA ── γ-7: モバイル固定底部バー (< 768px) ──────────────────
function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.accepting_casual_meetings === true;
  const hasJobs = company.job_count > 0;
  if (!hasMeeting && !hasJobs) return null;

  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 64, // モバイルボトムナビ（64px）の上に配置
        left: 0,
        right: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid var(--line)",
        padding: "10px 16px",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.06)",
      }}
    >
      {hasMeeting && (
        <Link
          href={`/companies/${company.id}/casual-meeting`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) 0",
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#fff",
            borderRadius: 8,
            fontSize: "var(--text-base)",
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            marginBottom: hasJobs ? "var(--space-2)" : 0,
            boxShadow: "0 3px 12px rgba(245,158,11,0.35)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#fff",
              flexShrink: 0,
              animation: "cta-pulse 1.8s ease-in-out infinite",
            }}
          />
          <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
        </Link>
      )}
      {hasJobs && (
        <a
          href="#jobs"
          style={{
            display: "block",
            padding: "10px 0",
            background: hasMeeting ? "transparent" : "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
            color: hasMeeting ? "var(--royal)" : "#fff",
            border: hasMeeting ? "1.5px solid var(--royal)" : "none",
            borderRadius: 8,
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: hasMeeting ? "none" : "0 3px 12px rgba(0,35,102,0.25)",
          }}
        >
          募集を見て応募する
        </a>
      )}
    </div>
  );
}

/*
  ⚠️ 2026-08-06 に currentEmployees / allEmployees を削除した。
     渡してはいたが使っていなかった。社員・OB/OG の表示は本文カラム側の
     EmployeeVoicesSection / CurrentEmployeesSection / AlumniSection が担当しており、
     そちらが本来の経路。サイドバーにも出そうとしてやめた名残だった。
*/
function Sidebar({
  company,
  detail,
  ambassadors = [],
}: {
  company: Company;
  detail: CompanyDetail;
  ambassadors?: PublicAmbassador[];
}) {
  return (
    <aside
      style={{
        position: "sticky",
        top: 132,
        alignSelf: "start",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
      className="hidden lg:flex"
    >
      {/* CTA card ── γ-2: 修正① CTA 優先順位逆転 */}
      {(() => {
        const hasMeeting = company.accepting_casual_meetings === true;
        const hasJobs = company.job_count > 0;
        return (
          <div
            style={{
              background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
              color: "#fff",
              padding: "var(--space-6)",
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                opacity: 0.72,
                marginBottom: 6,
                letterSpacing: "0.06em",
              }}
            >
              {company.name}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "var(--text-md)",
                fontWeight: 500,
                marginBottom: "var(--space-4)",
                lineHeight: 1.55,
              }}
            >
              {hasMeeting
                ? "対話から、はじめよう。"
                : hasJobs
                  ? `${company.job_count}件の求人を、見てみませんか？`
                  : "現在、受付中の募集・面談はありません"}
            </div>

            {/* ── case 1 & 2: accepting_casual_meetings = true ── */}
            {hasMeeting && (
              <>
                {/* 1st (Primary): 話を聞く（カジュアル面談） */}
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    width: "100%",
                    padding: "14px 0",
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "#fff",
                    borderRadius: 8,
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                    boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
                    boxSizing: "border-box",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#fff",
                      flexShrink: 0,
                      animation: "cta-pulse 1.8s ease-in-out infinite",
                    }}
                  />
                  <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
                </Link>
                {/* 補足テキスト: Primary ボタン直下、Primary 表示時のみ */}
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                    margin: "8px 0",
                    color: "#fff",
                    opacity: 0.75,
                    lineHeight: 1.4,
                  }}
                >
                  人事担当者が直接対応します
                </p>
                {/* 2nd (Secondary): 募集を見て応募する — job_count > 0 の時のみ */}
                {hasJobs && (
                  <a
                    href="#jobs"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 4,
                      padding: "9px 0",
                      background: "rgba(255,255,255,0.08)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 8,
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    募集を見て応募する
                  </a>
                )}
              </>
            )}

            {/* ── case 3: accepting_casual_meetings = false, job_count > 0 ── */}
            {!hasMeeting && hasJobs && (
              <a
                href="#jobs"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 0",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: 8,
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                募集を見て応募する
              </a>
            )}

            {/* ── case 4: accepting_casual_meetings = false, job_count = 0 ── */}
            {!hasMeeting && !hasJobs && (
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  textAlign: "center",
                  opacity: 0.68,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                現在募集中の情報がありません
              </p>
            )}
          </div>
        );
      })()}

      {/* カジュアル面談OKウィジェット */}
      {ambassadors.length > 0 && (
        <div style={{
          background: "#fff",
          border: "1px solid #FCD34D",
          borderRadius: 14,
          padding: "16px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
            💬 カジュアル面談OK
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
            {ambassadors.slice(0, 5).map((amb, i) => {
              const name = amb.ow_users?.name ?? "";
              const avatarUrl = amb.ow_users?.avatar_url ?? null;
              const avatarColor = amb.ow_users?.avatar_color ?? null;
              return (
                <a key={amb.id} href={`/u/${amb.user_id}`}
                  style={{ display: "block", marginLeft: i === 0 ? 0 : -8, position: "relative", zIndex: 5 - i, flexShrink: 0 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }} />
                  ) : (
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: avatarColor || "linear-gradient(135deg,var(--royal),#3B5FD9)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff", border: "2px solid #fff",
                    }}>
                      {name.charAt(0)}
                    </div>
                  )}
                </a>
              );
            })}
            <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
              {ambassadors.length}名が対応可能
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
            選考なし・完全無料。この会社のことを直接聞けます。<br />転職意欲がなくてもOK。
          </div>
          <a href={`#current-employees`} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "9px 0", borderRadius: 8,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            background: "var(--warm)", color: "#fff",
            boxSizing: "border-box",
          }}>
            カジュアル面談を申し込む →
          </a>
        </div>
      )}

      {/* 申し込みの流れ — コンパクト1行表示 */}
      {company.accepting_casual_meetings === true && (
        <div
          style={{
            background: "var(--bg-tint)",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <p style={{
            margin: 0,
            fontSize: 12, fontWeight: 500,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}>
            💬 気軽に話すだけでOK。選考なし・完全無料。
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: 12, fontWeight: 500,
            color: "var(--ink-mute)",
            lineHeight: 1.5,
          }}>
            フォーム1分 → 担当者から連絡 → 日程調整 → 面談（約30分）
          </p>
        </div>
      )}

      {/* Company Info */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "var(--space-6)",
          boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "#334155",
            marginBottom: "var(--space-3)",
            fontFamily: "var(--font-noto-sans)",
          }}
        >
          企業情報
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* ジャンルチップ: 登録済み企業のみ表示、未登録は行ごと非表示 */}
          {company.genres.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "76px 1fr",
                gap: "var(--space-2)",
                fontSize: "var(--text-sm)",
                alignItems: "flex-start",
                padding: "var(--space-2) 0",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 3 }}>ジャンル</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {company.genres.map((g) => (
                  <span
                    key={g.id}
                    style={{
                      padding: "var(--space-1) var(--space-3)",
                      borderRadius: 14,
                      fontSize: "var(--text-xs)",
                      background: "var(--bg-tint)",
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      fontWeight: 500,
                    }}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(
            [
              { key: "業界", value: company.industry, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              ...(detail.capitalType ? [{ key: "資本区分", value: CAPITAL_TYPE_LABELS[detail.capitalType] ?? detail.capitalType, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg> }] : []),
              ...(detail.parentCompanyName ? [{ key: "本社", value: detail.parentCompanyName + (detail.parentCompanyCountry ? `（${detail.parentCompanyCountry}）` : ""), subText: detail.capitalNotes ?? undefined, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> }] : []),
              { key: "従業員数", value: formatEmployeeCount(company.employee_count) ?? "", icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              ...(detail.globalEmployeeCount ? [{ key: "従業員数（世界）", value: formatEmployeeCount(detail.globalEmployeeCount), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
              { key: "所在地", value: detail.hq, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              ...(detail.branchLocations?.length ? [{ key: "拠点", value: detail.branchLocations.join("・"), icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> }] : []),
              ...(detail.remoteWorkStatus ? [{ key: "リモート状況", value: ({ full_remote: "フルリモート", hybrid: "ハイブリッド", on_site: "フル出社", other: "その他" } as Record<string, string>)[detail.remoteWorkStatus] ?? detail.remoteWorkStatus, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> }] : []),
              ...(detail.nearestStation ? [{ key: "最寄り駅", value: detail.nearestStation, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M9 4v16"/><path d="M15 4v16"/></svg> }] : []),
              { key: "設立", value: detail.established, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { key: "代表者", value: detail.ceo, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> }] : []),
            ] as { key: string; value: string; icon: React.ReactNode; isLink?: boolean; subText?: string }[]
          )
            .filter((item) => item.value)
            .map(({ key, value, icon, isLink, subText }) => (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  alignItems: "flex-start",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <span style={{ color: "var(--ink-soft)", fontSize: "var(--text-xs)", fontWeight: 600, paddingTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                  {icon}{key}
                </span>
                {isLink ? (
                  <a
                    href={value.startsWith("http") ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--royal)",
                      textDecoration: "underline",
                      fontWeight: 500,
                      wordBreak: "break-all",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    {value} →
                  </a>
                ) : (
                  <div>
                    <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: "var(--text-sm)" }}>{value}</span>
                    {subText && <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6 }}>{subText}</p>}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  /* ⚠️ 認証はここで読まない（2026-08-09）。読むとルートが動的化して
        `export const revalidate = 60` が効かなくなる。
        閲覧者ごとに変わるもの（社員一覧・ブックマーク・フォロー）は
        すべてクライアント側の専用APIに移してある。
        ⚠️ ここに `createClient()` や `auth.getUser()` を足さないこと。 */
  const adminSupabase = createAdminClient();

  const companyResult = await getCompanyBySlugOrIdCached(params.id);

  if (!companyResult) return notFound();

  const { company, detail, employeeCategories, resolvedId, slug: companySlug } = companyResult;

  // UUID が渡されてスラッグがある場合は 308 リダイレクト
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
  if (isUUID && companySlug) {
    permanentRedirect(`/companies/${companySlug}`);
  }

  // Phase 2: 残りのデータを companyId（UUID）で並列取得
  const companyId = resolvedId;

  const [photos, recruiters, companyArticles, employees, companyPosts, ambassadorsResult, companyTools,
         articleIdRowsResult] = await Promise.all([
    getCompanyPhotosCached(companyId),
    getCompanyRecruitersCached(companyId),
    /* ⚠️ ここから4本は 2026-08-09 にキャッシュ版へ差し替えた。
          このページは認証を読むためルート単位では毎回再レンダリングされるが、
          企業単位の公開データは閲覧者によって変わらないのでキャッシュしてよい。
          反映の遅れはページの `export const revalidate = 60` と同じ契約。 */
    getArticlesByCompanyCached(companyId),
    getCompanyEmployeesCached(companyId),
    getCompanyStoriesCached(companyId) as Promise<CompanyPost[]>,
    getPublicAmbassadorsCached(companyId),
    getCompanyToolsCached(companyId),
    /* ⚠️ 記事IDは companyId しか要らないのでここに相乗りさせる。
          閲覧者の ow_users はもう引かない（認証を読まないため）。 */
    adminSupabase.from("ow_articles").select("id").eq("company_id", companyId),
  ]);

  const ambassadors = (ambassadorsResult as unknown as PublicAmbassador[]);

  // userId → ambassador情報のマップ（EmployeeCardの面談OKバッジ用）
  const ambassadorMap = new Map<string, AmbassadorInfo>();
  for (const a of ambassadors) {
    ambassadorMap.set(a.user_id, { memberId: a.id });
  }

  /* ⚠️ 社員一覧の出し分けはここでは行わない（2026-08-09）。
        絞り込みは /api/jobseeker/companies/[id]/employees が
        閲覧者のセッションで行う。ここで employees を触らないこと。 */

  /* ⚠️ 閲覧者と企業の関係（在籍者かどうか）の判定はここから外した（2026-08-09）。
        閲覧者ごとに変わるためサーバーで引くとページが動的化する。
        判定は /api/jobseeker/companies/[id]/employees に移してある。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。 */

  // フィード投稿 (会社ID + 求人ID OR + 記事ID OR)
  type ActivityPost = {
    id: string;
    post_type: string;
    content: string;
    created_at: string;
    ref_job_id: string | null;
    ref_article_id: string | null;
    ref_company_id: string | null;
    ow_jobs: { id: string; title: string } | null;
    ow_articles: { id: string; slug: string; title: string } | null;
  };

  const companyJobIds = detail.jobs.flatMap((c) => c.items.map((j) => j.id));

  /* ⚠️ 旧 Phase 3（閲覧者の ow_users ＋ 記事ID）は Phase 2 に統合した（2026-08-09）。
        どちらも Phase 1 の結果しか要らず、独立した待ちを1段作る理由が無かった。 */
  const companyArticleIds = ((articleIdRowsResult.data ?? []) as { id: string }[]).map((r) => r.id);

  const orParts: string[] = [`ref_company_id.eq.${companyId}`];
  if (companyJobIds.length > 0) orParts.push(`ref_job_id.in.(${companyJobIds.join(",")})`);
  if (companyArticleIds.length > 0) orParts.push(`ref_article_id.in.(${companyArticleIds.join(",")})`);

  /* ⚠️ ブックマークとフォローの取得はここから外した（2026-08-09）。
        閲覧者ごとに変わる値なのでサーバーで引くとページを動的化させる。
        `/api/jobseeker/companies/[id]/viewer-state` からクライアントが取る。
        ⚠️ ここに閲覧者依存の問い合わせを足さないこと。 */
  const activityPostsRaw = await adminSupabase
    // ⚠️ 読みは ow_posts_visible。参照先が消えた投稿（ref_* が NULL）を落とすビュー。
    .from("ow_posts_visible")
    .select("id, post_type, content, created_at, ref_job_id, ref_article_id, ref_company_id, ow_jobs!ref_job_id(id, title), ow_articles!ref_article_id(id, slug, title)")
    .or(orParts.join(","))
    .neq("post_type", "company_joined")
    .order("created_at", { ascending: false })
    .limit(50);

  const activityPosts = ((activityPostsRaw.data ?? []) as unknown as ActivityPost[]);

  // Group posts by (YYYY-MM-DD, post_type) for 更新情報 display
  type ActivityGroup = { date: string; dateLabel: string; post_type: string; posts: ActivityPost[] };
  const allActivityGroups: ActivityGroup[] = (() => {
    const map = new Map<string, ActivityPost[]>();
    for (const post of activityPosts) {
      const dateKey = post.created_at.slice(0, 10);
      const key = `${dateKey}__${post.post_type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    const groups: ActivityGroup[] = Array.from(map.entries()).map(([key, posts]) => {
      const dateKey = key.split("__")[0];
      const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
      return { date: dateKey, dateLabel, post_type: posts[0].post_type, posts };
    });
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  })();
  const activityGroups = allActivityGroups.slice(0, 5);
  const hasMoreActivity = allActivityGroups.length > 5;

  return (
    <>
      <ReadingProgress />
      <BackToTop />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: company.name,
            description: company.tagline ?? undefined,
            url: `https://opinio.jp/companies/${companySlug ?? companyId}`,
            numberOfEmployees: company.employee_count > 0 ? {
              "@type": "QuantitativeValue",
              value: company.employee_count,
            } : undefined,
          }),
        }}
      />
      <RecentlyViewedTracker id={companySlug ?? companyId} name={company.name} logoUrl={company.logo_url ?? null} logoLetter={company.logo_letter ?? undefined} />
      <Breadcrumb items={[{ label: "OPINIO", href: "/" }, { label: "企業", href: "/companies" }, { label: company.name }]} />
      <Hero company={company} detail={detail} recruiters={recruiters} coverPhotoUrl={photos[0]?.image_url ?? null} />

      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <CompanyStickyNav items={[
          { id: "about", label: "企業概要" },
          ...((detail.main_products?.length || detail.customer_cases?.length || detail.main_customers?.length) ? [{ id: "products-clients", label: "事業" }] : []),
          ...(company.job_count > 0 ? [{ id: "jobs", label: "求人" }] : []),
          ...(detail.benefits?.length || (detail.orgTeams && detail.orgTeams.length > 0) || companyTools.length > 0 ? [{ id: "benefits", label: "働く環境" }] : []),
          /* ⚠️ 在籍者が1人でもいればタブを出す。閲覧者ごとの可視件数はサーバーでは
                分からない（絞り込みはクライアント側のAPIが行うため）。
                未ログインには中身が空になりうるが、タブは案内なので許容する。 */
          ...(employees.current.length > 0 || employees.alumni.length > 0 ? [{ id: "current-employees", label: "社員・OB/OG" }] : []),
          ...(companyPosts.length > 0 || companyArticles.length > 0 || activityPosts.length > 0 ? [{ id: "articles", label: "記事・更新情報" }] : []),
        ]} />
        <div
          style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_320px]"
        >
          {/* γ-7: モバイルで fixed bottom bar 分の余白を確保 */}
          <main className="pb-36 md:pb-0">
            {/* 1. 企業概要 */}
            <AboutSection
              detail={detail}
              photos={photos}
            />

            {/* 2. 製品・導入事例 */}
            <ProductsClientsSection detail={detail} />


            {/* 3. 求人 → 給与データ */}
            <JobsSection company={company} detail={detail} />

            {/* 4. 働く環境（benefits → org-teams） */}
            <BenefitsSection detail={detail} />

            {/* Mid-page CTA after Benefits */}
            {company.accepting_casual_meetings && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "14px 20px", borderRadius: 12, marginBottom: "var(--space-6)",
                background: "linear-gradient(135deg,#FEF3C7 0%,#FDE68A 100%)",
                border: "1px solid #FCD34D",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", lineHeight: 1.5 }}>
                    働く環境を読んだら、次は実際の声を聞いてみませんか？
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#B45309", marginTop: 2 }}>選考なし・完全無料のカジュアル面談</div>
                </div>
                <Link href={`/companies/${company.id}/casual-meeting`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff",
                  textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
                }}>
                  話を聞く →
                </Link>
              </div>
            )}

            <OrgTeamsSectionClient detail={detail} companyId={company.id} jobCount={company.job_count} />

            <ToolsSection tools={companyTools} />

            {/* 5. 社員・OB/OG（voices → current-employees → alumni）
                ⚠️ 閲覧者によって出し分けるためクライアント側で取る（2026-08-09）。
                   ここでサーバーから渡すと `auth.getUser()` が要り、
                   ページが動的化して `revalidate = 60` が効かなくなる。
                   絞り込みは /api/jobseeker/companies/[id]/employees が行う。 */}
            <CompanyEmployeeSections
              companyId={company.id}
              companyName={company.name}
              categories={employeeCategories}
              ambassadorMap={ambassadorMap}
            />

            {/* 6. 記事・更新情報（posts → articles → activity） */}
            <CompanyPostsSection posts={companyPosts} />
            <CompanyArticlesSection articles={companyArticles} company={company} />

            {/* ── 更新情報 ── */}
            {activityGroups.length > 0 && (
              <div id="activity" style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", marginBottom: "var(--space-6)", border: "1px solid var(--line)" }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
                    ACTIVITY
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
                    更新情報
                  </h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activityGroups.map((group, idx) => {
                    const isLast = idx === activityGroups.length - 1;
                    const { dateLabel, post_type, posts } = group;
                    const isAggregated = posts.length > 1;
                    const icon = post_type === "job_posted" ? "💼"
                      : post_type === "article_published" ? "📝"
                      : "💬";

                    let text: string;
                    let href: string | null;
                    if (isAggregated) {
                      if (post_type === "job_posted") {
                        text = `求人を ${posts.length} 件追加しました`;
                        href = "#jobs";
                      } else if (post_type === "article_published") {
                        text = `記事を ${posts.length} 件公開しました`;
                        href = "#articles";
                      } else {
                        text = `投稿を ${posts.length} 件しました`;
                        href = null;
                      }
                    } else {
                      const post = posts[0];
                      if (post_type === "job_posted") {
                        const title = post.ow_jobs?.title;
                        text = title ? `求人「${title}」の募集を開始しました` : post.content;
                        href = post.ref_job_id ? `/jobs/${post.ref_job_id}` : "#jobs";
                      } else if (post_type === "article_published") {
                        const title = post.ow_articles?.title;
                        text = title ? `記事「${title}」を公開しました` : post.content;
                        href = post.ow_articles?.slug ? `/articles/${post.ow_articles.slug}` : "#articles";
                      } else {
                        text = post.content;
                        href = null;
                      }
                    }

                    return (
                      <div key={`${group.date}__${post_type}`} style={{
                        display: "flex", gap: 14, paddingBottom: isLast ? 0 : 16,
                        marginBottom: isLast ? 0 : 16,
                        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
                        alignItems: "flex-start",
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", background: "var(--bg-tint)",
                          border: "1px solid var(--line)", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 16, flexShrink: 0,
                        }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 3, fontFamily: "Inter, sans-serif" }}>{dateLabel}</div>
                          {href ? (
                            <Link href={href} style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600, textDecoration: "none", lineHeight: 1.5, display: "block" }}
                              className="hover:underline">
                              {text}
                            </Link>
                          ) : (
                            <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600, lineHeight: 1.5 }}>{text}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMoreActivity && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)", textAlign: "center" }}>
                    <Link href="/feed" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                      フィードをすべて見る →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── ページ末尾CTA ── */}
            {company.accepting_casual_meetings && (
              <div style={{
                background: "#fff",
                borderRadius: 18,
                padding: "28px 32px",
                marginBottom: "var(--space-6)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                border: "2px solid #FDE68A",
                boxShadow: "0 4px 24px rgba(245,158,11,0.12)",
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#B45309", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>
                    NEXT STEP
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)", lineHeight: 1.4 }}>
                    気になったら、気軽に話してみませんか？
                  </h3>
                  <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                    選考なし・完全無料。転職意欲がなくても大丈夫です。
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {company.job_count > 0 && (
                    <a
                      href="#jobs"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#fff",
                        textDecoration: "none",
                        boxShadow: "0 3px 12px rgba(245,158,11,0.35)",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                      求人を見る ({company.job_count}件)
                    </a>
                  )}
                  <Link
                    href={`/companies/${company.id}/casual-meeting`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "12px 22px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                      background: "transparent", color: "var(--royal)",
                      border: "1.5px solid var(--royal)",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--royal)", animation: "cta-pulse 1.8s ease-in-out infinite", flexShrink: 0, display: "inline-block" }} />
                    <span>話を聞く<span style={{ whiteSpace: "nowrap" }}>（カジュアル面談）</span></span>
                  </Link>
                </div>
              </div>
            )}

            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}


          </main>

          <Sidebar company={company} detail={detail} ambassadors={ambassadors} />
        </div>
      </div>

      {/* γ-7: モバイル固定底部バー (< 768px) */}
      <MobileBottomCTA company={company} />

    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompanyById,
  getCompanyPhotos,
  getCompanyRecruiters,
  getArticlesByCompany,
  getCompanyEmployees,
} from "@/lib/supabase/queries";
import type { CompanyPhoto, CompanyRecruiter, CompanyEmployee, CompanyEmployeeCategoryItem } from "@/lib/supabase/queries";
import type { Article } from "@/app/articles/mockArticleData";
import { TYPE_BADGE, TYPE_EYECATCH_ICON } from "@/app/articles/mockArticleData";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail, CompanyNumbers } from "@/app/companies/[id]/mockDetailData";
import BookmarkButton from "./CompanyDetailClient";
import EvaluationText from "./EvaluationText";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/jobseeker/PostCard";
import type { Database } from "@/lib/supabase/types";
import { resolveAvatarColor } from "@/lib/jobCategoryColors";
import { JOB_GROUPING_THRESHOLD } from "@/lib/constants";

type ExternalLink = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const result = await getCompanyById(params.id);
  if (!result) return { title: "企業が見つかりません" };
  const { company } = result;
  return {
    title: `${company.name} — 企業情報 | Opinio`,
    description: company.tagline,
    openGraph: {
      title: `${company.name} | Opinio`,
      description: company.tagline,
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Breadcrumb({ company }: { company: Company }) {
  return (
    <nav
      style={{
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--line)",
        fontSize: 12,
        color: "var(--ink-mute)",
      }}
    >
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 py-3 md:px-12"
      >
        <Link href="/" style={{ color: "var(--ink-mute)" }}>
          Opinio
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/companies" style={{ color: "var(--ink-mute)" }}>
          企業を知る
        </Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--ink-soft)" }}>{company.name}</span>
      </div>
    </nav>
  );
}

function Hero({
  company,
  detail,
  initialBookmarked,
  isAuthenticated,
}: {
  company: Company;
  detail: CompanyDetail;
  initialBookmarked: boolean;
  isAuthenticated: boolean;
}) {
  const initial = company.name.charAt(0).toUpperCase();
  const freshLabel = formatUpdated(company.updated_days_ago);
  const isFresh = company.updated_days_ago <= 30;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
        className="px-5 py-8 md:px-12"
      >
        <div
          style={{
            display: "flex",
            gap: 32,
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          {/* Left: logo + info */}
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 16,
                flexShrink: 0,
                background: company.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 36,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              {initial}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                {company.industry}
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-noto-serif)',
                  fontWeight: 700,
                  fontSize: "clamp(22px,2.5vw,30px)",
                  color: "var(--ink)",
                  marginBottom: 6,
                  letterSpacing: "0.01em",
                }}
              >
                {company.name}
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--ink-soft)",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {company.tagline}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* バッジ1: 従業員 */}
                <span
                  style={{
                    padding: "5px 11px",
                    background: "var(--bg-tint)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {company.employee_count > 0
                    ? `従業員 ${company.employee_count.toLocaleString()}名`
                    : "従業員 —"}
                </span>
                {/* バッジ2: 創業 */}
                {(() => {
                  const year = parseInt(detail.established);
                  const age = !isNaN(year) ? new Date().getFullYear() - year : null;
                  return (
                    <span
                      style={{
                        padding: "5px 11px",
                        background: "var(--bg-tint)",
                        color: "var(--ink-soft)",
                        border: "1px solid var(--line)",
                        borderRadius: 100,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {age !== null ? `創業 ${age}年` : "創業 —"}
                    </span>
                  );
                })()}
                {/* バッジ3: 採用中 */}
                {company.job_count > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 11px",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      border: "1px solid #A7F3D0",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--success)",
                        boxShadow: "0 0 6px rgba(5,150,105,0.6)",
                      }}
                    />
                    採用中 {company.job_count}件
                  </span>
                )}
                {/* バッジ4: 更新日 */}
                {isFresh && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 11px",
                      background: "var(--bg-tint)",
                      color: "var(--ink-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--ink-soft)",
                      }}
                    />
                    {freshLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: bookmark */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignSelf: "flex-start" }}>
            <BookmarkButton
              companyName={company.name}
              companyId={company.id}
              initialBookmarked={initialBookmarked}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            paddingTop: 24,
            marginTop: 24,
            borderTop: "1px solid var(--line-soft)",
          }}
          className="[grid-template-columns:repeat(2,1fr)] sm:[grid-template-columns:repeat(4,1fr)]"
        >
          {[
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              ),
              label: "社員数",
              value: company.employee_count.toLocaleString(),
              unit: "名",
              sub: "直近公表値",
            },
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                </svg>
              ),
              label: "事業ステージ",
              value: company.phase ?? "—",
              unit: "",
              sub: "直近公表値",
              isText: true,
            },
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              ),
              label: "設立",
              value: detail.established,
              unit: "",
              sub: "",
              isText: true,
            },
            {
              icon: (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              ),
              label: "募集中の求人",
              value: String(company.job_count),
              unit: "件",
              sub: "現在公開中",
            },
          ].map(({ icon, label, value, unit, sub, isText }) => (
            <div key={label} style={{ padding: "6px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: "var(--royal)" }}>{icon}</span>
                {label}
              </div>
              <div
                style={{
                  fontFamily: isText ? undefined : "Inter, sans-serif",
                  fontSize: isText ? 16 : 22,
                  fontWeight: 700,
                  color: "var(--ink)",
                  lineHeight: 1.2,
                  marginBottom: 4,
                }}
              >
                {value}
                {unit && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      fontWeight: 500,
                      marginLeft: 2,
                    }}
                  >
                    {unit}
                  </span>
                )}
              </div>
              {sub && (
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>{sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TabsBar({ company }: { company: Company }) {
  const tabs = [
    { label: "概要", href: "#about" },
    {
      label: `求人${company.job_count > 0 ? ` ${company.job_count}件` : ""}`,
      href: "#jobs",
    },
    { label: "働き方", href: "#work-style" },
    { label: "特徴", href: "#opinion" },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        top: 64,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto", overflowX: "auto" }}
        className="px-5 md:px-12"
      >
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                padding: "14px 18px",
                background: "none",
                border: "none",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink-mute)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                borderBottom: "2px solid transparent",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function SecTitle({
  icon,
  children,
  iconColor = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  iconColor?: "default" | "green" | "purple" | "warm";
}) {
  const iconBg: Record<string, string> = {
    default: "var(--royal-50)",
    green: "var(--success-soft,#ECFDF5)",
    purple: "var(--purple-soft,#F3E8FF)",
    warm: "var(--warm-soft,#FEF3C7)",
  };
  const iconFg: Record<string, string> = {
    default: "var(--royal)",
    green: "var(--success)",
    purple: "var(--purple)",
    warm: "#B45309",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: 'var(--font-noto-serif)',
        fontWeight: 500,
        fontSize: 20,
        color: "var(--ink)",
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: iconBg[iconColor],
          color: iconFg[iconColor],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
  "linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)",
  "linear-gradient(135deg, #059669 0%, #047857 100%)",
];

function PhotoGallery({
  company,
  photos,
}: {
  company: Company;
  photos: CompanyPhoto[];
}) {
  if (photos.length === 0) {
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 10,
            height: 240,
            marginBottom: 10,
          }}
          className="[grid-template-columns:1fr] sm:[grid-template-columns:2fr_1fr] [height:auto]"
        >
          <div
            style={{
              borderRadius: 12,
              background: company.gradient,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 160,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                background: "rgba(255,255,255,0.95)",
                color: "var(--ink)",
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 100,
                letterSpacing: "0.05em",
              }}
            >
              Opinio編集部 撮影
            </span>
            <div
              style={{
                color: "rgba(255,255,255,0.95)",
                fontFamily: 'var(--font-noto-serif)',
                fontWeight: 500,
                fontStyle: "italic",
                fontSize: 20,
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              Working at {company.name}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "12px 16px",
                background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: "0 0 12px 12px",
              }}
            >
              メインオフィス
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
            {PLACEHOLDER_GRADIENTS.slice(1).map((bg, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 12,
                  background: bg,
                  position: "relative",
                  minHeight: 80,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "rgba(255,255,255,0.95)",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 100,
                  }}
                >
                  {i === 0 ? "OFFICE" : "EVENT"}
                </span>
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: "8px 12px",
                    background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)",
                    color: "#fff",
                    fontSize: 11,
                    borderRadius: "0 0 12px 12px",
                  }}
                >
                  {i === 0 ? "エントランス" : "全社イベントスペース"}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 20,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          Opinio編集部 訪問取材時に撮影
        </div>
      </>
    );
  }

  // Real photos: first large (2fr), up to 2 more in right column
  const [main, ...rest] = photos;
  const rightPhotos = rest.slice(0, 2);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: rightPhotos.length > 0 ? "2fr 1fr" : "1fr",
        gap: 10,
        marginBottom: 20,
      }}
      className="[grid-template-columns:1fr] sm:[grid-template-columns:2fr_1fr]"
    >
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          minHeight: 180,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={main.photo_url}
          alt={main.category ?? "オフィス写真"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 200 }}
        />
        {main.category && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "rgba(255,255,255,0.95)",
              color: "var(--ink)",
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 100,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {main.category}
          </span>
        )}
      </div>
      {rightPhotos.length > 0 && (
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 10 }}>
          {rightPhotos.map((photo) => (
            <div
              key={photo.id}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                minHeight: 80,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.photo_url}
                alt={photo.category ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 80 }}
              />
              {photo.category && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "rgba(255,255,255,0.95)",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 100,
                    textTransform: "uppercase",
                  }}
                >
                  {photo.category}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function AboutSection({
  company,
  detail,
  photos,
}: {
  company: Company;
  detail: CompanyDetail;
  photos: CompanyPhoto[];
}) {
  return (
    <section
      id="about"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 20 }}>
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

      {detail.mission && (
        <div
          style={{
            padding: 24,
            background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
            border: "1px solid var(--royal-100)",
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--accent)",
              marginBottom: 10,
            }}
          >
            MISSION
          </div>
          <div
            style={{
              fontFamily: 'var(--font-noto-serif)',
              fontSize: 22,
              fontWeight: 500,
              color: "var(--royal)",
              lineHeight: 1.5,
              letterSpacing: "0.02em",
            }}
          >
            {detail.mission}
          </div>
        </div>
      )}

      <PhotoGallery company={company} photos={photos} />

      {detail.about && (
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9 }}>
          {detail.about}
        </p>
      )}
    </section>
  );
}

// ─── OpinioOpinionCard ── γ-6 修正⑤: 編集部の見立てカード（ヒーロー直下） ────

/** company_features[0] から最大 150 字の要約テキストを抽出する */
function getSummaryText(opinionFit: string[] | null | undefined): string | null {
  if (!opinionFit || opinionFit.length === 0) return null;
  const first = opinionFit[0];
  if (!first) return null;
  return first.length > 150 ? first.slice(0, 150) + "…" : first;
}

function OpinioOpinionCard({ detail }: { detail: CompanyDetail }) {
  const summary = getSummaryText(detail.company_features);
  // 未登録企業（company_features 空）はカード自体を非表示
  if (!summary) return null;

  return (
    <div
      className="px-4 py-3 sm:px-[26px] sm:py-[22px]"
      style={{
        background: "#042C53",
        borderRadius: 16,
        marginBottom: 20,
      }}
    >
      {/* バッジ */}
      <div style={{ marginBottom: 14 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "0.1em",
            color: "#B5D4F4",
            background: "rgba(181,212,244,0.12)",
            border: "1px solid rgba(181,212,244,0.25)",
            borderRadius: 100,
            padding: "3px 10px",
          }}
        >
          {/* 編集ペンアイコン */}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          編集部取材
        </span>
      </div>

      {/* 引用テキスト（イタリック体・白文字） */}
      <p
        style={{
          margin: "0 0 18px",
          fontSize: 14,
          fontStyle: "italic",
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.8,
          fontFamily: "var(--font-noto-serif)",
        }}
      >
        「{summary}」
      </p>

      {/* 「全文を読む →」ボタン (γ-7: タップ領域 minHeight 44px) */}
      <a
        href="#opinion"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          minHeight: 44,
          padding: "8px 16px",
          background: "rgba(255,255,255,0.08)",
          color: "#B5D4F4",
          border: "1px solid rgba(181,212,244,0.28)",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        全文を読む →
      </a>
    </div>
  );
}

function CompanyFeaturesSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  if (!detail.company_features.length) return null;

  return (
    <section
      id="opinion"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          }
        >
          特徴
        </SecTitle>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            fontWeight: 600,
          }}
        >
          編集部取材
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {detail.company_features.map((item, i) => (
          <div
            key={i}
            style={{
              background: "var(--line-soft)",
              borderRadius: 8,
              padding: 14,
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--ink)",
            }}
          >
            {item}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "14px 18px",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)", display: "block", fontSize: 14, marginBottom: 2 }}>
            この見解、実際のところどうなのか。
          </strong>
          {company.name}で働いていた/いる先輩に、カジュアルに話を聞けます。
        </div>
        <Link
          href="/mentors"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            background: "var(--royal)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          先輩に相談する →
        </Link>
      </div>
    </section>
  );
}

// ─── Benefits Section ─────────────────────────────────────────────────────────

function BenefitsSection({ detail }: { detail: CompanyDetail }) {
  const SUBHEADER_STYLE: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--ink-mute)",
    marginBottom: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  };
  const UNSET_STYLE: React.CSSProperties = {
    fontSize: 13,
    color: "var(--ink-mute)",
    margin: 0,
  };

  return (
    <section
      id="benefits"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        >
          福利厚生・評価制度
        </SecTitle>
      </div>

      {/* ── 福利厚生 ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={SUBHEADER_STYLE}>Benefits</div>
        {detail.benefits && detail.benefits.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {detail.benefits.map((b) => (
              <span
                key={b}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 14px",
                  background: "var(--royal-50)",
                  border: "1px solid var(--royal-100)",
                  borderRadius: 100,
                  fontSize: 13,
                  color: "var(--royal)",
                  fontWeight: 500,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        ) : (
          <p style={UNSET_STYLE}>—</p>
        )}
      </div>

      {/* ── 評価制度 ── */}
      <div>
        <div style={SUBHEADER_STYLE}>Evaluation</div>
        {detail.evaluationSystem ? (
          <EvaluationText text={detail.evaluationSystem} />
        ) : (
          <p style={UNSET_STYLE}>—</p>
        )}
      </div>
    </section>
  );
}

function WorkStyleSection({ detail }: { detail: CompanyDetail }) {
  return (
    <section
      id="work-style"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <SecTitle
          iconColor="warm"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 4v4M16 4v4" />
            </svg>
          }
        >
          働き方の選択肢
        </SecTitle>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}
        className="[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]"
      >
        <div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Remote / Location
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_location.map(({ label, note }, i) => (
              <div key={i}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {label}
                </span>
                {note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 6,
                      paddingLeft: 14,
                    }}
                  >
                    {note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Work Style
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {detail.work_style.map(({ label, note }, i) => (
              <div key={i}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {label}
                </span>
                {note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      marginTop: 6,
                      paddingLeft: 14,
                    }}
                  >
                    {note}
                  </div>
                )}
              </div>
            ))}

            {/* work_time_system — 常時表示、null は「未設定」(Commit BB) */}
            <div>
              {detail.workTimeSystem ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    background: "var(--success-soft,#ECFDF5)",
                    border: "1px solid #A7F3D0",
                    borderRadius: 100,
                    fontSize: 13,
                    color: "var(--success)",
                    fontWeight: 600,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {detail.workTimeSystem}
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    padding: "8px 14px",
                    background: "var(--bg-tint)",
                    border: "1px solid var(--line)",
                    borderRadius: 100,
                    fontSize: 12,
                    color: "var(--ink-mute)",
                  }}
                >
                  勤務時間制度: —
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* workstyle_description — 常時表示、null は「未設定」(Commit BB) */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-mute)",
            marginBottom: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Working Style Note
        </div>
        {detail.workstyleDescription ? (
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, margin: 0 }}>
            {detail.workstyleDescription}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>—</p>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--ink-soft)",
          marginTop: 16,
          padding: "12px 14px",
          background: "var(--bg-tint)",
          borderRadius: 8,
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          lineHeight: 1.7,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          実際のリモート頻度や残業時間は部署・職種によって異なります。
          <strong style={{ color: "var(--royal)" }}>「先輩への相談」</strong>
          で、あなたが受ける可能性のあるポジションの実態をご確認ください。
        </div>
      </div>
    </section>
  );
}

// ─── Employee Sections ────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  showEndedAt,
}: {
  employee: CompanyEmployee;
  showEndedAt?: boolean;
}) {
  // γ-3 修正②: 職種カテゴリ（親カテゴリ優先）でアバター色を統一
  const avatarColor = resolveAvatarColor(employee.roleParentId, employee.roleCategoryId);

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        textDecoration: "none",
      }}
    >
      {/* Avatar — γ-3: 職種カテゴリ色 + rounded-md (6px) */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: avatarColor.bg,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 700,
          fontSize: 19,
          color: avatarColor.text,
        }}
      >
        {employee.avatarInitial}
      </div>

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
              whiteSpace: "nowrap",
            }}
          >
            {employee.name}
          </span>
          {employee.isMentor && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--purple)",
                background: "var(--purple-soft)",
                border: "1px solid #DDD6FE",
                borderRadius: 100,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}
            >
              メンター
            </span>
          )}
        </div>
        {employee.roleTitle && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--ink-soft)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {employee.roleTitle}
          </p>
        )}
        {showEndedAt && employee.endedAt && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--ink-mute)",
              marginTop: 2,
            }}
          >
            退職: {employee.endedAt}
          </p>
        )}
      </div>
    </a>
  );
}

const EMPLOYEE_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 10,
};

// ─── CompanyPostsSection ─────────────────────────────────────────────────────

function CompanyPostsSection({
  companyId,
  posts,
  postsCount,
}: {
  companyId: string;
  posts: ExternalLink[];
  postsCount: number;
}) {
  return (
    <section
      id="posts"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      {/* セクションタイトル */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          この企業の発信
        </h2>
        {postsCount > 5 && (
          <Link
            href={`/companies/${companyId}/posts`}
            style={{
              fontSize: 13,
              color: "var(--royal)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            すべて見る ({postsCount} 件) →
          </Link>
        )}
      </div>

      {/* PostCard 一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {/* もっと見るボタン (5 件超かつ小画面向け、リンクはセクションタイトルと同じ先) */}
      {postsCount > 5 && (
        <Link
          href={`/companies/${companyId}/posts`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 16,
            padding: "10px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            color: "var(--royal)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            transition: "background 0.15s",
          }}
          className="company-posts-more-link"
        >
          発信をすべて見る ({postsCount} 件) →
        </Link>
      )}
    </section>
  );
}

function CurrentEmployeesSection({
  employees,
  categories,
}: {
  employees: CompanyEmployee[];
  categories: CompanyEmployeeCategoryItem[];
}) {
  // ── カテゴリ別社員マップ (roleId → employees) ──────────────────────────────
  const empsByCategory = new Map<string, CompanyEmployee[]>();
  for (const emp of employees) {
    if (!emp.roleCategoryId) continue;
    if (!empsByCategory.has(emp.roleCategoryId)) empsByCategory.set(emp.roleCategoryId, []);
    empsByCategory.get(emp.roleCategoryId)!.push(emp);
  }

  // ── 親グループ化 (display_order 順を保持) ─────────────────────────────────
  type Group = {
    groupKey: string;
    parentName: string;
    isParentDirect: boolean; // parent_id が null = 親直カテゴリ
    children: CompanyEmployeeCategoryItem[];
  };
  const groups: Group[] = [];
  const groupMap = new Map<string, Group>();
  for (const cat of categories) {
    const groupKey = cat.parentId ?? cat.roleId;
    if (!groupMap.has(groupKey)) {
      const g: Group = {
        groupKey,
        parentName: cat.parentId ? (cat.parentName ?? cat.roleName) : cat.roleName,
        isParentDirect: !cat.parentId,
        children: [],
      };
      groups.push(g);
      groupMap.set(groupKey, g);
    }
    groupMap.get(groupKey)!.children.push(cat);
  }

  // カテゴリ未割り当て社員 (roleCategoryId が null の場合)
  const uncategorized = employees.filter((e) => !e.roleCategoryId);

  const SECTION_ICON = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  return (
    <section
      id="current-employees"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <SecTitle icon={SECTION_ICON}>
          現役社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: 8,
            }}
          >
            ({employees.length}名)
          </span>
        </SecTitle>
      </div>

      {employees.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8, margin: 0 }}>
          公開準備中 — Opinio で取材した社員プロフィールが順次公開されます
        </p>
      ) : categories.length === 0 ? (
        // カテゴリ設定なし → フラット 5 列
        <div style={EMPLOYEE_GRID_STYLE}>
          {employees.map((emp) => (
            <EmployeeCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        // カテゴリ設定あり → 階層表示
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groups.map((group) => {
            const totalInGroup = group.children.reduce(
              (sum, cat) => sum + (empsByCategory.get(cat.roleId)?.length ?? 0),
              0
            );
            if (totalInGroup === 0) return null; // 0 名カテゴリは非表示

            return (
              <div key={group.groupKey}>
                {/* 親カテゴリ見出し */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {group.parentName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                    }}
                  >
                    {totalInGroup}名
                  </span>
                </div>

                {group.isParentDirect ? (
                  // 親直: 子見出しなしでグリッドを直接表示
                  <div style={EMPLOYEE_GRID_STYLE}>
                    {(empsByCategory.get(group.children[0].roleId) ?? []).map((emp) => (
                      <EmployeeCard key={emp.userId} employee={emp} />
                    ))}
                  </div>
                ) : (
                  // 子カテゴリあり: 子見出し + グリッド
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {group.children.map((cat) => {
                      const empsInCat = empsByCategory.get(cat.roleId) ?? [];
                      if (empsInCat.length === 0) return null;
                      return (
                        <div key={cat.roleId}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 5,
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--ink-soft)",
                              }}
                            >
                              {cat.roleName}
                            </span>
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: 11,
                                fontWeight: 400,
                                color: "var(--ink-mute)",
                              }}
                            >
                              {empsInCat.length}名
                            </span>
                          </div>
                          <div style={EMPLOYEE_GRID_STYLE}>
                            {empsInCat.map((emp) => (
                              <EmployeeCard key={emp.userId} employee={emp} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* カテゴリ未割り当て社員 */}
          {uncategorized.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                その他
              </div>
              <div style={EMPLOYEE_GRID_STYLE}>
                {uncategorized.map((emp) => (
                  <EmployeeCard key={emp.userId} employee={emp} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── AlumniCard ── γ-5 修正④: OBOG 専用ダーク背景カード ────────────────────

function AlumniCard({ employee }: { employee: CompanyEmployee }) {
  // "2022-11" → "2022.11" フォーマット変換
  const formattedEndedAt = employee.endedAt
    ? employee.endedAt.replace(/-/g, ".")
    : null;

  return (
    <a
      href={`/u/${employee.userId}`}
      className="employee-card-link"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "#042C53",
        border: "1px solid rgba(181,212,244,0.18)",
        borderRadius: 12,
        textDecoration: "none",
      }}
    >
      {/* アバター: 固定「卒」・薄ブルー背景 (γ-7: モバイル 40px / sm+ 48px) */}
      <div
        className="w-10 h-10 sm:w-12 sm:h-12"
        style={{
          borderRadius: 6,
          background: "#B5D4F4",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 700,
          fontSize: 19,
          color: "#042C53",
        }}
      >
        卒
      </div>

      {/* 情報エリア */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* 名前 + ALUMNI バッジ */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            {employee.name}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.1em",
              color: "#B5D4F4",
              background: "rgba(181,212,244,0.14)",
              border: "1px solid rgba(181,212,244,0.28)",
              borderRadius: 100,
              padding: "1px 7px",
              whiteSpace: "nowrap",
            }}
          >
            ALUMNI
          </span>
        </div>

        {/* 役職 */}
        {employee.roleTitle && (
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 12,
              color: "#B5D4F4",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {employee.roleTitle}
          </p>
        )}

        {/* 退職時期 */}
        {formattedEndedAt && (
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 11,
              color: "rgba(181,212,244,0.55)",
            }}
          >
            退職: {formattedEndedAt}
          </p>
        )}
      </div>
    </a>
  );
}

function AlumniSection({ alumni }: { alumni: CompanyEmployee[] }) {
  return (
    <section
      id="alumni"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        >
          OB・OG社員
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--ink-mute)",
              marginLeft: 8,
            }}
          >
            ({alumni.length}名)
          </span>
        </SecTitle>
      </div>

      {alumni.length > 0 ? (
        <div style={EMPLOYEE_GRID_STYLE} className="[grid-template-columns:1fr] sm:[grid-template-columns:repeat(2,1fr)]">
          {alumni.map((emp) => (
            // γ-5: EmployeeCard → AlumniCard に差し替え
            <AlumniCard key={emp.userId} employee={emp} />
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-mute)",
            lineHeight: 1.8,
            margin: 0,
          }}
        >
          OB・OG情報は順次更新されます
        </p>
      )}
    </section>
  );
}

function JobsSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  // ── 0 件 ────────────────────────────────────────────────────────────────────
  if (detail.jobs.length === 0) {
    return (
      <section
        id="jobs"
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 20,
        }}
      >
        <SecTitle
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
          }
        >
          募集中の求人
        </SecTitle>
        <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-mute)", textAlign: "center", padding: "32px 0" }}>
          現在、公開中の求人はありません。
        </p>
      </section>
    );
  }

  // γ-4 修正③: 求人合計件数で表示モードを切り替え
  const totalJobs = detail.jobs.reduce((sum, cat) => sum + cat.total, 0);

  // 求人カード内の職種カラーバッジ (γ-4 修正②連携)
  function JobCatBadge({ catName, catId }: { catName: string; catId?: string }) {
    const color = resolveAvatarColor(catId ?? null, null);
    return (
      <span
        style={{
          display: "inline-block",
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 4,
          background: color.bg,
          color: color.text,
          fontWeight: 600,
        }}
      >
        {catName}
      </span>
    );
  }

  // 求人カード共通コンポーネント
  function JobCard({
    job,
    catName,
    catId,
    index,
  }: {
    job: { id?: string; title: string; salary: string; is_new?: boolean };
    catName: string;
    catId?: string;
    index: number;
  }) {
    return (
      <Link
        key={job.id ?? index}
        href={job.id ? `/jobs/${job.id}` : `/jobs?company=${company.id}`}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 16,
          padding: "14px 18px",
          border: "1px solid var(--line)",
          borderRadius: 10,
          cursor: "pointer",
          background: "#fff",
          textDecoration: "none",
          alignItems: "center",
        }}
        className="job-item-link"
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>
            {job.title}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {job.is_new && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--success-soft,#ECFDF5)",
                  color: "var(--success)",
                  fontWeight: 700,
                  border: "1px solid #A7F3D0",
                }}
              >
                新着
              </span>
            )}
            <JobCatBadge catName={catName} catId={catId} />
          </div>
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--royal)",
            flexShrink: 0,
            textAlign: "right",
          }}
        >
          {job.salary}
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    );
  }

  const sectionIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );

  return (
    <section
      id="jobs"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      {/* セクションヘッダー */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <SecTitle icon={sectionIcon}>
          募集中の求人
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            · {company.job_count}件
          </span>
        </SecTitle>
        <a href="#jobs" style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500 }}>
          すべて見る →
        </a>
      </div>

      {totalJobs < JOB_GROUPING_THRESHOLD ? (
        // ── 1〜3 件: カテゴリヘッダーなし、直接リスト (γ-4 修正③) ──────────
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {detail.jobs.flatMap((cat, ci) =>
            cat.items.map((job, ji) => (
              <JobCard
                key={job.id ?? `${ci}-${ji}`}
                job={job}
                catName={cat.cat}
                catId={cat.catId}
                index={ji}
              />
            ))
          )}
        </div>
      ) : (
        // ── 4 件以上: カテゴリグルーピング表示 (既存構造を維持) ────────────
        <>
          {detail.jobs.map((cat) => (
            <div key={cat.cat} style={{ marginBottom: 28 }}>
              {/* カテゴリヘッダー (既存スタイル維持) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  padding: "10px 16px",
                  background: "var(--royal-50)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--royal)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  {cat.cat}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      color: "var(--royal)",
                      background: "#fff",
                      padding: "2px 10px",
                      borderRadius: 100,
                      fontWeight: 700,
                    }}
                  >
                    {cat.total}件
                  </span>
                </div>
                {cat.total > 4 && (
                  <Link
                    href={cat.catId ? `/jobs?company=${company.id}&category=${cat.catId}` : `/jobs?company=${company.id}`}
                    style={{ fontSize: 12, color: "var(--royal)", fontWeight: 500, textDecoration: "none" }}
                  >
                    すべて見る →
                  </Link>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cat.items.slice(0, 4).map((job, i) => (
                  <JobCard key={job.id ?? i} job={job} catName={cat.cat} catId={cat.catId} index={i} />
                ))}
              </div>
            </div>
          ))}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <a
              href="#jobs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 24px",
                background: "#fff",
                color: "var(--royal)",
                border: "1.5px solid var(--royal)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {company.job_count}件すべての求人を見る →
            </a>
          </div>
        </>
      )}
    </section>
  );
}

const AV_GRADIENTS = [
  "linear-gradient(135deg, #002366, #3B5FD9)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #34D399, #059669)",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #818CF8, #6366F1)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #22D3EE, #0891B2)",
];

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
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 20 }}>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 10,
        }}
      >
        {recruiters.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: 10,
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "#fff",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                flexShrink: 0,
                background: r.avatar_color ?? AV_GRADIENTS[i % AV_GRADIENTS.length],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 19,
              }}
            >
              {r.avatar_initial}
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  marginBottom: 2,
                }}
              >
                {r.name}
              </div>
              {r.role_title && (
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2 }}>
                  {r.role_title}
                </div>
              )}
              {r.department && (
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {r.department}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "12px 14px",
          background: "var(--bg-tint)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--ink-soft)",
          lineHeight: 1.7,
        }}
      >
        カジュアル面談を申し込むと、上記担当者から連絡が届きます。
      </div>
    </section>
  );
}

// ─── Company Articles Section ─────────────────────────────────────────────────

function CompanyArticlesSection({ articles }: { articles: Article[] }) {
  const displayed = articles.slice(0, 3);

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 20,
      }}
    >
      <div style={{ marginBottom: 20 }}>
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
          Opinio 取材記事
        </SecTitle>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {displayed.map((article) => {
          const badge = TYPE_BADGE[article.type];
          const icon  = TYPE_EYECATCH_ICON[article.type];
          return (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                className="article-card"
              >
                {/* Eyecatch */}
                <div
                  style={{
                    height: 100,
                    background: article.eyecatch_gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 36, opacity: 0.3 }}>{icon}</span>
                  <div
                    style={{
                      position: "absolute", top: 8, left: 10,
                      display: "inline-flex", alignItems: "center",
                      padding: "3px 8px", borderRadius: 100,
                      background: badge.bg, color: badge.color,
                      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em",
                    }}
                  >
                    {badge.label}
                  </div>
                  <div
                    style={{
                      position: "absolute", bottom: 7, right: 10,
                      fontSize: 9, color: "rgba(255,255,255,0.8)",
                      fontFamily: "Inter, sans-serif", fontWeight: 500,
                    }}
                  >
                    {article.read_min} min read
                  </div>
                </div>

                {/* Title */}
                <div style={{ padding: "12px 14px", flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-noto-serif)',
                      fontSize: 12, fontWeight: 700, lineHeight: 1.6,
                      color: "var(--ink)",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties}
                  >
                    {article.title}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {articles.length > 0 && (
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Link
            href="/articles"
            style={{
              fontSize: 12, color: "var(--accent)", textDecoration: "none",
              fontFamily: "Inter, sans-serif", fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            記事一覧を見る
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── Numbers Section ──────────────────────────────────────────────────────────

const NUMBER_ITEMS: {
  label: string;
  key: keyof CompanyNumbers;
  format: (v: string | number) => string;
}[] = [
  { label: "平均年収", key: "avgSalary", format: (v) => String(v) },
  { label: "平均年齢", key: "avgAge", format: (v) => `${v} 歳` },
  { label: "有給取得率", key: "paidLeaveRate", format: (v) => `${v}%` },
  { label: "月間残業時間", key: "avgOvertimeHours", format: (v) => String(v) },
  { label: "男女比", key: "genderRatio", format: (v) => String(v) },
  { label: "累計調達額", key: "fundingTotal", format: (v) => String(v) },
];

function NumbersSection({ numbers }: { numbers: CompanyNumbers }) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid var(--line)",
        padding: "28px 32px 32px",
        marginBottom: 24,
      }}
    >
      {/* Section title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--royal)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
          <path d="M7 8h2v5H7zM11 6h2v7h-2zM15 10h2v3h-2z"/>
        </svg>
        <span
          style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: 17,
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "0.01em",
          }}
        >
          数値で見る企業
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            marginLeft: 4,
            fontFamily: "Inter, sans-serif",
          }}
        >
          企業アンケート回答
        </span>
      </div>

      {/* 3-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
        className="sm:grid-cols-3 grid-cols-2"
      >
        {NUMBER_ITEMS.map(({ label, key, format }) => {
          const raw = numbers[key];
          const hasValue = raw !== null && raw !== undefined && String(raw).trim() !== "";
          const display = hasValue ? format(raw as string | number) : "—";

          return (
            <div
              key={key}
              style={{
                background: hasValue ? "var(--bg-tint)" : "#fafafa",
                border: `1px solid ${hasValue ? "var(--line)" : "#efefef"}`,
                borderRadius: 10,
                padding: "14px 16px 16px",
                minHeight: 80,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: hasValue ? "var(--ink-soft)" : "var(--ink-mute)",
                }}
              >
                {label}
              </span>
              {/* Value */}
              <span
                style={{
                  fontSize: hasValue ? 18 : 14,
                  fontWeight: hasValue ? 700 : 400,
                  fontFamily: hasValue ? "Inter, 'Noto Sans JP', sans-serif" : "'Noto Sans JP', sans-serif",
                  color: hasValue ? "var(--ink)" : "var(--ink-mute)",
                  lineHeight: 1.25,
                }}
              >
                {display}
              </span>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p
        style={{
          marginTop: 14,
          fontSize: 11,
          color: "var(--ink-mute)",
          lineHeight: 1.6,
        }}
      >
        企業が自己申告した値です。実態は求人ページ・カジュアル面談でご確認ください。
        「—」は企業が情報を公開していない項目です。
      </p>
    </section>
  );
}

// ─── MobileBottomCTA ── γ-7: モバイル固定底部バー (< 768px) ──────────────────
function MobileBottomCTA({ company }: { company: Company }) {
  const hasMeeting = company.accepting_casual_meetings;
  const hasJobs = company.job_count > 0;
  if (!hasMeeting && !hasJobs) return null;

  return (
    <div
      className="md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
        padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
      }}
    >
      {hasMeeting && (
        <Link
          href={`/companies/${company.id}/casual-meeting`}
          style={{
            display: "block",
            padding: "12px 0",
            background: "#fff",
            color: "var(--royal)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
            marginBottom: hasJobs ? 8 : 0,
          }}
        >
          話を聞く（カジュアル面談）
        </Link>
      )}
      {hasJobs && (
        <a
          href="#jobs"
          style={{
            display: "block",
            padding: "10px 0",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          求人を見て応募する
        </a>
      )}
    </div>
  );
}

function Sidebar({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  return (
    <aside
      style={{
        position: "sticky",
        top: 132,
        alignSelf: "start",
        flexDirection: "column",
        gap: 16,
      }}
      className="hidden lg:flex"
    >
      {/* CTA card ── γ-2: 修正① CTA 優先順位逆転 */}
      {(() => {
        const hasMeeting = company.accepting_casual_meetings;
        const hasJobs = company.job_count > 0;
        return (
          <div
            style={{
              background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
              color: "#fff",
              padding: 22,
              borderRadius: 16,
              boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
            }}
          >
            {/* Eyebrow */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.72,
                marginBottom: 6,
                letterSpacing: "0.08em",
              }}
            >
              {company.name}
            </div>

            {/* Heading */}
            <div
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: 17,
                fontWeight: 500,
                marginBottom: 16,
                lineHeight: 1.55,
              }}
            >
              {hasMeeting
                ? "まず、話を聞いてみませんか？"
                : hasJobs
                  ? `${company.job_count}件の求人を、見てみませんか？`
                  : "現在、受付中の求人・面談はありません"}
            </div>

            {/* ── case 1 & 2: accepting_casual_meetings = true ── */}
            {hasMeeting && (
              <>
                {/* 1st (Primary): 話を聞く（カジュアル面談） */}
                <Link
                  href={`/companies/${company.id}/casual-meeting`}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "13px 0",
                    background: "#fff",
                    color: "var(--royal)",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  話を聞く（カジュアル面談）
                </Link>
                {/* 補足テキスト: Primary ボタン直下、Primary 表示時のみ */}
                <p
                  style={{
                    fontSize: 11,
                    textAlign: "center",
                    margin: "8px 0",
                    opacity: 0.68,
                    lineHeight: 1.4,
                  }}
                >
                  人事担当者が直接対応します
                </p>
                {/* 2nd (Secondary): 求人を見て応募する — job_count > 0 の時のみ */}
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
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    求人を見て応募する
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
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                求人を見て応募する
              </a>
            )}

            {/* ── case 4: accepting_casual_meetings = false, job_count = 0 ── */}
            {!hasMeeting && !hasJobs && (
              <p
                style={{
                  fontSize: 12,
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

      {/* Company Info */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 22,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--ink-mute)",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          Company Info
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(
            [
              { key: "業界", value: company.industry },
              { key: "事業ステージ", value: company.phase },
              { key: "従業員数", value: company.employee_count ? `${company.employee_count.toLocaleString()}名` : "" },
              { key: "所在地", value: detail.hq },
              // nearest_station: 常時表示、null は "未設定" (isUnset フラグ)
              { key: "最寄り駅", value: detail.nearestStation ?? "—", isUnset: !detail.nearestStation },
              { key: "設立", value: detail.established },
              { key: "代表者", value: detail.ceo },
              ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true }] : []),
            ] as { key: string; value: string; isLink?: boolean; isUnset?: boolean }[]
          )
            .filter((item) => item.isUnset || (item.value && item.value !== "—"))
            .map(({ key, value, isLink, isUnset }) => (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "85px 1fr",
                  gap: 12,
                  fontSize: 13,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{key}</span>
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
                    }}
                  >
                    {value} →
                  </a>
                ) : isUnset ? (
                  <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>{value}</span>
                ) : (
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{value}</span>
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
  const supabase = createClient();

  const [companyResult, photos, recruiters, companyArticles, employees, authResult, postsResult, postsCountResult] = await Promise.all([
    getCompanyById(params.id),
    getCompanyPhotos(params.id),
    getCompanyRecruiters(params.id),
    getArticlesByCompany(params.id),
    getCompanyEmployees(params.id),
    supabase.auth.getUser(),
    // 企業発信リンク (公開中、最新 5 件)
    supabase
      .from("ow_company_external_links")
      .select("*")
      .eq("company_id", params.id)
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    // 全件数 (もっと見るボタン用)
    supabase
      .from("ow_company_external_links")
      .select("*", { count: "exact", head: true })
      .eq("company_id", params.id)
      .eq("is_published", true),
  ]);

  const posts: ExternalLink[] = postsResult.data ?? [];
  const postsCount: number = postsCountResult.count ?? 0;

  if (!companyResult) return notFound();

  const { company, detail, employeeCategories } = companyResult;

  // Resolve ow_users.id and check existing bookmark
  let initialBookmarked = false;
  const isAuthenticated = !!authResult.data.user;
  if (isAuthenticated) {
    const { data: owUser } = await supabase
      .from("ow_users")
      .select("id")
      .eq("auth_id", authResult.data.user!.id)
      .maybeSingle();
    if (owUser) {
      const { data: bmark } = await supabase
        .from("ow_bookmarks")
        .select("id")
        .eq("user_id", owUser.id)
        .eq("target_type", "company")
        .eq("target_id", params.id)
        .maybeSingle();
      initialBookmarked = !!bmark;
    }
  }

  return (
    <>
      <Breadcrumb company={company} />
      <Hero company={company} detail={detail} initialBookmarked={initialBookmarked} isAuthenticated={isAuthenticated} />
      <TabsBar company={company} />

      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <div
          style={{ maxWidth: "var(--max-w-wide)", margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"
        >
          {/* γ-7: モバイルで fixed bottom bar 分の余白を確保 */}
          <main className="pb-28 md:pb-0">
            {/* γ-6 修正⑤: 編集部の見立てカード（TabsBar 直下、AboutSection 直前） */}
            <OpinioOpinionCard detail={detail} />
            <AboutSection company={company} detail={detail} photos={photos} />
            <CompanyFeaturesSection company={company} detail={detail} />
            <NumbersSection numbers={detail.numbers} />
            <WorkStyleSection detail={detail} />
            <BenefitsSection detail={detail} />
            {posts.length > 0 && (
              <CompanyPostsSection
                companyId={params.id}
                posts={posts}
                postsCount={postsCount}
              />
            )}
            <CurrentEmployeesSection employees={employees.current} categories={employeeCategories} />
            <AlumniSection alumni={employees.alumni} />
            <JobsSection company={company} detail={detail} />
            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}
            {companyArticles.length > 0 && (
              <CompanyArticlesSection articles={companyArticles} />
            )}
          </main>

          <Sidebar company={company} detail={detail} />
        </div>
      </div>

      {/* γ-7: モバイル固定底部バー (< 768px) */}
      <MobileBottomCTA company={company} />

      <style>{`
        .job-item-link:hover {
          border-color: var(--royal) !important;
          background: var(--royal-50) !important;
        }
        .employee-card-link:hover {
          border-color: var(--royal-100) !important;
          background: #fff !important;
        }
        .post-card-link:hover {
          border-color: var(--royal) !important;
        }
        .company-posts-more-link:hover {
          background: var(--royal-50) !important;
        }
      `}</style>
    </>
  );
}

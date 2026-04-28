import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompanyById,
  getCompanyPhotos,
  getCompanyRecruiters,
} from "@/lib/supabase/queries";
import type { CompanyPhoto, CompanyRecruiter } from "@/lib/supabase/queries";
import type { Company } from "@/app/companies/mockCompanies";
import { formatUpdated } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import BookmarkButton from "./CompanyDetailClient";
import { createClient } from "@/lib/supabase/server";

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
        style={{ maxWidth: 1400, margin: "0 auto" }}
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
  const isFresh = company.updated_days_ago <= 7;

  return (
    <section style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div
        style={{ maxWidth: 1400, margin: "0 auto" }}
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
                  fontFamily: '"Noto Serif JP", serif',
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
                {isFresh && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 11px",
                      background: "var(--royal-50)",
                      color: "var(--royal)",
                      border: "1px solid var(--royal-100)",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {freshLabel}
                  </span>
                )}
                {company.accepting_casual_meetings && (
                  <span
                    style={{
                      padding: "5px 11px",
                      background: "var(--success-soft)",
                      color: "var(--success)",
                      border: "1px solid #A7F3D0",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    カジュアル面談歓迎
                  </span>
                )}
                {company.phase && (
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
                    {company.phase}
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
    { label: "Opinioの見解", href: "#opinion" },
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
        style={{ maxWidth: 1400, margin: "0 auto", overflowX: "auto" }}
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
        fontFamily: '"Noto Serif JP", serif',
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
                fontFamily: '"Noto Serif JP", serif',
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
              fontFamily: '"Noto Serif JP", serif',
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

function OpinionSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
  if (!detail.opinion_fit.length && !detail.opinion_care.length) return null;

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
          Opinioの見解
        </SecTitle>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "var(--ink-mute)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {detail.opinion_date}
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        className="[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]"
      >
        {detail.opinion_fit.length > 0 && (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background: "var(--success-soft,#ECFDF5)",
              border: "1px solid #A7F3D0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--success)",
                marginBottom: 14,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              フィットしやすい点
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {detail.opinion_fit.map((item, i) => (
                <li
                  key={i}
                  style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {detail.opinion_care.length > 0 && (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background: "var(--warm-soft,#FEF3C7)",
              border: "1px solid #FDE68A",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: "#B45309",
                marginBottom: 14,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 9v4M12 17h.01" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              注意したい点
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {detail.opinion_care.map((item, i) => (
                <li
                  key={i}
                  style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth={3} style={{ flexShrink: 0, marginTop: 3 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
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
          </div>
        </div>
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

function JobsSection({
  company,
  detail,
}: {
  company: Company;
  detail: CompanyDetail;
}) {
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
        <p
          style={{
            marginTop: 20,
            fontSize: 14,
            color: "var(--ink-mute)",
            textAlign: "center",
            padding: "32px 0",
          }}
        >
          現在、公開中の求人はありません。
        </p>
      </section>
    );
  }

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
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
          }
        >
          募集中の求人
          <span
            style={{
              fontSize: 12,
              color: "var(--royal)",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
            }}
          >
            · {company.job_count}件
          </span>
        </SecTitle>
        <Link
          href={`/jobs?company=${company.id}`}
          style={{ color: "var(--royal)", fontSize: 13, fontWeight: 500 }}
        >
          すべて見る →
        </Link>
      </div>

      {detail.jobs.map((cat) => (
        <div key={cat.cat} style={{ marginBottom: 28 }}>
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
                color: "var(--royal)",
              }}
            >
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
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((job, i) => (
              <Link
                key={i}
                href={`/jobs?company=${company.id}`}
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
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    {job.title}
                  </div>
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
            ))}
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <Link
          href={`/jobs?company=${company.id}`}
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
        </Link>
      </div>
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
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {recruiters.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              gap: 14,
              padding: 16,
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "#fff",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
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
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
      className="hidden lg:flex"
    >
      {/* CTA card */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)",
          color: "#fff",
          padding: 22,
          borderRadius: 16,
          boxShadow: "0 12px 32px rgba(0,35,102,0.2)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            opacity: 0.8,
            marginBottom: 4,
            letterSpacing: "0.08em",
          }}
        >
          {company.name}へ、一歩
        </div>
        <div
          style={{
            fontFamily: '"Noto Serif JP", serif',
            fontSize: 18,
            fontWeight: 500,
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          {company.job_count > 0
            ? `${company.job_count}件の求人を、`
            : "企業情報を、"}
          <br />
          見てみませんか？
        </div>
        <Link
          href={`/jobs?company=${company.id}`}
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            background: "#fff",
            color: "var(--royal)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
            textDecoration: "none",
          }}
        >
          求人を見る →
        </Link>
        {company.accepting_casual_meetings && (
          <Link
            href={`/companies/${company.id}/casual-meeting`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 10,
              padding: 10,
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            面談を申し込む
          </Link>
        )}
      </div>

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
              { key: "所在地", value: detail.hq },
              { key: "設立", value: detail.established },
              { key: "代表者", value: detail.ceo },
              ...(detail.url ? [{ key: "公式サイト", value: detail.url, isLink: true }] : []),
            ] as { key: string; value: string; isLink?: boolean }[]
          )
            .filter((item) => item.value && item.value !== "—")
            .map(({ key, value, isLink }) => (
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

  const [companyResult, photos, recruiters, authResult] = await Promise.all([
    getCompanyById(params.id),
    getCompanyPhotos(params.id),
    getCompanyRecruiters(params.id),
    supabase.auth.getUser(),
  ]);

  if (!companyResult) return notFound();

  const { company, detail } = companyResult;

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
          style={{ maxWidth: 1400, margin: "0 auto" }}
          className="px-5 md:px-12 py-7 grid gap-7 [grid-template-columns:1fr] lg:[grid-template-columns:1fr_320px]"
        >
          <main>
            <AboutSection company={company} detail={detail} photos={photos} />
            <OpinionSection company={company} detail={detail} />
            <WorkStyleSection detail={detail} />
            <JobsSection company={company} detail={detail} />
            {recruiters.length > 0 && (
              <RecruitersSection recruiters={recruiters} />
            )}
          </main>

          <Sidebar company={company} detail={detail} />
        </div>
      </div>

      <style>{`
        .job-item-link:hover {
          border-color: var(--royal) !important;
          background: var(--royal-50) !important;
        }
      `}</style>
    </>
  );
}

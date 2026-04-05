"use client";

import Link from "next/link";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────

type MatchJob = {
  id: string;
  title: string;
  company_name: string;
  company_logo_url: string | null;
  company_url: string | null;
  salary_min: number | null;
  salary_max: number | null;
  match_percent: number;
  match_reason: string;
  tags: string[];
};

type CompanyLogo = {
  name: string;
  logo_url: string | null;
  url: string | null;
};

// ─── Logo helpers ─────────────────────────────────────

const LOGO_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F97316",
  "#EC4899", "#14B8A6", "#6366F1", "#F43F5E",
];

function getLogoColor(name: string): string {
  return LOGO_COLORS[name.charCodeAt(0) % LOGO_COLORS.length];
}

function SmallLogo({
  name,
  logoUrl,
  companyUrl,
  size = 36,
}: {
  name: string;
  logoUrl: string | null;
  companyUrl: string | null;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  let clearbit: string | null = null;
  if (companyUrl) {
    try {
      clearbit = `https://logo.clearbit.com/${new URL(companyUrl).hostname}`;
    } catch {}
  }
  const src = logoUrl || clearbit;
  const color = getLogoColor(name);

  if (err || !src) {
    return (
      <div
        className="flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: color,
          fontSize: size * 0.38,
        }}
      >
        {name[0]}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      className="object-cover flex-shrink-0"
      style={{ width: size, height: size, borderRadius: 10, border: "0.5px solid #e5e7eb" }}
    />
  );
}

// ─── Match Card ───────────────────────────────────────

function MatchCard({ job }: { job: MatchJob }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block bg-white rounded-xl p-4 transition-all hover:shadow-sm"
      style={{ border: "0.5px solid #e5e7eb" }}
    >
      {/* Top row: logo + title + salary */}
      <div className="flex items-start gap-3 mb-3">
        <SmallLogo
          name={job.company_name}
          logoUrl={job.company_logo_url}
          companyUrl={job.company_url}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-semibold text-gray-800 leading-tight line-clamp-1">
            {job.title}
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">{job.company_name}</p>
        </div>
        {job.salary_min && job.salary_max && (
          <span className="text-[11px] text-gray-500 font-medium flex-shrink-0 pt-0.5">
            {job.salary_min}〜{job.salary_max}万
          </span>
        )}
      </div>

      {/* Match bar */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 h-[4px] bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${job.match_percent}%`, background: "#1D9E75" }}
          />
        </div>
        <span className="text-[12px] font-bold" style={{ color: "#1D9E75" }}>
          {job.match_percent}%
        </span>
      </div>

      {/* Match reason */}
      <p
        className="text-[11px] leading-relaxed px-3 py-2 mb-2.5"
        style={{ background: "#E1F5EE", borderRadius: 7, color: "#0F6E56" }}
      >
        {job.match_reason}
      </p>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.tags.map((t, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "#f5f5f4", color: "#78716c" }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ─── Ticker Logo ──────────────────────────────────────

function TickerLogo({ company }: { company: CompanyLogo }) {
  const [err, setErr] = useState(false);
  let clearbit: string | null = null;
  if (company.url) {
    try {
      clearbit = `https://logo.clearbit.com/${new URL(company.url).hostname}`;
    } catch {}
  }
  const src = company.logo_url || clearbit;

  if (err || !src) {
    return (
      <div
        className="flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: getLogoColor(company.name),
          fontSize: 16,
        }}
      >
        {company.name[0]}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={company.name}
      onError={() => setErr(true)}
      className="object-cover flex-shrink-0"
      style={{ width: 40, height: 40, borderRadius: 10, border: "0.5px solid #e5e7eb" }}
    />
  );
}

// ─── Main Component ───────────────────────────────────

export default function HeroSection({
  matchJobs,
  companyLogos,
  isLoggedIn,
}: {
  matchJobs: MatchJob[];
  companyLogos: CompanyLogo[];
  isLoggedIn: boolean;
}) {
  // Stats data
  const stats = [
    { value: "128", unit: "社", label: "掲載企業" },
    { value: "200", unit: "名+", label: "登録求職者" },
    { value: "0", unit: "件", label: "早期離職" },
    { value: "120", unit: "社+", label: "クライアント" },
  ];

  // Duplicate logos for infinite loop
  const tickerLogos = [...companyLogos, ...companyLogos];

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="bg-white">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-stretch min-h-[480px]">

            {/* ── Left Column ── */}
            <div className="flex-1 flex flex-col justify-center py-16 pr-12">
              {/* Title — Mincho */}
              <h1 className="mb-6">
                <span
                  className="block text-[32px] md:text-[40px] leading-tight text-gray-800"
                  style={{ fontFamily: "'Noto Serif JP', 'Yu Mincho', serif", fontWeight: 400 }}
                >
                  あなたのキャリアに、
                </span>
                <span
                  className="block text-[32px] md:text-[40px] leading-tight"
                  style={{
                    fontFamily: "'Noto Serif JP', 'Yu Mincho', serif",
                    fontWeight: 500,
                    color: "#1D9E75",
                  }}
                >
                  本当のことを。
                </span>
              </h1>

              <p className="text-[14px] text-gray-400 leading-relaxed mb-8 max-w-md">
                IT/SaaS業界のビジネス職に特化。
                <br />
                カルチャー・雰囲気で企業を選べる転職サービス。
              </p>

              {/* CTA */}
              <div className="flex items-center gap-3 mb-12">
                <Link
                  href="/auth/signup"
                  className="text-[14px] font-medium px-7 py-3.5 rounded-lg text-white transition-colors"
                  style={{ background: "#1D9E75" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#0F6E56")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1D9E75")}
                >
                  無料で始める
                </Link>
                <Link
                  href="/companies"
                  className="text-[14px] font-medium px-7 py-3.5 rounded-lg transition-colors"
                  style={{ border: "0.5px solid #d1d5db", color: "#374151" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#1D9E75";
                    e.currentTarget.style.color = "#1D9E75";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.color = "#374151";
                  }}
                >
                  企業を見る
                </Link>
              </div>

              {/* ── Stats Bar ── */}
              <div className="flex items-center gap-0">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className="flex-1 text-center"
                    style={
                      i < stats.length - 1
                        ? { borderRight: "0.5px solid #e5e7eb" }
                        : {}
                    }
                  >
                    <div className="flex items-baseline justify-center gap-0.5">
                      <span
                        className="font-bold"
                        style={{ fontSize: 22, color: "#1D9E75" }}
                      >
                        {s.value}
                      </span>
                      <span className="text-[12px] text-gray-400">{s.unit}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div
              className="hidden md:block flex-shrink-0"
              style={{ borderLeft: "0.5px solid #e5e7eb" }}
            />

            {/* ── Right Column: Match Cards ── */}
            <div className="hidden md:flex flex-col justify-center w-[380px] flex-shrink-0 pl-10 py-12">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">
                あなたへのおすすめ求人
              </p>
              <div className="space-y-3">
                {matchJobs.map((job, idx) => {
                  const isLast = idx === 2;
                  const shouldBlur = isLast && !isLoggedIn;

                  if (shouldBlur) {
                    return (
                      <div key={job.id} className="relative">
                        <div style={{ filter: "blur(3px)" }} className="pointer-events-none">
                          <MatchCard job={job} />
                        </div>
                        {/* Overlay */}
                        <Link
                          href="/auth/signup"
                          className="absolute inset-0 flex items-center justify-center rounded-xl z-10"
                          style={{ background: "rgba(255,255,255,0.6)" }}
                        >
                          <span
                            className="text-[13px] font-medium px-4 py-2.5 rounded-lg text-white"
                            style={{ background: "#1D9E75" }}
                          >
                            登録してマッチ度を確認する →
                          </span>
                        </Link>
                      </div>
                    );
                  }

                  return <MatchCard key={job.id} job={job} />;
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Logo Ticker ─── */}
      {companyLogos.length > 0 && (
        <section
          className="overflow-hidden py-5"
          style={{ borderTop: "0.5px solid #f0f0f0", borderBottom: "0.5px solid #f0f0f0", background: "#FAFAF9" }}
        >
          <div className="relative">
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10" style={{ background: "linear-gradient(to right, #FAFAF9, transparent)" }} />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10" style={{ background: "linear-gradient(to left, #FAFAF9, transparent)" }} />

            <div className="flex items-center gap-8 ticker-track">
              {tickerLogos.map((c, i) => (
                <div key={`${c.name}-${i}`} className="flex-shrink-0">
                  <TickerLogo company={c} />
                </div>
              ))}
            </div>
          </div>

          <style>{`
            .ticker-track {
              animation: ticker 20s linear infinite;
              width: max-content;
            }
            @keyframes ticker {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </section>
      )}
    </>
  );
}

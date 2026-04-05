"use client";

import { useState, useMemo } from "react";

// ─── Types ──────────────────────────────────────────

type Mentor = {
  id: string;
  name: string;
  avatar_initial: string | null;
  avatar_color: string | null;
  current_company: string | null;
  current_role: string | null;
  previous_career: string | null;
  current_career: string | null;
  roles: string[] | null;
  worries: string[] | null;
  bio: string | null;
  concerns: string[] | null;
  calendly_url: string | null;
  is_available: boolean;
  display_order: number;
};

// ─── Constants ──────────────────────────────────────

const ROLE_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "営業", label: "営業・IS" },
  { value: "CS", label: "CS" },
  { value: "マーケ", label: "マーケ" },
  { value: "事業開発", label: "事業開発" },
];

const WORRY_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "転職タイミング", label: "転職タイミング" },
  { value: "年収交渉", label: "年収交渉" },
  { value: "キャリアチェンジ", label: "キャリアチェンジ" },
  { value: "外資転職", label: "外資転職" },
  { value: "スタートアップ", label: "スタートアップ" },
];

const HERO_STATS = [
  { value: "10名", label: "メンター" },
  { value: "無料", label: "相談料" },
  { value: "30分", label: "1回あたり" },
  { value: "営業ゼロ", label: "勧誘なし" },
];

// ─── Tag Button ─────────────────────────────────────

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] px-3 py-1.5 rounded-full transition-all whitespace-nowrap"
      style={
        selected
          ? { background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#0F6E56", fontWeight: 600 }
          : { background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }
      }
    >
      {label}
    </button>
  );
}

// ─── Mentor Card ────────────────────────────────────

function MentorCard({ mentor }: { mentor: Mentor }) {
  const avatarColor = mentor.avatar_color || "#1D9E75";
  const initial = mentor.avatar_initial || mentor.name[0];
  const available = mentor.is_available && !!mentor.calendly_url;

  const descStyle: React.CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 flex flex-col"
      style={{ border: "1px solid #e5e7eb" }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] text-gray-800">{mentor.name}</h3>
          {mentor.current_company && (
            <p className="text-[12px] text-gray-500 truncate">
              {mentor.current_company}
              {mentor.current_role && ` / ${mentor.current_role}`}
            </p>
          )}
          {mentor.previous_career && mentor.current_career && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              元{mentor.previous_career} → 現{mentor.current_career}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(mentor.roles || []).map((r) => (
          <span
            key={r}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            {r}
          </span>
        ))}
        {(mentor.worries || []).map((w) => (
          <span
            key={w}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#E6F1FB", color: "#185FA5" }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Bio */}
      {mentor.bio && (
        <p className="text-[12px] text-gray-500 leading-relaxed mb-3" style={descStyle}>
          {mentor.bio}
        </p>
      )}

      {/* Concerns */}
      {mentor.concerns && mentor.concerns.length > 0 && (
        <div className="mb-4 flex-1">
          <p className="text-[11px] font-semibold text-gray-600 mb-1.5">
            こんな悩みに答えられます
          </p>
          <ul className="space-y-1">
            {mentor.concerns.slice(0, 3).map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div
        className="pt-3 flex items-center justify-between"
        style={{ borderTop: "1px solid #f0f0f0" }}
      >
        {available ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-gray-400">予約受付中</span>
            </div>
            <a
              href={mentor.calendly_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-full transition-colors"
              style={{ background: "#1D9E75", color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#0F6E56")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#1D9E75")}
            >
              30分話してみる
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-[11px] text-gray-400">準備中</span>
            </div>
            <span
              className="inline-flex items-center text-[12px] font-medium px-4 py-2 rounded-full"
              style={{ background: "#f5f5f4", color: "#9ca3af" }}
            >
              準備中
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────

export default function CareerConsultationClient({
  mentors,
}: {
  mentors: Mentor[];
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [worryFilter, setWorryFilter] = useState("all");

  const filtered = useMemo(() => {
    return mentors.filter((m) => {
      if (roleFilter !== "all" && !(m.roles || []).includes(roleFilter)) return false;
      if (worryFilter !== "all" && !(m.worries || []).includes(worryFilter)) return false;
      return true;
    });
  }, [mentors, roleFilter, worryFilter]);

  return (
    <>
      {/* ─── Hero Section ─── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #F0FAF6 0%, #E6F1FB 50%, #FAEEDA 100%)",
        }}
      >
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div className="flex-1">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 mb-4">
                <span
                  className="text-[11px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "#fff", color: "#0F6E56", border: "1px solid #5DCAA5" }}
                >
                  全員 現役SaaS実務家 · 完全無料 · 30分
                </span>
              </div>

              {/* Title */}
              <h1 className="text-[28px] sm:text-[34px] font-bold text-gray-900 leading-tight mb-3">
                エージェントじゃない。
                <br />
                <em style={{ color: "#1D9E75", fontStyle: "normal" }}>現役実務家</em>が、本音で話す。
              </h1>

              {/* Sub text */}
              <p className="text-[14px] text-gray-500 leading-relaxed mb-5 max-w-lg">
                営業・CS・マーケで今まさに働くSaaS実務家が、転職のリアルを正直に話します。
                勧誘も営業も一切なし。ミスマッチのない転職のために。
              </p>

              {/* なぜ現役実務家なのか */}
              <div style={{ background: "#E1F5EE", borderRadius: 10, padding: "12px 16px", marginBottom: 20, maxWidth: 460 }}>
                <div style={{ fontSize: 10, color: "#0F6E56", fontWeight: 500, marginBottom: 8 }}>なぜ現役実務家なのか</div>
                {[
                  "エージェントは紹介料が発生するため中立な意見が言えない",
                  "今まさに現場で働く人が、最もリアルな情報を持っている",
                  "「転職しない」という選択肢も含めて正直に話せる",
                ].map((text, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#085041", marginBottom: 4 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1D9E75", flexShrink: 0, marginTop: 4 }} />
                    {text}
                  </div>
                ))}
              </div>

              {/* Stats bar */}
              <div className="flex items-center gap-0 mb-6">
                {HERO_STATS.map((s, i) => (
                  <div
                    key={i}
                    className="text-center px-4 sm:px-5"
                    style={i < HERO_STATS.length - 1 ? { borderRight: "1px solid #d1d5db40" } : {}}
                  >
                    <div className="text-[18px] sm:text-[20px] font-bold text-gray-800">{s.value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA button */}
            <div className="flex-shrink-0">
              <a
                href="https://calendly.com/hshiba-opinio/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
                style={{ background: "#1D9E75", color: "#fff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0F6E56")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1D9E75")}
              >
                今すぐ予約する →
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: "#1D9E75" }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10"
          style={{ background: "#185FA5" }}
        />
      </section>

      {/* ─── Filter Bar (sticky) ─── */}
      <div
        id="mentors"
        className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm"
        style={{ borderBottom: "1px solid #e5e7eb" }}
      >
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Role filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">職種</span>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    label={f.label}
                    selected={roleFilter === f.value}
                    onClick={() => setRoleFilter(f.value)}
                  />
                ))}
              </div>
            </div>
            {/* Worry filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">悩み</span>
              <div className="flex flex-wrap gap-1.5">
                {WORRY_FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    label={f.label}
                    selected={worryFilter === f.value}
                    onClick={() => setWorryFilter(f.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mentor Grid ─── */}
      <section className="max-w-[960px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[13px] text-gray-500">
            <span className="font-semibold text-gray-800">{filtered.length}名</span>
            のメンター
          </p>
          {(roleFilter !== "all" || worryFilter !== "all") && (
            <button
              onClick={() => {
                setRoleFilter("all");
                setWorryFilter("all");
              }}
              className="text-[12px] font-medium"
              style={{ color: "#1D9E75" }}
            >
              フィルターをクリア
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((m) => (
              <MentorCard key={m.id} mentor={m} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-400 text-[14px] mb-2">
              該当するメンターが見つかりませんでした
            </p>
            <button
              onClick={() => {
                setRoleFilter("all");
                setWorryFilter("all");
              }}
              className="text-[13px] font-medium"
              style={{ color: "#1D9E75" }}
            >
              フィルターをクリア
            </button>
          </div>
        )}
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-[20px] font-bold text-gray-800 mb-2">
            まずは気軽に30分、話してみませんか？
          </h2>
          <p className="text-[13px] text-gray-500 mb-6">
            営業は一切なし。転職するかどうか決まっていなくてもOKです。
          </p>
          <a
            href="#mentors"
            className="inline-flex items-center gap-2 text-[14px] font-semibold px-6 py-3 rounded-full transition-colors"
            style={{ background: "#1D9E75", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0F6E56")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1D9E75")}
          >
            メンターを選んで予約する
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </a>
        </div>
      </section>
    </>
  );
}

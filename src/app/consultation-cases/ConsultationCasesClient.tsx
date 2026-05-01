"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────

type ConsultationCase = {
  id: string;
  mentor_id: string;
  consulted_at: string;
  anon_profile: string;
  worry_category: string;
  worry_summary: string;
  insight: string;
  action_taken: string | null;
  display_order: number;
  mentors: {
    name: string;
    current_role: string | null;
    current_company: string | null;
    avatar_initial: string | null;
    avatar_color: string | null;
  } | null;
};

// ─── Constants ──────────────────────────────────────

const CATEGORY_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "キャリアチェンジ", label: "キャリアチェンジ" },
  { value: "年収交渉", label: "年収交渉" },
  { value: "転職タイミング", label: "転職タイミング" },
  { value: "スタートアップ", label: "スタートアップ" },
  { value: "外資転職", label: "外資転職" },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "キャリアチェンジ": { bg: "#E1F5EE", text: "#0F6E56" },
  "年収交渉": { bg: "#FAEEDA", text: "#854F0B" },
  "転職タイミング": { bg: "#E6F1FB", text: "#185FA5" },
  "スタートアップ": { bg: "#F3E8FF", text: "#6B21A8" },
  "外資転職": { bg: "#FEE2E2", text: "#991B1B" },
};

function getCategoryStyle(category: string) {
  return CATEGORY_COLORS[category] || { bg: "#f5f5f4", text: "#78716c" };
}

// ─── Case Card ──────────────────────────────────────

function CaseCard({ c }: { c: ConsultationCase }) {
  const catStyle = getCategoryStyle(c.worry_category);
  const mentor = c.mentors;

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: catStyle.bg, color: catStyle.text }}
          >
            {c.worry_category}
          </span>
          <span className="text-[11px] text-gray-600">
            {new Date(c.consulted_at).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
            })}
          </span>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
            style={{ background: "#9ca3af" }}
          >
            ?
          </div>
          <span className="text-[13px] font-medium text-gray-700">
            {c.anon_profile}
          </span>
        </div>
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1">
        {/* Left: 相談内容 */}
        <div className="px-5 py-4" style={{ borderTop: "0.5px solid #f0f0f0" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="#9ca3af"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
              相談内容
            </span>
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            {c.worry_summary}
          </p>
        </div>

        {/* Right: 気づき・アドバイス */}
        <div
          className="px-5 py-4"
          style={{
            borderTop: "0.5px solid #f0f0f0",
            background: "#FAFDF8",
          }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="#1D9E75"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#1D9E75" }}>
              気づき・アドバイス
            </span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: "#085041" }}>
            {c.insight}
          </p>
        </div>
      </div>

      {/* Action taken + Mentor */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: "0.5px solid #f0f0f0", background: "#fff" }}
      >
        {c.action_taken && (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="#1D9E75"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-[12px] text-gray-700 truncate">{c.action_taken}</span>
          </div>
        )}
        {mentor && (
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ background: mentor.avatar_color || "#1D9E75" }}
            >
              {mentor.avatar_initial || mentor.name[0]}
            </div>
            <span className="text-[11px] text-gray-600">
              {mentor.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────

export default function ConsultationCasesClient({
  cases,
}: {
  cases: ConsultationCase[];
}) {
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    if (category === "all") return cases;
    return cases.filter((c) => c.worry_category === category);
  }, [cases, category]);

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="bg-white" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-5"
            style={{ background: "#E1F5EE", color: "#0F6E56", border: "0.5px solid #5DCAA5" }}
          >
            実際の相談事例を公開中
          </div>
          <h1
            className="text-[28px] md:text-[34px] leading-tight mb-4"
            style={{
              fontFamily: "var(--font-noto-serif)",
              fontWeight: 400,
            }}
          >
            相談して、
            <span style={{ color: "#1D9E75", fontWeight: 500 }}>気づきが変わった</span>
            人たち。
          </h1>
          <p className="text-[14px] text-gray-600 leading-relaxed max-w-md mx-auto">
            実際にopinio.jpのキャリア相談を利用した方の
            <br className="hidden sm:block" />
            相談内容と気づきをご紹介します。
          </p>
        </div>
      </section>

      {/* ─── Filters ─── */}
      <section className="max-w-4xl mx-auto px-4 pt-8 pb-2">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setCategory(f.value)}
              className="text-[12px] px-3.5 py-1.5 rounded-full transition-all"
              style={
                category === f.value
                  ? { background: "#1D9E75", color: "#fff" }
                  : { background: "#fff", color: "#6b7280", border: "0.5px solid #e5e7eb" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[12px] text-gray-600 mt-3">
          {filtered.length}件の事例
        </div>
      </section>

      {/* ─── Cases ─── */}
      <section className="max-w-4xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-sm">該当する事例がありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <CaseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "#E1F5EE", border: "0.5px solid #5DCAA5" }}
        >
          <h2 className="text-[18px] font-semibold mb-2" style={{ color: "#085041" }}>
            あなたも、話してみませんか？
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "#0F6E56" }}>
            完全無料 · 営業なし · 30分で気づきが変わる
          </p>
          <Link
            href="/career-consultation"
            className="inline-block text-[14px] font-medium text-white px-6 py-3 rounded-lg transition-colors"
            style={{ background: "#1D9E75" }}
          >
            キャリア相談を予約する
          </Link>
        </div>
      </section>
    </>
  );
}

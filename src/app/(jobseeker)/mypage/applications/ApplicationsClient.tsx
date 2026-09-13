"use client";

import { useState } from "react";
import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";
import { SuggestionsSection } from "@/components/mypage/SuggestionsSection";
import type { SuggestedCompany, SuggestedJob } from "@/components/mypage/SuggestionsSection";
import { ApplicationEntryCard } from "@/components/mypage/ApplicationEntryCard";
import type { Entry } from "@/components/mypage/ApplicationEntryCard";

/* ⚠️ 型と部品の実体は `components/mypage/` 側。ここは `page.tsx` へ通すだけ
      （`/dev/preview` から同じ部品を import するため）。 */
export type { SuggestedCompany, SuggestedJob, Entry };

/**
 * ── 絞り込みは「状態」の1軸だけ（2026-09-13）────────────────────────────────
 *
 * ⚠️★**種別（応募／面談）と状態を同じ行に混ぜないこと。** 以前のタブは
 *    すべて / 書類選考中 / 面接中 / 内定 で、ここに「カジュアル面談」を足すと
 *    **粒度の違うものが同列に並ぶ**（CLAUDE.md「『成長ステージ』のようなバケットを、
 *    個別の段と同列に並べない」と同じ形）。種別は**各行のバッジ**で示す。
 *
 * ⚠️ 「内定」は求人応募にしか起きない。**それでよい** —— 状態の軸に、
 *    片方の種別にしか現れない値があるだけ。
 */
const OPEN_STATUSES = [
  "pending", "company_contacted", "scheduling", "scheduled",   // 面談
  "applied", "doc_review", "interview1", "interview_final",    // 応募
];
const OFFERED_STATUSES = ["offered", "accepted"];
const CLOSED_STATUSES = ["completed", "declined", "rejected"];

const FILTER_TABS = [
  { key: "all",     label: "すべて" },
  { key: "open",    label: "進行中" },
  { key: "offered", label: "内定" },
  { key: "closed",  label: "終了" },
];

export default function ApplicationsClient({
  initialEntries,
  suggestedJobs,
  suggestedCompanies,
}: {
  initialEntries: Entry[];
  suggestedJobs: SuggestedJob[];
  suggestedCompanies: SuggestedCompany[];
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = initialEntries.filter((e) => {
    if (activeFilter === "open") return OPEN_STATUSES.includes(e.status);
    if (activeFilter === "offered") return OFFERED_STATUSES.includes(e.status);
    if (activeFilter === "closed") return CLOSED_STATUSES.includes(e.status);
    return true;
  });

  const counts = {
    meeting: initialEntries.filter((e) => e.kind === "meeting").length,
    job: initialEntries.filter((e) => e.kind === "job").length,
    open: initialEntries.filter((e) => OPEN_STATUSES.includes(e.status)).length,
    offered: initialEntries.filter((e) => OFFERED_STATUSES.includes(e.status)).length,
  };

  return (
    <MypageLayout activeKey="applications">
      <div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif)", fontSize: 22, fontWeight: 700,
          color: "var(--ink)", marginBottom: 24,
        }}>応募・面談</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* ★4つとも同じ色にした（2026-09-01）。理由は3つ。
                ① **`text-yellow-600`(#CA8A04) が白の上で 2.94。** 数字は 24px なので基準は 3.0
                   だが届かない（実測）。
                ② **`text-purple-600` は紫。** `.claude/skills/ui-conventions`「色の役割」は
                   **紫は使わない**と定めている。globals.css の但し書き
                   「①②③（運営・企業側の状態表示）は当面残す」は**求職者側には適用されない。**
                ③ ★**凡例が無く、色が何も伝えていない。**
                   ここで情報を運んでいるのは**数字の下のラベル**であって、色ではない。
             ⚠️ 1つだけ色を残す案は採らない。**どれかが上位だという序列**になる。 */}
          {[
            { label: "カジュアル面談", count: counts.meeting },
            { label: "求人応募", count: counts.job },
            { label: "進行中", count: counts.open },
            { label: "内定", count: counts.offered },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-card p-4 border border-card-border text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--ink)" }}>{card.count}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6" role="tablist" aria-label="状態で絞り込み">
          {FILTER_TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              role="tab"
              aria-selected={activeFilter === tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 text-sm rounded-full border transition-colors ${
                activeFilter === tab.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-card-border hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasAny={initialEntries.length > 0} />
        ) : (
          <div className="space-y-4">
            {filtered.map((e) => <ApplicationEntryCard key={`${e.kind}-${e.id}`} entry={e} />)}
          </div>
        )}

        {/* ★おすすめ（2026-09-13）。⚠️ 出せるものが無ければ部品側が null を返す。 */}
        <SuggestionsSection jobs={suggestedJobs} companies={suggestedCompanies} />
      </div>
    </MypageLayout>
  );
}

/* ── 0件のとき ─────────────────────────────────────────────────────────────── */

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      background: "#fff", borderRadius: 16, border: "1px solid var(--line)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--royal-50)", display: "flex",
        alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="12" y2="17"/>
        </svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
        {hasAny ? "この状態のものはありません" : "まだ申し込みがありません"}
      </p>
      {!hasAny && (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24, lineHeight: 1.7 }}>
            気になる企業にカジュアル面談を申し込むと、ここで状況が追えます
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--royal)", color: "#fff", textDecoration: "none",
            }}>
              企業を探す →
            </Link>
            <Link href="/jobs" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: "1px solid var(--line)", color: "var(--ink-soft)", textDecoration: "none", background: "#fff",
            }}>
              募集を見る
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

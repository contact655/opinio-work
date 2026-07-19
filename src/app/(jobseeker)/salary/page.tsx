import type { Metadata } from "next";
import Link from "next/link";
import { getJobs } from "@/lib/supabase/queries";
import { buildSalaryStats } from "./salaryData";
import { SalaryClient } from "./SalaryClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS 匿名年収データベース | OPINIO" },
  description:
    "IT/SaaS・外資系企業に在籍・在籍経験のある方が匿名で報告した実績年収データベース。自分の年収を報告すると閲覧できます。",
  keywords: ["IT年収", "SaaS年収", "外資系年収", "職種別年収", "年収相場", "転職年収", "匿名年収"],
  alternates: { canonical: "/salary" },
  openGraph: {
    title: "IT/SaaS 匿名年収データベース | OPINIO",
    description: "IT/SaaS・外資系企業に在籍・在籍経験のある方が匿名で報告した実績年収データベース。",
    type: "website",
    url: "/salary",
  },
};

const FREE_COUNT = 4;

export default async function SalaryPage() {
  const { jobs } = await getJobs();
  const stats = buildSalaryStats(jobs);
  const maxBar = Math.max(...stats.map((s) => s.avgMax), 1);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>

      {/* ── ヒーロー ── */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "52px 24px 44px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 100, padding: "3px 10px" }}>
              匿名年収レポート
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", border: "1px solid #a7f3d0", borderRadius: 100, padding: "3px 10px" }}>
              🔒 完全匿名
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 14px", lineHeight: 1.25 }}>
            IT / SaaS 業界<br />
            <span style={{ color: "var(--royal)" }}>匿名年収データベース</span>
          </h1>

          <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.75, maxWidth: 540 }}>
            IT/SaaS・外資系企業に在籍・在籍経験のある方が<strong style={{ color: "var(--ink)" }}>匿名</strong>で報告した実績年収をもとに、業界の相場を可視化しています。
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 28px", lineHeight: 1.6, maxWidth: 540 }}>
            ※ 自分の在籍年収を報告すると、全データが閲覧できます（Glassdoor方式）
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/profile/edit"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 24px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 12px rgba(0,35,102,0.25)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
              年収を報告する（無料・匿名）
            </Link>
            <Link
              href="#data"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 20px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1.5px solid var(--royal-100)" }}
            >
              データを見る →
            </Link>
          </div>
        </div>
      </div>

      {/* ── 検索 + データ（Client Component）── */}
      <SalaryClient stats={stats} maxBar={maxBar} freeCount={FREE_COUNT} />
    </div>
  );
}

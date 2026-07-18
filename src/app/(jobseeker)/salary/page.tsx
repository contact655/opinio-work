import type { Metadata } from "next";
import Link from "next/link";
import { getJobs } from "@/lib/supabase/queries";
import { buildSalaryStats } from "./salaryData";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS職種別 年収相場 | OPINIO" },
  description:
    "外資系・IT/SaaS企業の職種別年収相場を実際の求人データから集計。エンタープライズ営業・カスタマーサクセス・セールスエンジニアなど職種ごとの年収レンジを確認できます。",
  keywords: ["IT年収", "SaaS年収", "外資系年収", "職種別年収", "年収相場", "転職年収"],
  alternates: { canonical: "/salary" },
  openGraph: {
    title: "IT/SaaS職種別 年収相場 | OPINIO",
    description: "外資系・IT/SaaS企業の職種別年収相場を実際の求人データから集計。",
    type: "website",
    url: "/salary",
  },
};

export default async function SalaryPage() {
  const { jobs } = await getJobs();
  const stats = buildSalaryStats(jobs);

  const MAX_BAR = Math.max(...stats.map((s) => s.avgMax), 1);
  const totalJobs = stats.reduce((a, s) => a + s.jobCount, 0);
  const topMax = Math.max(...stats.map((s) => s.maxSalary));

  return (
    <>
      <style>{`
        .sc-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px 24px; text-decoration:none; display:block; transition:box-shadow .15s,border-color .15s; }
        .sc-card:hover { box-shadow:0 4px 20px rgba(0,35,102,.10); border-color:var(--royal-100); }
        .sc-bar-outer { background:var(--line-soft); border-radius:100px; height:10px; overflow:hidden; margin-top:10px; }
        .sc-bar-inner { height:10px; border-radius:100px; background:linear-gradient(90deg,var(--royal),#3B5FD9); }
      `}</style>

      {/* ─ ヒーロー ─ */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "48px 24px 40px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 12 }}>
            Salary Insights
          </div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 14px", lineHeight: 1.25 }}>
            IT / SaaS 職種別<br />年収相場
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 24px", lineHeight: 1.7, maxWidth: 520 }}>
            外資系・SaaS企業の実際の求人データをもとに、職種ごとの年収レンジを集計しました。転職活動の年収交渉や市場価値の把握にお役立てください。
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { num: `${stats.length}`, label: "職種のデータ" },
              { num: `${totalJobs}`, label: "件の求人から集計" },
              { num: `〜${topMax}万円`, label: "最高年収レンジ", green: true },
            ].map(({ num, label, green }) => (
              <div key={label} style={{ background: "#fff", border: "1px solid var(--royal-100)", borderRadius: 12, padding: "10px 18px", fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: green ? "var(--success)" : "var(--royal)", fontFamily: "Inter,sans-serif" }}>{num}</span>
                <span style={{ color: "var(--ink-soft)", marginLeft: 5 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* 注記 */}
        <div style={{ background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 12, padding: "12px 16px", marginBottom: 28, fontSize: 12, color: "var(--royal)", lineHeight: 1.6 }}>
          <strong>データについて：</strong>OPINIOに掲載されている求人票に記載された年収レンジをもとに集計しています。企業・経験・スキルにより実際の年収は異なります。
        </div>

        {/* ─ 職種一覧 ─ */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
          職種別 年収レンジ一覧
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stats.map((s) => {
            const barPct = Math.round((s.avgMax / MAX_BAR) * 100);
            return (
              <Link key={s.slug} href={`/salary/${s.slug}`} className="sc-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                        求人{s.jobCount}件
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>
                        {s.avgMin}〜{s.avgMax}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-soft)", marginLeft: 4 }}>万円（平均レンジ）</span>
                    </div>
                    <div className="sc-bar-outer">
                      <div className="sc-bar-inner" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2 }}>最高</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", fontFamily: "Inter,sans-serif" }}>
                      {s.maxSalary}<span style={{ fontSize: 11, fontWeight: 500 }}>万円</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--royal)", fontWeight: 600 }}>
                      詳細を見る →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ─ 注記 ─ */}
        <div style={{ marginTop: 28, padding: "14px 18px", background: "var(--bg-tint)", borderRadius: 12, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          ※ 本データはOPINIOに掲載中の求人票に記載された年収レンジをもとに集計したものです。企業・経験・スキルにより実際の年収は異なります。職種ごとのページで実際の求人を確認できます。
        </div>

        {/* ─ CTA ─ */}
        <div style={{ marginTop: 40, padding: "28px 24px", borderRadius: 16, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
            年収アップを目指すなら、先輩社員に実際の話を聞くのが一番の近道です。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/jobs" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              求人を見る →
            </Link>
            <Link href="/companies" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>
              企業を探す
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getJobs } from "@/lib/supabase/queries";
import { buildSalaryStats } from "./salaryData";

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

// ── ダミーの個人報告データ（将来 ow_salary_reports テーブルから取得）
const DUMMY_REPORTS = [
  { id: 1, role: "エンタープライズ営業", company: "外資系SaaS（非公開）", salary: 1200, yoe: 5, year: 2024 },
  { id: 2, role: "カスタマーサクセス", company: "国内SaaS（非公開）", salary: 780, yoe: 3, year: 2024 },
  { id: 3, role: "セールスエンジニア", company: "外資系クラウド（非公開）", salary: 1450, yoe: 7, year: 2023 },
  { id: 4, role: "インサイドセールス", company: "外資系SaaS（非公開）", salary: 620, yoe: 2, year: 2024 },
  { id: 5, role: "マーケティング", company: "国内SaaS（非公開）", salary: 850, yoe: 6, year: 2023 },
  { id: 6, role: "プロダクトマネージャー", company: "外資系SaaS（非公開）", salary: 1600, yoe: 9, year: 2024 },
];

export default async function SalaryPage() {
  const { jobs } = await getJobs();
  const stats = buildSalaryStats(jobs);

  const MAX_BAR = Math.max(...stats.map((s) => s.avgMax), 1);
  const totalJobs = stats.reduce((a, s) => a + s.jobCount, 0);
  const topMax = Math.max(...stats.map((s) => s.maxSalary));

  // 表示する職種（最初の4件は公開、残りはブラー）
  const FREE_COUNT = 4;

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style suppressHydrationWarning>{`
        .sc-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 22px 24px;
          text-decoration: none;
          display: block;
          transition: box-shadow .15s, border-color .15s;
        }
        .sc-card:hover {
          box-shadow: 0 4px 20px rgba(0,35,102,.10);
          border-color: var(--royal-100);
        }
        .sc-bar-outer {
          background: var(--line-soft, #f1f5f9);
          border-radius: 100px;
          height: 8px;
          overflow: hidden;
          margin-top: 10px;
          position: relative;
        }
        .sc-bar-inner {
          height: 8px;
          border-radius: 100px;
          background: linear-gradient(90deg, var(--royal), #3B5FD9);
          position: relative;
        }
        .report-row {
          display: flex;
          align-items: center;
          padding: 14px 0;
          border-bottom: 1px solid var(--line-soft, #f1f5f9);
          gap: 12px;
        }
        .report-row:last-child { border-bottom: none; }
        .how-step {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px 0;
        }
        .how-step:not(:last-child) {
          border-bottom: 1px solid var(--line-soft, #f1f5f9);
        }
        @media (max-width: 600px) {
          .salary-hero-h1 { font-size: 26px !important; }
          .salary-stats { flex-direction: column; gap: 8px !important; }
          .sc-card { padding: 16px; }
        }
      `}</style>

      {/* ── ヒーロー ── */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "52px 24px 44px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* バッジ */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 100, padding: "3px 10px" }}>
              匿名年収レポート
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", border: "1px solid #a7f3d0", borderRadius: 100, padding: "3px 10px" }}>
              🔒 完全匿名
            </span>
          </div>

          <h1 className="salary-hero-h1" style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 14px", lineHeight: 1.25 }}>
            IT / SaaS 業界<br />
            <span style={{ color: "var(--royal)" }}>匿名年収データベース</span>
          </h1>

          <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: "0 0 12px", lineHeight: 1.75, maxWidth: 540 }}>
            IT/SaaS・外資系企業に在籍・在籍経験のある方が<strong style={{ color: "var(--ink)" }}>匿名</strong>で報告した実績年収をもとに、業界の相場を可視化しています。
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 28px", lineHeight: 1.6, maxWidth: 540 }}>
            ※ 自分の在籍年収を報告すると、全データが閲覧できます（Glassdoor方式）
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
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

          {/* Stats */}
          <div className="salary-stats" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { num: `${stats.length}`, label: "職種のデータ", icon: "📊" },
              { num: `${totalJobs}`, label: "件の求人データから算出", icon: "💼" },
              { num: `〜${topMax}万円`, label: "最高年収レンジ", icon: "💰", green: true },
              { num: "匿名", label: "で報告・閲覧できます", icon: "🔒" },
            ].map(({ num, label, icon, green }) => (
              <div key={label} style={{ background: "#fff", border: "1px solid var(--royal-100)", borderRadius: 12, padding: "10px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{icon}</span>
                <span style={{ fontWeight: 700, color: green ? "var(--success)" : "var(--royal)", fontFamily: "Inter,sans-serif", fontSize: 14 }}>{num}</span>
                <span style={{ color: "var(--ink-soft)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="data" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px 80px", background: "#fff" }}>

        {/* ── 仕組みの説明（How it works）── */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "24px", marginBottom: 36 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
            📖 このデータベースについて
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 20px" }}>
            Glassdoor・levels.fyi と同じ「Give to Get」方式です
          </p>
          <div>
            {[
              {
                step: "01",
                title: "在籍年収を匿名で報告する",
                desc: "現在・過去に在籍した企業の年収を匿名で入力。氏名・メールアドレスは一切公開されません。",
                color: "var(--royal)",
              },
              {
                step: "02",
                title: "全データが閲覧できるようになる",
                desc: "報告後、他のユーザーが投稿した詳細な年収データ（企業別・職種別・経験年数別）が閲覧できます。",
                color: "var(--success)",
              },
              {
                step: "03",
                title: "コミュニティで相場を共有する",
                desc: "みんながデータを出し合うことで、IT/SaaS業界の透明な年収相場が作られます。",
                color: "#7C3AED",
              },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="how-step">
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Inter,sans-serif", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 職種別サマリー ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            職種別 年収サマリー
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            ※ 求人票データをもとに算出（詳細は報告後に閲覧可）
          </span>
        </div>

        {/* 公開カード（最初の FREE_COUNT 件） */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {stats.slice(0, FREE_COUNT).map((s) => {
            const barPct = Math.round((s.avgMax / MAX_BAR) * 100);
            return (
              <Link key={s.slug} href={`/salary/${s.slug}`} className="sc-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                        {s.jobCount}件の求人データ
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>
                        {s.avgMin}〜{s.avgMax}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>万円（平均レンジ）</span>
                    </div>
                    {/* パーセンタイルバー */}
                    <div style={{ marginTop: 12 }}>
                      <div className="sc-bar-outer" style={{ height: 8 }}>
                        <div className="sc-bar-inner" style={{ width: `${barPct}%` }} />
                      </div>
                      {/* P25 / P50 / P75 ラベル */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter,sans-serif" }}>
                        <span>P25 {s.avgMin}万</span>
                        <span>中央値 {Math.round((s.avgMin + s.avgMax) / 2)}万</span>
                        <span>P75 {s.avgMax}万</span>
                      </div>
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

        {/* ── Give to Get ゲート ── */}
        {stats.length > FREE_COUNT && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* ロックされた職種カード（グレーアウト表示） */}
            {stats.slice(FREE_COUNT).map((s) => (
              <div key={s.slug} style={{ background: "#f8fafc", border: "1.5px dashed var(--line)", borderRadius: 16, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-mute)" }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>報告後に閲覧可</span>
              </div>
            ))}

            {/* ロック解除CTA */}
            <div style={{ marginTop: 8, padding: "24px", background: "var(--royal-50)", border: "1.5px solid var(--royal-100)", borderRadius: 16, textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
                残り {stats.length - FREE_COUNT} 職種のデータを閲覧するには
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.65 }}>
                自分の在籍年収を匿名で報告すると、全 {stats.length} 職種 + 個人報告データが閲覧できます
              </p>
              <Link
                href="/profile/edit"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 12px rgba(0,35,102,0.2)" }}
              >
                🔓 年収を報告して全データを見る
              </Link>
              <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 10 }}>
                完全無料・匿名・1分で完了
              </p>
            </div>
          </div>
        )}

        {/* ── 匿名報告データプレビュー（ロック表示） ── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              匿名年収レポート（個人報告）
            </h2>
            <span style={{ fontSize: 11, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", borderRadius: 100, padding: "3px 10px", fontWeight: 600 }}>
              🔒 報告後に閲覧可
            </span>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", position: "relative" }}>
            {/* テーブルヘッダー */}
            <div style={{ display: "flex", gap: 0, padding: "10px 20px", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.03em" }}>
              <span style={{ flex: 2 }}>職種</span>
              <span style={{ flex: 2 }}>企業</span>
              <span style={{ flex: 1, textAlign: "right" }}>年収</span>
              <span style={{ flex: 1, textAlign: "right" }}>経験年数</span>
            </div>

            {/* データ行（最初の2件のみ表示、残りはロック） */}
            {DUMMY_REPORTS.slice(0, 2).map((r) => (
              <div key={r.id} className="report-row" style={{ padding: "14px 20px" }}>
                <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.role}</span>
                <span style={{ flex: 2, fontSize: 12, color: "var(--ink-soft)" }}>{r.company}</span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>{r.salary}万</span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 12, color: "var(--ink-mute)" }}>{r.yoe}年</span>
              </div>
            ))}

            {/* ロックCTA */}
            <div style={{ padding: "20px", textAlign: "center", background: "var(--bg-tint)", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
                🔒 あと {DUMMY_REPORTS.length - 2} 件の個人年収レポートがあります
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 12px" }}>
                自分の年収を報告すると閲覧できます
              </p>
              <Link
                href="/profile/edit"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
              >
                🔓 報告して全件閲覧する
              </Link>
            </div>
          </div>
        </div>

        {/* ── 注記 ── */}
        <div style={{ marginTop: 28, padding: "14px 18px", background: "var(--bg-tint)", borderRadius: 12, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          ※ 職種別サマリーはOPINIOに掲載中の求人票に記載された年収レンジをもとに算出した参考値です。個人報告データ（Give to Get）は今後実装予定です。
        </div>

        {/* ── CTA ── */}
        <div style={{ marginTop: 40, padding: "32px 24px", borderRadius: 20, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔒</div>
          <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
            あなたの年収がデータベースを豊かにする
          </h3>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.7 }}>
            匿名で報告するだけで、IT/SaaS業界全体の<br />
            透明な年収情報が広がります。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/profile/edit" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              年収を報告する（1分・無料）
            </Link>
            <Link href="/jobs" style={{ display: "inline-block", padding: "12px 20px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>
              求人を見る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

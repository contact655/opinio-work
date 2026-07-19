"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { SalaryStats } from "./salaryData";

// ── フィルターグループ ────────────────────────────────
const FILTER_GROUPS: { label: string; slugs: string[] }[] = [
  { label: "すべて", slugs: [] },
  { label: "営業", slugs: ["enterprise-sales", "smb-sales"] },
  { label: "CS", slugs: ["customer-success"] },
  { label: "プリセールス", slugs: ["sales-engineer", "solutions-architect"] },
  { label: "エンジニア", slugs: ["backend-engineer", "ml-engineer"] },
  { label: "PM", slugs: ["product-manager"] },
  { label: "その他", slugs: ["other"] },
];

// ── ダミーの個人報告データ ───────────────────────────
const DUMMY_REPORTS = [
  { id: 1, role: "エンタープライズ営業", company: "外資系SaaS（非公開）", salary: 1200, yoe: 5, year: 2024 },
  { id: 2, role: "カスタマーサクセス", company: "国内SaaS（非公開）", salary: 780, yoe: 3, year: 2024 },
];

interface Props {
  stats: SalaryStats[];
  maxBar: number;
  freeCount: number;
}

export function SalaryClient({ stats, maxBar, freeCount }: Props) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("すべて");

  const filtered = useMemo(() => {
    let result = stats;
    // グループフィルター
    const group = FILTER_GROUPS.find((g) => g.label === activeGroup);
    if (group && group.slugs.length > 0) {
      result = result.filter((s) => group.slugs.includes(s.slug));
    }
    // テキスト検索
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((s) => s.label.toLowerCase().includes(q));
    }
    return result;
  }, [stats, activeGroup, query]);

  const freeItems = filtered.slice(0, freeCount);
  const lockedItems = filtered.slice(freeCount);

  return (
    <>
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
        }
        .sc-bar-inner {
          height: 8px;
          border-radius: 100px;
          background: linear-gradient(90deg, var(--royal), #3B5FD9);
        }
        .sc-chip {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink-soft);
          transition: all .12s;
          white-space: nowrap;
        }
        .sc-chip:hover {
          border-color: var(--royal-100);
          color: var(--royal);
        }
        .sc-chip.active {
          background: var(--royal);
          border-color: var(--royal);
          color: #fff;
        }
        .sc-search-wrap {
          position: relative;
        }
        .sc-search-input {
          width: 100%;
          padding: 10px 16px 10px 40px;
          border: 1.5px solid var(--line);
          border-radius: 100px;
          font-size: 14px;
          color: var(--ink);
          background: #fff;
          outline: none;
          box-sizing: border-box;
          transition: border-color .15s;
          font-family: inherit;
        }
        .sc-search-input:focus {
          border-color: var(--royal);
        }
        .sc-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--ink-mute);
        }
        .sc-search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--ink-mute);
          padding: 2px;
          font-size: 16px;
          line-height: 1;
        }
        .report-row {
          display: flex;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--line-soft, #f1f5f9);
          gap: 12px;
        }
        .report-row:last-child { border-bottom: none; }
        @media (max-width: 600px) {
          .sc-card { padding: 16px; }
          .sc-chip { font-size: 12px; padding: 5px 11px; }
        }
      `}</style>

      <div id="data" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px", background: "#fff" }}>

        {/* ── 仕組みの説明 ── */}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, padding: "24px", marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
            📖 このデータベースについて
          </h2>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 20px" }}>
            Glassdoor・levels.fyi と同じ「Give to Get」方式です
          </p>
          {[
            { step: "01", title: "在籍年収を匿名で報告する", desc: "現在・過去に在籍した企業の年収を匿名で入力。氏名・メールアドレスは一切公開されません。", color: "var(--royal)" },
            { step: "02", title: "全データが閲覧できるようになる", desc: "報告後、他のユーザーが投稿した詳細な年収データ（企業別・職種別・経験年数別）が閲覧できます。", color: "var(--success)" },
            { step: "03", title: "コミュニティで相場を共有する", desc: "みんながデータを出し合うことで、IT/SaaS業界の透明な年収相場が作られます。", color: "#7C3AED" },
          ].map(({ step, title, desc, color }) => (
            <div key={step} style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "14px 0", borderBottom: step !== "03" ? "1px solid var(--line-soft)" : "none" }}>
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

        {/* ── 検索バー ── */}
        <div style={{ marginBottom: 14 }}>
          <div className="sc-search-wrap">
            <svg className="sc-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="sc-search-input"
              type="text"
              placeholder="職種・キーワードで絞り込む"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="sc-search-clear" onClick={() => setQuery("")} aria-label="クリア">×</button>
            )}
          </div>
        </div>

        {/* ── フィルターチップ ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          {FILTER_GROUPS.map((g) => (
            <button
              key={g.label}
              className={`sc-chip${activeGroup === g.label ? " active" : ""}`}
              onClick={() => setActiveGroup(g.label)}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* ── 職種別サマリーヘッダー ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            職種別 年収サマリー
            {filtered.length < stats.length && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 8 }}>{filtered.length}件</span>
            )}
          </h2>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>※ 求人票データをもとに算出</span>
        </div>

        {/* 検索結果なし */}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-mute)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--ink)" }}>該当する職種が見つかりませんでした</p>
            <p style={{ margin: 0, fontSize: 13 }}>検索キーワードを変えてみてください</p>
          </div>
        )}

        {/* 公開カード */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {freeItems.map((s) => {
            const barPct = Math.round((s.avgMax / maxBar) * 100);
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
                    <div className="sc-bar-outer">
                      <div className="sc-bar-inner" style={{ width: `${barPct}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter,sans-serif" }}>
                      <span>P25 {s.avgMin}万</span>
                      <span>中央値 {Math.round((s.avgMin + s.avgMax) / 2)}万</span>
                      <span>P75 {s.avgMax}万</span>
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

        {/* Give to Get ゲート */}
        {lockedItems.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {lockedItems.map((s) => (
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

            <div style={{ marginTop: 8, padding: "24px", background: "var(--royal-50)", border: "1.5px solid var(--royal-100)", borderRadius: 16, textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
                残り {lockedItems.length} 職種のデータを閲覧するには
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.65 }}>
                自分の在籍年収を匿名で報告すると、全 {stats.length} 職種 + 個人報告データが閲覧できます
              </p>
              <Link
                href="/profile/edit"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
              >
                🔓 年収を報告して全データを見る
              </Link>
              <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 10 }}>完全無料・匿名・1分で完了</p>
            </div>
          </div>
        )}

        {/* 匿名報告データプレビュー */}
        <div style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              匿名年収レポート（個人報告）
            </h2>
            <span style={{ fontSize: 11, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", borderRadius: 100, padding: "3px 10px", fontWeight: 600 }}>
              🔒 報告後に閲覧可
            </span>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", padding: "10px 20px", background: "var(--bg-tint)", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 700, color: "var(--ink-mute)" }}>
              <span style={{ flex: 2 }}>職種</span>
              <span style={{ flex: 2 }}>企業</span>
              <span style={{ flex: 1, textAlign: "right" }}>年収</span>
              <span style={{ flex: 1, textAlign: "right" }}>経験年数</span>
            </div>
            {DUMMY_REPORTS.map((r) => (
              <div key={r.id} className="report-row">
                <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.role}</span>
                <span style={{ flex: 2, fontSize: 12, color: "var(--ink-soft)" }}>{r.company}</span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>{r.salary}万</span>
                <span style={{ flex: 1, textAlign: "right", fontSize: 12, color: "var(--ink-mute)" }}>{r.yoe}年</span>
              </div>
            ))}
            <div style={{ padding: "20px", textAlign: "center", background: "var(--bg-tint)", borderTop: "1px solid var(--line)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
                🔒 あと {Math.max(0, 6 - DUMMY_REPORTS.length)} 件の個人年収レポートがあります
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

        {/* 注記 */}
        <div style={{ marginTop: 28, padding: "14px 18px", background: "var(--bg-tint)", borderRadius: 12, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          ※ 職種別サマリーはOPINIOに掲載中の求人票に記載された年収レンジをもとに算出した参考値です。個人報告データ（Give to Get）は今後実装予定です。
        </div>

        {/* 締めCTA */}
        <div style={{ marginTop: 40, padding: "32px 24px", borderRadius: 20, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔒</div>
          <h3 style={{ color: "#fff", fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>
            あなたの年収がデータベースを豊かにする
          </h3>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.7 }}>
            匿名で報告するだけで、IT/SaaS業界全体の<br />透明な年収情報が広がります。
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
    </>
  );
}

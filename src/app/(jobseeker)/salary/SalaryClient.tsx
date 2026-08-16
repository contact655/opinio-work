"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { SalaryStats } from "./salaryData";
import { fmtMan } from "@/lib/utils/salary";

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
}

export function SalaryClient({ stats, maxBar }: Props) {
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
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "0 0 20px" }}>
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

        {/* ── ① ユーザー投稿年収（メインセクション・現在は空状態）── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              匿名年収レポート
            </h2>
            <span style={{ fontSize: 12, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", borderRadius: 100, padding: "3px 10px", fontWeight: 600 }}>
              0 件（準備中）
            </span>
          </div>

          {/* 空状態 */}
          <div style={{ background: "#fff", border: "2px dashed var(--royal-100)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>
              📊
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
              まだ年収レポートがありません
            </h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 6px", lineHeight: 1.75, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              あなたが最初の報告者になりましょう。<br />
              報告が集まると、職種別・企業別の実績年収データが閲覧できるようになります。
            </p>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "0 0 24px" }}>
              完全匿名・無料・1分で完了
            </p>
            <Link
              href="/mypage"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 12px rgba(0,35,102,0.2)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
              最初の年収を報告する
            </Link>

            {/* データが集まるとこうなる（イメージ） */}
            <div style={{ marginTop: 32, padding: "16px", background: "var(--bg-tint)", borderRadius: 12, textAlign: "left" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                データが集まると表示されるもの（イメージ）
              </p>
              {DUMMY_REPORTS.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line-soft)", opacity: 0.4 }}>
                  <span style={{ flex: 2, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.role}</span>
                  <span style={{ flex: 2, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>{r.company}</span>
                  <span style={{ flex: 1, textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--success)", fontFamily: "Inter,sans-serif" }}>{r.salary}万</span>
                  <span style={{ flex: 1, textAlign: "right", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{r.yoe}年</span>
                </div>
              ))}
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "10px 0 0", textAlign: "center" }}>
                ※ これはイメージです。実際のデータは報告が集まり次第表示されます。
              </p>
            </div>
          </div>
        </div>

        {/* ── ② 参考データ（求人票ベース・明確にラベリング）── */}
        <div style={{ padding: "20px 24px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>
                以下は「求人票」ベースの参考データです
              </p>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#b45309", margin: 0, lineHeight: 1.65 }}>
                企業が求人票に記載した希望年収レンジの集計値であり、<strong>実際に在籍した社員の年収ではありません。</strong>
                参考情報としてご活用ください。実際の年収はこれより高い・低い場合があります。
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-soft)", margin: 0 }}>
            📋 参考：求人票の年収レンジ
            {filtered.length < stats.length && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 8 }}>{filtered.length}件</span>
            )}
          </h2>
        </div>

        {/* 検索結果なし */}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--ink-mute)", fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--ink)" }}>該当する職種が見つかりませんでした</p>
            <p style={{ margin: 0, fontSize: 13 }}>検索キーワードを変えてみてください</p>
          </div>
        )}

        {/* 求人票カード（全件表示・ゲートなし） */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((s) => {
            const barPct = Math.round((s.avgMax / maxBar) * 100);
            return (
              <Link key={s.slug} href={`/salary/${s.slug}`} className="sc-card" style={{ opacity: 0.85 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{s.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                        求人票 {s.jobCount}件
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink-soft)", fontFamily: "Inter,sans-serif" }}>
                        {fmtMan(s.avgMin)}〜{fmtMan(s.avgMax)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>万円（求人票平均レンジ）</span>
                    </div>
                    <div className="sc-bar-outer" style={{ marginTop: 10 }}>
                      <div style={{ height: 8, borderRadius: 100, background: "linear-gradient(90deg,#d97706,#f59e0b)", width: `${barPct}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "Inter,sans-serif" }}>
                      <span>下限 {fmtMan(s.avgMin)}万</span>
                      <span>中央 {Math.round((s.avgMin + s.avgMax) / 2)}万</span>
                      <span>上限 {fmtMan(s.avgMax)}万</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 2 }}>求人票最高</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-soft)", fontFamily: "Inter,sans-serif" }}>
                      {fmtMan(s.maxSalary)}<span style={{ fontSize: 12, fontWeight: 500 }}>万円</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-mute)", fontWeight: 600 }}>
                      求人を見る →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
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
            <Link href="/mypage" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
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

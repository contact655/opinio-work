"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { COVERAGE_COLUMNS } from "./columns";

export type CoverageRow = {
  id: string;
  slug: string | null;
  name: string;
  /** 列key → 埋まっているか */
  filled: Record<string, boolean>;
  filledCount: number;
};

const TOTAL = COVERAGE_COLUMNS.length;

/**
 * 企業データの充填状況（運営の作業管理用）。
 *
 * ⚠️ **データはサーバー（page.tsx + createAdminClient）で取る。**
 *    ここでブラウザ側の Supabase クライアントを使わないこと。
 *
 * ⚠️ 76社を1画面で俯瞰したいので、ページネーションは置かない。密度を優先する。
 */
export default function CoverageClient({ rows, testCount }: { rows: CoverageRow[]; testCount: number }) {
  /** 「この項目が空の企業だけ」に絞る。列ヘッダのクリックで切り替える */
  const [emptyOnly, setEmptyOnly] = useState<string | null>(null);
  /** 空が多い順（既定） / 社名順 */
  const [sortByEmpty, setSortByEmpty] = useState(true);

  const visible = useMemo(() => {
    const list = emptyOnly ? rows.filter((r) => !r.filled[emptyOnly]) : rows;
    return [...list].sort((a, b) =>
      sortByEmpty ? a.filledCount - b.filledCount || a.name.localeCompare(b.name, "ja")
                  : a.name.localeCompare(b.name, "ja"));
  }, [rows, emptyOnly, sortByEmpty]);

  /** 列ごとの空件数。ヘッダに出して「どの項目が遅れているか」を見る */
  const emptyCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const col of COVERAGE_COLUMNS) m[col.key] = rows.filter((r) => !r.filled[col.key]).length;
    return m;
  }, [rows]);

  const th: React.CSSProperties = {
    position: "sticky", top: 0, zIndex: 1, background: "#F8FAFC",
    borderBottom: "1px solid #E2E8F0", padding: "6px 4px",
    fontSize: 11, fontWeight: 700, color: "#475569", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    borderBottom: "1px solid #F1F5F9", padding: "4px", fontSize: 12, textAlign: "center",
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>充填状況</h1>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          公開 {rows.length} 社 × {TOTAL} 項目／全項目そろっている企業{" "}
          <strong style={{ color: "#0F172A" }}>{rows.filter((r) => r.filledCount === TOTAL).length}</strong> 社
          {/* ⚠️ 検証用の企業は表から外すが、件数は必ず出す。
                 完全に隠すと「見えていないだけ」を自分で作ることになる。 */}
          {testCount > 0 && (
            <span style={{ marginLeft: 8, color: "#94A3B8" }} title="is_test = true の企業。表からは除外している">
              （テスト {testCount} 社を除く）
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px", lineHeight: 1.8 }}>
        公開情報から機械的に取れる項目だけを並べています（取材が要る項目は入れていません）。
        <br />
        列見出しをクリックすると<strong>その項目が空の企業だけ</strong>に絞れます。
        <br />
        空のマスは、運営画面に入力欄がある項目は <strong style={{ color: "#B45309" }}>＋</strong>（押すと該当タブが開く）、
        migration で投入する項目は <strong>−</strong> で示しています。
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setSortByEmpty((v) => !v)}
          style={{
            padding: "6px 14px", borderRadius: 100, border: "1px solid #E2E8F0",
            background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
        >
          並び: {sortByEmpty ? "空が多い順" : "社名順"}
        </button>
        {emptyOnly && (
          <button
            type="button"
            onClick={() => setEmptyOnly(null)}
            style={{
              padding: "6px 14px", borderRadius: 100, border: "1px solid var(--royal)",
              background: "var(--royal)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            「{COVERAGE_COLUMNS.find((c) => c.key === emptyOnly)?.label}」が空の {visible.length} 社 ✕
          </button>
        )}
      </div>

      {/* ⚠️ 横に長いので、表だけを横スクロールさせる（ページ全体を横に伸ばさない） */}
      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", paddingLeft: 12, minWidth: 200 }}>企業</th>
              <th style={{ ...th, minWidth: 46 }} title={`${TOTAL}項目中いくつ埋まっているか`}>件数</th>
              {COVERAGE_COLUMNS.map((col) => (
                <th key={col.key} style={{ ...th, minWidth: 52 }} title={col.title}>
                  <button
                    type="button"
                    onClick={() => setEmptyOnly((v) => (v === col.key ? null : col.key))}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                      color: emptyOnly === col.key ? "var(--royal)" : "#475569",
                      textDecoration: emptyOnly === col.key ? "underline" : "none",
                    }}
                  >
                    {col.label}
                    <br />
                    <span style={{ fontWeight: 500, color: emptyCount[col.key] > 0 ? "#B45309" : "#059669" }}>
                      {emptyCount[col.key] === 0 ? "済" : `空${emptyCount[col.key]}`}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 12 }}>
                  <Link href={`/admin/companies/${r.id}`} style={{ color: "#0F172A", fontWeight: 600, textDecoration: "none" }}>
                    {r.name}
                  </Link>
                </td>
                <td style={{ ...td, fontFamily: "Inter, sans-serif", fontWeight: 700,
                             color: r.filledCount === TOTAL ? "#059669" : r.filledCount <= 3 ? "#DC2626" : "#475569" }}>
                  {r.filledCount}
                </td>
                {COVERAGE_COLUMNS.map((col) => (
                  <td key={col.key} style={{ ...td, background: r.filled[col.key] ? undefined : "#FFFBEB" }}>
                    {/* ⚠️ 空のマスだけリンクにする。埋まっているマスまでリンクにすると
                           どこを押せばよいか分からなくなる */}
                    {r.filled[col.key] ? (
                      <span style={{ color: "#059669" }} aria-label="入力済み">✓</span>
                    ) : col.editable ? (
                      <Link
                        href={`/admin/companies/${r.id}?tab=${col.tab}`}
                        aria-label={`${r.name} の ${col.title} を入力する`}
                        style={{ display: "block", color: "#B45309", textDecoration: "none", fontSize: 14, lineHeight: 1 }}
                      >
                        ＋
                      </Link>
                    ) : (
                      /* ⚠️ 入力欄が無い列はリンクにしない（2026-08-12）。
                            `?tab=opinio` に飛ばしても該当の入力欄が無く、
                            「押せるが何も入力できない」リンクになっていた。
                            マス自体は残す。消すと「空である」ことが読めなくなる。 */
                      <span style={{ color: "#CBD5E1" }} aria-label="未入力（migration で投入）">−</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 16 }}>
          該当する企業はありません。
        </p>
      )}
    </div>
  );
}

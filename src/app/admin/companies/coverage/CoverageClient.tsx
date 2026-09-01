"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { COVERAGE_COLUMNS } from "./columns";
import { COMPANY_SOURCE_KIND_LABELS, isCompanySourceStale,
         COMPANY_SOURCE_STALE_AFTER_DAYS, type CompanySourceKind } from "@/lib/constants/companySources";

/** 本社所在地の出典（`ow_company_data_sources`）。⚠️ 運営専用。求職者にも企業にも出さない。 */
export type AddressSource = { kind: CompanySourceKind; url: string | null; verifiedAt: string };

export type CoverageRow = {
  id: string;
  slug: string | null;
  name: string;
  /** 列key → 埋まっているか */
  filled: Record<string, boolean>;
  filledCount: number;
  /** ⚠️ null は「出典が記録されていない」。住所が入っているのに null なら記録漏れ。 */
  addressSource: AddressSource | null;
};

/** 本社のマスに出す1文字の印。⚠️ 色分けはしない（凡例のない色を増やさない）。 */
const SOURCE_MARK: Record<CompanySourceKind, string> = {
  registry: "登", official_site: "公", company_input: "社", unknown: "?",
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
export default function CoverageClient(
  { rows, testCount, sourcesUnavailable }:
  { rows: CoverageRow[]; testCount: number; sourcesUnavailable: boolean },
) {
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

  /** 本社の出典の内訳。⚠️ 母数は「住所が入っている企業」であって全社ではない。 */
  const srcStat = useMemo(() => {
    const withAddr = rows.filter((r) => r.filled.headquarters_address);
    const byKind: Record<string, number> = {};
    let noUrl = 0, missing = 0, stale = 0;
    for (const r of withAddr) {
      const s = r.addressSource;
      if (!s) { missing++; continue; }
      byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
      /* ⚠️ `unknown` は**数えない**。出所そのものが分かっていないので定義上URLを持てず
            （DB の CHECK で禁じている）、「? 不明」として別に出している。
            ここに混ぜると**二重計上**になり、「URLを調べれば埋まる件数」がずれる。 */
      if (!s.url && s.kind !== "unknown") noUrl++;
      if (isCompanySourceStale(s.verifiedAt)) stale++;
    }
    return { withAddr: withAddr.length, byKind, noUrl, missing, stale };
  }, [rows]);

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
        空のマスは、運営画面に入力欄がある項目は <strong style={{ color: "var(--warm-ink)" }}>＋</strong>（押すと該当タブが開く）、
        migration で投入する項目は <strong>−</strong> で示しています。
      </p>

      {/* ── 本社所在地の出典（`ow_company_data_sources`）────────────────────────
             ⚠️ **取得に失敗したら「0件」と出さない。** 判定できないことを明示する
                （CLAUDE.md「取得に失敗したら『0件』と表示しない」）。 */}
      <div style={{
        marginBottom: 14, padding: "10px 14px", borderRadius: 8,
        background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12, color: "#475569", lineHeight: 1.9,
      }}>
        {sourcesUnavailable ? (
          <span role="alert" style={{ color: "#991B1B", fontWeight: 700 }}>
            出典の取得に失敗しました（0件という意味ではありません）
          </span>
        ) : (
          <>
            <strong style={{ color: "#0F172A" }}>本社所在地の出典</strong>
            {" — 住所あり "}<strong style={{ color: "#0F172A" }}>{srcStat.withAddr}</strong>{" 社のうち "}
            {(Object.keys(SOURCE_MARK) as CompanySourceKind[])
              .filter((k) => srcStat.byKind[k])
              .map((k) => `${SOURCE_MARK[k]} ${COMPANY_SOURCE_KIND_LABELS[k]} ${srcStat.byKind[k]}`)
              .join(" ／ ")}
            {srcStat.noUrl > 0 && (
              <>
                {" ／ "}
                <strong style={{ color: "#0F172A" }} title="出典の種別は分かっているが、確認したページのURLが記録されていない">
                  URL未記録 {srcStat.noUrl}
                </strong>
              </>
            )}
            {srcStat.missing > 0 && (
              <>
                {" ／ "}
                <strong style={{ color: "#DC2626" }} title="住所は入っているのに出典の記録が無い。入れた人が記録し忘れている">
                  出典なし {srcStat.missing}
                </strong>
              </>
            )}
            {srcStat.stale > 0 && (
              <>
                {" ／ "}
                <strong style={{ color: "#DC2626" }} title={`最後に突き合わせてから ${COMPANY_SOURCE_STALE_AFTER_DAYS} 日を超えている`}>
                  要再確認 {srcStat.stale}
                </strong>
              </>
            )}
            <br />
            {/* ⚠️★登記と公式サイトは**意味が違う**。ここを読む人が混同しないよう毎回書く。 */}
            <span style={{ color: "#64748B" }}>
              ⚠️ <strong>登</strong>＝登記上の<strong>本店</strong>所在地（国税庁）、
              <strong>公</strong>＝公式サイトの<strong>オフィス</strong>所在地。
              一致する保証はありません。本社のマスの印にカーソルを当てると出典が出ます。
            </span>
          </>
        )}
      </div>

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
                    <span style={{ fontWeight: 500, color: emptyCount[col.key] > 0 ? "var(--warm-ink)" : "#059669" }}>
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
                <td style={{ ...td, fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700,
                             color: r.filledCount === TOTAL ? "#059669" : r.filledCount <= 3 ? "#DC2626" : "#475569" }}>
                  {r.filledCount}
                </td>
                {COVERAGE_COLUMNS.map((col) => (
                  <td key={col.key} style={{ ...td, background: r.filled[col.key] ? undefined : "#FFFBEB" }}>
                    {/* ⚠️ 空のマスだけリンクにする。埋まっているマスまでリンクにすると
                           どこを押せばよいか分からなくなる */}
                    {/* ★本社だけ、埋まっているマスに**出典の印**を出す（2026-08-30）。
                           ⚠️ 色分けはしない。印は1文字（登/公/社/?）で、詳細は title に入れる。
                              凡例のない色を増やさないため（ui-conventions「色の役割」）。
                           ⚠️ **住所があるのに出典が無い行を「✓」で流さない。**
                              記録漏れが読めなくなる。 */}
                    {r.filled[col.key] && col.key === "headquarters_address" ? (
                      r.addressSource ? (
                        <span
                          title={[
                            `出典: ${COMPANY_SOURCE_KIND_LABELS[r.addressSource.kind]}`,
                            r.addressSource.url ?? "URLは記録されていません",
                            `最終確認: ${r.addressSource.verifiedAt.slice(0, 10)}`,
                            isCompanySourceStale(r.addressSource.verifiedAt)
                              ? `⚠️ ${COMPANY_SOURCE_STALE_AFTER_DAYS}日を超えています` : "",
                          ].filter(Boolean).join("\n")}
                          style={{
                            display: "inline-block", minWidth: 18, padding: "0 4px", borderRadius: 4,
                            border: "1px solid #E2E8F0", background: "#F8FAFC",
                            fontSize: 11, fontWeight: 700, color: "#475569", cursor: "help",
                          }}
                        >
                          {SOURCE_MARK[r.addressSource.kind]}
                        </span>
                      ) : (
                        <span title="住所は入っているが、出典が記録されていません"
                              style={{ color: "#DC2626", fontWeight: 700 }} aria-label="出典なし">✓!</span>
                      )
                    ) : r.filled[col.key] ? (
                      <span style={{ color: "#059669" }} aria-label="入力済み">✓</span>
                    ) : col.editable ? (
                      <Link
                        href={`/admin/companies/${r.id}?tab=${col.tab}`}
                        aria-label={`${r.name} の ${col.title} を入力する`}
                        style={{ display: "block", color: "var(--warm-ink)", textDecoration: "none", fontSize: 14, lineHeight: 1 }}
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

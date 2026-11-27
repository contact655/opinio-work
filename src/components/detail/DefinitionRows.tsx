import type React from "react";

/**
 * ★項目名と中身を並べる表（2026-11-26 / 柴さんの指示。企業詳細・募集詳細で共通）。
 *   それまでの SpecTable（項目名150px・灰色の背景・外枠）を置き換えた。
 *
 * - 左に項目名（dt・幅120px）、右に中身（dd）。行の間に区切り線
 * - 値が空の行は出さない（呼び出し側で落とさなくてよい）。1行も無ければ何も描かない
 * - 640px 以下は項目名を上、中身を下に並べる
 * - `compact`（幅の狭いサイドバー用）は項目名を96px にし、文字を小さくする
 * - 値は文字列なら改行をそのまま行替えにする（企業が改行で区切って書いた値）
 *
 * ⚠️ 幅と余白は下の style タグが持つ。インラインに戻すとスマホで縦に並べられなくなる。
 * ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（ハイドレーションが壊れる）。
 */
export type DefinitionRow = { label: string; value: React.ReactNode };

function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasValue);
  return true;
}

export function DefinitionRows({ rows, ariaLabel, compact = false }: {
  rows: DefinitionRow[];
  ariaLabel?: string;
  compact?: boolean;
}) {
  const shown = rows.filter((r) => hasValue(r.value));
  if (shown.length === 0) return null;
  return (
    <>
      <style>{`
        .def-rows { margin: 0; }
        .def-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); column-gap: 16px; padding: 12px 0; }
        .def-row + .def-row { border-top: 1px solid var(--line); }
        .def-row dt { font-size: 13px; font-weight: 700; color: var(--ink-soft); line-height: 1.8; }
        .def-row dd { margin: 0; font-size: 15px; line-height: 1.85; color: var(--ink); min-width: 0; overflow-wrap: anywhere; white-space: pre-line; }
        .def-rows--compact .def-row { grid-template-columns: 96px minmax(0, 1fr); column-gap: 12px; padding: 10px 0; }
        .def-rows--compact .def-row dt { font-size: 12.5px; }
        .def-rows--compact .def-row dd { font-size: 13.5px; line-height: 1.75; }
        @media (max-width: 640px) {
          .def-row, .def-rows--compact .def-row { grid-template-columns: minmax(0, 1fr); row-gap: 2px; }
          .def-row dd { font-size: 14.5px; }
        }
      `}</style>
      <dl className={compact ? "def-rows def-rows--compact" : "def-rows"} aria-label={ariaLabel}>
        {shown.map((r) => (
          <div key={r.label} className="def-row" data-def-row={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * セルの中で、小見出し付きの行を縦に並べる（「試用期間：4か月」など）。
 * ⚠️ 部品ではなく関数にしてある。値が1つも無いときに null を返し、DefinitionRows がその行ごと落とせるように
 *    （要素を返すと「中身の無い要素」も値ありに見え、空の行が出る）。
 */
export function specLines(lines: { label?: string; value: string | null | undefined }[]): React.ReactNode {
  const shown = lines.filter((l) => l.value && l.value.trim());
  if (shown.length === 0) return null;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {shown.map((l, i) => (
        <span key={i}>
          {l.label && <span style={{ color: "var(--ink-soft)" }}>{l.label}：</span>}
          {l.value}
        </span>
      ))}
    </span>
  );
}

/**
 * 左に見出しの列を置いた2列の表（2026-11-26 / 求人ページの「募集要項」「会社概要」）。
 *
 * - 値が無い行は出さない（呼び出し側で落とさなくてよい）。1行も無ければ何も描かない
 * - 見出しの列は 150px・薄いグレーの背景。640px 以下は 96px に縮める
 * - 値は文字列なら改行をそのまま行替えにする（求人の補足は改行で区切って書かれている）
 *
 * ⚠️ 幅と余白は下の style タグが持つ。インラインに戻すとスマホで縮められなくなる。
 * ⚠️ style タグの中に不等号・バッククォートを書かない（ハイドレーションが壊れる）。
 */
export type SpecRow = { label: string; value: React.ReactNode };

function hasValue(v: React.ReactNode): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasValue);
  return true;
}

export function SpecTable({ rows, ariaLabel }: { rows: SpecRow[]; ariaLabel?: string }) {
  const shown = rows.filter((r) => hasValue(r.value));
  if (shown.length === 0) return null;
  return (
    <>
      <style>{`
        .spec-table { margin: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
        .spec-row { display: grid; grid-template-columns: 150px minmax(0, 1fr); }
        .spec-row + .spec-row { border-top: 1px solid var(--line); }
        .spec-row dt { background: var(--bg-tint); padding: 14px 16px; font-size: 13px; font-weight: 700; color: var(--ink-soft); line-height: 1.7; }
        .spec-row dd { margin: 0; padding: 14px 16px; font-size: 15px; line-height: 1.9; color: var(--ink); min-width: 0; overflow-wrap: anywhere; white-space: pre-line; }
        @media (max-width: 640px) {
          .spec-row { grid-template-columns: 96px minmax(0, 1fr); }
          .spec-row dt { padding: 12px 10px; font-size: 12px; }
          .spec-row dd { padding: 12px 12px; font-size: 14px; }
        }
      `}</style>
      <dl className="spec-table" aria-label={ariaLabel}>
        {shown.map((r) => (
          <div key={r.label} className="spec-row" data-spec-row={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * 表のセルの中で、小見出し付きの行を縦に並べる（「試用期間：4か月」など）。
 * ⚠️ 部品ではなく関数にしてある。値が1つも無いときに null を返し、SpecTable がその行ごと落とせるように
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

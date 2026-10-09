"use client";

/**
 * 一覧の「詳細検索」まわりの共通部品（2026-10-09）。
 *
 * ⚠️★ /companies・/jobs・/people の3つが使う。ページ側に同じボタンを書き直さないこと。
 *    それまで3ページに別々の実装があり、active の色・チェブロンの字形・バッジの余白・
 *    選択中のチップの大きさがページごとに少しずつ違っていた（docs/list-filters-20261009.md）。
 * ⚠️ 見た目は globals.css の `.csb-filter-toggle` / `.csb-active-chips` / `.csb-active-chip`
 *    （/companies のもの）に揃えた。クラス名は /companies 由来のまま。
 * ⚠️ 軸（何で絞るか）はページごとに違うので、ここには持たない。
 */

export type ActiveFilter = { key: string; label: string; clear: () => void };

/** 「詳細検索」ボタン。⚠️ 768px 未満はラベルが消える（`.tb-collapse-label`）ので、
 *  アイコンとバッジを外さないこと。 */
export function DetailSearchToggle({
  open,
  count,
  onToggle,
}: {
  open: boolean;
  /** いま効いている条件の数。0 ならバッジを出さない */
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`csb-filter-toggle tb-collapse-label${open || count > 0 ? " active" : ""}`}
      aria-label="詳細検索"
      aria-expanded={open}
      onClick={onToggle}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="11" y1="18" x2="13" y2="18" />
      </svg>
      <span className="tb-label">詳細検索</span>
      {count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 100,
          background: "var(--royal)", color: "#fff",
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>{count}</span>
      )}
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
        style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}>
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * 選択中の条件のチップ。
 *
 * ⚠️★**詳細検索を閉じているときだけ出す**（呼び出し側で `!open` を渡す）。開いているときは
 *    ピル自身が選択状態を持っているので同じ語が2回並ぶ（/jobs 2026-09-09 の判断）。
 * ⚠️★**閉じているときに消さないこと。** 消すと絞り込んだ理由が画面から消える。
 * ⚠️ 行は `flex-basis: 100%` で必ず折る（同じ行だと開閉のたびに「詳細検索」が左右に動く）。
 */
export function ActiveFilterChips({ chips }: { chips: ActiveFilter[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="csb-active-chips">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="csb-active-chip"
          onClick={c.clear}
          aria-label={`${c.label} の絞り込みを外す`}
        >
          {c.label}
          <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.75 }}>✕</span>
        </button>
      ))}
    </div>
  );
}

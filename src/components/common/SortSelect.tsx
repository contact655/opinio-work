"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 並び替えのドロップダウン（2026-09-17）。**3つの一覧で同じものを使う。**
 *
 * ── ⚠️★なぜ部品にしたか ────────────────────────────────────────────────────
 * 同じ「並び替え」が **3箇所に別々の実装**で存在していた
 * （`/jobs` は `JobsClient` に直書き、`/companies` は `GridSortBar` の `.sort-btn`、
 *  `/people` は `PeopleListClient` に直書き）。見た目も余白も少しずつ違っていた。
 * CLAUDE.md が「同じ操作が2つの一覧で別の見た目だった」を理由にビュートグルを
 * 揃えたのと同じ問題なので、**1箇所にまとめてある。**
 *
 * ── ⚠️★ピルを並べる形から変えた理由 ──────────────────────────────────────
 * 実測（2026-09-17 / 1440px）: `/jobs` は **513px**、`/companies` は **約345px** を
 * 並び替えだけで使っていた。ツールバーを1行にしたので、ここが一番かさばる。
 * ドロップダウンなら **約140px**。
 *
 * ⚠️★**いま何順かは閉じていても見える**（ボタンに現在値を出す）。
 *    隠れるのは「他の選択肢」だけ。**絞り込みのチップとは事情が違う**
 *    ——あちらは「効いている条件」が消えるので `activeChips` を外に出す必要があった。
 *
 * ⚠️★**「3つ以上で畳む」という線引きは置いた当日に取り下げた**（2026-09-17 / 柴さんの指示）。
 *    `/people` は選択肢が2つなので当初ピルのまま残したが、**3つの一覧で同じ操作が
 *    同じ見た目であること**を優先して揃えた。
 *    ⚠️ 代償は分かっている ——**2つのときは1クリックが2クリックになる。**
 *       それでも揃えたのは、ビュートグルを 2026-08-27 に揃えたのと同じ理由
 *       （CLAUDE.md「同じ操作が2つの一覧で別の見た目だった」）。
 *    ⚠️★**件数で出し分けないこと。** 「2つならピル、3つ以上はドロップダウン」にすると、
 *       選択肢を1つ足した日に**操作の形が黙って変わる**。
 */
export function SortSelect({
  value,
  options,
  onChange,
  label = "並び替え",
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  /* ⚠️★メニューは `position: fixed`。`/jobs` のフィルターピルと同じ理由で、
        **祖先の overflow に切られるのを避ける**ため（あちらのコメント参照）。
     ⚠️ fixed はスクロールに追従しないので、**スクロールしたら閉じる。**
        追従させようとすると、sticky なツールバーとの兼ね合いで座標が合わなくなる。 */
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        /* ⚠️★狭い画面ではラベルの語を隠す（下）ので、**読み上げ名はここで固定する**。
              付けないと、隠れたときに「新着順」としか読まれず何の操作か分からない。 */
        aria-label={label}
        className="sort-select-btn"
        onClick={() => {
          if (open) { setOpen(false); return; }
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 6, left: r.left });
          setOpen(true);
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        {/* ⚠️★現在値（下の strong）を必ず出す。出さないと「いま何順か」が画面から消える。
            ⚠️★**語のほう（「並び替え」）は 767px 以下で隠れる**（globals.css の
               `.sort-select-label`）。狭い画面では 158px の横幅が収まらず、
               ツールバーが1行ぶん増えていた（`/articles` で実測 204px -> 160px）。
               隠れても**アイコンと現在値は残る**し、読み上げ名は上の `aria-label` が持つ。
            ⚠️ ここに `display` をインラインで書かないこと —— インラインは CSS に勝つので、
               メディアクエリが効かなくなる（このリポジトリで何度も踏んでいる形）。 */}
        <span className="sort-select-label" style={{ color: "var(--ink-mute)", fontWeight: 500 }}>{label}</span>
        <strong style={{ fontWeight: 700 }}>{current?.label}</strong>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
             style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && anchor && (
        <div ref={menuRef} className="sort-select-menu" role="listbox"
             style={{ position: "fixed", top: anchor.top, left: anchor.left, zIndex: 1200 }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`sort-select-item${o.value === value ? " selected" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import React from "react";

/**
 * 一覧（グリッド）／詳細（1列＋分割）の切り替えトグル。
 *
 * ⚠️★**見た目の出どころはここ1箇所。** 2026-10-01 に `GridSortBar` から切り出した。
 *    `/jobs` に同じものが要るようになったときに**4つ目の複製を作らない**ため
 *    （`FilterChip` が2つに割れていた前例。CLAUDE.md「同じ名前の別実装を作らない」）。
 *
 * ⚠️★**表示だけを持つ。値の持ち方は呼び出し側が決める。**
 *    `/companies` と `/jobs` は URL（`?view=`）、`/people` は localStorage で、
 *    **持ち方が違う**。ここに `useSearchParams` を入れると `/people` が使えなくなる。
 *
 * ⚠️ `.view-btn` の CSS は `globals.css`（`GridSortBar` 用に書かれたもの）。
 *    class 名を変えないこと。
 *
 * ⚠️★**まだ `/people` と `/articles` は自前の複製を持っている**（意匠だけ合わせてある）。
 *    次にあちらを触るときにここへ寄せること。**先回りで3画面を書き換えない**
 *    （`/people` は値の持ち方が違い、`/articles` は選択肢の意味が違う）。
 *
 * ⚠️ 語は「一覧」「詳細」。**変えるときは4画面すべて**（`/companies` ・ `/jobs` ・
 *    `/people` ・ `/articles`）を同時に変えること。片方だけだと同じ操作が別の名前になる。
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: "card" | "list";
  onChange: (v: "card" | "list") => void;
}) {
  /* ★2026-11-12: /people と同じ見た目にした（柴さんの指示「並び替えと表示切替も /people とそろえて」）。
        濃紺の塗りと「一覧」「詳細」の文字をやめ、白地に枠の丸い入れ物とアイコンだけのボタン（選んでいる方だけ薄い灰色）。
     ⚠️ 読み上げ名は aria-label（「一覧で表示」「詳細で表示」）。見た目の文字が無いので外さないこと。
     ⚠️ CSS は globals.css の .lt-view-toggle / .lt-view-btn（/people の .ppl-view-toggle と同じ値） */
  return (
    /* ⚠️ `display` は CSS（`.view-toggle`）。スマホ（767px 以下）では出さないため（2026-10-17。
          スマホの一覧は1列なので切り替える意味が薄い）。インラインに戻さないこと */
    <div role="group" aria-label="表示の切り替え" className="view-toggle lt-view-toggle">
      <button
        type="button"
        onClick={() => onChange("card")}
        className="lt-view-btn btn-fixed-size"
        title="一覧"
        aria-label="一覧で表示"
        aria-pressed={value === "card"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className="lt-view-btn btn-fixed-size"
        title="詳細"
        aria-label="詳細で表示"
        aria-pressed={value === "list"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </div>
  );
}

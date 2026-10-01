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
  return (
    <div style={{
      display: "flex", gap: 2,
      background: "var(--line-soft)", borderRadius: 8, padding: 2,
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => onChange("card")}
        className="view-btn"
        style={{
          background: value === "card" ? "var(--royal)" : "transparent",
          color: value === "card" ? "#fff" : "var(--ink-mute)",
        }}
        title="コンパクト一覧"
        aria-pressed={value === "card"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        一覧
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className="view-btn"
        style={{
          background: value === "list" ? "var(--royal)" : "transparent",
          color: value === "list" ? "#fff" : "var(--ink-mute)",
        }}
        title="詳細リストビュー"
        aria-pressed={value === "list"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
        詳細
      </button>
    </div>
  );
}

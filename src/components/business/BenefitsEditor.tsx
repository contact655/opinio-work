"use client";

import React, { useState } from "react";
import { BENEFIT_CATEGORIES, benefitCategoryOf, groupBenefitsByCategory, isBenefitCategory, type Benefit, type BenefitCategory } from "@/lib/companies/benefits";

/**
 * 福利厚生の入力（名前 ＋ 任意の詳細）。2026-08-31 に新設。
 *
 * ⚠️★**`RequirementsTagInput` を拡張しなかった理由。**
 *    あれは求人フォーム（`JobEditForm`）でも使う共通部品で、
 *    必須スキル・歓迎スキルは**名前だけ**でよい。詳細のために props を足すと、
 *    使う側ごとに形が違う部品になる。**福利厚生専用にここへ切り出す。**
 *
 * ⚠️ 詳細は**任意**（柴さん・2026-08-31）。89社中2社しか福利厚生を持たない現状で
 *    必須にすると、入力の摩擦が増えるだけ。
 *
 * ★カテゴリ（2026-11-28 / 柴さんの指示）。追加するときに7つから選ぶ（必須）。一覧もカテゴリごとにまとめて出す。
 *   カテゴリの無い既存の項目は「その他」に入る。項目ごとにカテゴリを変えられる。
 *
 * ⚠️★**空文字の詳細を保存しないこと。** 保存は `serializeBenefits` が
 *    「空ならキーごと省く」形に整える。ここで `detail: ""` を作っても
 *    向こうで落ちるが、**画面の状態としても空文字を持たない**ほうが分かりやすい。
 */
export function BenefitsEditor({
  items, onChange,
}: {
  items: Benefit[];
  onChange: (next: Benefit[]) => void;
}) {
  const [draft, setDraft] = useState("");
  /* ★カテゴリは必須。選ぶまで「追加」を押せない */
  const [draftCategory, setDraftCategory] = useState<BenefitCategory | "">("");

  const add = () => {
    const name = draft.trim();
    if (!name || !draftCategory) return;
    /* ⚠️ 同じ名前を2つ作らせない。詳細がどちらに付くか分からなくなる */
    if (items.some((b) => b.name === name)) { setDraft(""); return; }
    onChange([...items, { name, category: draftCategory }]);
    setDraft("");
  };

  /* ⚠️ 項目を作り直すときに category を落とさない（2026-11-28 まで detail 以外のキーを捨てていた） */
  const setDetail = (i: number, detail: string) => {
    const next = items.slice();
    const d = detail.trim();
    /* ⚠️ 空なら `detail` を**持たせない**（キーごと消す） */
    const { detail: _old, ...rest } = next[i];
    void _old;
    next[i] = d ? { ...rest, detail } : rest;
    onChange(next);
  };

  const setCategory = (i: number, category: string) => {
    if (!isBenefitCategory(category)) return;
    const next = items.slice();
    next[i] = { ...next[i], category };
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));

  /* 一覧はカテゴリごとにまとめる（元の並びの番号を持ったまま） */
  const groups = groupBenefitsByCategory(items.map((b, i) => ({ ...b, idx: i })));

  const selectStyle: React.CSSProperties = {
    padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14,
    fontFamily: "inherit", background: "#fff", color: "var(--ink)",
  };

  return (
    <div>
      {/* 追加（カテゴリは必須） */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: items.length ? 14 : 0 }}>
        <select
          value={draftCategory}
          onChange={(e) => setDraftCategory(isBenefitCategory(e.target.value) ? e.target.value : "")}
          aria-label="カテゴリ"
          data-state="benefit-new-category"
          style={{ ...selectStyle, flex: "0 0 auto" }}
        >
          <option value="">カテゴリを選ぶ</option>
          {BENEFIT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="例: 書籍・学習費用補助"
          style={{
            flex: "1 1 200px", minWidth: 0, padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--line)", fontSize: 14, fontFamily: "inherit",
          }}
        />
        <button
          type="button" onClick={add}
          disabled={!draft.trim() || !draftCategory}
          style={{
            padding: "10px 18px", borderRadius: 8, border: 0,
            background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: !draft.trim() || !draftCategory ? "default" : "pointer", flexShrink: 0,
            opacity: !draft.trim() || !draftCategory ? 0.5 : 1,
          }}
        >追加</button>
      </div>
      {draft.trim() && !draftCategory && (
        <p style={{ margin: "-6px 0 12px", fontSize: 12.5, color: "var(--ink-mute)" }}>カテゴリを選ぶと追加できます</p>
      )}

      {/* 一覧。カテゴリごとにまとめ、1件ずつ「名前」「カテゴリ」「詳細（任意）」を持つ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <div key={g.key} data-state={`benefit-group-${g.key}`}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>{g.label}（{g.items.length}）</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.items.map((b) => {
                const i = b.idx;
                return (
                  <div key={`${b.name}-${i}`} style={{
                    border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
                    background: "var(--bg-tint)",
                  }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ flex: "1 1 160px", minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>
                        {b.name}
                      </span>
                      <select
                        value={benefitCategoryOf(b)}
                        onChange={(e) => setCategory(i, e.target.value)}
                        aria-label={`${b.name} のカテゴリ`}
                        style={{ ...selectStyle, padding: "5px 8px", fontSize: 13 }}
                      >
                        {BENEFIT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <button
                        type="button" onClick={() => remove(i)}
                        aria-label={`${b.name} を削除`}
                        style={{
                          border: "1px solid var(--line)", background: "#fff", borderRadius: 8,
                          padding: "4px 10px", fontSize: 12, color: "var(--ink-mute)",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >削除</button>
                    </div>
                    <input
                      value={b.detail ?? ""}
                      onChange={(e) => setDetail(i, e.target.value)}
                      placeholder="詳細（任意）例: 年間65万円（学習機関の指定あり）"
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: 8,
                        border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit",
                        background: "#fff",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          まだ登録がありません。カテゴリを選び、項目名を入力して「追加」を押してください。
        </p>
      )}
    </div>
  );
}

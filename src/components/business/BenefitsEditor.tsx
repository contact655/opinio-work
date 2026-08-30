"use client";

import React, { useState } from "react";
import type { Benefit } from "@/lib/companies/benefits";

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

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    /* ⚠️ 同じ名前を2つ作らせない。詳細がどちらに付くか分からなくなる */
    if (items.some((b) => b.name === name)) { setDraft(""); return; }
    onChange([...items, { name }]);
    setDraft("");
  };

  const setDetail = (i: number, detail: string) => {
    const next = items.slice();
    const d = detail.trim();
    /* ⚠️ 空なら `detail` を**持たせない**（キーごと消す） */
    next[i] = d ? { name: next[i].name, detail } : { name: next[i].name };
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, k) => k !== i));

  return (
    <div>
      {/* 追加 */}
      <div style={{ display: "flex", gap: 8, marginBottom: items.length ? 14 : 0 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="例: 書籍・学習費用補助"
          style={{
            flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--line)", fontSize: 14, fontFamily: "inherit",
          }}
        />
        <button
          type="button" onClick={add}
          style={{
            padding: "10px 18px", borderRadius: 8, border: 0,
            background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: "pointer", flexShrink: 0,
          }}
        >追加</button>
      </div>

      {/* 一覧。1件ずつ「名前」と「詳細（任意）」を持つ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((b, i) => (
          <div key={`${b.name}-${i}`} style={{
            border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
            background: "var(--bg-tint)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {b.name}
              </span>
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
        ))}
      </div>

      {items.length === 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          まだ登録がありません。項目名を入力して「追加」を押してください。
        </p>
      )}
    </div>
  );
}

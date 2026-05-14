"use client";

import { useState } from "react";
import GenreChipSelector, { type Genre } from "@/components/ui/GenreChipSelector";

// ow_genres の実データと同一（display_order 昇順）
const ALL_GENRES: Genre[] = [
  { slug: "foreign-capital",  name: "外資系",           display_order: 1 },
  { slug: "horizontal-saas",  name: "ホリゾンタルSaaS", display_order: 2 },
  { slug: "vertical-saas",    name: "バーティカルSaaS", display_order: 3 },
  { slug: "mega-venture",     name: "メガベンチャー",   display_order: 4 },
  { slug: "early-stage",      name: "シード〜シリーズA", display_order: 5 },
  { slug: "ai-llm",           name: "AI・LLM特化",      display_order: 6 },
  { slug: "dx-consulting",    name: "DX/コンサル",      display_order: 7 },
  { slug: "ipo-ready",        name: "IPO準備中",        display_order: 8 },
];

export default function GenreChipTestClient() {
  const [selected, setSelected] = useState<string[]>([]);
  const [disabled, setDisabled] = useState(false);

  // display_order 順でないシャッフル版（ソート保証の確認用）
  const shuffled = [...ALL_GENRES].sort(() => Math.random() - 0.5);

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px", fontFamily: "inherit" }}>
      {/* ヘッダー */}
      <div style={{
        background: "#FEF3C7", border: "1px solid #F59E0B",
        borderRadius: 8, padding: "10px 16px", marginBottom: 40,
        fontSize: 12, color: "#92400E", fontWeight: 500,
      }}>
        ⚠️ dev-only ページ: `NODE_ENV === &apos;development&apos;` のみアクセス可
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
        GenreChipSelector テスト
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 40 }}>
        PR-β Phase 1 — 共通コンポーネント動作確認ページ
      </p>

      {/* ── ケース 1: 通常（未選択） ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          ケース 1: 通常（未選択状態からスタート）
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16 }}>
          チップをタップで選択/解除できます。複数選択可、上限なし。
        </p>
        <GenreChipSelector
          genres={ALL_GENRES}
          selected={selected}
          onChange={setSelected}
          disabled={disabled}
        />
        <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12 }}>
          <span style={{ color: "var(--ink-mute)", marginRight: 8 }}>selected:</span>
          <code style={{ color: "var(--royal)" }}>
            {selected.length === 0 ? "[]" : JSON.stringify(selected)}
          </code>
        </div>
      </section>

      {/* ── ケース 2: 初期値あり ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          ケース 2: 初期値あり（編集再開のシミュレーション）
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16 }}>
          draft_data から復元した状態。&ldquo;外資系&rdquo; + &ldquo;AI・LLM特化&rdquo; が選択済み。
        </p>
        <GenreChipSelector
          genres={ALL_GENRES}
          selected={["foreign-capital", "ai-llm"]}
          onChange={() => {/* read-only demo */}}
        />
      </section>

      {/* ── ケース 3: display_order 保証（シャッフル渡し） ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          ケース 3: display_order ソート保証
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16 }}>
          genres をシャッフルして渡しても、内部で display_order 昇順ソートされることを確認。
        </p>
        <GenreChipSelector
          genres={shuffled}
          selected={[]}
          onChange={() => {}}
        />
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-mute)" }}>
          渡した順序: {shuffled.map(g => g.name).join(" → ")}
        </div>
      </section>

      {/* ── ケース 4: disabled ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          ケース 4: disabled 状態
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 16 }}>
          公開処理中など、操作不可の場合の表示。
        </p>
        <GenreChipSelector
          genres={ALL_GENRES}
          selected={["mega-venture"]}
          onChange={() => {}}
          disabled={true}
        />
      </section>

      {/* ── ケース 5: 全選択 ── */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          ケース 5: 全選択（最大8件）
        </h2>
        <GenreChipSelector
          genres={ALL_GENRES}
          selected={ALL_GENRES.map(g => g.slug)}
          onChange={() => {}}
        />
      </section>

      {/* ── インタラクティブコントロール ── */}
      <div style={{
        borderTop: "1px solid var(--line)", paddingTop: 32, marginBottom: 48,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
          インタラクティブコントロール（ケース 1 の state）
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelected([])}
            style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer" }}
          >
            全解除
          </button>
          <button
            onClick={() => setSelected(ALL_GENRES.map(g => g.slug))}
            style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer" }}
          >
            全選択
          </button>
          <button
            onClick={() => setSelected(["foreign-capital", "ai-llm"])}
            style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer" }}
          >
            外資系 + AI・LLM に設定
          </button>
          <button
            onClick={() => setDisabled(!disabled)}
            style={{
              padding: "7px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer",
              border: `1px solid ${disabled ? "var(--royal)" : "var(--line)"}`,
              background: disabled ? "var(--royal-50)" : "#fff",
              color: disabled ? "var(--royal)" : "var(--ink)",
            }}
          >
            {disabled ? "disabled 解除" : "disabled にする"}
          </button>
        </div>
      </div>

      {/* ── モバイル幅確認メモ ── */}
      <div style={{
        background: "var(--bg-tint)", border: "1px solid var(--line)",
        borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "var(--ink-soft)",
      }}>
        <strong>モバイル確認手順:</strong> DevTools で幅を 375px に変更し、ケース 1 のチップが
        折り返して表示されることを確認。flexWrap: wrap が機能していれば OK。
      </div>
    </div>
  );
}

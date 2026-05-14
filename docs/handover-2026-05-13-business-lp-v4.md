# Handover: Business LP v4 — Point1/2/3 構造化 + 導入の流れ STEP1-4

実装日: 2026-05-13  
commit: aee8ed5  
Vercel: ● Ready 確認済み

---

## 1. 改修1: Point 構造化

### 採用した理由

Green LP の「Point1/2/3」構造は、強みを箇条書きにせず**「見出しとして立てる」**手法。
訪問者が「何が売りか」を一目でスキャンできる。Opinio も3つの差別化軸
（コスト・メンター・ユーザー層）を同じ形式で並列化することで、
競合比較の基準を自社ポイントに誘導できると判断した。

### Point 1 — 完全無料で求人掲載（Section 2 の変換）

| 変更点 | 内容 |
|--------|------|
| セクションラベル | 「料金比較」→ `<PointLabel n={1} />` |
| 見出し | 「他社が『掲載で稼ぐ』のに対し...」→「完全無料で求人掲載」 |
| サブテキスト | 「月額費用なし、広告費なし。お金が発生するのは入社決定の一点のみ。」 |
| 料金比較表 | 維持（Point1 内に組み込み） |
| 強調ボックス | 旧: 2行テキスト（Emphasis box）を Point1 下部に移植・リデザイン |
| id | `id="pricing"` 維持 |

### Point 2 + Point 3 — ダークセクション（Section 4 の変換）

| 変更点 | 内容 |
|--------|------|
| 削除 | 大見出し「なぜ採用ミスマッチが起きないのか？」 |
| 削除 | サブテキスト「Opinio には、他の求人媒体にはない2つの仕組みがあります。」|
| 削除 | `<SectionLabel>差別化</SectionLabel>` |
| 追加 | セクション上部に微小ラベル「Opinio Work の差別化」（rgba white, uppercase） |
| 各カード | `<PointLabel n={2} dark />` / `<PointLabel n={3} dark />` をカード上部に配置 |
| Point 2 タイトル | 「メンターが間に立つから」→「メンターが間に立つ仕組み」（名詞化で明確に） |
| id | `id="mentor"` 維持 |

### PointLabel コンポーネント（新規追加）

```tsx
function PointLabel({ n, dark = false }: { n: number; dark?: boolean }) {
  return (
    <div style={{
      display: "inline-flex",
      padding: "4px 14px",
      background: dark ? "rgba(255,255,255,0.15)" : "var(--royal)",
      color: "#fff",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      marginBottom: 12,
      fontFamily: "'Inter', sans-serif",
    }}>
      Point {n}
    </div>
  );
}
```

- `dark=false`: royal blue 背景（白背景セクション用）
- `dark=true`: 半透明白背景（ダーク背景セクション用）

---

## 2. 改修2: 「導入の流れ」STEP1-4

### 4ステップの設計判断

| 項目 | 判断 |
|------|------|
| ステップ数 | 旧3→新4に変更。「候補者から応募が届く」ステップを明示し、メンター面談の価値を流れの中で強調 |
| STEP3 文言 | 「応募前メンター面談を経た、本気度の高い候補者から応募が届きます」— Point2/3の訴求との連携を意識 |
| アイコン | 絵文字（🏢📋👤✅）— SVGアイコン資産が business/page.tsx にないため、軽量な絵文字を採用 |
| 矢印 | デスクトップのみ `→` を Tailwind `hidden md:flex` で表示。グリッドは `[1fr_28px_1fr_28px_1fr_28px_1fr]` |
| モバイル | `grid-cols-1` で縦積み。矢印は非表示。 |

### ステップ詳細

| STEP | タイトル | 補足 |
|------|---------|------|
| 1 | 企業を新規登録 | 1分、メールのみ、クレカ不要 |
| 2 | 求人を作成・公開 | 件数・期間無制限、「公開」ボタンで即反映 |
| 3 | 候補者から応募が届く | メンター面談済み、本気度の高い応募 |
| 4 | 入社決定時のみ成果報酬 | 年収30〜35%、決定まで請求なし |

### id = "flow" を新設

旧 Section 3 には id がなかった。新 Section 3 に `id="flow"` を付与し、BusinessHeader から `#flow` でナビゲーション可能。

---

## 3. BusinessHeader ナビゲーション変更

```diff
const NAV_LINKS = [
- { href: "#mentor",   label: "サービス" },
- { href: "#pricing",  label: "料金" },
+ { href: "#pricing",  label: "強み" },
+ { href: "#flow",     label: "導入の流れ" },
  { href: "#faq",      label: "FAQ" },
];
```

**変更の判断:**
- 「サービス」→「強み」: Point構造化で「Opinioの3つの強み」を訴求する文脈になったため
- 「料金」を独立ナビから外し「強み」に統合: Point1が料金を含むため、#pricingへのリンクで問題なし
- 「導入の流れ(#flow)」を追加: 新設セクションを発見性を高めるためにナビに追加

---

## 4. ページ構造（最終版）

| セクション | id | 背景 | 内容 |
|-----------|-----|------|------|
| Hero | — | gradient | 左右レイアウト / 候補者プレビュー |
| Point 1 | `#pricing` | bg-tint | 完全無料 + 料金比較表 |
| 導入の流れ | `#flow` | white | STEP1-4 |
| Point 2+3 | `#mentor` | dark(ink) | メンター制度 / IT業界ユーザー |
| ターゲット | — | white | こんな企業に最適 |
| 活用企業 | — | bg-tint | ロゴ（プレースホルダー） |
| FAQ | `#faq` | white | 7問 |
| Final CTA | — | royal | 今すぐ始める |

---

**作成者**: Claude Code  
**作成日**: 2026-05-13

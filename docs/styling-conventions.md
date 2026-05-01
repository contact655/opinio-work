# Opinio スタイリング規約

> Phase α Step 1-2 で確立。Step 3 以降の実装はこの規約に従う。

---

## 基本方針: インライン style + CSS 変数

opinio-work は **「インライン style + CSS 変数」** を正式なスタイリング手法として採用しています。

### 理由

- CSS 変数を一箇所変えれば全体に波及する
- Tailwind config と実装の二重管理を避ける
- 既存の 188 箇所のインライン style 資産を活かす

### Tailwind の立ち位置

Tailwind は **レイアウト補助ツール** として使う。色・サイズ・余白は CSS 変数経由を推奨。

---

## 書き方の原則

### ✅ Good

```tsx
<div style={{
  color: "var(--ink)",
  background: "var(--bg-tint)",
  padding: "var(--space-6)",
  fontSize: "var(--text-h3)",
  lineHeight: "var(--leading-snug)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-sm)",
}}>
  ...
</div>
```

### ❌ Bad

```tsx
{/* tailwind config と乖離している */}
<div className="text-primary bg-tint p-6">

{/* ハードコード色 */}
<div style={{ color: "#0F172A" }}>

{/* 無計画なマジックナンバー */}
<div style={{ padding: "13px", borderRadius: "7px" }}>
```

---

## トークン一覧と使い所

### 色 (src/app/globals.css)

| トークン | 値 | 用途 |
|---------|-----|------|
| `--royal` | `#002366` | メインカラー、CTA、ヘッダー、アクティブ |
| `--royal-deep` | `#001A4D` | hover 時の濃色 |
| `--royal-50` | `#EFF3FC` | 極薄背景 |
| `--royal-100` | `#DCE5F7` | 薄背景・ホバー |
| `--accent` | `#3B5FD9` | リンク、補助アクション |
| `--ink` | `#0F172A` | 本文テキスト（最強） |
| `--ink-soft` | `#475569` | サブテキスト |
| `--ink-mute` | `#94A3B8` | ヒント・ラベル・補足 |
| `--line` | `#E2E8F0` | 標準ボーダー |
| `--line-soft` | `#F1F5F9` | 薄いボーダー |
| `--bg-tint` | `#F8FAFC` | ページ背景（薄グレー） |
| `--success` | `#059669` | 成功・published・accepted |
| `--warm` | `#F59E0B` | 注意・pending |
| `--purple` | `#7C3AED` | scheduling |
| `--error` | `#DC2626` | エラー・declined |
| `--pink` | `#DB2777` | scheduled |

### 余白 (8px grid)

| トークン | px | 用途 |
|---------|-----|------|
| `--space-1` | 4 | atomic — アイコンとテキスト間など極小間隔 |
| `--space-2` | 8 | tight — 要素内の隙間、タグ間 |
| `--space-3` | 12 | compact — インライン要素間 |
| `--space-4` | 16 | default — 標準的なパディング・マージン |
| `--space-6` | 24 | loose — カード内セクション間 |
| `--space-8` | 32 | generous — カード間・グリッドギャップ |
| `--space-12` | 48 | section padding — セクション内上下余白 |
| `--space-16` | 64 | between sections — BIZ ダッシュボード密度 |
| `--space-24` | 96 | between sections — 求職者向け、Stripe 密度 |
| `--space-32` | 128 | hero padding — ヒーローセクション上下 |

### タイポグラフィ

#### フォントサイズ

| トークン | px | 用途 |
|---------|-----|------|
| `--text-display` | 64 | ヒーロー級（求職者向けトップのみ） |
| `--text-super` | 48 | 大ヒーロー（セクション冒頭） |
| `--text-h1` | 36 | セクション大見出し |
| `--text-h2` | 28 | セクション中見出し |
| `--text-h3` | 22 | サブ見出し |
| `--text-h4` | 18 | 小見出し、カードタイトル |
| `--text-body-lg` | 18 | 求職者向け本文（読み物向け、Stripe-like） |
| `--text-body` | 16 | 標準本文 |
| `--text-body-sm` | 14 | メタ情報、注記 |
| `--text-caption` | 12 | キャプション、ラベル、バッジ文字 |
| `--text-stat-lg` | 40 | 大きい数値表示（KPI） |
| `--text-stat` | 28 | 標準数値表示（KPI） |

#### 行間・字間

| トークン | 値 | 用途 |
|---------|-----|------|
| `--leading-tight` | 1.15 | display, h1, h2 — 大見出し |
| `--leading-snug` | 1.35 | h3, h4 — 中見出し |
| `--leading-normal` | 1.5 | body 標準 |
| `--leading-relaxed` | 1.7 | body-lg — 読み物本文 |
| `--tracking-tight` | -0.02em | display, h1 — 大文字詰め |
| `--tracking-normal` | 0 | body 標準 |
| `--tracking-wide` | 0.02em | caption, all-caps ラベル |

### 角丸

| トークン | px | 用途 |
|---------|-----|------|
| `--radius-sm` | 6 | タグ、ピル、StatusPill |
| `--radius-md` | 10 | ボタン、入力欄、小カード |
| `--radius-lg` | 16 | カード（標準）※ tailwind `rounded-card` と同値 |
| `--radius-xl` | 24 | 大カード、画像、ヒーロー要素 |

### 影

| トークン | 用途 |
|---------|------|
| `--shadow-xs` | hover 時の浮上感 |
| `--shadow-sm` | カード基本 |
| `--shadow-md` | モーダル、ドロップダウン |
| `--shadow-lg` | ヒーロー要素 |

> **Tailwind との棲み分け**: `shadow-card`（Tailwind）は「影 + 1px リング」の合成で旧ページが使用中。
> 新規コードは `--shadow-*` を使う。

---

## フォント使い分け

| 用途 | フォント | CSS 変数 | Tailwind className |
|------|---------|---------|-------------------|
| 見出し（格調・温度感） | Noto Serif JP | `var(--font-noto-serif)` | `font-serif` |
| 本文（日本語） | Noto Sans JP | `var(--font-noto)` | `font-sans` |
| 数字・英語ラベル | Inter | `var(--font-inter)` | `font-sans` |

**使い分け指針:**
- 「人物の言葉」「編集部コメント」「ヒーロー見出し」→ **Noto Serif JP** で温度感を出す
- データ・ラベル・KPI 数値 → **Inter** で知性・整然感を出す
- 長文本文・日本語説明文 → **Noto Sans JP** で可読性を確保

---

## Tailwind className を使ってよい場面

レイアウト系ユーティリティは Tailwind className を許容:

```tsx
// ✅ OK: レイアウト
className="flex items-center justify-between gap-4"
className="grid grid-cols-2 gap-4"
className="hidden md:flex"
className="mx-auto w-full"

// ✅ OK: Opinio 定義のカスタムクラス（tailwind.config.ts 由来）
className="rounded-card"        // 16px — --radius-lg と同値
className="rounded-card-lg"     // 20px — 旧ページ互換
className="shadow-card"         // 旧ページ互換（新規では --shadow-sm 推奨）

// ❌ 避ける: 色・サイズ
className="text-blue-600 bg-gray-100 p-4 text-sm"
```

---

## アンチパターン

### 1. Tailwind の `text-primary` / `bg-primary` を使う

Step 1 で `primary` を royal blue に統一済みだが、**セマンティック CSS 変数を使う**のが原則:

```tsx
// ❌ 避ける
<span className="text-primary">

// ✅ 推奨
<span style={{ color: "var(--royal)" }}>
```

### 2. ハードコードされた色

```tsx
// ❌ 避ける
<div style={{ color: "#0F172A", background: "#F8FAFC" }}>

// ✅ 推奨
<div style={{ color: "var(--ink)", background: "var(--bg-tint)" }}>
```

例外: `#fff`（white）は可。`rgba(0,0,0,0.x)` の透明度は可。

### 3. マジックナンバー余白

```tsx
// ❌ 避ける
<div style={{ padding: "13px", gap: "22px", borderRadius: "7px" }}>

// ✅ 推奨（--space-* スケールから選ぶ）
<div style={{ padding: "var(--space-3)", gap: "var(--space-6)", borderRadius: "var(--radius-md)" }}>
```

### 4. `<style>` タグでホバー定義

既存のインライン `<style>` タグ（ファイル末尾での hover 注入）は維持してよいが、新規では避ける。
ホバーが必要な場合は `*.module.css` ファイルを検討する。

---

## 参考: Step 別作業範囲

| Step | 内容 | 状態 |
|------|------|------|
| α-1 | CSS 変数整理（2重定義解消・primary 修正・Noto Serif next/font 統合） | ✅ 完了 |
| α-2 | デザイントークン拡充（spacing / typography / radius / shadow） | ✅ 完了 |
| α-3 | Header 整理・maxWidth 統一・lucide-react 導入 | 未着手 |

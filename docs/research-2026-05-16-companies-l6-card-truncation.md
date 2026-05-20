# 調査レポート: /companies ページ 4列目カード途切れバグ (L6)

**調査日**: 2026-05-16  
**対象**: `/companies` ページ ジャンル別カルーセル  
**優先度**: 🔴 高（視認性に直結）  
**ステータス**: 調査完了・実装待ち

---

## 1. 現象の正確な記述

### 発生箇所

- **全ジャンル共通**で発生（ジャンル固有の問題ではない）
- カルーセル内の **4枚目カードの右端が水平方向に切れる**
- スクロールせずに初期表示された時点で 4枚目が見えかけている状態（＝途切れて見える）

### 途切れ方の種類

- **水平方向**に右端が切れる（カードの右端 数 px〜十数 px がスクロールコンテナの境界でクリップされる）
- 縦方向は正常、カード構造自体は破損していない

### 幅の数値シミュレーション

| 要素 | 幅 |
|------|-----|
| ページコンテナ (`max-w-6xl mx-auto px-4`) | **1248px**（1280 - 32） |
| 左右矢印ボタン (`w-9` × 2) | **72px** |
| ボタン↔スクロール領域の gap (`gap-2` × 2) | **16px** |
| **スクロール領域の実幅** | **1160px**（1248 - 72 - 16） |
| カード4枚 + gap3本 (`w-[280px]` × 4 + `gap-3` × 3) | **1156px**（1120 + 36） |
| **スクロール右端の余白** | **4px のみ** |

→ 4枚のカードは理論上 1160px に収まるが、右側の padding がゼロのため、スクロールコンテナの `overflow-x-auto` によって右端 4px がクリップされる。フォント・ボーダー・影（box-shadow）がカード右端に存在する場合、実際に見える切れ方はさらに顕著になる。

---

## 2. 原因の特定

### 根本原因

**`GenreCarousel.tsx` 68行目**: スクロールコンテナに `padding-right` が設定されていない。

```tsx
// src/components/companies/GenreCarousel.tsx — 66〜75行
<div
  ref={scrollRef}
  className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide flex-1 min-w-0"
  //                                                                              ^^^
  //                  pb-2（下）はある。pr-xx（右）がない ← これがバグの原因
>
  {companies.map((company) => (
    <div key={company.id} className="flex-shrink-0 w-[280px] snap-start">
      <CompanyCardCompact company={company} />
    </div>
  ))}
</div>
```

### なぜ padding-right で解決するか

`overflow-x-auto` のスクロールコンテナは、**コンテンツの終端がコンテナ境界に接するとそこで描画をクリップする**。  
CSS の仕様上、スクロールコンテナに `padding-right` を加えることで「スクロールしきった時に最後のアイテムの右側に余白が生まれる」ため、カードがクリップされなくなる。

`padding-bottom` (`pb-2`) は付いているのに `padding-right` が欠落しているのは、縦方向（影・ボーダーのはみ出し）は気にされたが横方向は見落とされた、典型的なパターン。

### コンポーネント構成（参考）

```
companies/page.tsx (37行)
  └─ GenreSection.tsx (38行) × ジャンル数分
       └─ GenreCarousel.tsx (88行) ← バグ箇所
            └─ CompanyCardCompact.tsx × 企業数分
```

### 関連ファイル・行番号サマリー

| ファイル | 行 | 内容 |
|---------|-----|------|
| `src/components/companies/GenreCarousel.tsx` | **68** | バグ箇所: `padding-right` 欠落 |
| `src/components/companies/GenreCarousel.tsx` | 71 | カード幅: `w-[280px]` |
| `src/app/(jobseeker)/companies/page.tsx` | 15 | ページ幅: `max-w-6xl mx-auto px-4` |
| `src/app/globals.css` | 223–229 | `.scrollbar-hide` の CSS 定義 |

---

## 3. 修正方針の複数案

### 案A: 最小修正（padding-right 追加）⭐ 推奨

**変更箇所**: `GenreCarousel.tsx` 68行目のみ

```tsx
// Before
className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide flex-1 min-w-0"

// After
className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 pr-3 scrollbar-hide flex-1 min-w-0"
//                                                                                 ^^^^
//                                                              pr-3 = 12px の右パディングを追加
```

| 項目 | 内容 |
|------|------|
| **メリット** | 1行変更のみ。影響範囲ゼロ。全ジャンル・全デバイスで即効。 |
| **デメリット** | スクロールバーが非表示のため、padding がスクロール可能範囲を視覚的に縮めることに気づきにくい（実害なし） |
| **作業量** | 5分 |
| **リスク** | ほぼゼロ |

`pr-3`（12px）推奨。`pr-2`（8px）でも理論上は修正できるが、box-shadow や将来のスタイル変更への余裕を考えると `pr-3` が安全。

---

### 案B: 構造修正（カード幅をレスポンシブ化）

固定幅 `w-[280px]` をやめ、`min-w-[240px] max-w-[300px]` のようにレスポンシブ化する。

```tsx
// Before
<div key={company.id} className="flex-shrink-0 w-[280px] snap-start">

// After
<div key={company.id} className="flex-shrink-0 w-[clamp(240px,calc(25%-12px),300px)] snap-start">
```

| 項目 | 内容 |
|------|------|
| **メリット** | タブレット幅でも3枚がきれいに収まる。将来的なウィンドウ幅変動に強い。 |
| **デメリット** | `clamp` の計算が gap 数・コンテナ幅に依存し、複雑。カード幅が揃わなくなり CompanyCardCompact のレイアウトが崩れる可能性。 |
| **作業量** | 1〜2時間（検証含む） |
| **リスク** | CompanyCardCompact 内部の固定幅前提のレイアウトが崩れる可能性あり（要確認） |

---

### 案C: 抜本修正（カルーセルライブラリ導入）

`embla-carousel-react` や `keen-slider` のような専用ライブラリに置き換える。

| 項目 | 内容 |
|------|------|
| **メリット** | スナップ・ループ・アクセシビリティが全て解決。今後の機能追加が容易。 |
| **デメリット** | 追加依存関係（バンドルサイズ増）。実装の大幅書き換え。現行の矢印ボタン・`canScrollLeft/Right` のロジックが不要になり、コードの複雑度が一時的に上がる。 |
| **作業量** | 半日〜1日 |
| **リスク** | スクロールフィーリング・SNS性の変化。デザインの再調整が必要な可能性。 |

---

## 4. 推奨案と理由

**→ 案A（padding-right 追加）を強く推奨**

理由:
1. **原因が明確**（右パディングの欠落）で、修正も 1行追加と完全に対応している
2. **影響範囲ゼロ** — 変更は `GenreCarousel.tsx` の className 属性の1トークン追加のみ
3. **全ジャンル・全ブラウザで即効**（CSS の仕様として正しい修正）
4. **将来のリファクタリングの妨げにならない**（案Bや案Cへの移行時に邪魔にならない）
5. **ビルドリスクがない**（型エラー・ロジック変更なし）

---

## 5. 副次的な発見

### L4: 背景色の問題

`page.tsx` 15行目: `<div className="max-w-6xl mx-auto px-4 py-6">` — ページ自体の背景色指定なし。  
親レイアウト（`src/app/(jobseeker)/layout.tsx`）や `globals.css` の `body` / `:root` に適用されているデフォルト背景色が露出していると思われる。  
→ `globals.css` の背景色と LP v6 の配色を照合して、`bg-slate-50` か `bg-gray-50` を追加するのが安全。

### `snap-mandatory` の挙動について

現状 `snap-x snap-mandatory` を使用しているため、スクロールが常にカードの先頭にスナップする。4枚目が途切れた状態だと、ユーザーが右矢印を押してもスナップ位置が中途半端になる現象が合わさっている可能性がある。  
→ 案Aの `pr-3` 追加で padding を確保すれば、スナップ動作も自然になる（スクロール末端でカードが正しい位置に収まるため）。

### `canScrollRight` の初期値判定

68行目の `scrollWidth - clientWidth < 1` の判定（22行目）は、カードがぴったり収まっている場合に `canScrollRight = false`（右矢印が disabled）になる可能性がある。  
→ padding-right を追加することで `scrollWidth > clientWidth` が確実になり、矢印ボタンの初期状態も正しくなる。

---

## 実装メモ（実施時の参考）

```bash
# 変更ファイル
src/components/companies/GenreCarousel.tsx

# 変更行
68行目の className に pr-3 を追加

# ビルド確認
npm run build

# コミットメッセージ案
fix(companies): add padding-right to carousel scroll container to prevent card truncation
```

**変更前後の diff（予定）:**
```diff
-  className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide flex-1 min-w-0"
+  className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 pr-3 scrollbar-hide flex-1 min-w-0"
```

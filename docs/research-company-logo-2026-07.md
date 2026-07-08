# 会社ロゴ表示 共通化 調査レポート

> 調査日: 2026-07-09  
> 目的: ロゴ表示のばらつきを解消し `CompanyLogo` 単一コンポーネントに統一する設計を確定する

---

## 1. データの実態（Supabase `ow_companies` 全 84 件）

### logo_url（Clearbit URL）の状況

| 状態 | 件数 | 例 |
|------|------|----|
| Clearbit URL あり | 78 社 | `https://logo.clearbit.com/salesforce.com` |
| null（ロゴなし） | 6 社 | アサヒビール、富士フイルム、TEST、Third Box、エージェント、フライル |

**結論**: logo_url は 93% が Clearbit URL。しかし Clearbit は外部サービスのため本番では 404 が起きうる（開発環境でも壊れる）。**onError フォールバックは必須**。

### logo_letter（フォールバック文字）の状況

| 状態 | 件数 | 例 |
|------|------|----|
| 英字 1 文字（正常） | 70 社 | `"S"`, `"H"`, `"D"` |
| CJK 1 文字（日本企業） | 4 社 | `"ア"`, `"シ"`, `"タ"`, `"富"` |
| null（未設定） | 4 社 | 株式会社medimo, TEST, Third Box, エージェント |

**結論**: logo_letter に「株式会社〇〇」のようなフルネームが入っているケースは **現在 DB には 0 件**。  
バグの原因は「logo_letter = null のとき `company.name.charAt(0)` で代替するが name が『株式会社medimo』のため『株』になる」という実装側の問題。  
`getLogoLetter(logo_letter, name)` を使えばこれは解決（null → name のプレフィックス除去 → 「M」を返す）。

---

## 2. 現状：ロゴを表示している全箇所

### 2-A. 既存の「ロゴコンポーネント」（3 種類が乱立）

| ファイル | 用途 | onError | getLogoLetter | 問題 |
|---------|------|---------|---------------|------|
| `src/components/jobseeker/CompanyLogo.tsx` | 企業一覧・/people など | ❌ なし（Server 想定） | ❌ `logoLetter ?? name.charAt(0)` | 画像エラー時に空白 |
| `src/components/companies/CompanyLogoImage.tsx` | 企業詳細ヘッダー | ✅ あり | ❌ 呼び出し元が letter を用意 | 返すのは `<span>` or `<img>` のみ（コンテナなし）|
| `src/components/profile/CompanyLogoImg.tsx` | タイムライン・経歴カード | ✅ あり | ❌ 呼び出し元が letter を用意 | ほぼ完成形だが letter 加工が呼び出し元任せ |

### 2-B. インライン実装（コンポーネントを使わず直接書いている箇所）

| ファイル | 箇所 | サイズ | 現状の問題 |
|---------|------|--------|-----------|
| `jobs/[id]/page.tsx` L430 | Hero ロゴ | 64×64px, r=14 | `<Image>` に onError なし。Clearbit 404 → **空枠** |
| `jobs/[id]/page.tsx` L1048 | 「企業について」ロゴ | 52×52px, r=12 | 同上 → **空枠** |
| `jobs/[id]/page.tsx` L152 | 「同じ職種の求人」各カード | 40×40px, r=8 | 独自正規表現（`!/^[株合有（]/`）。onError なし → Clearbit 404 で空枠 |
| `companies/[id]/page.tsx` L2681 | 比較バー候補企業 | 36×36px, r=6 | `<img>` のみ。onError なし |
| `CompanyCardList.tsx` L302 | 企業一覧の大カード ロゴ部 | 96×96px, r=12 | `<img>` onError なし |
| `CompanyCardList.tsx` L523 | 同カード ヘッダー背景内 | 48×48px | `<img>` onError なし |
| `CompanyCardCompact.tsx` L215 | 企業カード（コンパクト） | 独自実装 | ✅ `logoError` state あり（最も正しい実装） |

### 2-C. コンポーネントを使っているが問題のある箇所

| ファイル | 使用コンポーネント | 問題 |
|---------|------------------|------|
| `companies/[id]/page.tsx` L192 | `CompanyLogoImage` | `fallbackLetter={company.logo_letter ?? initial}` — `initial` は `logo_letter ?? name.charAt(0)` で getLogoLetter 未使用 |
| `CompaniesClient.tsx` L222, L539 | `CompanyLogo`（jobseeker版） | onError なし → 画像エラーで空白 |
| `FeedSidebar.tsx` L96 | 独自レンダリング（`job.logoLetter` を表示） | logoLetter は FeedSidebar の呼び出し元（`feed/page.tsx`）が加工しているはずだが確認要 |

---

## 3. ロゴ表示のバラバラ具体例（同じ「株式会社medimo」）

| 画面 | 表示 | 理由 |
|------|------|------|
| 求人一覧カード（グリッド/リスト） | ✅ 「M」+ Clearbit 画像 | 34e318a で `getLogoLetter` + onError 対応済み |
| 求人詳細 Hero（64px） | ❌ 空枠（Clearbit 失敗時） | `<Image>` に onError なし |
| 求人詳細「企業について」（52px） | ❌ 空枠 | 同上 |
| 求人詳細「同じ職種の求人」（40px） | ⚠️ 「株」（旧正規表現） | `getLogoLetter` 未使用 |
| 企業詳細 Hero | ✅ onError → letter 表示 | `CompanyLogoImage` 使用（ただし getLogoLetter 未使用で letter が「株」の可能性） |

---

## 4. 設計案：`CompanyLogo` 共通コンポーネント

### 配置

```
src/components/common/CompanyLogo.tsx   ← 新規
```

既存の `src/components/jobseeker/CompanyLogo.tsx` を **アップグレード移植**する形が現実的。  
（既存コンポーネントのプロップス設計は良いが `"use client"` と `onError` が不足している）

### Props 設計

```tsx
"use client";

type SizeToken = "xs" | "sm" | "md" | "lg" | "xl";

// サイズトークン → px / borderRadius のマッピング
const SIZE_TOKENS: Record<SizeToken, { px: number; radius: number }> = {
  xs: { px: 24, radius: 5  },   // フィードサイドバー、小バッジ等
  sm: { px: 36, radius: 7  },   // タイムライン、関連求人カード (40px相当)
  md: { px: 48, radius: 10 },   // 企業カード、一覧カード
  lg: { px: 64, radius: 14 },   // 求人詳細 Hero
  xl: { px: 96, radius: 14 },   // 企業詳細 Hero（CompanyLogoImage の96px相当）
};

interface CompanyLogoProps {
  /** DB の ow_companies.logo_url（Clearbit URL 等） */
  logoUrl?: string | null;
  /** DB の ow_companies.logo_letter */
  logoLetter?: string | null;
  /** DB の ow_companies.name（フォールバック頭文字計算に使用） */
  name: string;
  /** DB の ow_companies.logo_gradient（null → navy デフォルト） */
  logoGradient?: string | null;
  /** サイズ: トークン or px 数値（後方互換） */
  size?: SizeToken | number;
  /** 角丸 px（数値 size 指定時のみ有効。トークン時は自動） */
  borderRadius?: number;
  /** 追加クラス */
  className?: string;
  /** 追加スタイル */
  style?: React.CSSProperties;
}
```

### フォールバックロジック

```
logoUrl あり
  └─ 画像ロード成功 → ロゴ画像表示
  └─ onError（Clearbit 404 等）→ 頭文字フォールバック
logoUrl なし → 頭文字フォールバック

頭文字フォールバック:
  getLogoLetter(logoLetter, name) を使用
  → logo_letter が "S" → "S"
  → logo_letter が null, name が "株式会社medimo" → "M"
  → logo_letter が null, name が "富士フイルム..." → "富"
  → グラデーション背景（logoGradient ?? navy）+ 白文字
```

### 実装概要（コア部分）

```tsx
"use client";
import { useState } from "react";
import { getLogoLetter } from "@/lib/utils/companyLogo";

export function CompanyLogo({ logoUrl, logoLetter, name, logoGradient, size = "md", ... }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);
  
  // サイズ解決
  const { px, radius } = resolveSize(size, borderRadius);
  
  // 頭文字（getLogoLetter で法人格プレフィックス除去済み）
  const letter = getLogoLetter(logoLetter, name);
  
  const showImage = !!logoUrl && !imgError;
  
  if (showImage) {
    return (
      <div style={containerStyle(px, radius, "#f8fafc", "1px solid var(--line)")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""                          // 装飾的画像は alt=""
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: px * 0.08 }}
        />
      </div>
    );
  }
  
  return (
    <div style={containerStyle(px, radius, logoGradient ?? DEFAULT_GRADIENT)}>
      <span style={{ color: "#fff", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: Math.round(px * 0.38) }}>
        {letter}
      </span>
    </div>
  );
}
```

**なぜ `<img>` で `<Image>` でないか:**
- `<Image>` は onError のフォールバックが Client Component 上でも動作しにくい（Next.js の最適化処理後に画像URLが変わるため）
- Clearbit は外部ドメインのため `remotePatterns` 設定も必要になる
- `<img>` + onError がシンプルかつ確実（`CompanyLogoImage.tsx` の既存実装方針と同じ）

---

## 5. 置き換え計画

### 対象 12 箇所と置き換えサイズ

| # | ファイル | 箇所 | 現サイズ | 新 size 指定 | 現状の問題 | 置き換え後 |
|---|---------|------|---------|-------------|-----------|-----------|
| 1 | `jobs/[id]/page.tsx` L430 | Hero ロゴ | 64×64 r=14 | `size="lg"` | 空枠（onError なし） | ✅ 修正 |
| 2 | `jobs/[id]/page.tsx` L1048 | 企業についてカード | 52×52 r=12 | `size={52}` | 空枠（onError なし） | ✅ 修正 |
| 3 | `jobs/[id]/page.tsx` L152 | 同じ職種の求人カード | 40×40 r=8 | `size={40}` | 旧正規表現 + 空枠 | ✅ 修正 |
| 4 | `companies/[id]/page.tsx` L192 | 企業詳細 Hero | 96×96 | `size="xl"` | getLogoLetter 未使用 | ✅ 修正 |
| 5 | `companies/[id]/page.tsx` L2681 | 比較バー候補 | 36×36 r=6 | `size={36}` | onError なし | ✅ 修正 |
| 6 | `CompaniesClient.tsx` L222 | 企業一覧グリッドカード | 48×48 r=10 | `size="md"` | onError なし | ✅ 修正 |
| 7 | `CompaniesClient.tsx` L539 | 企業一覧リストカード | 48×48 r=10 | `size="md"` | onError なし | ✅ 修正 |
| 8 | `CompanyCardCompact.tsx` L215 | 企業カード（コンパクト） | 独自 | `size={独自}` | ✅ 既存動作OK | 統一で削除 |
| 9 | `CompanyCardList.tsx` L302 | 大カード上部ロゴ | 96×96 r=12 | `size="xl"` | onError なし | ✅ 修正 |
| 10 | `CompanyCardList.tsx` L523 | 大カード背景内ロゴ | 48×48 | `size="md"` | onError なし | ✅ 修正 |
| 11 | `FeedSidebar.tsx` L96 | フィード求人ミニカード | 小 | `size="xs"` | letter 加工が呼び出し元任せ | ✅ 統一 |
| 12 | `companies/[id]/page.tsx` L435 | サイドメンバーカード内 | 36px | `size={36}` | `logo_letter ?? name.charAt(0)` | ✅ 修正 |

### 対象外（今回スコープ外）

| ファイル | 理由 |
|---------|------|
| `mypage/conversations/ConversationsClient.tsx` | 会話リスト。会社ロゴではなく会社アバター的用途 |
| `mypage/conversations/[id]/ConversationDetailClient.tsx` | チャット内の小アイコン（8px）|
| `CareerHistoryEditor.tsx` | 編集 UI 内の小アイコン（28px）|
| `companies/CompanySections.tsx` | 別ルートの旧ページ |
| `companies/list/CompanyListClient.tsx` | 同上 |
| `RecentlyViewedSection.tsx` | 最近見た企業の 32px アイコン（影響軽微）|
| `biz/*` 系 | biz 管理画面のロゴはユーザー入力値を扱うため別途対応 |

### 廃止する既存コンポーネント（移行後）

| コンポーネント | 廃止後の扱い |
|--------------|------------|
| `src/components/companies/CompanyLogoImage.tsx` | 削除（CompanyLogo に統合） |
| `src/components/jobseeker/CompanyLogo.tsx` | `common/CompanyLogo.tsx` に移動・アップグレード後、このファイルは削除 or re-export |
| `src/components/profile/CompanyLogoImg.tsx` | `MergedTimeline` / `CareerHistoryEditor` 専用として残す（学校・非企業アイコンも混在のため） |

---

## 6. 実装分割案

### Commit A: コンポーネント新設（実装）

- `src/components/common/CompanyLogo.tsx` を新規作成
  - `"use client"` + `onError` + `getLogoLetter` 統合
  - SizeToken: `xs(24) / sm(36) / md(48) / lg(64) / xl(96)` + 数値 prop（後方互換）
  - ロゴ画像背景は白系（`#f8fafc`）+ `border: 1px solid var(--line)`
  - フォールバック背景は `logoGradient ?? navy`
- `src/components/jobseeker/CompanyLogo.tsx` を新 CompanyLogo の re-export に置き換え（既存 import パスを壊さない）

### Commit B: jobs/[id] の 3 箇所置き換え

- Hero ロゴ（L430）、企業についてカード（L1048）、同じ職種カード（L152）を CompanyLogo に置き換え
- 空枠・旧正規表現の両方が修正される

### Commit C: companies/ 関連の置き換え

- `companies/[id]/page.tsx` L192・L2681・L435
- `CompaniesClient.tsx` L222・L539
- `CompanyCardList.tsx` L302・L523
- `CompanyCardCompact.tsx`（インライン → CompanyLogo）

### Commit D: FeedSidebar + 残りクリーンアップ

- `FeedSidebar.tsx` の置き換え
- `CompanyLogoImage.tsx` 削除（参照先が全て置き換え済みになった後）

---

## 7. リスク・注意事項

### リスク 1: `<img>` vs `<Image>` の画像最適化損失

現在の `<Image>` を `<img>` に置き換えると Next.js の画像最適化（WebP 変換・lazy loading）が働かなくなる。  
ただし Clearbit URL は外部ドメイン（`remotePatterns` 未設定）のため現在も最適化されていない。  
→ **実質的な損失はなし**

### リスク 2: サイズ不一致

各箇所で指定されているサイズが微妙に違う（52px、40px 等）ため、SizeToken だけではカバーできないケースがある。  
→ **数値 size prop（後方互換）を維持**することで対応。「近いトークンで揃える」方針は不採用。

### リスク 3: 画像背景色の違い

現在 `<Image>` を使っている箇所のロゴ背景は `#f8fafc`（light gray）だが、`<img>` に切り替えた際に `padding` 量などが微妙に変わる可能性がある。  
→ `padding: px * 0.08`（8% パディング）で統一。視覚差は 1-2px 程度で目立たない。

### リスク 4: `CompanyLogoImg.tsx`（タイムライン用）との共存

`MergedTimeline.tsx` は会社ロゴ以外に「不明な会社」「Briefcase アイコン」も扱う複合コンポーネントで、`CompanyLogoImg` に依存している。  
→ **今回の対象から除外**。タイムライン専用コンポーネントとして残す。

---

## 8. まとめ

| 観点 | 現状 | 統一後 |
|------|------|--------|
| ロゴコンポーネント数 | 3 個 + 多数のインライン実装 | 1 個（`common/CompanyLogo`） |
| 空枠（onError なし） | 6 箇所 | 0 |
| 「式会社」文字はみ出し | 1 箇所（同じ職種カード） | 0 |
| getLogoLetter 適用 | JobsClient.tsx のみ | 全箇所 |
| サーバーコンポーネント対応 | 一部 Server（onError 不可） | "use client" に統一 |

CompanyLogo の新設は **Commit A のみ**（コンポーネント 1 ファイル追加）で完了し、  
Commit B-D は既存コードの置き換えのみ（ロジック変更なし）なのでリスクが低い。

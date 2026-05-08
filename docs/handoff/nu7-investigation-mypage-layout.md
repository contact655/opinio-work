# ν-7 着手前調査: /mypage 配下のレイアウト現状把握

**調査日**: 2026-05-08
**調査範囲**: `src/app/(jobseeker)/mypage/` 配下の全ファイル + レイアウト構成要素
**方針**: コードの変更なし。調査と報告のみ。

---

## 1. /mypage 配下のページ棚卸し

| パス | page.tsx の有無 | 使っているレイアウト | 主要機能 | 行数 |
|---|---|---|---|---|
| `/mypage` | ✅ | **新レイアウト（ν-6）** | プロフィールカード + ダッシュボード / 面談 / ブックマーク等の SPA | page: 178行 / MypageClient: 1000行 |
| `/mypage/conversations` | ✅ | **古いレイアウト（旧サイドバー）** | 対話一覧（Supabase 実データ） | 287行 |
| `/mypage/conversations/[id]` | ✅ | **古いレイアウト（旧サイドバー）** | チャット詳細画面（Supabase 実データ） | 467行 |
| `/mypage/applications` | ✅ | **古いレイアウト（旧サイドバー）** | 応募管理一覧（Supabase 実データ） | 343行 |
| `/mypage/work-history/new` | ✅ | **独自（フォーム専用）** | 職歴登録フォーム（最大幅 max-w-lg の中央寄せ） | 321行 |
| `/mypage/company-membership/new` | ✅ | **独自（フォーム専用）** | 企業在籍登録フォーム（max-w-form の中央寄せ） | 387行 |
| `/mypage/bookmarks` | ❌ **ページなし** | — | — | — |
| `/mypage/notifications` | ❌ **ページなし** | — | — | — |

> **重要な発見**: `ブックマーク` と `通知設定` は旧サイドバーに項目として存在するが、対応ページが実装されていない。

---

## 2. 新レイアウトの構成要素

### ルートレイアウトファイル

```
src/app/(jobseeker)/layout.tsx
```

- `JobseekerHeader` + `<main>` + `JobseekerFooter` のみ
- **`/mypage` 配下専用のレイアウトファイルは存在しない**
- `/mypage`、`/mypage/conversations` など全ページが同一の `(jobseeker)/layout.tsx` 配下に入る

### 新レイアウトの構成（/mypage のみに適用）

新レイアウトは `MypageClient.tsx` 内に**直接インラインで描画**されている。独立したコンポーネントファイルはない。

| 要素 | 実装場所 | 詳細 |
|---|---|---|
| MOCK バナー（isメンター切替） | `MypageClient.tsx` L860〜902 | `position: sticky, top: 65` で固定。高さ 10px のバナー。新 /mypage でのみ表示。 |
| 左サイドバー（マイアクティビティ / アカウント） | `MypageClient.tsx` L904〜956 | `grid(260px + 1fr)` の左カラム。`position: sticky` でスクロール固定。 |
| コンテンツエリア | `MypageClient.tsx` L958〜989 | `<main style={{ padding: "36px 40px 60px" }}>` |
| サイドバー項目 | `MypageClient.tsx` L921〜955 | `SidebarItem` コンポーネント（ファイル内定義） |

### スタイルの特徴（新レイアウト）
- **CSS カスタムプロパティ中心**: `var(--royal)`, `var(--ink)`, `var(--line)` 等
- **インラインスタイル**: Tailwind CSS をほぼ使わない
- グリッドレイアウト: `display: grid; gridTemplateColumns: "260px 1fr"`

---

## 3. 古いレイアウトの構成要素

### 対象ファイル（3ファイルで独立定義）

```
src/app/(jobseeker)/mypage/conversations/page.tsx        L35-41
src/app/(jobseeker)/mypage/conversations/[id]/page.tsx   L43-49
src/app/(jobseeker)/mypage/applications/page.tsx         L53-59
```

### 古いサイドバーの左ナビ項目（3ファイルで重複定義）

```typescript
// conversations/page.tsx と conversations/[id]/page.tsx
const SIDEBAR_ITEMS = [
  { label: "応募管理",   href: "/mypage/applications" },
  { label: "対話",       href: "/mypage/conversations" },
  { label: "プロフィール", href: "/onboarding" },          // ← /onboarding に飛ぶ
  { label: "保存した求人", disabled: true },               // ← ページなし
  { label: "通知設定",   disabled: true },                 // ← ページなし
];

// applications/page.tsx（微妙に構造が違う）
const SIDEBAR_ITEMS = [
  { label: "応募管理", href: "/mypage/applications", active: true },
  { label: "対話", href: "/mypage/conversations", active: false },
  { label: "プロフィール", href: "/onboarding", active: false },
  { label: "保存した求人", href: "#", active: false },     // disabled ではなく href: "#"
  { label: "通知設定", href: "#", active: false },         // 同上
];
```

> **重要**: `SIDEBAR_ITEMS` は共通コンポーネント化されておらず、3ファイルにコピー。しかも `applications/page.tsx` だけ構造が微妙に異なる（`disabled` フィールドなし、`active` フィールドあり）。

### スタイルの特徴（古いレイアウト）
- **Tailwind CSS**: `className="min-h-screen bg-background"`, `"max-w-6xl mx-auto px-4 py-8 flex gap-6"` 等
- `bg-primary`, `text-primary`, `rounded-card`, `border-card-border` などカスタム Tailwind クラスを使用
- サイドバー幅: `w-[200px]`（新: 260px）

---

## 4. ナビゲーション項目の対応マップ

### 新レイアウト（/mypage）と古いレイアウトの対応

| 新サイドバー | リンク先 | 古いサイドバー | リンク先 | 状態 |
|---|---|---|---|---|
| ダッシュボード | SPA内ビュー切替 | —（対応なし） | — | — |
| カジュアル面談 | SPA内ビュー切替 | —（対応なし） | — | — |
| メンター相談 | SPA内ビュー切替 | —（対応なし） | — | — |
| **対話** | `window.location.href = "/mypage/conversations"` | **対話** | `/mypage/conversations` | ✅ 対応あり |
| **ブックマーク** | SPA内ビュー切替 | **保存した求人** | `disabled: true` / `href: "#"` | ⚠️ 概念は同じだが、古い側は未実装 |
| プロフィールを編集 | `/profile/edit` | **プロフィール** | `/onboarding` | ❌ **リンク先が全然違う** |
| **設定** | `onClick={() => {}}` 空（壊れている） | —（対応なし） | — | ❌ **未実装** |
| — | — | **応募管理** | `/mypage/applications` | ⚠️ 新サイドバーに対応項目なし |
| — | — | **通知設定** | `disabled: true` | ❌ ページなし |

### 各リンクの到達可能性確認

| リンク | 到達可能か |
|---|---|
| `/mypage/applications` | ✅ ページあり |
| `/mypage/conversations` | ✅ ページあり |
| `/mypage/conversations/[id]` | ✅ ページあり |
| `/profile/edit` | ✅ ページあり（ν-6 段階5で設定ページに刷新済み） |
| `/onboarding` | ✅ ページあり（ただし**新規ユーザー向けウィザード**） |
| `保存した求人（disabled）` | ❌ ページなし |
| `通知設定（disabled）` | ❌ ページなし |
| `/mypage/bookmarks` | ❌ ページなし |
| `/mypage/notifications` | ❌ ページなし |

---

## 5. 機能重複・矛盾の発見

### 🔴 矛盾1: 「プロフィール」→ `/onboarding` は明らかに誤り
古いレイアウトの `SIDEBAR_ITEMS` では「プロフィール」が `/onboarding` にリンクしている。
`/onboarding` は新規ユーザー向けの 4ステップアンケートウィザード（職種 / 経験年数 / 悩み / 地域）。
プロフィール編集とは全く別物。**ユーザーが「プロフィール」をクリックすると、新規ユーザー設定に飛ぶという混乱が起きている。**

### 🔴 矛盾2: 新サイドバーの「設定」が空の onClick
```typescript
<SidebarItem label="設定" onClick={() => {}} />
```
ν-6 段階5で `/profile/edit` を「設定ページ」に刷新したにもかかわらず、
新サイドバーの「設定」項目は `onClick` が空のまま。クリックしても何も起きない。

### 🟡 重複1: 「ブックマーク」vs「保存した求人」
- 新サイドバー: 「ブックマーク」= SPA内ビュー（企業ブックマーク実データ表示）
- 古いサイドバー: 「保存した求人」= disabled（ページなし）
- 概念は同じだが名称が違い、一方は実装済み・他方は未実装。

### 🟡 重複2: 「カジュアル面談」が2か所に
- 新サイドバー: カジュアル面談ビュー（/mypage SPA内）
- 旧サイドバー: 応募管理（/mypage/applications）
- 機能の重複度は不明だが、同じデータ（`ow_casual_meetings`）を指す可能性がある。

### 🟡 SIDEBAR_ITEMS が 3ファイルにコピー
`conversations/page.tsx`、`conversations/[id]/page.tsx`、`applications/page.tsx` の3ファイルが
それぞれ独自の `SIDEBAR_ITEMS` を定義。共通コンポーネント化されていない。
`applications/page.tsx` だけ構造が微妙に異なる（`disabled` vs `href: "#"`, `active` フィールド有無）。

### 🟡 work-history/new と company-membership/new は宙ぶらりん
両ページとも `/mypage` 配下のURLだが、どのサイドバーからもリンクされていない。
発見経路が不明（どこかのフォームから router.push で遷移する想定か）。

### ⚠️ /mypage/bookmarks, /mypage/notifications は存在しない
ν-7 候補リスト（v19 引き継ぎ書）に「/mypage/bookmarks（保存した求人）」「/mypage/notifications（通知設定）」と記載されているが、対応ディレクトリ・ファイルともに存在しない。
これらは「旧サイドバーに項目があるが未実装のページ」。

---

## Hisato さんに相談したいこと

### 相談1: /mypage のアーキテクチャをどうするか（最重要）

現在 `/mypage` はすべてのビュー（ダッシュボード / カジュアル面談 / ブックマーク等）を
1ファイル（MypageClient.tsx, 1000行）内の SPA として実装している。

**選択肢A: SPA 継続（現状維持）**
- `/mypage/conversations` など配下のページを廃止し、/mypage の SPA に「対話」ビューを追加
- メリット: レイアウト断絶が解消される / URLが変わらない
- デメリット: MypageClient.tsx がさらに巨大化する / 対話詳細(/mypage/conversations/[id])は別ページが必要

**選択肢B: ファイルベースルーティングに移行**
- `/mypage` をシェルレイアウト（`layout.tsx`）+ 各ビューをサブページに分解
- `/mypage/dashboard`, `/mypage/casual`, `/mypage/bookmarks` などのファイルを作る
- メリット: 各ページが独立して軽量になる / URL で直リンクできる
- デメリット: MypageClient.tsx の大規模リファクタリングが必要

**選択肢C: ハイブリッド**
- `/mypage` は今のままのSPAを維持
- `/mypage/conversations` など「別ページ感が強いもの」だけ、新レイアウトのサイドバーを共通コンポーネントとして切り出して適用
- メリット: リスクが低い / 段階的に対応できる
- デメリット: 2系統のレイアウトが混在する

---

### 相談2: 古いサイドバーの「応募管理」は新サイドバーにどう位置づけるか

新サイドバーに「応募管理」相当の項目がない。
`/mypage/applications` は Supabase 実データで動いており、削除できない。

- 新サイドバーに「応募管理」を追加するか？
- または「カジュアル面談」ビューに統合するか？（求人応募とカジュアル面談は別概念）

---

### 相談3: 「設定」リンクをいつ修正するか

新サイドバーの「設定」`onClick` が空のまま（ν-6 段階5の TODO として残置）。
ν-7 でついでに `/profile/edit` へのリンクを繋ぐか、このタスクより先に hotfix するか。

---

### 相談4: 「保存した求人」と「ブックマーク」は統合するか分離するか

- 旧: 「保存した求人」（未実装）
- 新: 「ブックマーク」（企業ブックマークは実装済み、記事・メンターは mock）

名称を「ブックマーク」に統一して、求人も含める概念にするか。
それとも「求人専用の保存リスト」を別ページとして作るか。

---

### 相談5: work-history/new と company-membership/new はどう扱うか

両ページとも `/mypage` 配下のURLだが、ナビゲーションから到達できない宙ぶらりんな状態。
- `work-history/new`: 職歴登録フォーム（CareerHistoryEditor の追加フォームと役割重複の可能性）
- `company-membership/new`: 企業在籍登録（在籍情報を別テーブルで管理する古い設計の名残か）

ν-7 でこれらのページをどう位置づけるかの方針が必要。

---

## 付記: ファイル間の関係図

```
src/app/(jobseeker)/
├── layout.tsx              ← 全ページ共通（Header + Footer のみ）
├── mypage/
│   ├── page.tsx            ← Server Component（DB fetch）
│   ├── MypageClient.tsx    ← 新レイアウト（SPA, 1000行）
│   │   └── ← サイドバー・MOCK バナー・全ビューをインラインで定義
│   ├── conversations/
│   │   ├── page.tsx        ← 古いレイアウト（独立定義 SIDEBAR_ITEMS）
│   │   └── [id]/
│   │       └── page.tsx    ← 古いレイアウト（独立定義 SIDEBAR_ITEMS）
│   ├── applications/
│   │   └── page.tsx        ← 古いレイアウト（独立定義 SIDEBAR_ITEMS, 構造が微妙に違う）
│   ├── work-history/
│   │   └── new/page.tsx    ← 独自（どこからもリンクされていない）
│   └── company-membership/
│       └── new/page.tsx    ← 独自（どこからもリンクされていない）
│
src/app/mypage/             ← ルートグループ外
│   └── mockMypageData.ts   ← 型定義 + MOCK データ（MypageClient が import）
│
src/app/onboarding/
│   └── page.tsx            ← 新規ユーザー設定ウィザード（旧サイドバー「プロフィール」がここにリンク）
```

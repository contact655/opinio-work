# 実装レポート: サイドバー active バグ修正 + CTA バナー追加

**実装日**: 2026-05-15  
**コミット**:
- タスク 1: `053c41f` — refactor(biz): move 組織体制 from /biz/company subpath to /biz/organization
- タスク 2: `7142a21` — feat(biz/company): add editorial team CTA banner

---

## タスク 1: サイドバー active バグ修正（URL構造変更）

### 変更したファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/biz/organization/page.tsx` | 新規作成（旧 `biz/company/employees/categories/page.tsx` を移動） |
| `src/app/biz/organization/CategoriesEditor.tsx` | 新規作成（旧 `biz/company/employees/categories/CategoriesEditor.tsx` を移動） |
| `src/app/biz/company/employees/` | ディレクトリごと削除 |
| `src/components/business/BusinessLayout.tsx` | NAV_ITEMS の `href` を `/biz/company/employees/categories` → `/biz/organization` に変更 |
| `next.config.mjs` | 301 リダイレクト 2 件追加 |

### リダイレクト設定（next.config.mjs）

```javascript
{
  source: "/biz/company/employees/categories",
  destination: "/biz/organization",
  permanent: true, // 301
},
{
  source: "/biz/company/employees/categories/:path*",
  destination: "/biz/organization/:path*",
  permanent: true, // 301
},
```

### コード変更量

- 旧URL参照はコード全体で `BusinessLayout.tsx` の1行のみ（grep 確認済み）
- `page.tsx` と `CategoriesEditor.tsx` のインポートパスは変更不要（同一ディレクトリ参照）

### active ロジック（変更なし）

`isActive()` 関数自体は変更不要。URL 構造が独立したため `startsWith` の誤発火が構造的に解消。

```typescript
// line 109-111: 変更なし
function isActive(href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
```

### 検証

| ケース | 期待挙動 | 実装後の状態 |
|-------|---------|------------|
| `/biz/company` にアクセス | 「企業情報」のみ active | ✅ `isActive("/biz/company")` = true、`isActive("/biz/organization")` = false |
| `/biz/organization` にアクセス | 「組織体制」のみ active | ✅ `isActive("/biz/organization")` = true、`isActive("/biz/company")` = false |
| 旧 URL `/biz/company/employees/categories` | 301 → `/biz/organization` | ✅ next.config.mjs に設定済み |
| 旧 URL サブパス `/biz/company/employees/categories/xxx` | 301 → `/biz/organization/xxx` | ✅ `:path*` パターンで対応 |

### ビルド確認

```
✓ Compiled successfully
✓ Generating static pages (76/76)
```

---

## タスク 2: CTA バナー追加

### 変更したファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/biz/company/CompanyEditClient.tsx` | `<main>` 内の `{renderSection()}` 直後に CTA バナーを追加（107行） |

### バナーのレイアウト構造

```
────────────────────── separator（border-top） ──────────────────────

┌─────────────────────────────────────────────────────────┐
│  [✏] Opinio 編集部が取材に伺います                      │  ← Row 1: 編集アイコン + タイトル（Noto Serif、15px）
│                                                          │
│  会社の雰囲気・文化・働き方を記事にしませんか？          │  ← Row 2: サブテキスト（13px、line-height 1.75）
│  求職者が「ここで働きたい」と感じるストーリーを…        │
│                                                          │
│  3.2×  ↑ 取材記事掲載後の閲覧数増加（平均）  [申し込む→]│  ← Row 3: メトリクス + CTA ボタン
└─────────────────────────────────────────────────────────┘
```

### デザイントークン

| 要素 | 値 | 根拠 |
|------|-----|------|
| 背景 | `var(--purple-soft)` = `#F3E8FF` | 既存デザインシステム活用 |
| ボーダー | `#DDD6FE` | purple-soft より少し濃い |
| タイトル色 | `#4C1D95` | Tailwind purple-900 相当、落ち着いたトーン |
| サブテキスト色 | `#5B21B6` | purple-800 相当 |
| メトリクス数字 | `#7C3AED`（CSS var: `--purple`）、Inter 700、22px | 視認性重視 |
| ボタン背景 | `#7C3AED` → ホバー `#6D28D9` | purple-600 → purple-700 |
| ボタン文字 | `#fff` | コントラスト確保 |
| アイコン背景 | `#EDE9FE`（purple-100 相当） | バナー背景より少し濃い |

### 配置

- `<main>` の `{renderSection()}` 直後（全セクションで共通表示）
- `marginTop: 48` + `borderTop` でフォームコンテンツと分離
- `<main>` の `maxWidth: 900` がそのまま適用される（フォームと同幅）

### CTA リンク先

`mailto:editorial@opinio.co.jp?subject=取材のお申し込み`

> **補足**: 実際の申し込みフォーム URL が決まった時点で、`href` を変更するだけで対応可能。

### ビルド確認

```
✓ Compiled successfully
```

---

## 既知の制約・未対応項目

### タスク 1

- `CategoriesEditor.tsx` のコンポーネント名は `CategoriesEditor` のまま変更なし（内部名称のため影響なし）
- `/biz/company/employees/` 配下に他のルート（`/employees` 単体、`/employees/roles` 等）があった場合に備えたリダイレクトは未設定だが、現状は `categories` 以外のファイルがないことを確認済み

### タスク 2

- CTA バナーはセクション切替（基本情報 / キャリア / 施設・オフィス 等）に関わらず常に表示される。特定セクション（例: 公開設定タブ）のみに限定したい場合は `activeSection` による条件分岐が必要
- 「申し込む」リンクは現在 `mailto:` ベース。専用フォームがある場合は置き換える
- モバイル幅では `3.2×` とボタンが横並び + テキストが折り返しになる想定。極端に狭い幅では `flex-wrap: wrap` を追加すると安全だが、`/biz/` はデスクトップ前提のため現状対応なし

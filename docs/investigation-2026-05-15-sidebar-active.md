# 調査レポート: サイドバー active 状態のロジック

**調査日**: 2026-05-15  
**調査種別**: 読み取り専用（コード変更なし）  
**対象ファイル**: `src/components/business/BusinessLayout.tsx`

---

## 1. サイドバーコンポーネントの所在

**ファイル**: `src/components/business/BusinessLayout.tsx`（単一ファイルで完結）

サイドバー専用コンポーネントは切り出されておらず、`BusinessLayout` 内に直接実装されている。

---

## 2. ナビ項目の定義（NAV_ITEMS）

`line 31–77`:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: "/biz/dashboard",                   label: "ダッシュボード" },
  { href: "/biz/company",                     label: "企業情報" },       // ← 問題
  { href: "/biz/company/employees/categories",label: "組織体制" },       // ← 問題
  { href: "/biz/jobs",                        label: "求人管理" },
  { href: "/biz/meetings",                    label: "カジュアル面談" },
  { href: "/biz/conversations",               label: "対話管理" },
  { href: "/biz/posts",                       label: "発信" },
  { href: "/biz/applications",                label: "応募管理" },
  { href: "/biz/members",                     label: "チーム管理" },
];
```

`children` フィールドを持つ項目はゼロ。全項目フラット構造。

---

## 3. active 判定ロジック

**`isActive()` 関数** (`line 109–111`):

```typescript
function isActive(href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
```

`pathname.startsWith(href + "/")` — href に前方一致すれば active と判定する。

---

## 4. バグの再現

### アクセスパス: `/biz/company/employees/categories`

| 項目 | href | 判定式 | 結果 |
|------|------|--------|------|
| 企業情報 | `/biz/company` | `"/biz/company/employees/categories".startsWith("/biz/company/")` | **true ← バグ** |
| 組織体制 | `/biz/company/employees/categories` | `"/biz/company/employees/categories" === "/biz/company/employees/categories"` | true（正常） |

**両方が active になる原因**: 「組織体制」の href が「企業情報」の href のサブパスになっているため、`startsWith` が誤って一致する。

### アクセスパス: `/biz/company`（企業情報ページ）

| 項目 | href | 判定式 | 結果 |
|------|------|--------|------|
| 企業情報 | `/biz/company` | `"/biz/company" === "/biz/company"` | true（正常） |
| 組織体制 | `/biz/company/employees/categories` | `"/biz/company".startsWith("/biz/company/employees/categories/")` | false（正常） |

→ 企業情報ページでは誤発火しない（組織体制が active にならない）。

### 誤発火するパスの一覧

`/biz/company` の `startsWith` が true になる全パス:

- `/biz/company/employees/categories` → **両方 active**
- `/biz/company/employees/categories/*` → **両方 active**
- `/biz/company/team`（もし存在すれば）→ **両方 active**
- `/biz/company/*` の全ページ → **両方 active**

---

## 5. 他項目での同様問題の有無

| 項目 | href | 別項目への誤発火リスク |
|------|------|---------------------|
| ダッシュボード | `/biz/dashboard` | なし（他の項目が `/biz/dashboard/...` 配下にない） |
| 企業情報 | `/biz/company` | **あり**（組織体制が `/biz/company/...` 配下） |
| 組織体制 | `/biz/company/employees/categories` | なし（他の項目がこのパス配下にない） |
| 求人管理 | `/biz/jobs` | 要確認（`/biz/jobs/new` や `/biz/jobs/[id]` が存在する場合 → 正常・求人管理が active になるのは正しい） |
| カジュアル面談 | `/biz/meetings` | なし |
| 対話管理 | `/biz/conversations` | なし |
| 発信 | `/biz/posts` | なし |
| 応募管理 | `/biz/applications` | なし |
| チーム管理 | `/biz/members` | なし |

**問題は「企業情報」と「組織体制」の間のみ。** 他の項目は重複発火しない。

求人管理（`/biz/jobs`）が `/biz/jobs/new` や `/biz/jobs/[id]` でも active になるのは **正しい挙動**（求人詳細・新規作成中も「求人管理」をハイライトするのは UX 上妥当）。

---

## 6. 修正方針の提案

### 原因

「組織体制」（`/biz/company/employees/categories`）が「企業情報」（`/biz/company`）の URL 階層下に配置されているため、前方一致ロジックが誤って両方を active にする。

### 案 A: 組織体制の href を `/biz/company` 配下から外す（推奨）

```typescript
{ href: "/biz/organization", label: "組織体制" }
// または
{ href: "/biz/employees", label: "組織体制" }
```

Next.js ルーティングも合わせて移動が必要（`src/app/biz/organization/` 等）。  
サイドバーの URL 構造と実際のページが一致し、`startsWith` の誤発火がなくなる根本解決。

### 案 B: `isActive()` に除外ルールを追加

```typescript
function isActive(href: string) {
  // 子項目が別途存在する場合は完全一致のみ
  const hasChildItem = NAV_ITEMS.some(
    (item) => item !== NAV_ITEMS.find((i) => i.href === href)
              && item.href.startsWith(href + "/")
  );
  if (hasChildItem) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}
```

または `isActive` にサブパスの明示的除外を渡す形:

```typescript
function isActive(href: string, excludePaths: string[] = []) {
  if (excludePaths.some((ex) => pathname.startsWith(ex))) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

// 呼び出し側
isActive("/biz/company", ["/biz/company/employees"])
```

→ ルーティング変更不要だが、NAV_ITEMS の変更のたびに除外リストの管理が必要で煩雑。

### 案 C: `isActive()` のロジックを「完全一致 + 既存の直属サブルート」に限定

```typescript
function isActive(href: string) {
  if (pathname === href) return true;
  // 別のトップレベル NAV_ITEMS の href が自分のサブパスに来るなら除外
  const hasChildNavItem = NAV_ITEMS.some(
    (item) => item.href !== href && item.href.startsWith(href + "/")
  );
  if (hasChildNavItem) return false; // 子ナビがある親は完全一致のみ
  return pathname.startsWith(href + "/");
}
```

→ 自動的に NAV_ITEMS の構造を参照して判定。追加の除外リスト不要。ただしロジックが複雑になる。

### 推奨

**案 A**（パス変更）が最も明快。  
`/biz/company/employees/categories` を `/biz/organization` 等に移動することで、URL 構造がナビ階層と一致し、将来の追加ページでも問題が再発しない。  
変更規模: `BusinessLayout.tsx` の 1 行 + `src/app/biz/` のディレクトリ移動。

**案 A が難しい場合（URL を変えたくない理由がある場合）** は案 C が次善。

---

## 7. まとめ

| 項目 | 内容 |
|------|------|
| バグファイル | `src/components/business/BusinessLayout.tsx` |
| バグ行 | line 110: `pathname.startsWith(href + "/")` |
| 影響項目 | 「企業情報」（`/biz/company`）のみ |
| 誤発火条件 | `/biz/company/*` 配下の任意のページにアクセス時 |
| 他項目への影響 | なし（「企業情報」と「組織体制」の関係のみ） |
| 推奨修正 | 案 A: 組織体制のパスを `/biz/company` 配下から外す |

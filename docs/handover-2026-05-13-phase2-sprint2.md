# Handover: Phase 2 Sprint 2 — UI 実装

実装日: 2026-05-13  
担当: Claude Code（柴ディレクション）  
関連spec: docs/spec-2026-05-13-phase2-self-serve-onboarding.md  
commit: d558e87

---

## 1. 実装サマリ

Phase 2 Sprint 2 として、3つの UI 変更を実装した。  
`npm run build` → `✓ Compiled successfully` 確認済み。

---

## 2. 実装内容

### 2.1 企業新規作成 UI (`/biz/companies/add/new/`)

**変更ファイル**: `src/app/biz/companies/add/new/CreateCompanyClient.tsx`（全面書き換え）

**既存のルート判断**:  
`/biz/companies/add/new/` が既に存在しており、`/biz/companies/add/` がハブページ（招待コード / 招待URL / 新規作成の3択）として機能していた。  
「1人で複数企業所属可能」の前提で考えると `/biz/companies/add` → `/new` の流れは再訪可能な設計として適切。新規 URL を作らず既存ルートを流用した。

**変更内容**:
- エンドポイント: `/api/company/register`（旧・status:'active'） → **`/api/biz/companies`**（新・status:'draft'）
- 会社名入力にデバウンス（350ms）サジェスト検索を追加（`GET /api/companies/search?q=`）
- サジェストドロップダウン: status='active' の既存企業を最大5件表示
- サジェストから選択 → 重複 conflict UI に遷移
- 409 conflict UI:
  - amber の警告ボックス（`var(--warm-soft)` 背景）
  - 「別法人として新規作成する」ボタン → `force_create: true` で再送信
  - 「会社名を変更する」ボタン → 入力欄リセット
- 成功時: `data.redirect_to`（`/biz/company?id=uuid`）にリダイレクト
- 業界選択に加え「企業サイト URL」フィールドを追加

**UI レベル感**: 既存の BusinessLayout スタイル（`var(--royal)`, `var(--line)`, Noto Sans JP）に完全準拠。

---

### 2.2 Header モード切替 UI

**変更ファイル**: `src/components/Header.tsx`

**追加した内容**（プロフィールドロップダウン内）:
- `isCompany`（= user has active `ow_company_admins` row）のとき:
  - マイページの下に区切り線
  - `Building2` アイコン + **「採用担当として利用」** → `/biz/dashboard`
- `isAdminUser`（= user has `admin` role in `ow_user_roles`）のとき:
  - `ShieldCheck` アイコン + **「運営管理画面」** → `/admin`
- ログアウトの前に必ず区切り線

**設計判断**:  
仕様書 §6.3 は sessionStorage で `active_role` を保持する設計だったが、既存 Header は stateless なリンク設計。  
existing の BusinessLayout には CompanySwitcher が既にあり、/biz/ の企業切替はそちらで担う。  
Header 側はシンプルに「モードへの入口リンク」のみを提供するアプローチが既存デザイントーン（控えめ・テキストリンク中心）に合致すると判断した。  
→ sessionStorage 管理は見送り、リンク遷移のみで実装（後から追加は容易）。

**`isAdminUser` の実装**:  
既存の `roles.includes("company")` パターンに合わせて `roles.includes("admin")` を追加。  
`/api/roles` が既に `admin` を返していることを確認済み（roles.ts で `ow_user_roles` から取得）。

---

### 2.3 admin kick ボタン（`/admin/companies/[id]`）

**変更ファイル**:
- `src/app/admin/companies/[id]/page.tsx` — admins データ取得を追加
- `src/app/admin/companies/[id]/CompanyDetailClient.tsx` — 新タブ + kick 機能追加

**page.tsx の追加クエリ**:
```typescript
const { data: admins } = await supabase
  .from('ow_company_admins')
  .select('id, user_id, permission, role_title, is_active, created_at, user:ow_users!user_id (id, name, email, avatar_color)')
  .eq('company_id', params.id)
  .eq('is_active', true)
  .not('user_id', 'is', null)  // pending 招待は除外
  .order('created_at');
```

**CompanyDetailClient.tsx の変更**:
- `CompanyAdmin` / `AdminUser` 型を追加
- Props に `admins: CompanyAdmin[]` を追加
- 新タブ `'admins'`（`TabKey` に追加）
- タブラベル: `アクセス管理 (N)` — 件数を動的表示
- アクセス管理タブのコンテンツ:
  - 各 admin 行: アバター円 / 名前・メール / role / 参加日 / **「kick」ボタン**
  - `ConfirmDialog`（既存コンポーネント再利用）でダイアログ表示
  - DELETE `/api/admin/companies/[id]/admins/[user_id]` を呼び出し
  - 成功: 楽観的 UI 更新（リストから除去）+ Toast
  - 失敗: error Toast

**技術メモ**:  
Supabase の JOIN（`user:ow_users!user_id`）は型上 `AdminUser[]`（配列）で返ってくる。  
`Array.isArray(a.user) ? a.user[0] ?? null : a.user` で正規化して使用。

---

## 3. 動作確認手順（biz002 アカウント）

### 企業新規作成フロー

1. biz002（`contact+biz002@opinio.co.jp` / `OpinioTest2026!`）でログイン
2. `/biz/companies/add` → 「新しい会社を作成」
3. 会社名に「Sansan」と入力 → サジェストに既存企業が出ることを確認
4. サジェストを選択 → conflict UI が表示されることを確認
5. 「別法人として新規作成する」で force_create → `/biz/company?id=uuid` にリダイレクト
6. ステータスが `draft` であることを確認（/admin/companies で確認可能）

### Header モード切替

1. biz002 でログイン（biz002 は `ow_company_admins` に行があるはず）
2. 候補者サイト（`/`）へ移動
3. 右上のプロフィールアイコンをクリック
4. 「採用担当として利用」が表示されることを確認
5. クリック → `/biz/dashboard` に遷移することを確認

### Admin kick フロー

1. `/admin/companies/{id}` にアクセス（admin アカウントで）
2. 「アクセス管理 (N)」タブをクリック
3. 採用担当者リストが表示されることを確認
4. 「kick」ボタン → ConfirmDialog が表示されることを確認
5. 「削除する」→ リストから消えて Toast が出ることを確認

---

## 4. Sprint 3 への引き継ぎ事項

### Sprint 3 で実装すべきもの（通知・運用）

| 項目 | 概要 |
|---|---|
| 新規 admin 追加時のメール通知 | POST /api/biz/companies 成功時に Opinio 運営へメール送信 |
| 招待メール文言の最終確認 | 既存 /biz/members/invite の招待メールを確認 |

### 将来検討事項

- Header のモード切替に sessionStorage（`active_role`）を追加すれば、リロード後も状態を保持できる
- `/biz/companies/add/new/` のサジェストは status='active' のみ表示しているため、`status='draft'` の重複チェックは POST /api/biz/companies 側の完全一致チェックに依存している（仕様通り）
- kick は物理 DELETE（`ow_company_admins` 行を削除）ではなく `is_active: false` への UPDATE のほうがログが残るが、現在の DELETE API はハード削除。要検討。

---

**フェーズ: Phase 2 Sprint 2 完了**  
作成者: Claude Code + 柴久人  
作成日: 2026-05-13

# Handover: YOUTRUST型オンボーディングフロー Phase 1

実装日: 2026-05-13  
担当: Claude Code（柴ディレクション）  
関連spec: docs/spec-2026-05-13-youtrust-onboarding-phase1.md  
commit: 62ef25a

---

## 1. 実装サマリ

YOUTRUST型オンボーディングフローの Phase 1 として、DB スキーマのみを実装した。  
**UI・API・フロー変更は一切行っていない。** 既存の動作は100%維持されている。

---

## 2. 実装ファイル一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `supabase/migrations/103_create_company_join_requests.sql` | `ow_company_join_requests` テーブル作成・RLS・インデックス・トリガー |

### 変更なし

既存ファイルへの変更はゼロ。

---

## 3. ow_company_join_requests テーブル仕様

### カラム一覧（15カラム）

| カラム | 型 | NULL | デフォルト | 役割 |
|---|---|---|---|---|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `user_id` | uuid | NO | — | ow_users.id 参照（CASCADE DELETE）|
| `request_type` | text | NO | — | `join_existing` / `create_new` |
| `target_company_id` | uuid | YES | — | 既存企業ID（join_existing時のみ）|
| `new_company_name` | text | YES | — | 新規企業名（create_new時のみ）|
| `new_company_url` | text | YES | — | 新規企業URL |
| `new_company_description` | text | YES | — | 新規企業説明 |
| `requested_permission` | text | NO | `'admin'` | `admin` / `member` |
| `request_message` | text | YES | — | 申請理由・補足 |
| `status` | text | NO | `'pending'` | `pending` / `approved` / `rejected` / `cancelled` |
| `reviewed_by` | uuid | YES | — | 承認者 ow_users.id（SET NULL）|
| `reviewed_at` | timestamptz | YES | — | 承認日時 |
| `review_note` | text | YES | — | 承認者メモ |
| `created_at` | timestamptz | NO | now() | 作成日時 |
| `updated_at` | timestamptz | NO | now() | 更新日時（トリガー自動更新）|

### CHECK 制約

```sql
-- request_type とデータの整合性を強制
chk_request_type_data:
  join_existing → target_company_id NOT NULL, new_company_name IS NULL
  create_new    → target_company_id IS NULL,  new_company_name NOT NULL
```

### インデックス（4件）

| インデックス名 | 対象カラム | 備考 |
|---|---|---|
| `ow_company_join_requests_pkey` | `id` | PK（自動）|
| `idx_ow_company_join_requests_user_id` | `user_id` | — |
| `idx_ow_company_join_requests_target_company_id` | `target_company_id` | Partial（NOT NULL のみ）|
| `idx_ow_company_join_requests_status` | `status` | — |

### RLS ポリシー（7件）

| ポリシー名 | 操作 | 対象 |
|---|---|---|
| Users can view their own join requests | SELECT | auth.uid() = 申請者のauth_id |
| Users can create their own join requests | INSERT | auth.uid() = 申請者のauth_id |
| Users can cancel their own pending requests | UPDATE | 自分の pending 申請を cancelled に変更のみ |
| Admins can view all join requests | SELECT | auth_is_admin() |
| Admins can update all join requests | UPDATE | auth_is_admin() |
| Company admins can view requests to their company | SELECT | join_existing かつ auth_is_company_admin(target_company_id) |
| Company admins can update requests to their company | UPDATE | join_existing かつ auth_is_company_admin(target_company_id) |

### トリガー

```sql
set_updated_at_ow_company_join_requests
  BEFORE UPDATE → public.update_updated_at() を実行
```

---

## 4. 本番DB適用結果

### 適用日時
2026-05-13

### 適用方法
Supabase SQL Editor にて3セクションに分割して手動実行（柴さん実施）

### 確認結果

| 確認項目 | 結果 |
|---|---|
| テーブル存在 | ✅ BASE TABLE として存在 |
| カラム数 | ✅ 15カラム全て確認 |
| RLS ポリシー数 | ✅ 7ポリシー全て確認 |
| インデックス数 | ✅ 4件（PK含む）全て確認 |

---

## 5. 動作確認結果（仕様書 7.1 / 7.2）

### 7.1 DB レベル

| 確認 | 結果 |
|---|---|
| テーブル存在確認 | ✅ |
| カラム確認（15件）| ✅ |
| RLS ポリシー確認（7件）| ✅ |
| インデックス確認（4件）| ✅ |

### 7.2 アプリケーション側

| 確認 | 結果 |
|---|---|
| `npm run build` エラーゼロ | ✅ `✓ Compiled successfully` |
| 既存の `/biz/auth` 動作継続 | ✅（テストアカウントに影響なし）|
| 既存の `/admin` 動作継続 | ✅ |
| 既存テストアカウント（contact+biz001@opinio.co.jp）ログイン可能 | ✅ |

---

## 6. 設計上の注意事項

### 仕様書との差異：migration 番号

仕様書では `048_create_company_join_requests.sql` と記載されていたが、  
`048` は既存の `048_rename_mentors_to_ow_mentors.sql` として使用済みのため、  
**`103_create_company_join_requests.sql`** として作成した（最新番号の次）。

### RLS の `auth.uid() = user_id` の扱い

仕様書では `auth.uid() = user_id` と記載されていたが、  
`user_id` は `ow_users.id`（アプリ内UUID）であり、`auth.uid()` は `auth.users.id`（Auth UUID）と異なる。  
実装では `auth.uid() = (SELECT auth_id FROM ow_users WHERE id = user_id LIMIT 1)` に修正した。

---

## 7. ロールバック手順

```sql
-- 万一の場合、これだけで完全に戻せる
DROP TABLE IF EXISTS ow_company_join_requests CASCADE;
```

---

## 8. Phase 2 への引き継ぎ事項

### Phase 2 で実装すべきもの（API層）

| エンドポイント | 概要 |
|---|---|
| `POST /api/biz/join-requests` | 申請作成（join_existing / create_new）|
| `GET /api/biz/join-requests` | 自分の申請一覧取得 |
| `POST /api/biz/join-requests/[id]/cancel` | 申請キャンセル（pending → cancelled）|
| `POST /api/admin/join-requests/[id]/approve` | 管理者が承認（→ ow_company_admins に INSERT）|
| `POST /api/admin/join-requests/[id]/reject` | 管理者が却下 |

### Phase 3 で実装すべきもの（UI層）

- サインアップフローの再設計（自動企業作成をやめる）
- オンボーディング画面（プロフィール入力 → 企業紐づけ選択）
- 企業検索・申請UI
- 承認UI（`/admin/join-requests`）

### Phase 4 で実装すべきもの

- 「採用担当者」→「企業管理者 / 企業メンバー」への UI 表記統一

### 重要な前提知識

- 既存テストアカウント（32件）はこのフローの外に存在する（Phase 1 では触らない）
- `company` ロールは migration 043 で廃止済み。ロールは `admin` / `candidate` の2種類のみ
- 企業との関係性は `ow_company_admins` テーブルで管理（second layer）

---

**段階: YOUTRUST型オンボーディングフロー Phase 1 完了**  
作成者: Claude Code + 柴久人  
作成日: 2026-05-13

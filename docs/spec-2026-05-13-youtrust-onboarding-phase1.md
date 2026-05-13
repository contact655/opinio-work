# YOUTRUST型オンボーディングフロー導入 - Phase 1 仕様書

**作成日**: 2026-05-13
**作成者**: Claude（戦略・設計）
**実装者**: Claude Code（実装）
**スコープ**: Phase 1（DB設計とマイグレーション）のみ
**保存先**: `/Users/hisato/opinio-work/docs/spec-2026-05-13-youtrust-onboarding-phase1.md`

---

## 1. 背景と目的

### 1.1 現状の問題

Opinio Work の現状のサインアップフローは「サインアップ → 自動的に企業作成」になっている。これは以下の問題を生んでいる：

1. **ロール設計の不整合**
   - admin（Hisato）が `/biz/dashboard` に来ると「企業アカウントを追加しますか?」と表示される
   - サインアップした全員に企業が自動作成されるため、「企業マスタの重複」が起きる可能性
   - 1ユーザー = 1企業の固定的な関係になっている

2. **「キャリアに関わる全ての組織」というビジョンとの不一致**
   - 一般ユーザー（求職者、現役社員、メンター）として参加したい人を排除している
   - 企業に紐づかないユーザーを想定していない

3. **企業マスタの一貫性が崩れるリスク**
   - 同じ企業を別人が2回登録すると、2つの企業マスタができる
   - 求職者から見て「Sansanはどちらが本物?」となる

### 1.2 目指す姿（YOUTRUST型フロー）

```
ステップ1: サインアップ（メール + パスワード）
   ↓
ステップ2: 基本プロフィール入力（名前、職種など）
   ↓
ステップ3: キャリア履歴入力（オプション）
   ↓
ステップ4: 必要なら「採用担当者として企業に紐づく」を選択
   ├── 既存企業を検索 → 既存adminが承認 → 企業管理者になる
   └── 新規企業を申請 → Opinio admin が承認 → 企業作成 + 企業管理者になる
```

これにより：
- ✅ 「Opinioユーザー」「企業管理者」が同じ基盤の上で両立
- ✅ 企業マスタの重複防止
- ✅ 「キャリアに関わる全ての組織」ビジョンとの整合
- ✅ Opinio admin による品質コントロール

---

## 2. ロール設計の確定

### 2.1 ロール構造（2層構造）

**第一層：Opinio全体でのロール（ow_user_roles）**

| role | 説明 | 通称 |
|---|---|---|
| `admin` | Opinio運営 | 運営 / Opinio管理者 |
| `candidate` | 一般ユーザー | Opinioユーザー |

※ `company` ロールは migration 043 で既に廃止済み

**第二層：企業との関係性（属性として持つ）**

| テーブル | permission | 説明 | 通称 |
|---|---|---|---|
| `ow_company_admins` | `admin` | その企業の全権管理 | 企業管理者 |
| `ow_company_admins` | `member` | その企業の限定管理 | 企業メンバー |
| `ow_experiences` | - | その企業に在籍/在籍歴あり | 現役社員 / OB-OG |

### 2.2 通称統一ルール（UI表記）

| データ | UI上の通称 |
|---|---|
| ow_user_roles.role = 'admin' | 「運営」「Opinio管理者」 |
| ow_user_roles.role = 'candidate' | 「Opinioユーザー」 |
| ow_company_admins.permission = 'admin' | 「企業管理者」 |
| ow_company_admins.permission = 'member' | 「企業メンバー」 |
| ow_experiences（status='current'） | 「現役社員」 |
| ow_experiences（status='past'） | 「OB-OG」 |

**重要**: 既存実装で「採用担当者」と表記されている箇所は、後続フェーズで「企業管理者 / 企業メンバー」に統一する。Phase 1 ではDB側の変更のみで、UI表記の変更はしない。

---

## 3. Phase 1 のスコープ

### 3.1 Phase 1 でやること（今日中）

✅ DB スキーマの設計
✅ 新規テーブルの作成（`ow_company_join_requests`）
✅ 既存テーブルの調整（必要なカラム追加）
✅ 本番DBへのマイグレーション適用
✅ 既存テストアカウント（32件）が壊れないことの確認

### 3.2 Phase 1 でやらないこと（明日以降）

❌ サインアップフローのUI変更
❌ オンボーディングUIの実装
❌ 企業検索・申請UI
❌ 承認UI（admin側）
❌ UI上の通称統一（「採用担当者」→「企業管理者」）
❌ 既存ユーザーのデータ移行

---

## 4. DB 設計

### 4.1 新規テーブル：`ow_company_join_requests`

**役割**: 「ユーザーが企業に紐づきたい」という申請を管理する

```sql
CREATE TABLE ow_company_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  
  -- 既存企業への紐づけ申請 OR 新規企業作成申請
  request_type text NOT NULL CHECK (request_type IN ('join_existing', 'create_new')),
  
  -- 既存企業への申請の場合
  target_company_id uuid REFERENCES ow_companies(id) ON DELETE CASCADE,
  
  -- 新規企業作成申請の場合（仮の企業情報）
  new_company_name text,
  new_company_url text,
  new_company_description text,
  
  -- 申請者が希望する権限
  requested_permission text NOT NULL CHECK (requested_permission IN ('admin', 'member')) DEFAULT 'admin',
  
  -- 申請理由・補足
  request_message text,
  
  -- ステータス管理
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
  
  -- 承認者情報
  reviewed_by uuid REFERENCES ow_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  
  -- 作成日時
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_ow_company_join_requests_user_id 
  ON ow_company_join_requests(user_id);
CREATE INDEX idx_ow_company_join_requests_target_company_id 
  ON ow_company_join_requests(target_company_id) 
  WHERE target_company_id IS NOT NULL;
CREATE INDEX idx_ow_company_join_requests_status 
  ON ow_company_join_requests(status);

-- データ整合性チェック
ALTER TABLE ow_company_join_requests
  ADD CONSTRAINT chk_request_type_data CHECK (
    (request_type = 'join_existing' AND target_company_id IS NOT NULL AND new_company_name IS NULL)
    OR
    (request_type = 'create_new' AND target_company_id IS NULL AND new_company_name IS NOT NULL)
  );
```

### 4.2 既存テーブルの調整

#### `ow_companies` テーブル
**カラム追加なし**（既存の status カラムで pending / active / rejected を管理）

確認事項：
- status カラムが存在するか
- 存在しない場合は追加（CHECK 制約付き）

```sql
-- 既に存在する場合はスキップ
ALTER TABLE ow_companies 
  ADD COLUMN IF NOT EXISTS status text 
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended')) 
    DEFAULT 'pending';
```

#### `ow_users` テーブル
**カラム追加なし**（既存の career_history で個人プロフィールを管理）

#### `ow_user_roles` テーブル
**変更なし**（admin / candidate の2種類のみ、companyロールは廃止済み）

### 4.3 RLS（Row Level Security）ポリシー

`ow_company_join_requests` の RLS：

```sql
-- RLS 有効化
ALTER TABLE ow_company_join_requests ENABLE ROW LEVEL SECURITY;

-- ポリシー1: ユーザーは自分の申請のみ閲覧可能
CREATE POLICY "Users can view their own join requests"
  ON ow_company_join_requests FOR SELECT
  USING (auth.uid() = user_id);

-- ポリシー2: ユーザーは自分の申請を作成可能
CREATE POLICY "Users can create their own join requests"
  ON ow_company_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ポリシー3: ユーザーは自分の pending な申請をキャンセル可能
CREATE POLICY "Users can cancel their own pending requests"
  ON ow_company_join_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- ポリシー4: admin は全申請を閲覧・編集可能
CREATE POLICY "Admins can view all join requests"
  ON ow_company_join_requests FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "Admins can update all join requests"
  ON ow_company_join_requests FOR UPDATE
  USING (auth_is_admin());

-- ポリシー5: 既存企業の admin は、自社への申請を閲覧・編集可能
CREATE POLICY "Company admins can view requests to their company"
  ON ow_company_join_requests FOR SELECT
  USING (
    request_type = 'join_existing' 
    AND target_company_id IS NOT NULL 
    AND auth_is_company_admin(target_company_id)
  );

CREATE POLICY "Company admins can update requests to their company"
  ON ow_company_join_requests FOR UPDATE
  USING (
    request_type = 'join_existing' 
    AND target_company_id IS NOT NULL 
    AND auth_is_company_admin(target_company_id)
  );
```

### 4.4 トリガー：updated_at の自動更新

```sql
CREATE TRIGGER set_updated_at_ow_company_join_requests
  BEFORE UPDATE ON ow_company_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

**注意**: `public.update_updated_at` 関数の存在を migration 044-047 で確認済み。

---

## 5. マイグレーションファイル

### 5.1 ファイル名

`supabase/migrations/048_create_company_join_requests.sql`

### 5.2 マイグレーションの構成

```sql
-- ============================================
-- Migration 048: ow_company_join_requests テーブル作成
-- 目的: YOUTRUST型オンボーディングフロー Phase 1
-- 作成日: 2026-05-13
-- ============================================

-- 既存があれば削除（冪等性）
DROP TABLE IF EXISTS ow_company_join_requests CASCADE;

-- テーブル作成
CREATE TABLE ow_company_join_requests (
  -- ... (上記参照)
);

-- インデックス
-- ... (上記参照)

-- 制約
-- ... (上記参照)

-- RLS
-- ... (上記参照)

-- トリガー
-- ... (上記参照)

-- 動作確認
DO $$
BEGIN
  RAISE NOTICE 'ow_company_join_requests テーブル作成完了';
  RAISE NOTICE 'カラム数: %', (
    SELECT count(*) FROM information_schema.columns 
    WHERE table_name = 'ow_company_join_requests'
  );
END $$;
```

### 5.3 ロールバックスクリプト

万一の場合のロールバック：

```sql
-- ============================================
-- Rollback: migration 048
-- ============================================

DROP TABLE IF EXISTS ow_company_join_requests CASCADE;
```

シンプル。新規テーブルなので、既存データへの影響なし。

---

## 6. 既存実装への影響範囲

### 6.1 影響を受けないもの

✅ 既存テストアカウント（32件）→ 何も変わらない
✅ 既存の `/biz/auth`, `/biz/dashboard` → 動作継続
✅ 既存の `/admin/companies` → 動作継続
✅ 既存の RLS ポリシー → 何も変わらない

### 6.2 影響を受けるもの

なし。Phase 1 は**完全に新規テーブルの追加**であり、既存実装への変更はゼロ。

これにより：
- Phase 1 適用後、すぐに本番デプロイ可能
- 何かおかしくなったら、テーブルを DROP するだけで戻せる

---

## 7. 動作確認手順（Phase 1 完了後）

### 7.1 DB レベルの確認

```sql
-- テーブル存在確認
SELECT * FROM information_schema.tables 
WHERE table_name = 'ow_company_join_requests';

-- カラム確認
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ow_company_join_requests'
ORDER BY ordinal_position;

-- RLS 確認
SELECT * FROM pg_policies 
WHERE tablename = 'ow_company_join_requests';

-- インデックス確認
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ow_company_join_requests';
```

### 7.2 アプリケーション側の確認

- ✅ `npm run build` がエラーなく完了
- ✅ 既存の `/biz/auth` でログインできる
- ✅ 既存の `/admin` が動作する
- ✅ 既存テストアカウント（contact+biz001@opinio.co.jp）でログイン可能

### 7.3 RLS ポリシーの動作確認（簡易）

本番DBで以下を実行：
```sql
-- (Service role で実行) サンプルデータ挿入
INSERT INTO ow_company_join_requests (
  user_id, request_type, target_company_id, requested_permission
) VALUES (
  '<some-user-id>', 'join_existing', '<some-company-id>', 'admin'
);

-- (ユーザーロールで実行) 自分の申請が見えるか確認
SELECT * FROM ow_company_join_requests;
```

---

## 8. Phase 2 以降への準備

Phase 1 完了後、以下が Phase 2 のスコープになる：

### 8.1 Phase 2: API実装（明日以降）
- `POST /api/biz/join-requests` 申請作成
- `GET /api/biz/join-requests` 自分の申請一覧
- `POST /api/admin/join-requests/[id]/approve` 承認
- `POST /api/admin/join-requests/[id]/reject` 却下
- `POST /api/biz/join-requests/[id]/cancel` キャンセル

### 8.2 Phase 3: UI実装（明日以降）
- サインアップフローの再設計
- オンボーディング画面
- 企業検索画面
- 申請UI
- 承認UI（admin側）

### 8.3 Phase 4: 通称統一（明日以降）
- 「採用担当者」→「企業管理者 / 企業メンバー」表記変更

---

## 9. ハンドオフ文書

実装完了後、以下を作成：

`docs/handover-2026-05-13-youtrust-phase1.md`

含める内容：
- 実装した migration ファイル一覧
- 本番DB適用結果
- 動作確認結果
- 次フェーズ（Phase 2）への引き継ぎ事項

---

## 10. 重要な注意事項

### 10.1 本番DB適用について

⚠️ **本日中に本番DBに適用する判断**：
- これは新規テーブル追加のみで、既存データに影響なし
- ロールバック容易（DROP TABLE 一発）
- リスクは最小限

ただし以下を必ず守る：
- migration スクリプトは冪等性を持たせる（DROP IF EXISTS から始める）
- 適用前に Supabase Dashboard でバックアップを取る（または取られていることを確認）
- 適用後すぐに `npm run build` と動作確認

### 10.2 Phase 2 以降との分離

Phase 1 は**Phase 2-4 と完全に独立**して動作する。
つまり、Phase 1 を適用しても、UI 側では何も変わらない。
これは意図的な設計で、リスクを最小化するため。

### 10.3 既存ユーザーの扱い

既存の32テストアカウントは、Phase 1 では何もしない。Phase 2-3 でUI が完成した後、必要に応じてマイグレーション処理を別途設計する。

---

## 完了基準

Phase 1 完了の判断基準：

✅ migration 048 が本番DBで実行成功
✅ `ow_company_join_requests` テーブルが本番に存在する
✅ RLS ポリシーが期待通り動作する
✅ 既存の `/biz/auth` でテストアカウントがログイン可能
✅ ハンドオフ文書が作成されている
✅ git に commit + push されている

これらが全て揃ったら、Phase 1 完了。

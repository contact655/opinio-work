# 調査レポート: ow_users の orphan レコード（auth_id IS NULL）

**調査日**: 2026-05-15  
**調査者**: Claude (read-only MCP)  
**対象テーブル**: `public.ow_users`  
**対象条件**: `auth_id IS NULL`  
**実施 SQL**: クエリ 1〜12（DDL・DML なし）

---

## 1. サマリー

### 件数

`auth_id IS NULL` のレコードは **計 210 件**。

### 正体仮説（確度順）

| 仮説 | 根拠 | 確度 |
|------|------|------|
| **テスト・シードデータ（意図的な投入）** | ドメインが `test.opinio.jp`（120件）・`seed.internal`（90件）の 2 種のみ。実在サービスドメインゼロ。個人メールゼロ。 | 高 |
| 本番ユーザーとの重複 or 混在 | `auth.users` とのメアド突合が **0 件**。本番ユーザーと紐付く痕跡なし。 | 低 |
| 手動 INSERT バグによる残骸 | `ow_company_admins` との紐付けゼロ・2日間に集中した投入 → 意図的スクリプト実行の可能性が高く、バグ残骸の可能性は低い | 低 |

**結論（暫定）**: 2026-05-01〜05-02 に実行されたシード or テストスクリプトが生成したレコード群。実ユーザーではない可能性が極めて高い。

### 推奨マイグレーション方針の論点（判断は Hisato さんに委ねる）

| 論点 | 内容 |
|------|------|
| **削除してよいか** | `ow_company_admins` と紐付きゼロ・`auth.users` と突合ゼロ → 参照整合性の懸念は現時点でなし。ただし他テーブル（`ow_user_roles` 等）との FK は別途要確認 |
| **email UNIQUE 制約の影響** | `ow_users_email_key` が存在する。DELETE 後に同メアドで本番ユーザーが新規 INSERT できるようになる（制約衝突の解消）。逆に DELETE しないと本番環境でテストメアドが衝突する可能性あり |
| **削除タイミング** | 本番ユーザーのサインアップ数が増える前に DELETE しておくほうが安全。放置すると auth_id 突合ロジックへの混入リスクが増える |
| **soft delete vs hard delete** | このテーブルに `deleted_at` カラムはない（クエリ3参照）。物理 DELETE が現実的 |

---

## 2. 時系列分布（クエリ 1・2）

### 日別件数

| 日付 | 件数 |
|------|------|
| 2026-05-01 | 90 件 |
| 2026-05-02 | 120 件 |
| **合計** | **210 件** |

### 最古・最新レコード

| 項目 | 値（UTC） |
|------|-----------|
| 最古 `created_at` | 2026-05-01 03:35:29 |
| 最新 `created_at` | 2026-05-02 06:47:38 |

**所見**: 2日間に集中して生成されており、継続的なユーザー流入パターンではない。スクリプト or マイグレーション実行の痕跡と見られる。

---

## 3. created_via / source 系フラグの有無（クエリ 3）

`ow_users` テーブルには `created_via` / `source` / `role` 系のカラムは存在しない。

投入元を DB 上で識別するカラムがないため、ドメイン名が唯一の手がかりとなる。

### テーブル全カラム一覧

| カラム名 | データ型 |
|----------|----------|
| id | uuid |
| auth_id | uuid |
| email | text |
| name | text |
| avatar_color | text |
| cover_color | text |
| about_me | text |
| location | text |
| social_links | jsonb |
| is_mentor | boolean |
| mentor_registered_at | timestamp with time zone |
| mentor_themes | ARRAY |
| is_active_mentor | boolean |
| visibility | text |
| created_at | timestamp with time zone |
| updated_at | timestamp with time zone |
| future_aspirations | text |
| birth_date | date |

---

## 4. メアドドメイン分布（クエリ 4・5・12）

### ドメイン別件数（上位 20、実質 2 種のみ）

| ドメイン | 件数 |
|----------|------|
| test.opinio.jp | 120 |
| seed.internal | 90 |

**メアドなし件数**: 0 件（全 210 件にメアドあり）

### 個人 vs 法人ドメイン分類

| 区分 | 件数 |
|------|------|
| 個人メール（gmail.com 等） | 0 件 |
| 法人ドメイン（上記以外） | 210 件 |

**所見**: `test.opinio.jp` と `seed.internal` はいずれも架空・内部用と思われるドメイン。実在ユーザーのメアドは含まれていない。

---

## 5. プロフィール充足度（クエリ 6・7）

### フィールド別充足状況

| フィールド | NULL でない | 空文字でない |
|------------|-------------|-------------|
| total | 210 | — |
| name | 210 / 210 | 210 / 210 |
| about_me (bio) | 0 / 210 | 0 / 210 |
| avatar_color | 210 / 210 | 210 / 210 |

### 「全部空」vs「何か入っている」

| 状態 | 件数 |
|------|------|
| 何か入っている | 210 件 |
| 全部空 | 0 件 |

**所見**: `name` と `avatar_color` は全件埋まっており、`about_me` は全件空。シードスクリプトが `name` と `avatar_color` のみを設定したパターンと一致する。手動の本番ユーザーが `about_me` を埋めずに `name` と `avatar_color` だけ持つケースは稀であり、スクリプト投入を強く示唆する。

---

## 6. ow_company_admins 紐付け状況（クエリ 8・9）

| 指標 | 件数 |
|------|------|
| orphan ユーザーのうち企業紐付きあり | 0 件 |
| orphan ユーザーが紐付く distinct 企業数 | 0 件 |
| 企業紐付きなし（= 全 orphan ユーザー） | 210 件 |

**所見**: 210 件全員が `ow_company_admins` とも紐付いていない。企業側の業務データへの影響はゼロ。

---

## 7. auth.users との突合（クエリ 10）

| 指標 | 件数 |
|------|------|
| auth.users と同メアドが存在する orphan ユーザー | 0 件 |

**所見**: 本番の認証ユーザーと重複するメアドはゼロ。現時点では `email UNIQUE` 制約が衝突する本番ユーザーも存在しないが、今後テストメアドと同じドメインで本番ユーザーが登録されることは考えにくいため、リスクは限定的。

---

## 8. スキーマ・制約の現状（クエリ 3・11）

### インデックス・UNIQUE 制約

| インデックス名 | 種別 | カラム |
|---------------|------|--------|
| ow_users_pkey | UNIQUE（PK） | id |
| ow_users_auth_id_key | UNIQUE | auth_id |
| ow_users_email_key | UNIQUE | email |
| idx_ow_users_auth_id | INDEX | auth_id |
| idx_ow_users_email | INDEX | email |
| idx_ow_users_is_mentor | INDEX（partial） | is_mentor（WHERE true） |

**注意点**:
- `email` に UNIQUE 制約あり。orphan レコードを残すと、将来同メアドで本番ユーザーが `ow_users` へ INSERT しようとしたときに制約違反が発生しうる（`test.opinio.jp` / `seed.internal` ドメインは架空なので実害は出にくいが）。
- `auth_id` にも UNIQUE 制約あり。将来の突合・UPDATE 時の衝突可能性は email 制約と同様の考え方で評価できる。
- `information_schema.table_constraints` では制約が空（0件）だったが、`pg_indexes` では UNIQUE INDEX が確認できた。これは制約が `CREATE UNIQUE INDEX` で直接作成されている（`ADD CONSTRAINT` 経由でない）可能性を示す。

---

## 9. 論点・懸念（実装者視点）

### 判断が必要な点（Hisato さんへ）

1. **このシードデータは誰が・いつ・何の目的で投入したか？**  
   2026-05-01〜05-02 の 2 日間に集中しており、`test.opinio.jp` と `seed.internal` というドメイン構成から、開発チームによる意図的な投入と推測される。投入した人物・スクリプトを確認し、既に用途を終えているなら削除を検討。

2. **他テーブルとの FK 参照は別途確認要**  
   本調査では `ow_company_admins` のみ確認。`ow_user_roles`、`ow_activities`、`ow_threads`、`ow_casual_meetings` 等への FK が存在する場合、物理 DELETE 前に CASCADE 設定または事前クリーンアップが必要。

3. **削除する場合の SQL（参考）**  
   ```sql
   -- 事前確認
   SELECT COUNT(*) FROM ow_users WHERE auth_id IS NULL;
   -- 削除（実行は柴さんが手動で）
   DELETE FROM ow_users
   WHERE auth_id IS NULL
     AND email LIKE '%@test.opinio.jp'
      OR email LIKE '%@seed.internal';
   ```
   WHERE 条件をドメインで絞ることで、万一同条件で本番レコードが混入していた場合のリスクを限定できる。

4. **削除しない場合のリスク**  
   - RLS ポリシーが `auth_id` を前提としているため、これら 210 件は通常の API リクエストでは参照・更新されない（= 実害はほぼゼロ）。
   - ただし集計クエリ（`COUNT(*)` 等）で件数が膨らむため、分析・モニタリング時にノイズとなる可能性がある。

5. **`created_via` 等の属性カラムがない問題**  
   今後テストデータを投入する際は、`source` カラム追加（`'seed'`, `'test'`, `'real'` 等）を検討すると、このような調査コストが大幅に下がる。

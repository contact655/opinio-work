# 段階7-F Phase 3 完了 handover ドキュメント

**作成日**: 2026-05-12
**段階**: ν-8 段階7-F Phase 3 — 学校追加リクエスト承認 API
**状態**: ✅ Phase 3 完了、push 済み、本番反映 ● Ready 確認済み

---

## エグゼクティブサマリ

段階7-F Phase 3 では、段階7-F Phase 1 + 2 で構築した管理画面に対して、
**承認 API を実装**した。

承認処理は 3 つの DB 操作を **atomic transaction として実行する必要がある** ため、
PostgreSQL FUNCTION で実装。これにより以下を保証:
- INSERT ow_schools + UPDATE ow_school_requests + UPDATE ow_user_educations が全成功 or 全 rollback
- 同時承認のレースコンディションを `FOR UPDATE` で防止
- service_role 専用 EXECUTE 権限で多層防御

これにより、**本日構築した「丁寧な介在」運用フローが両側で動く状態** に到達。
ユーザー側経路(段階6-8)→ 運営側経路(段階7-F)の End-to-End が本番で動作。

**規模**: 1 Phase / 1 コミット(6ed8d81)/ Migration 101 / 235 行追加

---

## Phase 3 の出発点と判断

### 出発点

段階7-F Phase 2 完了時点で:
- 運営側で **pending リクエスト一覧** は見られる(/admin/school-requests)
- ただし、承認するには **Dashboard SQL を手動で書く** 必要があった

承認処理は 3 つの DB 操作を必要とする:
1. ow_schools に新しい学校を INSERT
2. ow_school_requests を approved 状態に UPDATE
3. ow_user_educations に school_id を一括 UPDATE

これを Supabase JS Client で順次実行すると、途中失敗時に整合性が崩れるリスクがあるため、
**PostgreSQL FUNCTION で atomic transaction** として実装する判断。

### 確定済み判断点(5 件)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | Transaction 実装方式 | 案 A: PostgreSQL FUNCTION(Migration 101) |
| 2 | logo_letter / logo_gradient 入力 | 案 X: API のみ実装(Phase 5 で UI) |
| 3 | 承認ボタン UI 追加タイミング | 案 iii: Phase 4 で却下と同時実装 |
| 4 | API レスポンス | 案 R: school_id + request_id + updated_educations_count |
| 5 | エラーハンドリング | 全エラーケース実装(400/401/403/404/409/500) |

---

## 🚨 Phase 3 で発見した重要事実

### 1. `ow_school_requests.approved_by → ow_users(id)` の FK 構造

| カラム | 参照先 |
|--------|--------|
| `ow_school_requests.requested_by` | `ow_users(id)` |
| `ow_school_requests.approved_by` | **`ow_users(id)`** ⭐ Phase 3 で確定 |

**重要な含意**:
- `ow_user_roles.user_id` は `auth.users(id)` 参照
- `ow_school_requests.approved_by` は **`ow_users(id)` 参照**
- → 同じ「user 識別子」でも、テーブルごとに参照先が違う設計

これは段階7-F Phase 1 + 2 handover で記録した DB 構造の補完情報。

### 2. PG15+ で SECURITY DEFINER に SET row_security = off が必須

PostgreSQL 15 以降、`SECURITY DEFINER` だけでは RLS をバイパスしない。
**追加で `SET row_security = off` が必要**。

```sql
CREATE OR REPLACE FUNCTION approve_school_request(...)
RETURNS TABLE (school_id uuid, updated_educations_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off   -- ★ PG15+ 必須
AS $$
...
$$;
```

これは将来同様の FUNCTION を書く時の **必須前提**。

### 3. PostgreSQL カスタム ERRCODE による API エラーマッピング

FUNCTION 内部で `RAISE EXCEPTION ... USING ERRCODE = 'P0001'` のようにカスタムコードを
発行することで、API レイヤで HTTP ステータスにマッピングできる。

| ERRCODE | HTTP ステータス | 意味 |
|---------|--------------|------|
| P0001 | 404 Not Found | リクエストが存在しない |
| P0002 | 409 Conflict | リクエストが pending でない |

この設計パターンは:
- FUNCTION 内部の条件判定を API 側に伝播できる
- API 側でビジネスロジックを書かずに、HTTP ステータスマッピングだけ書ける
- 将来同様の FUNCTION を作る際の参考パターン

### 4. FOR UPDATE で同時承認のレースコンディション防止

```sql
SELECT *
INTO v_request
FROM ow_school_requests
WHERE id = p_request_id
FOR UPDATE;  -- ★ 排他ロック
```

これにより、2 人の運営が同時に同じリクエストを承認するレアケースでも:
- 先に到達したセッションが処理を完了
- 後のセッションは pending でなくなった状態を検知 → P0002 エラー

実運用では発生しにくいが、堅牢性のため実装。

---

## 実装サマリ

### コミット: `6ed8d81`

#### 新規ファイル

1. **`supabase/migrations/101_create_approve_school_request_function.sql`**
   - `approve_school_request(p_request_id, p_logo_letter, p_logo_gradient, p_approved_by)` FUNCTION
   - SECURITY DEFINER + SET row_security = off
   - 5 ステップ atomic 処理:
     1. リクエスト取得(FOR UPDATE)
     2. status pending 確認(P0002 RAISE)
     3. 承認者 auth_id → ow_users.id 解決
     4. ow_schools INSERT + RETURNING で id 取得
     5. ow_school_requests / ow_user_educations 一括 UPDATE
   - REVOKE ALL FROM PUBLIC + authenticated(service_role 専用)

2. **`supabase/rollbacks/101_create_approve_school_request_function_rollback.sql`**
   - `DROP FUNCTION IF EXISTS approve_school_request(uuid, text, text, uuid);`

3. **`src/app/api/admin/school-requests/[id]/approve/route.ts`**
   - POST ハンドラ
   - 二重認可(`supabase.auth.getUser()` + `isAdmin()`)
   - Body バリデーション(logo_letter, logo_gradient 必須かつ非空)
   - `createAdminClient().rpc("approve_school_request", {...})`
   - ERRCODE マッピング(P0001 → 404、P0002 → 409)
   - レスポンス: `{ school_id, request_id, updated_educations_count }`

#### Migration 適用前後の検証(段階6-4 で確立した運用)

- Migration 101 Dashboard 適用: `Success. No rows returned` ✅
- 確認 1: FUNCTION 存在 + `prosecdef = true` ✅
- 確認 2: 引数 4 + 戻り値 TABLE 型 ✅
- 確認 3: `approved_by` FK 参照先 = `ow_users(id)` ✅

#### 動作確認(7 シナリオ全合格)

| シナリオ | 内容 | 結果 |
|---------|------|------|
| 1 | テストリクエスト作成(/profile/edit + バナー)| ✅ |
| 2 | 承認 API 呼び出し → 200 + updated_educations_count: 1 | ✅ |
| 3 | Dashboard SQL で 3 DB 操作確認 | ✅ |
| **4** ⭐ | **/profile/edit でロゴ表示**(クライマックス) | **✅** |
| 5 | 重複承認 → 409 Conflict | ✅ |
| 6 | 不存在 id → 404 Not Found | ✅ |
| 7 | バリデーション欠落 → 400 Bad Request | ✅ |

特に **シナリオ 4** が本日のセッション全体のクライマックス。本日構築した
連鎖が **本番でも完全に動作する状態** に到達した瞬間。

---

## 設計上の重要なポイント(将来参考)

### service_role 使用が必須の理由

Phase 3 では `createAdminClient()`(service_role)を使用。これは以下の理由から:

1. **3 つのテーブルへの UPDATE/INSERT** が必要(RLS で制限される)
2. **`ow_schools` には INSERT ポリシーがない**(運営のみが書き込み可能な設計)
3. **`approve_school_request` FUNCTION が `service_role` 専用 EXECUTE 権限**

これは段階6-4 で確立した「不必要な service_role 使用を避ける」原則の **正当な例外**。

### 二重認可(Defense in Depth)

API Route で:
1. `supabase.auth.getUser()` でセッション確認(401)
2. `isAdmin()` ヘルパーで admin 判定(403)
3. FUNCTION 側でも `REVOKE PUBLIC + authenticated`(多層防御)

3 段階のガード:
- API レイヤ: 認証 + 認可
- DB レイヤ: EXECUTE 権限

### atomic transaction の威力

PostgreSQL FUNCTION 1 つで以下を全成功 or 全 rollback:

```
INSERT ow_schools         ← 1 行追加
UPDATE ow_school_requests ← 1 行更新
UPDATE ow_user_educations ← N 行更新(updated_educations_count を返す)
```

途中失敗時は PostgreSQL が自動で全部 rollback してくれる。Supabase JS Client では実現困難な保証。

---

## 次の段階に向けて

### 段階7-F Phase 4 候補(自然な延長、未着手)

**却下 API + UI 統合**

```
エンドポイント: POST /api/admin/school-requests/[id]/reject

処理内容:
1. ow_school_requests を rejected 状態に UPDATE
   - status = 'rejected'
   - approved_at = now()(rejected_at として再利用 or 別カラム?)
   - approved_by = (admin の auth.users.id → ow_users.id)

要件:
- service_role(RLS バイパス)
- admin 認可
- 単一 UPDATE のため FUNCTION 不要(直接 SQL でも OK)

UI 統合:
- /admin/school-requests 一覧ページに「承認」「却下」ボタン追加
- 承認ボタンクリック → モーダル(logo_letter + logo_gradient 入力)→ POST approve
- 却下ボタンクリック → 確認 dialog → POST reject
- 成功時: 一覧から該当 request を削除 or status badge を更新
```

### 段階7-F Phase 5 候補(logo_letter / logo_gradient 入力 UI 改善)

承認時の logo_letter / logo_gradient の手動入力を、より使いやすい UI に:
- logo_letter: 自動補完(school_name の最初の文字を提示)
- logo_gradient: プリセットパレット選択 + カスタム入力
- プレビュー表示(SchoolLogoImg コンポーネント再利用)

### 段階7-F Phase 6 候補(全体 handover doc)

Phase 1-5 完了後、段階7-F 全体の総括 handover doc を作成。

---

## 段階6 + 段階7 の全体状況(段階7-F Phase 3 完了時点)

- **完了済み段階**: 6-1, 6-2, 6-3-1, 6-3-1.5, 6-3-2, 6-3-3, 6-4, 6-5, 6-6, 6-7, 6-8, **7-F Phase 1**, **7-F Phase 2**, **7-F Phase 3**
- 段階6 累計: 約 74 コミット + 19 migration
- 段階7 累計: 7-F Phase 1-3 完了、Phase 4-6 未着手
- 残存技術的負債(変更なし):
  - 段階6-4 判断点 2: `ow_uploads_auth_insert` 強化
  - 段階6-4 判断点 3: documents/candidate-documents 用途確認
  - 段階6-3-3 §6 #4: card_color カスタマイズ
  - 段階7-F: `ADMIN_EMAIL`(単数)と `ADMIN_EMAILS`(複数)の整理

---

## ファイル一覧

### 新規ファイル(Phase 3)

- `supabase/migrations/101_create_approve_school_request_function.sql`
- `supabase/rollbacks/101_create_approve_school_request_function_rollback.sql`
- `src/app/api/admin/school-requests/[id]/approve/route.ts`

### handover doc

- `docs/handover-2026-05-12-nu8-stage7-f-phase-3.md`(本ファイル)

---

## 運用課題と反省点

### 反省点なし(順調な進行)

Phase 3 は段階7-F Phase 1 + 2 で確立した運用ルール + 段階6-7 で確立した
`npm run build` 必須等を全て遵守し、致命的な問題なく完走できた。

### 確認できた既存運用ルールの効果

- **`npm run build` 必須**: 5 度目の実践、完全に身体化
- **Vercel deployments 目視確認**: ● Ready 確認済み
- **本番反映を完走の定義に組み込む**: 本セッションで遵守
- **新規ルート作成前に `ls src/app/` で網羅確認**: Phase 3 着手時に既存実装を確認

### Phase 3 で実践した新しい知見

- **PG15+ の SECURITY DEFINER + SET row_security = off の組み合わせ**
- **カスタム ERRCODE による API レイヤとの分離設計**
- **FOR UPDATE による排他ロック設計**
- **service_role 専用 EXECUTE 権限による DB レイヤでの多層防御**

これらは将来同様の atomic transaction を必要とする実装で参考になる。

---

## 本セッションの段階7-F Phase 3 総括

### 達成したこと

- 承認 API の本番稼働
- ユーザー側経路(段階6-8)→ 運営側経路(段階7-F)の **完全な End-to-End 動作**
- 「丁寧な介在」思想の運用フローが本番で完成

### 印象的な瞬間

- **シナリオ 4 のロゴ表示**: 「承認テスト大学」を承認 → `/profile/edit` で **本物のロゴ(紺紫グラデ + 「承」)** が現れた瞬間。本日構築した連鎖が完成した証明。
- **`approved_by` FK 確認 SQL**: `ow_school_requests.approved_by → ow_users(id)` を Dashboard SQL で確定。Claude Code の auth_id → ow_users.id 変換の正当性が証明された。

---

**段階7-F Phase 3 完了**
**作成者**: Claude(チャット) + 柴久人
**作成日**: 2026-05-12

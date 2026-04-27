# /biz/members チーム管理画面 — 実装計画

**作成日**: 2026-04-27
**ステータス**: v2 確定 / 実装待ち
**推定実装時間**: M-1〜M-3 で約 3.2 時間（M-2.5 含めると 3.7 時間）、M-4（招待フロー完全版）は追加 2〜3 時間

## 変更履歴

- 2026-04-27 17:05: v2 確定 — レビュー反映（自分自身判定の実装方針、再有効化を M-2 に追加、role_title 編集を M-2.5 に分離、UI パターン再確認の注記、M-3 を modal dialog で明記）
- 2026-04-27 16:00: v1 初版作成

---

## 全体ゴール

企業担当者が `/biz/members` で自社のチームメンバーを管理できる画面を作る。
ベースとなる `ow_company_admins` テーブルと RLS は Phase 4（migration 031/037）で整備済み。

---

## Step 1: 既存資産の棚卸し

### 1-A: ow_company_admins テーブル（migration 031/037）

```sql
CREATE TABLE ow_company_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES ow_companies(id) ON DELETE CASCADE,
  department  TEXT,           -- 所属部署（任意）
  role_title  TEXT,           -- 役職名（任意）
  permission  TEXT NOT NULL DEFAULT 'member'
    CHECK (permission IN ('admin', 'member')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);
```

**RLS（migration 037 で最適化済み）:**
- SELECT: `auth_is_company_member(company_id)` — アクティブなメンバー全員が閲覧可
- INSERT/UPDATE/DELETE: `auth_is_company_admin(company_id)` — admin のみ操作可

**招待フロー用フィールドの有無:**

| フィールド | 現状 | 対応 |
|---|---|---|
| `invited_at` | **なし** | M-3 または M-4 で migration 040 追加 |
| `invited_by_user_id` | **なし** | 同上 |
| `invitation_token` | **なし** | 同上（M-4 が必要な場合のみ） |
| `is_active=false` | あり ✅ | 無効化（soft delete）として使える |

**結論**: M-1〜M-2 は migration 不要。M-3（既存ユーザー追加）も不要。
M-4（招待フロー完全版）のみ migration 040 が必要。

---

### 1-B: 既存 API Routes

| エンドポイント | メソッド | 参考にできるパターン |
|---|---|---|
| `/api/biz/jobs` | POST | companyId 取得 → INSERT → return id |
| `/api/biz/jobs/[id]` | PATCH | action ベースの分岐（status, memo 等） |
| `/api/biz/meetings/[id]` | PATCH | 同上 |

members 用に必要なエンドポイント（未作成）:

| エンドポイント | メソッド | 内容 |
|---|---|---|
| `/api/biz/members` | GET | 一覧（Server Component からは不要、直接 fetch） |
| `/api/biz/members` | POST | 既存 ow_users を email で検索 → INSERT |
| `/api/biz/members/[id]` | PATCH | permission / role_title 変更 |
| `/api/biz/members/[id]` | DELETE | is_active=false（soft delete） |

---

### 1-C: 既存 fetcher

`src/lib/business/team.ts` → `fetchTeamMembersForDashboard()`:
- dashboard 向け軽量版（is_active=true のみ、5件程度）
- 返す型: `DashboardTeamMember`（id, name, initial, gradient, role, permission）
- email, department, created_at は返さない

**方針**: 新規に `src/lib/business/members.ts` を作成し、より詳細な型・全件取得・無効済みメンバーも含む fetcher を定義する。`team.ts` は dashboard 用として現状維持。

---

### 1-D: 既存 UI

- `src/components/business/TeamMembers.tsx`: dashboard の軽量カードウィジェット。/biz/members ページには流用せず、専用フルページ UI を新規作成。
- `/biz` ページ一覧: `auth / company / dashboard / jobs / meetings` — members なし。
- shadcn/ui: 使用なし（プロジェクト全体で inline styles パターンを採用）。同様のパターンで実装する。

**実装前の確認事項（実装初期に view で確認）:**
- 既存の TeamMembers.tsx (dashboard 用) は inline styles か、別パターンか?
- /biz/jobs ページの一覧 UI と編集ダイアログのパターンを確認
- /biz/meetings の admin/member 操作 UI を確認

これら 3 ファイルを実装直前に再 view し、最も近いパターンを採用する。

---

### 1-E: サイドナビ（BusinessLayout.tsx）

現在の `NAV_ITEMS`:
```
ダッシュボード  /biz/dashboard
企業情報       /biz/company
求人管理       /biz/jobs
カジュアル面談  /biz/meetings
```

**追加位置の提案**: meetings の後ろに追加（「採用活動」グループの最後）:
```
チーム管理     /biz/members   ← 新規追加
```

将来的に設定セクションが増えたらグルーピングを検討。今は単純に末尾追加でよい。

---

## Step 2: 機能要件と MVP スコープ

### 2-A: 機能一覧と判断

| 機能 | MVP 含む? | 理由 |
|---|---|---|
| メンバー一覧（アクティブ） | ✅ M-1 | 必須 |
| 権限変更（admin ↔ member） | ✅ M-2 | admin にとって最重要操作 |
| 無効化（is_active=false） | ✅ M-2 | 削除より安全、既存カラムで対応可 |
| 既存ユーザー追加（email 検索） | ✅ M-3 | ow_users に存在するユーザーのみ対象 |
| 招待フロー（URL 発行のみ） | 🟡 M-4 | 未登録ユーザー向け。token 管理が必要 |
| 招待フロー（メール送信） | ❌ 後日 | Resend 等の設定が別途必要 |
| 無効化済みメンバー表示 | 🟡 M-2 に含む | タブ切り替えで表示 |
| Audit log | ❌ 後日 | ow_activities に追加するのみで対応可能 |

**MVP 定義**: M-1〜M-3 まで。既存 auth ユーザー同士でチームを組める状態。
M-4 は Phase 5 のスコープ。

---

## Step 3: 段階分け

### M-1: 一覧表示（READ）— 約 1 時間

**実装内容:**
- `src/lib/business/members.ts` 新規作成
  - `MemberRecord` 型（id, user_id, name, email, initial, gradient, role_title, department, permission, is_active, created_at）
  - **role_title / department は M-1 では読み取り専用。編集は M-2.5（オプション）で対応。**
  - `fetchMembersForCompany(supabase, tenantId)` — アクティブ + 無効化済み全件
- `src/app/biz/members/page.tsx` — async Server Component
- `src/app/biz/members/MembersClient.tsx` — `"use client"` でタブ切り替え（アクティブ / 無効化済み）
- `src/components/business/BusinessLayout.tsx` — NAV_ITEMS に「チーム管理」追加

**自分自身の判定方法:**
- page.tsx (Server Component) で `getOwUserId(supabase, authUserId)` を実行
- 取得した `currentUserId` を MembersClient.tsx に props で渡す
- 各メンバー行で `member.user_id === currentUserId` で判定し「あなた」バッジ表示
- ヘルパーは Phase 4 で作成済み (`src/lib/business/company.ts`)

**Acceptance Criteria:**
- `/biz/members` にアクセスするとメンバー一覧が表示される
- admin / member のバッジが正しく表示される
- 自分自身のレコードがハイライトされる（「あなた」バッジ）
- サイドナビに「チーム管理」が表示される

---

### M-2: 権限変更 + 無効化/再有効化（UPDATE + soft toggle）— 約 1.2 時間

**実装内容:**
- `src/app/api/biz/members/[id]/route.ts` 新規作成
  - PATCH: `{ action: "permission", value: "admin" | "member" }`
  - PATCH: `{ action: "deactivate" }` → is_active=false
  - PATCH: `{ action: "reactivate" }` → is_active=true
- UI: 各メンバー行の「…」メニュー → 権限変更 / 無効化ダイアログ
- UI: 「無効化済み」タブの各行に「再有効化」ボタン
- ガード:
  - 自分自身の permission 変更は admin → member への降格を禁止（UI + API 両方）
  - 最後の admin を無効化・降格禁止（API で COUNT チェック）

**Acceptance Criteria:**
- admin が他のメンバーの permission を変更できる
- 自分自身を admin → member に降格しようとするとエラー表示
- 最後の admin を無効化しようとするとエラー表示
- 無効化したメンバーが「無効化済み」タブに移動する
- 「無効化済み」タブで「再有効化」ボタンが押せる
- 再有効化したメンバーが「アクティブ」タブに戻る

---

### M-2.5: role_title / department 編集（UPDATE）— 約 30 分（オプション）

**実装内容:**
- `src/app/api/biz/members/[id]/route.ts` に追加
  - PATCH: `{ action: "role_title", value: string }`
  - PATCH: `{ action: "department", value: string }`
- UI: 各メンバー行の「編集」アイコン → モーダル or インライン編集

**Acceptance Criteria:**
- admin が他のメンバーの役職・部署を変更できる
- 自分自身の役職・部署も変更できる

**MVP 必須ではない。** 時間に余裕があれば実装、なければスキップ。

---

### M-3: 既存ユーザー追加（CREATE with existing ow_users）— 約 1 時間

**実装内容:**
- `src/app/api/biz/members/route.ts` 新規作成
  - POST: `{ email: string, permission: "admin" | "member" }` → ow_users を email で検索 → INSERT ow_company_admins
  - エラーケース: ユーザー未登録 / すでにメンバー（UNIQUE 制約）
- UI: 「+ メンバーを追加」ボタン → モーダルダイアログ
  - 入力フィールド: email (text), permission (radio: admin/member)
  - パターン: /biz/jobs 新規作成と同じ shadcn なし inline styles
  - 確認ダイアログ: あり（追加内容の確認）

**Acceptance Criteria:**
- admin が email 入力でメンバーを追加できる
- 入力した email が ow_users に存在しない場合は「このメールアドレスはまだ登録されていません」エラー
- すでにメンバーの場合は「すでにメンバーです」エラー
- 追加後、一覧にリアルタイム反映（Router.refresh）

---

### M-4: 招待フロー（未登録ユーザー対応）— 約 2〜3 時間

**migration 040 が必要:**
```sql
ALTER TABLE ow_company_admins
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES ow_users(id),
  ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
```

**実装内容:**
- POST /api/biz/members → email が ow_users に未存在でも招待レコード作成
- 招待 URL: `/biz/auth/accept-invite?token={uuid}` → Supabase Auth でサインアップ → ow_users 自動作成 → ow_company_admins の user_id を埋める
- Pending 状態: `user_id IS NULL` = 未承諾の招待

---

## Step 4: 想定リスクと対策

| リスク | 詳細 | 対策 |
|---|---|---|
| **最後の admin 消去** | 自分だけが admin のときに降格・無効化 | API 側で `COUNT(*) WHERE permission='admin' AND is_active=true` チェック、1件なら 400 返す |
| **自己降格** | 自分が admin → member に変更 | `getOwUserId` で actor_id と target user_id を比較、一致したら 403 |
| **M-3 で ow_users 未登録** | email が ow_users に存在しない | COALESCE で graceful エラー返す（"このユーザーはまだ Opinio に登録されていません"） |
| **RLS で member が INSERT しようとする** | member 権限ユーザーが API を叩いた場合 | `auth_is_company_admin()` が false → Supabase が INSERT を弾く（RLS が 2 重ガード） |
| **UNIQUE(user_id, company_id) 違反** | 既存メンバーを再追加しようとした場合 | API 側で事前チェックし、ユーザーフレンドリーなエラーメッセージを返す |
| **M-4: service_role 要否** | 完全新規ユーザー（auth.users 未存在）を招待する場合、auth.users には service_role でしか INSERT できない | `/api/biz/members/invite` は `createAdminClient()` を使う（既存 `src/lib/supabase/admin.ts` あり） |
| **N+1 クエリ** | ow_company_admins と ow_users を別々に取得 | Supabase の Foreign Key JOIN（`user:ow_users!user_id`）で1クエリに収める |

---

## 変更ファイル一覧（M-1〜M-3）

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/lib/business/members.ts` | 新規 | MemberRecord 型 + fetchMembersForCompany |
| `src/app/biz/members/page.tsx` | 新規 | async Server Component |
| `src/app/biz/members/MembersClient.tsx` | 新規 | `"use client"` メイン UI |
| `src/app/api/biz/members/route.ts` | 新規 | POST（メンバー追加） |
| `src/app/api/biz/members/[id]/route.ts` | 新規 | PATCH（権限・役職変更）/ DELETE（無効化） |
| `src/components/business/BusinessLayout.tsx` | 修正 | NAV_ITEMS に「チーム管理」追加 |

---

## 総合所見

**MVP スコープ**: M-1〜M-3（既存 ow_users ユーザーのみ対象）を今日のセッションで完成させる。
migration は不要で、既存の `auth_is_company_admin()` RLS がそのまま使える。

**最大リスク**: 最後の admin 消去バグ。これだけ API 側でカウントチェックを入れておかないと、誰もログインできなくなる事故が起きる。M-2 の実装で最優先で対処する。

**M-4 はスコープ外**: 未登録ユーザーへの招待は service_role + token 管理が必要で、Phase 5 の認証フロー強化（Stage 2）と一緒にやるのが自然。今は「Opinio に登録済みのユーザーしか追加できません」として割り切る。

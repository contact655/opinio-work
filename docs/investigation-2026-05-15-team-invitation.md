# 調査レポート: チーム管理機能・招待フロー現状把握

**調査日**: 2026-05-14  
**調査種別**: 読み取り専用（コード変更なし）  
**対象**: `/biz/members` および招待関連の実装・DB 全般

---

## 1. /biz/team の存在状況とファイル構成

**結論: ルート名は `/biz/team` ではなく `/biz/members` として実装済み。機能は完成している。**

### ファイル構成

```
src/app/biz/members/
├── page.tsx              ← Server Component（async、force-dynamic）
└── MembersClient.tsx     ← Client Component（~44KB、メンバー管理UI全体）

src/app/api/biz/members/
├── route.ts              ← GET（メンバー一覧）、POST（直接追加）
├── invite/route.ts       ← POST（招待メール送信フロー）
├── accept/route.ts       ← POST（招待トークン受諾）
├── [id]/route.ts         ← PATCH（権限変更・無効化・再有効化）、DELETE（招待キャンセル）
└── _lib.ts               ← addExistingUserToCompany() 共通ヘルパー

src/app/biz/auth/accept-invite/
├── page.tsx              ← Server Component（トークン検証・状態分岐）
└── AcceptInviteClient.tsx ← Client Component（UI ステート: ready/unauthenticated/mismatch/expired/invalid）

src/app/biz/companies/add/
├── page.tsx              ← 「会社を追加」選択ページ（3パターン）
├── token/
│   ├── page.tsx
│   └── AddByTokenClient.tsx   ← 招待コード直接入力フロー
└── url/
    ├── page.tsx
    └── AddByUrlClient.tsx     ← 招待 URL 貼り付けフロー
```

### サイドナビへの接続

- **ファイル**: `src/components/business/BusinessLayout.tsx` 行 73–74
- **定義**: `{ href: "/biz/members", label: "チーム管理", icon: <Users ... /> }`
- NAV_ITEMS 配列の一項目として定義。アイコンは `lucide-react` の `Users`（`👥` に相当）

---

## 2. 既存UIの実装内容

### page.tsx の処理フロー（行 26–53）

```
getTenantContext() → [テナントなし → "企業アカウントが必要です" 表示]
↓
Promise.all([
  fetchMembersForCompany(supabase, tenantId),      → ow_company_admins JOIN ow_users
  fetchPendingInvitesForCompany(supabase, tenantId) → ow_company_admins WHERE user_id IS NULL
])
↓
BusinessLayout + MembersClient へデータを渡す
```

### MembersClient.tsx の主要機能

| 機能 | 状態 | 説明 |
|------|------|------|
| メンバー一覧表示 | ✅ 実装済み | アクティブ / 無効化済みタブ切替 |
| 権限変更 (admin/member) | ✅ 実装済み | PATCH /api/biz/members/[id] |
| メンバー無効化 | ✅ 実装済み | PATCH (deactivate) + 確認ダイアログ |
| メンバー再有効化 | ✅ 実装済み | PATCH (reactivate) |
| 役職・部署編集 | ✅ 実装済み | EditProfileDialog コンポーネント |
| 招待中メンバー表示 | ✅ 実装済み | PendingInvitesSection（期限・権限表示） |
| 招待送信（メールアドレス入力） | ✅ 実装済み | POST /api/biz/members/invite |
| 招待キャンセル | ✅ 実装済み | DELETE /api/biz/members/[id] |

### データ取得元

| データ | テーブル | 取得方法 |
|--------|---------|---------|
| アクティブメンバー | `ow_company_admins` JOIN `ow_users` | `fetchMembersForCompany()` (`src/lib/business/members.ts`) |
| 招待中（pending） | `ow_company_admins` WHERE `user_id IS NULL` | `fetchPendingInvitesForCompany()` |

### 型定義（`src/lib/business/members.ts`）

```typescript
type MemberRecord = {
  id, user_id, name, email, initial, gradient,
  role_title, department,
  permission: "admin" | "member",
  is_active: boolean,
  created_at: string
}

type PendingInviteRecord = {
  id, invited_email, invited_at, expires_at,
  permission: "admin" | "member",
  invitation_token: string
}
```

---

## 3. 招待関連の既存実装の有無（テーブル・API・メール）

**結論: 招待フローは「admin が未登録者にメール招待する」パスまで完全実装済み。**

### フロー全体像

```
[admin が /biz/members から招待]
  ↓
POST /api/biz/members/invite { email, permission }
  ├── Case 1: ow_users に存在 → 直接 ow_company_admins に INSERT（メールなし）
  └── Case 2: 未登録 → ow_company_admins に pending 行 INSERT (user_id=null)
                       → Resend で招待メール送信（7日間有効トークン付き URL）

[招待メールを受け取ったユーザー]
  ↓
/biz/auth/accept-invite?token={UUID}
  → Server Component でトークン検証・企業名取得・auth チェック
  → AcceptInviteClient で状態に応じた UI 表示
    ├── unauthenticated → ログイン/サインアップを促す UI
    ├── mismatch → 「メアドが一致しません」
    ├── expired → 「有効期限切れ」
    └── ready → 「受諾する」ボタン → POST /api/biz/members/accept
  
POST /api/biz/members/accept { invitation_token }
  → トークン検証 → 有効期限チェック → email 一致確認
  → ow_company_admins UPDATE (user_id をセット、token をクリア)
  → biz_current_company_id Cookie をセット → /biz/dashboard へリダイレクト

[別ルート: 招待コードを手入力 or URL 貼り付け]
/biz/companies/add/token → AddByTokenClient → POST /api/biz/members/accept（同一 API）
/biz/companies/add/url  → AddByUrlClient → token 抽出 → 同上
```

### 招待 URL の形式

```
{baseUrl}/biz/auth/accept-invite?token={UUID}
```

- `baseUrl` の決定: `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `Origin` header → `localhost:3000`（フォールバック順）
- トークンは crypto.randomUUID()（UUID v4）

---

## 4. ow_company_admins のスキーマと現状

### スキーマ（全カラム）

| カラム名 | 型 | NULL | デフォルト | 役割 |
|---------|-----|------|-----------|------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | **YES** | — | ow_users.id（pending 招待は NULL） |
| company_id | uuid | NO | — | FK → ow_companies |
| department | text | YES | — | 部署名（任意） |
| role_title | text | YES | — | 役職名（任意） |
| permission | text | NO | 'member' | 'admin' \| 'member' |
| is_active | boolean | NO | true | 論理削除フラグ |
| created_at | timestamptz | NO | now() | — |
| invited_by_user_id | uuid | YES | — | 誰が招待したか（migration 040） |
| invitation_token | text | YES | — | 招待トークン（受諾後は NULL にクリア） |
| invited_email | text | YES | — | 招待先メアド（pending 行のみ） |
| invited_at | timestamptz | YES | — | 招待日時 |
| accepted_at | timestamptz | YES | — | 受諾日時 |
| joined_at | timestamptz | YES | — | 参加日時 |
| is_default | boolean | NO | false | デフォルト企業フラグ |

### UNIQUE インデックス

| インデックス名 | 対象カラム | 条件 | 目的 |
|--------------|-----------|------|------|
| `ow_company_admins_pkey` | id | — | PK |
| `ow_company_admins_user_id_company_id_key` | (user_id, company_id) | — | 同一ユーザーが同一企業に重複登録しない |
| `uniq_default_company_per_user` | user_id | `is_default=true AND is_active=true AND user_id IS NOT NULL` | 1ユーザー1デフォルト企業 |
| `uniq_invitation_token` | invitation_token | `invitation_token IS NOT NULL` | トークン衝突防止 |
| `uniq_pending_invite` | (company_id, invited_email) | `user_id IS NULL AND invited_email IS NOT NULL` | 同一企業への重複招待防止 |

### レコード分布（2026-05-14 時点）

| permission | is_active | user_id あり（確定済み） | user_id なし（pending） |
|-----------|-----------|----------------------|----------------------|
| admin | true | 33件 | 0件 |
| admin | false（無効化済み） | 1件 | 0件 |
| member | true | 2件 | 0件 |
| **合計** | | **36件** | **0件** |

- **全36件が 2026-05月に集中**（テスト/シードデータ。本番利用はこれから）
- **pending 招待は現在 0 件**

---

## 5. ow_company_join_requests の生死状態

**結論: テーブルは存在・RLS 設定済みだが、コードから参照するファイルは一切ない。完全な休眠状態。**

### スキーマ

| カラム名 | 型 | NULL | 役割 |
|---------|-----|------|------|
| id | uuid | NO | PK |
| user_id | uuid | NO | FK → ow_users（申請者） |
| request_type | text | NO | 'join_existing' \| 'create_new' |
| target_company_id | uuid | YES | 既存企業への申請時の会社 ID |
| new_company_name | text | YES | 新規企業作成申請時の仮名称 |
| new_company_url | text | YES | 同上・URL |
| new_company_description | text | YES | 同上・説明 |
| requested_permission | text | NO | 'admin'（デフォルト） \| 'member' |
| request_message | text | YES | 申請理由 |
| status | text | NO | 'pending' \| 'approved' \| 'rejected' \| 'cancelled' |
| reviewed_by | uuid | YES | FK → ow_users（承認者） |
| reviewed_at | timestamptz | YES | — |
| review_note | text | YES | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### RLS ポリシー（7件・整備済み）

- ユーザー: 自分の申請のみ SELECT / INSERT / UPDATE(→cancelled のみ)
- Opinio 運営 admin: 全件 SELECT / UPDATE
- 企業 admin: `join_existing` 型のうち自社向けのみ SELECT / UPDATE

### データ件数と参照状況

| 項目 | 状態 |
|------|------|
| レコード件数 | **0件**（一度も使われていない） |
| `src/` からの参照 | **0件**（grep でヒットなし） |
| migration 番号 | `103_create_company_join_requests.sql`（2026-05-13 作成） |
| 作成経緯 | 仕様書 `spec-2026-05-13-youtrust-onboarding-phase1.md` に基づく「YOUTRUST型オンボーディング Phase 1」として準備されたが、その後方針転換 |

**判定: 完全に死んでいる（DB にテーブルとポリシーのみ存在、コード側の参照はゼロ）**

---

## 6. 権限境界の現状実装

### API ルート側のチェック

| ファイル | 行 | チェック内容 | 403 時のメッセージ |
|---------|-----|-------------|-----------------|
| `/api/biz/members/invite/route.ts` | 46–49 | `permission !== "admin"` | "メンバー追加は管理者のみ可能です" |
| `/api/biz/members/route.ts` | 38–40 | `permission !== "admin"` | 同上 |
| `/api/biz/members/[id]/route.ts` | — | PATCH `update_profile` 時に admin チェック | — |
| `/api/biz/members/[id]/route.ts` | — | DELETE（招待キャンセル）時に admin チェック | — |

### self-protection ガード（`[id]/route.ts`）

| ガード名 | 内容 |
|---------|------|
| SELF_DEMOTION | 自分自身の権限を降格できない |
| LAST_ADMIN | 最後の admin は降格できない |
| SELF_DEACTIVATE | 自分自身を無効化できない |

### 権限チェックのない領域

- `/biz/company`（企業情報編集）: middleware のセッションチェックのみ。admin/member の差は現状なし
- `/biz/jobs`（求人管理）: 未実装のため権限チェックなし
- `/biz/dashboard`、`/biz/meetings`: 同上

**middleware.ts** は `/biz/` 配下の「ログイン済みか」のみチェック。ロールベースの分岐は各 API Route に委ねる設計。

---

## 7. メール送信基盤の流用ポイント

### 基本構成

| 項目 | 詳細 |
|------|------|
| パッケージ | `resend@^6.10.0` |
| 送信関数 | `sendEmail(params)` in `src/lib/notify/email.ts` |
| テンプレート | `src/lib/notify/templates.ts`（14,651 bytes） |
| 環境変数 | `RESEND_API_KEY`、`RESEND_FROM_EMAIL` |
| フォールバック | API キーなし → `console.log` でモック（dev 環境） |

### 既存テンプレート一覧

| 関数名 | 用途 |
|-------|------|
| `companyInviteTemplate()` | チーム招待メール（**招待機能で使用中**） |
| `casualMeetingAdminTemplate()` | カジュアル面談申込（admin 宛） |
| `casualMeetingUserTemplate()` | カジュアル面談申込（申込者宛） |
| `meetingStatusTemplate()` | 面談ステータス変更通知 |
| その他 | メンター予約、応募通知など |

### companyInviteTemplate の現在の内容（`templates.ts` 行 220–262）

- **件名**: `${companyName} の採用担当として招待されました - Opinio Work`
- **本文**: 招待者名・企業名 + 招待 URL ボタン + 「7日間有効」メッセージ
- **引数**: `{ recipientEmail, inviterName, companyName, inviteUrl }`

### 新テンプレートを追加する場合のパターン

`templates.ts` に関数を追加 → `email.ts` の `sendEmail()` に渡す。既存パターンを踏襲するだけ。

---

## 8. ヘッダーバッジ「(2)」の正体

**結論: 現在のコードベースには "(2)" に相当するバッジ実装は存在しない。**

調査箇所:
- `BusinessLayout.tsx`: `tenantName` の表示部分に数字の付加なし
- `CompanySwitcher.tsx`: `memberships` の件数を表示するロジックなし
- `MembersClient.tsx`: タブ内でのカウント（例: `アクティブ (3)`）はあるが、ヘッダーには出ない

**仮説**: スクリーンショットの "(2)" は別セッションで検討したプロトタイプ・モックアップのもの。現時点では未実装。

---

## 9. 招待機能実装にあたっての論点・懸念（実装者視点）

### A. 招待フローはすでに「完成」しているが、未登録ユーザー向けに gap がある

現在の `/api/biz/members/accept` は **ログイン済み** かつ **メアド一致** を前提とする。  
招待メールを受け取った未登録ユーザーが `/biz/auth/accept-invite?token=xxx` を踏んだとき、
`AcceptInviteClient` は `state="unauthenticated"` を表示するが、**その後のサインアップ完了 → 自動受諾のフローが未接続**。

具体的なギャップ:
- `/biz/auth` でサインアップ後に `accept-invite` ページへ自動遷移させるロジックがない
- sessionStorage/cookie でトークンを引き回す仕組みがない
- `AcceptInviteClient(unauthenticated)` が何を表示しているか未確認（要読み込み）

### B. トークンの有効期限切れ後の再送信 UI がない

`/api/biz/members/invite` は重複チェックで `ALREADY_INVITED(409)` を返す。  
ただし期限切れ pending 行に対する「再送信」API は存在しない。  
現在の MembersClient に「再送信」ボタンがあるかは未確認。

### C. ow_company_join_requests テーブルの位置づけ

テーブルと RLS は整備済みだが、コード参照ゼロ・レコード件数ゼロ。  
これは「admin からの招待」ではなく「ユーザー側からの参加申請」フロー（プッシュ型 vs プル型）の基盤として設計されたもの。  
現行の招待フロー（admin 主導）とは設計思想が異なる。活用・廃棄の判断が必要。

### D. 権限チェックの網羅性

現状、admin チェックは `/api/biz/members/` 配下のみ実装。  
`/api/biz/company`（企業情報編集）や `/api/biz/jobs/` は admin/member を区別していない。  
「member はダッシュボード閲覧のみ、企業情報の編集は admin のみ」のようなポリシーを後から追加する場合、各 API に横断的な変更が必要になる。

### E. is_default フラグの管理

`ow_company_admins.is_default` カラムがあるが（`uniq_default_company_per_user` で1ユーザー1件を保証）、  
招待受諾時（`/api/biz/members/accept`）に `is_default` が設定されていない。  
既存企業への招待受諾後に「デフォルト企業」がどう決まるかが未整理。

### F. CompanySwitcher の「別の会社に参加」リンク先

現在 `/biz/companies/add` → 選択ページ（3パターン）。  
「招待コード入力」「招待 URL 貼り付け」「新規企業作成」の 3 択で、  
token/url どちらのパスも最終的に `/api/biz/members/accept` に到達する。  
フローは一貫しているが、ユーザーに「招待コード」を手動コピーさせるパスが必要かは UX 観点の論点。

---

## まとめ表

| 項目 | ステータス | 補足 |
|------|-----------|------|
| `/biz/members` ページ | ✅ 完全実装 | メンバー一覧・権限変更・無効化・招待送信・招待キャンセル |
| サイドナビ「チーム管理」 | ✅ 実装済み | `/biz/members` にリンク |
| 招待メール送信（未登録ユーザー） | ✅ 実装済み | Resend 経由、7日有効トークン |
| 招待受諾ページ | ✅ 実装済み | `/biz/auth/accept-invite?token=` |
| 招待受諾 API | ✅ 実装済み | `/api/biz/members/accept` |
| 未登録ユーザーの自動受諾フロー | ⚠️ ギャップあり | サインアップ後の自動受諾が未接続 |
| Resend メール基盤 | ✅ 実装済み | `src/lib/notify/email.ts` + `templates.ts` |
| 権限チェック (admin/member) | ✅ members API のみ | 企業情報・求人 API は未対応 |
| ow_company_admins スキーマ | ✅ 招待フロー対応済み | migration 040・041 で拡張 |
| ow_company_join_requests | ⚠️ 休眠中 | テーブル・RLS あり、コード参照ゼロ、レコード 0 件 |
| ヘッダーバッジ "(2)" | ❌ 未実装 | 現行コードに存在しない |

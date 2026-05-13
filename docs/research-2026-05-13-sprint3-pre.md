# 事前調査レポート: Phase 2 Sprint 3 — メール送信基盤

**作成日**: 2026-05-13  
**作成者**: Claude Code（調査）  
**目的**: Sprint 3（通知・運用機能）実装前の現状把握  
**調査コミット時点**: Phase 2 Sprint 2 完了（commit: 8d8b7c9）

---

## 1. メール送信ライブラリ・サービス

**ラベル: ✅ 既存実装あり**

### ライブラリ

| パッケージ | バージョン | 用途 |
|---|---|---|
| `resend` | `^6.10.0` | **メール送信の唯一の手段**（package.json 確認済み） |

sendgrid / nodemailer / mailgun は未導入。

### 中央ヘルパー

**`src/lib/notify/email.ts`** — Resend のラッパー関数（整備済み）

```typescript
// sendEmail: 実際の送信（RESEND_API_KEY がなければ console.log でモック）
export async function sendEmail(params: { to, subject, html }): Promise<void>

// notify: best-effort ラッパー（例外を握り潰す）
export async function notify(params: EmailParams): Promise<void>
```

- `FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@opinio.jp"`
- `FROM_NAME = "opinio.jp"`
- API キーが未設定の場合は **console.log で代替**（モックパターン）→ ローカル開発ではメールが飛ばない

### 環境変数の設定状況

| 変数名 | `.env.local` | `.env.development.local` | 本番(Vercel) |
|---|---|---|---|
| `RESEND_API_KEY` | **未設定** | 未設定 | **不明** |
| `RESEND_FROM_EMAIL` | 未設定（noreply@opinio.jp がデフォルト） | 未設定 | 不明 |
| `ADMIN_EMAIL` | 未設定（テンプレート側で `hshiba@opinio.co.jp` がデフォルト） | 未設定 | 不明 |
| `ADMIN_EMAILS` | ✅ SET | — | 不明 |

**重要**: ローカル開発環境では `RESEND_API_KEY` が設定されていない。  
`sendEmail()` は API キーなしのとき自動的に console.log に切り替わる安全設計。  
本番（Vercel）での `RESEND_API_KEY` の設定有無は調査不能（要確認）。

---

## 2. 既存の招待メール送信の実装

**ラベル: ❌ 未実装（最重要ギャップ）**

### 招待フロー全体像

```
[管理者] /biz/members で「メンバーを追加」ボタン
    ↓
[UI] InviteDialog でメールアドレス + 権限を入力
    ↓
[API] POST /api/biz/members （src/app/api/biz/members/route.ts）
    ├─ Case 1: すでに ow_users に存在 → ow_company_admins に直接 INSERT → 完了
    └─ Case 2: 未登録ユーザー → POST /api/biz/members/invite に委譲？
                   ↓
              ※ 実際は /api/biz/members/route.ts が 404 を返す（未登録なら追加不可）
```

```
[管理者] /biz/members で「招待」フロー（別経路）
    ↓
    ※ MembersClient.tsx には /api/biz/members/invite への POST 呼び出しなし
    ※ invite route は存在するが、現在の UI から呼ばれていない
```

### 現在の実態

1. **`/api/biz/members` (POST)**: 既存ユーザーのみ追加可能。未登録ユーザーは 404 を返す。
2. **`/api/biz/members/invite` (POST)**: 
   - `ow_company_admins` に pending 行を作成し `invite_url` を返す
   - **メール送信は一切していない**
   - `invite_url` を受け取った UI がどうするかは呼び出し元次第
   - ただし **現在の `/biz/members` UI からこのルートは呼ばれていない**
3. **`/api/biz/members/accept` (POST)**: トークン検証 + `ow_company_admins` の user_id を埋める処理（実装済み）
4. **`/biz/auth/accept-invite/`**: 招待トークン受諾 UI（実装済み）

### 結論

「招待メールを送信する」機能は **DB・API・UI の全層で未接続**。  
現在の実用的な運用:
- 管理者が `/biz/members` で pending 招待レコードを作成
- 招待 URL をクリップボードにコピーして手動で相手にシェア（Slack・メール等）
- 相手が URL をクリック → `/biz/auth/accept-invite` で受諾

---

## 3. 既存メール送信の実装状況（他機能）

### ✅ `src/lib/notify/templates.ts` — 共通テンプレート集（整備済み）

| テンプレート関数 | 宛先 | 用途 | 実際に呼ばれているか |
|---|---|---|---|
| `casualMeetingAdminTemplate` | admin | カジュアル面談申込通知 | ✅ `/api/casual-meetings` |
| `casualMeetingUserTemplate` | 申込者 | カジュアル面談受付確認 | ✅ `/api/casual-meetings` |
| `meetingStatusTemplate` | 申込者 | 面談ステータス変更通知 | ✅ `/api/biz/meetings/[id]` |
| `mentorReservationAdminTemplate` | admin | メンター相談申込通知 | ✅ `/api/mentor-reservations` |
| `mentorReservationUserTemplate` | 申込者 | メンター相談受付確認 | ✅ `/api/mentor-reservations` |
| `applicationAdminTemplate` | admin | 求人応募通知 | ✅ `/api/applications` |
| `applicationUserTemplate` | 応募者 | 応募受付確認 | ✅ `/api/applications` |
| `applicationStatusTemplate` | 応募者 | 選考ステータス変更通知 | ✅ `/api/biz/applications/[id]` |

**招待メールのテンプレートは存在しない**。

### テンプレートの共通仕様

```typescript
// HTMLラッパー（全テンプレート共通）
function htmlWrap(content: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      ${content}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
      <p style="color: #888; font-size: 12px;">
        opinio.jp — 採用と転職のためのプラットフォーム<br/>
        <a href="https://opinio.jp">https://opinio.jp</a>
      </p>
    </div>
  `;
}
```

- **From**: `"opinio.jp <noreply@opinio.jp>"`（lib/notify/email.ts の FROM_EMAIL/FROM_NAME）
- **Reply-To**: 未設定
- **ロゴ画像**: なし（テキスト+リンクのみ）
- **多言語**: なし（日本語のみ）
- **ブランディング**: シンプルなフッターテキストのみ

### 注意: 2系統の直接 Resend 呼び出し（非推奨パターン）

```typescript
// ❌ lib/notify/ を通さない旧パターン（2ファイルに存在）
// src/app/api/consultation/book/route.ts
// src/app/api/consultation-request/notify/route.ts
const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_fromEmail || "onboarding@resend.dev";
// → "onboarding@resend.dev" は Resend のデフォルトドメインのため本番で問題になる
```

Sprint 3 で新規テンプレートを追加するときは **`lib/notify/` パターンを使うこと**。

---

## 4. Supabase Auth のメール機能との関係

**ラベル: ⚠️ 部分実装（関与は最小限）**

### Supabase Auth が担当するメール

- サインアップ確認メール（magic link / email confirmation）
- パスワードリセットメール
- → これらは Supabase の設定（ダッシュボード側）で管理

### 業務メール（`lib/notify/` 経由）とは完全に別基盤

- Supabase Auth メール: Supabase が管理、SMTP or Supabase Email を使用
- 業務メール（面談通知・応募通知等）: Resend を使用

### `supabase/config.toml`

プロジェクトに `supabase/config.toml` が存在しない（ローカル Supabase CLI を使っていない）。  
ダッシュボードでカスタマイズされているかは調査不能。

---

## 5. 通知系の既存実装

**ラベル: ❌ 未実装（アプリ内通知はなし）**

### `/api/notifications/` ディレクトリ

→ **存在しない**

### `ow_notifications` テーブル

→ `supabase/migrations/` を全件検索しても**存在しない**

### アプリ内通知（バッジ等）

→ なし。`Header.tsx` に `newJobCount`（新着求人数バッジ）のみ存在するが、ユーザー向けの汎用通知システムはない。

---

## 6. メール文言テンプレートの管理方式

**ラベル: ✅ 既存実装あり（改善余地あり）**

| 観点 | 現状 |
|---|---|
| 管理場所 | `src/lib/notify/templates.ts` にハードコード |
| 件名命名規則 | `【opinio.jp】件名` 形式（一部 `【新着◯◯】` 形式） |
| HTML | インラインスタイル + 最小限の構造 |
| 多言語 | 日本語のみ |
| ロゴ | なし |
| From アドレス | `noreply@opinio.jp`（デフォルト） |
| Reply-To | 未設定 |
| DB 管理 | なし |

---

## 7. Sprint 3 で必要な作業サマリ

### 🔴 新規作成が必要なもの

| # | 作業 | 優先度 | 難易度 |
|---|---|---|---|
| 1 | **招待メールテンプレートの追加** | 最高 | ⭐ |
| 2 | **`/api/biz/members/invite` にメール送信処理を追加** | 最高 | ⭐ |
| 3 | **新規企業 admin 追加時の運営通知テンプレート** | 高 | ⭐ |
| 4 | **`POST /api/biz/companies` にメール通知を追加** | 高 | ⭐ |
| 5 | Vercel に `RESEND_API_KEY` が設定されているか確認（要柴さん確認） | 高 | — |

### 🟡 既存改修で済むもの

| # | 作業 | 優先度 | 難易度 |
|---|---|---|---|
| 6 | 旧パターン（`RESEND_fromEmail` / `onboarding@resend.dev`）を `lib/notify/` に統一 | 中 | ⭐ |
| 7 | 招待メールの文言確認（既存の `/biz/members` invite フローの文言整備） | 中 | ⭐ |

### 🟢 後日対応でよいもの

| # | 作業 | 理由 |
|---|---|---|
| ow_notifications テーブル | アプリ内通知は MVP 外 | |
| メールテンプレートの DB 管理化 | 現規模では不要 | |
| Reply-To 設定 | noreply で問題なし | |
| ロゴ入りリッチ HTML | 機能優先 | |

---

## 8. 招待メール送信フロー — 完全実装ガイド（コード抜粋）

Sprint 3 で実装するべき変更の全体像。

### Step 1: テンプレート追加（`src/lib/notify/templates.ts`）

```typescript
// 追加するテンプレート1: 招待メール（招待された人へ）
export function companyInviteTemplate(params: {
  to: string;
  inviterName: string;    // 招待した人の名前
  companyName: string;    // 企業名
  inviteUrl: string;      // 受諾 URL
  expiresAt: string;      // 有効期限（ISO string）
}) {
  const expiryDate = new Date(params.expiresAt).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });

  return {
    to: params.to,
    subject: `【opinio.jp】${params.companyName} の採用担当チームに招待されました`,
    html: htmlWrap(`
      <h2>${params.companyName} の採用担当チームへ招待されました</h2>
      <p>${params.inviterName} さんから、Opinio Business への招待が届いています。</p>
      <p>以下のリンクから参加手続きを完了してください（有効期限: ${expiryDate}）。</p>
      <p style="margin: 24px 0;">
        <a href="${params.inviteUrl}" 
           style="background: #002366; color: #fff; padding: 12px 24px; 
                  border-radius: 8px; text-decoration: none; font-weight: bold;">
          招待を受諾する
        </a>
      </p>
      <p style="color: #888; font-size: 12px;">
        このリンクは${expiryDate}まで有効です。<br/>
        招待に心当たりがない場合は、このメールを無視してください。
      </p>
    `),
  };
}

// 追加するテンプレート2: 新規企業作成の運営通知（admin へ）
export function newCompanyAdminTemplate(params: {
  companyId: string;
  companyName: string;
  creatorEmail: string;
  createdAt: string;
}) {
  return {
    to: ADMIN_EMAIL,
    subject: `【新規企業登録】${params.companyName} が作成されました`,
    html: htmlWrap(`
      <h2>新規企業が登録されました</h2>
      <p><strong>${params.companyName}</strong> が Opinio Business に新規登録されました。</p>
      <p><strong>作成者:</strong> ${params.creatorEmail}</p>
      <p><strong>企業 ID:</strong> ${params.companyId}</p>
      <p><strong>登録日時:</strong> ${new Date(params.createdAt).toLocaleString("ja-JP")}</p>
      <p><a href="https://opinio.jp/admin/companies/${params.companyId}">管理画面で確認する →</a></p>
      <p style="color: #888; font-size: 12px;">
        内容を確認し、不審な登録があれば kick または非公開化してください。
      </p>
    `),
  };
}
```

### Step 2: invite API にメール送信を追加（`/api/biz/members/invite/route.ts`）

現在の route.ts の末尾（INSERT 成功後）に以下を追加:

```typescript
// ── 現在のコード（末尾・レスポンス前）─────────────────────────────────
const inviteUrl = `${baseUrl}/biz/auth/accept-invite?token=${inviteToken}`;

// ── 追加: メール送信（best-effort）──────────────────────────────────
import { notify } from "@/lib/notify/email";
import { companyInviteTemplate } from "@/lib/notify/templates";

// 招待者の名前を取得（actor = 現在ログイン中のユーザー）
const { data: actorProfile } = await supabase
  .from("ow_users")
  .select("name")
  .eq("id", actorOwUserId)
  .maybeSingle();

// 企業名を取得
const { data: companyInfo } = await supabase
  .from("ow_companies")
  .select("name")
  .eq("id", companyId)
  .maybeSingle();

await notify(companyInviteTemplate({
  to: email,
  inviterName: actorProfile?.name ?? "採用担当者",
  companyName: companyInfo?.name ?? "会社",
  inviteUrl,
  expiresAt: expiresAt.toISOString(),
}));
// ── ここまで追加 ──────────────────────────────────────────────────────

return NextResponse.json({ ... }, { status: 201 });
```

### Step 3: 新規企業作成 API に運営通知を追加（`/api/biz/companies/route.ts`）

```typescript
// ow_company_admins INSERT 成功後、レスポンス前に追加
import { notify } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";

await notify(newCompanyAdminTemplate({
  companyId: company.id,
  companyName: company.name,
  creatorEmail: user.email ?? "unknown",
  createdAt: company.created_at,
}));
```

### Step 4: 環境変数の確認（柴さん実施）

Vercel の Environment Variables で以下を確認・設定:

```
RESEND_API_KEY=re_xxxxx           # ← 設定済みかどうか要確認
RESEND_FROM_EMAIL=noreply@opinio.jp  # ← lib/notify/email.ts のデフォルト値で OK
ADMIN_EMAIL=hshiba@opinio.co.jp   # ← templates.ts のデフォルト値で OK（必要なら明示設定）
```

---

## 9. 既存の問題点（Sprint 3 実装前に把握すべき事項）

### 問題1: 旧パターンの `RESEND_fromEmail` 変数名の不統一

```typescript
// 旧パターン（2ファイル）: camelCase、typo 的なキー名
const fromEmail = process.env.RESEND_fromEmail || "onboarding@resend.dev";

// 新パターン（lib/notify/email.ts）: SCREAMING_SNAKE_CASE
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@opinio.jp";
```

→ `RESEND_fromEmail` が設定されていない場合、旧パターンは `onboarding@resend.dev`（Resend デフォルト）から送信されてしまう。  
→ 本番では `noreply@opinio.jp` から送るべきで、統一が必要。

### 問題2: 招待フローの UI 側が招待メールを想定していない

現在の `/biz/members` は `/api/biz/members`（既存ユーザーのみ）にしか繋がっておらず、  
`/api/biz/members/invite`（未登録ユーザーへの招待）は **UI から呼ばれていない**。  
Sprint 3 でメール送信を追加しても、UI 側に「招待」ボタンを繋がないと機能しない。  
→ UI 改修（Sprint 2 の範囲外のため Sprint 3 で対応が必要）

### 問題3: `RESEND_API_KEY` のローカル未設定

ローカルでは API キーなしのため常に console.log モック。  
Sprint 3 の動作確認は **Vercel preview デプロイで実施する必要がある**（または一時的にローカルに設定）。

---

**作成者**: Claude Code  
**作成日**: 2026-05-13

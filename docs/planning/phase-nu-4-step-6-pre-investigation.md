# Sub-step 4A-6 事前不確実性調査

**調査日**: 2026-05-07  
**調査者**: Claude (Sub-step 4A-6 実装前)  
**用途**: migration 070 適用後に 4A-6 を即着手できるよう不確実性を潰す

---

## 目次

1. [候補者側 /mypage/conversations の構造精読](#1-候補者側-mypageconversations-の構造精読)
2. [/biz 配下の既存実装確認](#2-biz-配下の既存実装確認)
3. [サイドバー系統の分析](#3-サイドバー系統の分析)
4. [/biz/conversations の新規作成設計方針](#4-bizconversations-の新規作成設計方針)
5. [⚠️ 重大発見サマリー](#5-️-重大発見サマリー)
6. [Hisato 確認待ち事項](#6-hisato-確認待ち事項)
7. [マスタープラン更新の必要性](#7-マスタープラン更新の必要性)

---

## 1. 候補者側 /mypage/conversations の構造精読

### 1-A. ファイル構成

```
src/app/(jobseeker)/mypage/conversations/
  page.tsx          ← "use client", 240行, 対話一覧
  [id]/page.tsx     ← "use client", 365行, 対話詳細 + 返信フォーム
```

どちらも `(jobseeker)` ルートグループに属し、`/(jobseeker)/layout.tsx`（JobseekerHeader + JobseekerFooter）の配下。

### 1-B. `page.tsx`（対話一覧）のデータ取得ロジック

```typescript
// 認証
getSession() → session.user → ow_users.id (auth_id で変換)

// SELECT (1): ow_conversations
supabase.from("ow_conversations")
  .select(`id, kind, stage, status, last_message_at, created_at,
           company_id, mentor_user_id,
           ow_companies(id, name, logo_url, logo_letter),
           mentor:ow_users!mentor_user_id(id, name)`)
  .order("last_message_at", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false })
// → RLS が participant 登録済みの対話のみ返す（explicit .eq() 不要）

// SELECT (2): ow_conversation_participants（未読検出用）
.eq("user_id", owUser.id).in("conversation_id", conversationIds)

// SELECT (3): ow_conversation_messages（未読検出用）
.in("conversation_id", conversationIds).is("deleted_at", null)
```

### 1-C. `page.tsx` のカードコンポーネント

```
┌─────────────────────────────────────────────────┐
│ [ロゴ 40px]  企業名 or メンター名            未読● │
│             最終メッセージ日時                     │
└─────────────────────────────────────────────────┘
```

表示要素: 企業ロゴ（logo_url or logo_letter + 頭文字）, 表示名, 日時, 未読ドット（赤丸）

### 1-D. 企業側での流用可否と変換が必要な箇所

| 要素 | 候補者側 | 企業側（4A-6） | 変換要否 |
|------|---------|--------------|---------|
| 認証 | getSession() → ow_users | getSession() → ow_users + company_admin チェック | ⚠️ 変換必要 |
| RLS フィルター | participant として登録済みの対話 | migration 070 後: 同社 company_admin も対象 | ✅ 変換不要（RLS が自動処理） |
| 表示名 | 企業名 / メンター名 | 候補者名（ow_users.name） | ⚠️ 変換必要 |
| ロゴ | 企業ロゴ | 候補者アバター（avatar_color + 頭文字） | ⚠️ 変換必要 |
| 未読検出 | participants + messages | 同じロジック | ✅ 流用可 |
| JOIN 構造 | ow_companies + mentor | `candidate:ow_users!candidate_user_id` | ⚠️ 変換必要 |
| サイドバー | 独自 SIDEBAR_ITEMS | BusinessLayout のサイドバー | ⚠️ 変換必要 |
| レイアウト | JobseekerHeader + Footer | BusinessLayout コンポーネント | ⚠️ 変換必要 |

**結論**: ロジックの骨格（getSession → ow_users → SELECT conversations → 未読判定）は流用できる。UI の大部分（レイアウト・表示名・ロゴ）は企業側に合わせて書き換える。

### 1-E. 「系統 B」であることの確認

`/mypage/conversations/page.tsx` は **MypageClient.tsx とは独立した「系統 B」ページ**。

- MypageClient.tsx（系統 A）: `/mypage` のみ。複雑なサイドバー（6ビュー切替）を自前管理
- `/mypage/conversations/page.tsx`（系統 B）: MypageClient.tsx を使わない。独自サイドバー（SIDEBAR_ITEMS 配列をハードコード）

→ マスタープランの「4A-6 は系統 A で作る」設計は、候補者側 conversations を参考にするのではなく `/biz` の BusinessLayout を参考にするということ。

---

## 2. /biz 配下の既存実装確認

### 2-A. /biz 配下の全ページ一覧（2026-05-07 時点）

```
src/app/biz/
  applications/
    ApplicationsClient.tsx
    page.tsx
  auth/
    accept-invite/AcceptInviteClient.tsx, page.tsx
    page.tsx
    signup/page.tsx
  companies/add/
    new/CreateCompanyClient.tsx, page.tsx
    page.tsx
    token/AddByTokenClient.tsx, page.tsx
    url/AddByUrlClient.tsx, page.tsx
  company/
    CompanyEditClient.tsx
    employees/categories/CategoriesEditor.tsx, page.tsx
    page.tsx
  dashboard/
    DashboardMockView.tsx
    page.tsx  ← 229行
  jobs/
    JobsClient.tsx, JobsMockView.tsx
    [id]/edit/JobEditMockView.tsx, page.tsx
    new/page.tsx
    page.tsx
  meetings/
    MeetingsClient.tsx, MeetingsMockView.tsx
    page.tsx  ← 62行
  members/MembersClient.tsx, page.tsx
  posts/PostsClient.tsx, page.tsx
  select-company/SelectCompanyClient.tsx, page.tsx
```

**`/biz/conversations/` は存在しない → 完全新規作成が必要。**

### 2-B. /biz に layout.tsx が存在しないことの確認

```bash
find src/app/biz -name "layout.tsx"
# → 結果なし（0件）
```

存在する layout.tsx:
- `src/app/layout.tsx` — root (全サイト共通)
- `src/app/(jobseeker)/layout.tsx` — JobseekerHeader + JobseekerFooter
- `src/app/admin/layout.tsx` — admin 系統

**/biz は layout.tsx を使わず、各ページで `BusinessLayout` コンポーネントを直接インポートして使用している。**

### 2-C. BusinessLayout コンポーネントの利用パターン（dashboard から確認）

```typescript
// /biz/dashboard/page.tsx の冒頭
import { BusinessLayout } from "@/components/business/BusinessLayout";

// 使い方
async function NoTenantPage() {
  return (
    <BusinessLayout userName={userName}>
      {/* ... */}
    </BusinessLayout>
  );
}

export default async function DashboardPage() {
  // ... data fetching ...
  return (
    <BusinessLayout userName={tenantContext.userName} companyName={...}>
      {/* ダッシュボードコンテンツ */}
    </BusinessLayout>
  );
}
```

**4A-6 で採用すべきパターン**: `BusinessLayout` で wrap する Server Component。

### 2-D. BusinessLayout コンポーネントの構造確認（要追加調査）

```
src/components/business/BusinessLayout.tsx の構造は本調査では未読。
4A-6 着手時に props 定義（userName, companyName, activeNav 等）を確認すること。
```

### 2-E. /biz のサイドバーナビゲーション

`BusinessLayout` がサイドバーを管理していると推定される。/biz ページ群はすべてこれを経由しており、4A-6 で `conversations` をサイドバーに追加する場合、`BusinessLayout` のサイドバー定義を修正することになる可能性が高い。

---

## 3. サイドバー系統の分析

### 3-A. 系統の整理

| 系統 | 対象ページ | サイドバー管理 | レイアウトコンポーネント |
|------|-----------|--------------|----------------------|
| **系統 A（企業側）** | `/biz/*` | `BusinessLayout` | `@/components/business/BusinessLayout` |
| **系統 B（求職者 standalone）** | `/mypage/conversations/*` | ローカル `SIDEBAR_ITEMS` 配列 | `(jobseeker)/layout.tsx` の Header/Footer のみ |
| **系統 C（求職者 MypageClient）** | `/mypage`（トップのみ） | `MypageClient.tsx` 内部 | `(jobseeker)/layout.tsx` の Header/Footer + MypageClient |

### 3-B. 4A-6 が「系統 A」に属する根拠

マスタープランに「サイドバー系統 A（BusinessLayout）で実装」とある。

/biz/conversations は:
- `/biz/` パス → 企業側 HR が操作する画面
- BusinessLayout を wrap する
- 候補者側の conversations.page.tsx の sidebar コードは **流用しない**

### 3-C. マスタープランの「系統 A/B 制約」について

マスタープランに記載:
> 系統 A と系統 B を「サイドバー統一 UI 」へマージする改修は Phase ν-5 スコープ。
> 4A-6 と 4A-7 では現状の系統を尊重し、新規 UI は系統 A（BusinessLayout）で実装する。

→ これは確認済み。候補者側の conversations は 系統 B のまま放置し、企業側は系統 A で新規作成する。

---

## 4. /biz/conversations の新規作成設計方針

### 4-A. ページ構成（推奨）

```
src/app/biz/conversations/
  page.tsx          ← async Server Component。BusinessLayout でラップ。対話一覧
  [id]/page.tsx     ← "use client" or Server + Client Component。詳細
```

### 4-B. `page.tsx`（一覧）の設計方針

**データ取得 SELECT**:
```typescript
// migration 070 後 RLS は company_admin にも対話 SELECT を許可
supabase.from("ow_conversations")
  .select(`
    id, kind, stage, status, last_message_at, created_at,
    company_id,
    candidate:ow_users!candidate_user_id(id, name, avatar_color),
    ow_jobs(id, title)   -- 応募求人（候補、ow_job_applications 経由の方が正確）
  `)
  .eq("company_id", companyId)
  .order("last_message_at", { ascending: false, nullsFirst: false })
```

**候補者側との差分**:
- `.eq("company_id", companyId)` で絞り込む（RLS だけでも取れるが明示的フィルターを追加）
- 表示名: 候補者名（`candidate.name`）
- アバター: 候補者 avatar_color + 頭文字

### 4-C. 一覧カードのデザイン方針

```
┌────────────────────────────────────────────────────────┐
│ [候補者アバター 40px]  候補者名                  未読● │
│                        最終メッセージ日時              │
│                        stage ラベル (active/offer/...)  │
└────────────────────────────────────────────────────────┘
```

### 4-D. Server Component vs Client Component の判断

**一覧 (`page.tsx`)**:
- 初期データ取得は Server Component で可能
- 未読バッジ（participant + messages の比較）はリアルタイム性がないなら Server でも可
- **推奨: Server Component**（他の /biz pages と同じパターン）

**詳細 (`[id]/page.tsx`)**:
- メッセージ送信（INSERT）や既読更新（UPDATE）はクライアント側で行う
- **推奨: `"use client"`**（候補者側と同じパターン。または Server + Client 分割）

---

## 5. ⚠️ 重大発見サマリー

### 重大発見 1: /mypage/conversations は MypageClient.tsx の外にある（系統 B）

候補者側の対話ページは MypageClient.tsx を **使っていない**。独自サイドバー（SIDEBAR_ITEMS 配列）を持つ系統 B ページ。これは 4A-6 の「系統 A（BusinessLayout）で作る」方針に影響しない（正しい判断）が、候補者側 UI の流用範囲を明確にする意味で重大。

**具体的影響**: /biz/conversations を作るとき、候補者側の `SIDEBAR_ITEMS` や `<aside>` JSX ブロックはコピーしない。`BusinessLayout` をラップするだけでサイドバーが付く。

### 重大発見 2: /biz に layout.tsx が存在しない

`/biz/layout.tsx` は存在せず、各ページが `BusinessLayout` を直接 import している。これは想定外の発見ではなく現状の設計だが、Next.js の route group layout を使っていないことを確認した。

**具体的影響**: `/biz/conversations/page.tsx` を作る際、layout.tsx を追加する必要はなく、`BusinessLayout` コンポーネントをそのまま使えばよい。

### 重大発見 3: /biz/conversations ディレクトリが存在しない

完全新規作成が必要。既存の /biz ページに conversations の「一部実装」が紛れ込んでいる事実はない。

---

## 6. Hisato 確認待ち事項

### Q1: BusinessLayout の `activeNav` 的な props の確認

`BusinessLayout` コンポーネントが「対話」をサイドバーナビゲーション項目として持っているか不明。4A-6 着手前に `src/components/business/BusinessLayout.tsx` を確認し、必要なら `conversations` 項目を追加する必要がある。

→ これは 4A-6 冒頭で Claude が確認・判断できる範囲のため、Hisato 事前判断は不要。

### Q2: 一覧ページのフィルタータブの要否

候補者側にはフィルタータブがない（全対話を一覧表示）。企業側でも同様に「全対話」を一覧表示するか、または `stage`（active / offer / closed 等）でフィルタリングするタブ UI を用意するか。

マスタープランに「フィルタータブ」の記載がある場合はそれに従う。なければシンプルな全一覧で開始を推奨。

### Q3: 未読バッジを Server Component で実装するか Client で実装するか

一覧を Server Component にする場合、未読バッジは初期ロード時の値のみ（リアルタイム更新なし）で良いか。Hisato の UX 方針を確認。

→ 初期実装では「リアルタイムなし」で問題ないと想定するが、確認推奨。

---

## 7. マスタープラン更新の必要性

| 更新箇所 | 現状の記載 | 正しい内容 |
|---------|-----------|-----------|
| 4A-6「候補者側 conversationsの流用範囲」 | 不明確 | ロジックは参考にできるが、サイドバー・レイアウト・表示要素は全て置き換える |
| 4A-6「サイドバー」 | BusinessLayout（系統 A） | ✅ 正しい。BusinessLayout コンポーネントを wrap するだけで OK |
| 4A-6「layout.tsx 追加の必要性」 | 言及なし | 不要（/biz には layout.tsx がなく、BusinessLayout 直接 import の慣例） |
| 4A-6「ディレクトリ事前確認」 | 言及なし | /biz/conversations は存在しない → 完全新規作成が必要であることを明記推奨 |

---

*（調査完了: 2026-05-07）*

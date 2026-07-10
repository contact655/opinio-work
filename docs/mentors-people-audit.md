# /mentors・/people 機能 現状監査レポート

> 作成日: 2026-07-10  
> 目的: /mentors と /people の今後の扱い（撤去/整理/統合）を判断するための事実整理  
> 方針: コードと git 履歴から確認できた事実のみ記述。推測・提案は含まない。

---

## 1. /mentors の現状

### ページ・コンポーネント

| ファイル | 状態 |
|---------|------|
| `src/app/(jobseeker)/mentors/` | **存在しない**（ディレクトリごと削除済み） |
| `src/app/(jobseeker)/mentors/[id]/reserve/` | **存在しない** |
| `src/app/api/mentor-reservations/route.ts` | **存在しない**（2026-06-21 削除） |
| `src/app/admin/mentors/` | **存在しない**（`/admin/page.tsx` に dead link あり） |
| `src/app/terms/mentor/page.tsx` | 存在する（ナビからのリンクはない） |

### `/mentors` への導線

| 場所 | 内容 |
|------|------|
| `JobseekerHeader.tsx` NAV_LINKS | `/people` のみ。`/mentors` なし |
| `MobileBottomNav.tsx` TABS | `/people` のみ。`/mentors` なし |
| `JobseekerFooter.tsx` | `/people` なし、`/mentors` なし |
| `next.config.mjs` | `/mentors` → `/people` に 301 リダイレクト設定あり |
| コード内全参照 (`grep`) | `/admin/page.tsx` L559 の dead link のみ |

**結論**: URL `/mentors` は `next.config.mjs` のリダイレクトで `/people` に転送される。ナビ上のリンクは一切ない。

### DBテーブル

| テーブル | 状態 |
|---------|------|
| `ow_mentors` | **削除済み**（migration 140、2026-02-18実施） |
| `ow_mentor_categories` | 削除済み（migration 140） |
| `ow_consultation_requests` | 削除済み（migration 140） |
| `ow_consultations` | 削除済み（migration 140） |
| `ow_mentor_reservations` | migration 197 で**再作成**（ただし内容は変化、後述） |

#### `ow_mentor_reservations`（migration 197）の現在の構造

旧 `ow_mentor_reservations` の FK 先は `ow_mentors` だったが、migration 197 では以下に変更:

```sql
ambassador_id     UUID REFERENCES ow_company_admins(id)  -- アンバサダー（企業管理者）
ambassador_user_id UUID REFERENCES ow_users(id)
```

`ow_mentors` を参照するカラムは存在しない。APIエンドポイント（`/api/mentor-reservations`）も削除済みのため、このテーブルに書き込む経路は現在存在しない。

### `ow_users.is_mentor` カラム

- カラム自体は存在する
- 使用箇所: `/admin/page.tsx` でユーザー一覧表示時にバッジとして表示するのみ
- マイページの `isMentor` フラグは `owUser?.is_mentor === true` を参照しているが、`is_mentor=true` のユーザーが存在するかは未確認

### dead code（メンター関連）

| ファイル | 内容 |
|---------|------|
| `src/lib/supabase/queries.ts` | `ow_mentors` クエリ関数が残存（テーブル削除済みのため実行時に失敗） |
| `src/lib/supabase/types.ts` | `ow_mentors`・`ow_consultations` の型定義が残存 |
| `src/app/admin/page.tsx` L559 | `/admin/mentors` へのリンク（ディレクトリ存在しない） |
| `src/app/terms/mentor/page.tsx` | メンター利用規約ページ（ナビリンクなし・フッターリンクなし） |

---

## 2. /people の現状

### ファイル構成

```
src/app/(jobseeker)/people/
├── page.tsx             （Server Component、ISR revalidate=300）
├── PeopleListClient.tsx （Client Component）
└── loading.tsx          （スケルトン）
```

### データ取得（`page.tsx`）

**アンバサダー（`ow_company_admins`）:**

```typescript
adminSupabase
  .from("ow_company_admins")
  .select(`
    id, user_id, company_id, role_title, department, talk_themes,
    user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility),
    company:ow_companies!company_id(...)
  `)
  .eq("is_ambassador", true)
  .eq("is_active", true)
  .not("user_id", "is", null)
  .order("company_id", { ascending: true })
```

取得後、`visibility === "public"` AND `name` 存在でサーバー側フィルタリングを実施。

**ピア（`ow_users.can_talk_to_candidates`）:**

```typescript
adminSupabase
  .from("ow_users")
  .select("id, name, avatar_color, avatar_url, auth_id")
  .eq("can_talk_to_candidates", true)
  .eq("visibility", "public")
  .order("created_at", { ascending: false })
```

### 参照テーブル・カラム

| テーブル | 参照カラム |
|---------|-----------|
| `ow_company_admins` | `id`, `user_id`, `company_id`, `role_title`, `department`, `talk_themes`, `is_ambassador`, `is_active` |
| `ow_users` | `id`, `name`, `avatar_color`, `avatar_url`, `visibility`, `can_talk_to_candidates` |
| `ow_companies` | `id`, `name`, `brand_name`, `logo_url`, `logo_gradient`, `logo_letter`, `phase`, `industry` |

### UI機能（`PeopleListClient.tsx`）

- グリッド/リスト表示切り替え
- 職種カテゴリフィルタ（role_title/department から自動推定）
- 企業タイプフィルタ（フェーズ別）
- フリーワード検索
- 「話を聞く」ボタン → `/companies/{companyId}/casual-meeting`
- プロフィール → `/u/{userId}`

### アンバサダー登録の仕組み

1. `/admin/biz-accounts` でトグルスイッチ → `ow_company_admins.is_ambassador` を更新（`toggleAmbassador` Server Action）
2. `/biz/members` から企業担当者自身が「話せる人として登録」できる（`cdcf97be` で実装）
3. 更新時に `/people` を `revalidatePath`

**現在の登録件数**: コードから直接確認する手段なし（DB参照が必要）。ただし `bf277e09`（2026-06-XX）のコミットで「準備中バナーを削除」しており、本番表示可能な状態になっている。

### /people への導線

| 場所 | ラベル |
|------|--------|
| `JobseekerHeader.tsx` NAV_LINKS L14 | 「ユーザー」 |
| `MobileBottomNav.tsx` TABS L28 | 「ユーザー」 |
| `MypageClient.tsx` L1110（オンボーディング誘導） | 「話せる人を見る →」 |
| `FeedSidebar.tsx` L366 | リンクあり |
| `JobseekerFooter.tsx` | なし |

---

## 3. git履歴から読み取れる経緯

### /mentors の削除・縮小プロセス（時系列）

| コミット | 日付 | 内容 |
|---------|------|------|
| `db882ec3` | 2026-02-18以前 | migration 140: `ow_mentors`・`ow_mentor_reservations` 等を全削除 |
| `bc742237` | 2026-06-14 | `feat: remove mentor feature — replace with DM-based user connections`。`/mentors` ナビリンク削除、Hero メンター表示削除、HowItWorks STEP02 をメンター→DM/面談に変更、`/u/[id]` と `/jobs/[id]` のメンターCTAを削除 |
| `8b0ed956` | 2026-06-XX | `feat: remove mentor references, add feed UVP + mobile auth CTA` |
| `b4aeda2a` | 2026-06-XX | `feat(lp): remove mentor references — LP + FAQ + article page` |
| `d6f27518` | 2026-06-XX | `/terms/mentor` ページとフッターリンク削除 |
| `a70affb6` | 2026-06-21 | `feat: メンター相談予約機能を削除`。`/api/mentor-reservations` ルート削除、jobs/[id] の「相談可」バッジ削除。コミットメッセージに「`/mentors` ページ・キャリアを見るボタンは維持」とあるが、当該ページは既に削除済み |
| `d11d864a` | 2026-06-XX | `refactor(queries): remove dead ow_mentors queries from getJobPositionMembers` |
| `54e1ca76` | 2026-06-29 | `/mentors` → `/people` の 301 リダイレクトを `next.config.mjs` に追加 |

### /people（アンバサダー）の追加経緯

| コミット | 内容 |
|---------|------|
| 不明（調査範囲外） | `/people` ディレクトリ初期作成 |
| `89eb8cee` | `feat(labels): rename nav labels + neutralize /people and /feed copy`（ナビラベル「ユーザー」に変更） |
| `5f88584a` | `feat(people): 6項目UX修正 + 話せるテーマAdmin編集UI` |
| `4adfc4b1` | `feat(people): 話せる人ページ全面UX改善（10項目）` |
| `fc9b8013` | `feat(people): add peer cards — candidates who opt in to talk to each other`（`can_talk_to_candidates` 機能追加） |
| `cdcf97be` | `feat(biz/members): allow non-admin members to self-register as 話せる人` |
| `5d604425` | `security: fix ambassador privilege escalation`（セキュリティ修正） |

### career.opinio.co.jp への分離

確認した git 履歴の範囲では、`career.opinio.co.jp` へのメンター機能の分離に関するコミットは存在しない。

---

## 4. 依存関係（/mentors 撤去時の影響範囲）

### `next.config.mjs` の `/mentors` リダイレクト

```javascript
{ source: "/mentors",       destination: "/people", permanent: true },
{ source: "/mentors/:path*", destination: "/people", permanent: true },
```

撤去する場合、このリダイレクト設定の削除/維持を判断する必要がある。301 のため削除すると既存ブックマーク等が壊れる。

### `/admin/page.tsx` L559 の dead link

```typescript
{ href: "/admin/mentors", label: "メンターを管理する", desc: "メンター登録・承認", icon: "🎓" }
```

現在この href のディレクトリは存在しない。クリックすると Next.js の 404 が表示される。

### `src/lib/supabase/queries.ts` の dead code

`ow_mentors` を参照するクエリ関数が残存。テーブルは削除済みのため、実行時エラーになる可能性がある（ただし現在呼び出し元が存在するかは別途確認が必要）。

### `src/lib/supabase/types.ts` の型定義

`ow_mentors`・`ow_consultations` の型定義が残存しているが、実際の DB テーブルは存在しない。

### `src/app/terms/mentor/page.tsx`

メンター利用規約ページ。ナビリンクはないが URL として存在する（`/terms/mentor`）。

### /mentors と /people の機能的重複

- **同一人物が両方に出ることはない**: `ow_mentors`（削除済み）と `ow_company_admins`（現行）は別テーブル・別人物
- 機能的な重複は現状ない
- `/people` の「話を聞く」ボタンは `/companies/{companyId}/casual-meeting` に遷移（カジュアル面談フローと統合済み）

---

## 5. 現状サマリー

| 項目 | 状態 |
|------|------|
| `/mentors` ページルート | **存在しない**（ディレクトリ削除済み） |
| `/mentors` URL | `next.config.mjs` で `/people` に 301 リダイレクト |
| `/mentors` ナビリンク | **存在しない** |
| `ow_mentors` テーブル | **削除済み**（migration 140） |
| `ow_mentor_reservations` テーブル | **再作成済み**（migration 197、FK は `ow_company_admins` に変更） |
| `/api/mentor-reservations` | **削除済み**（2026-06-21） |
| `/people` ページルート | **実装済み・稼働中** |
| `/people` ナビリンク | Header・MobileBottomNav に「ユーザー」として存在 |
| アンバサダー機能 | `ow_company_admins.is_ambassador` で制御、admin UIあり |
| ピア機能（`can_talk_to_candidates`） | `ow_users.can_talk_to_candidates` で制御、実装済み |
| `/admin/mentors` リンク | **dead link**（ディレクトリ存在しない） |
| `src/lib/supabase/queries.ts` メンター関数 | **dead code**（テーブル削除済み） |
| `/terms/mentor/page.tsx` | 存在するがナビリンクなし |

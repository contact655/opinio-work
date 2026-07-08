# 「話せますよラベル」機能 実装前調査レポート
作成: 2026-07-08

---

## 1. メンター関連の現状と廃止影響

### 1-1. メンター概念の現状

**Migration 140 で ow_mentors テーブルは既に削除済み。**
`supabase/migrations/140_drop_mentor_tables.sql` で以下を全て DROP:
- `ow_mentor_reservations`（当時）
- `ow_mentor_categories`
- `ow_consultation_requests`
- `ow_consultations`
- `ow_mentors`

つまり「メンター」は DB レベルでは**すでに廃止済み**。

廃止後の代替設計として以下が整備されている:
- **`ow_company_admins.is_ambassador`** — 企業の人事・社員が「話せる人」として登録される（Migration 前後で実装）
- **`ow_company_admins.talk_themes`** — 話せるテーマ（Migration 201）
- **`/people` ページ** — ambassador 一覧（`src/app/(jobseeker)/people/page.tsx`）
- **`ow_mentor_reservations` 再作成**（Migration 197）— 名称は mentor だが FK は `ow_company_admins.id`（ambassador_id）を参照する。実質「アンバサダーへの相談予約」テーブル

**現在コードに残っている "mentor" 文字列の正体:**

| 参照箇所 | 実態 |
|---------|------|
| `src/lib/supabase/queries.ts` の `ow_mentors` クエリ（L744-790） | `getJobAlumniMap()` 内で求人カードに「先輩X名」表示するために参照。テーブルが存在しなければ silent error（空配列扱い）になり UI は壊れない |
| `src/lib/supabase/public.ts` | 型定義のみ、実際の SELECT なし |
| `src/lib/supabase/types.ts` | 型定義のみ |
| `ow_users.is_mentor` | フラグカラムは DB 上は残存（migration 140 は削除しなかった）。`/admin/candidates` と `/admin/page.tsx` でカウント表示に使用。`can_casual_meeting` の初期 backfill にも使用（migration 160） |
| `src/app/terms/mentor/page.tsx` | メンター利用規約ページ。UI として /terms/mentor に存在するが、ナビからのリンクは現在未確認 |

### 1-2. Dead code 候補

| ファイル | 判定 | 理由 |
|---------|------|------|
| `src/lib/supabase/queries.ts` L738-792 の `ow_mentors` クエリブロック | **dead code 候補** | `ow_mentors` テーブルは migration 140 で削除済み。クエリは失敗し空配列を返す |
| `src/app/mypage/mockMypageData.ts` の `isMentor` | mock データ | mock なので影響小 |
| `src/app/terms/mentor/page.tsx` | 要判断 | 利用規約として残すか廃止するかはビジネス判断 |
| `ow_users.is_mentor` カラム | **不要候補** | ambassador に移行済み。admin での表示のみに使われるが、実態は ambassador が役割を引き継いでいる |

### 1-3. 廃止した場合の影響

以下は **廃止しても安全**:
- `queries.ts` の `ow_mentors` クエリブロック（失敗を silent に処理中）
- `ow_users.is_mentor` フラグ（admin 表示のみ）

以下は **ambassador で代替済み**（廃止不要・既に切り替わっている）:
- `/people` ページ → `ow_company_admins.is_ambassador` 一覧に完全移行
- 予約フロー → `ow_mentor_reservations`（migration 197、ambassador_id 参照）

---

## 2. プロフィール公開設定・フラグの現状

### 2-1. ow_users の意思表示フラグ一覧

| カラム | 型 | 誰が設定 | 意味 |
|-------|---|---------|------|
| `visibility` | text ('public'/'login_only'/'private') | 本人（profile/edit） | プロフィールの公開範囲 |
| `is_open_to_work` | boolean | 本人（profile/edit） | 「転職検討中」バッジ表示 |
| `can_casual_meeting` | boolean | **管理者のみ**（admin/candidates） | カジュアル面談ボタンの表示可否 |
| `is_mentor` | boolean | 管理者 | 旧メンター制度の名残（ambassador に移行済み） |

**キーポイント:**
- `is_open_to_work` → 本人がオン/オフ可能（profile/edit のアカウント設定タブに既存のトグル UI あり）
- `can_casual_meeting` → **管理者が付与するフラグ**。本人は変更不可（admin/candidates の `CanCasualMeetingToggle` で admin が操作）

### 2-2. ProfileEditClient の既存トグル UI

`src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` L4382 付近に完成品のトグルスイッチがある:

```tsx
<button
  type="button"
  role="switch"
  aria-checked={settings.isOpenToWork}
  onClick={() => setSettings((prev) => ({ ...prev, isOpenToWork: !prev.isOpenToWork }))}
  style={{
    width: 44, height: 24, borderRadius: 100,
    background: settings.isOpenToWork ? "var(--success)" : "var(--line)",
    border: "none", cursor: "pointer", position: "relative",
    transition: "background 0.2s",
  }}
>
  ...
</button>
```

このパターンを今回の「話せますよ」ラベルにそのまま流用できる。
「転職検討中」トグルは「アカウント設定」タブ（Section 3）に配置済み。
同タブに「話せますよ」トグルを追加するのが自然。

### 2-3. 新フラグ追加の要否

**新フラグが必要**。既存カラムでは代替不可:

| 新フラグ | 付与場所 | 対応テーブル |
|---------|---------|------------|
| `can_talk_to_candidates` (①他の候補者と話してOK) | 本人が自分でオン | `ow_users` にカラム追加 |
| `can_talk_to_hr` (②企業の人事と話してOK) | 本人が自分でオン | `ow_users` にカラム追加 |

`can_casual_meeting` は「管理者が個別に許可するフラグ」で設計上異なる。
`is_open_to_work` は「転職検討中」の意思表示で意味が異なる。

---

## 3. 候補者向け一覧画面の有無

### 3-1. 現状の /people ページ

**`/people` ページは「話せる人（ambassador）」一覧であり、候補者一覧ではない。**

- 対象: `ow_company_admins.is_ambassador = true` の企業担当者・社員
- 閲覧者: 全ユーザー（認証不要）
- 機能: 企業・役職・テーマでフィルタリング

候補者（求職者）が他の候補者を見る画面は**現状存在しない**。

### 3-2. 候補者が候補者を見る導線の有無

- `/u/[id]` 公開プロフィールは存在するが、一覧への入口がない（直リンクのみ）
- `/companies/[id]` の CurrentEmployeesSection・AlumniSection は、その企業の在籍者・OB一覧（一般候補者の探索画面ではない）
- 候補者が全候補者を横断検索できる画面は**ゼロ**

### 3-3. ① フィルタの置き場所案

①「他の候補者と話してOK」フィルタを置く画面を**新規作成する必要がある**。

候補案:
- **A: `/people` ページに「候補者」タブを追加** — ambassador（企業人事）と並列して「候補者と話せる人」タブを作る。URL は `/people?tab=peers`
- **B: `/community` 等の新ページ** — 完全に独立したページ。将来コミュニティ機能に育てやすい
- **C: 現状保留** — ②（企業向け）だけ先に実装し、①は後回し

**推奨: A**。`/people` は既に「話せる人を探す」文脈で確立しており、候補者×候補者の接点もその延長線上にある。新規 URL を増やさずに済む。

---

## 4. /biz/candidates の現状と ② フィルタ追加の可否

### 4-1. サーバー側クエリの現状

`src/app/biz/candidates/page.tsx` のデータ取得:

```
ow_users: id, name, location, is_mentor, created_at, auth_id
  WHERE visibility = 'public'
  LIMIT 500

ow_profiles (admin client): user_id, onboarding_completed, desired_work_style,
  job_type, desired_phase, transfer_timing

ow_experiences: user_id, role_title, company_text, company_anonymized
  WHERE is_current = true
```

CandidatesClient に渡す候補者オブジェクト:
```typescript
{ id, name, location, isMentor, currentRole, currentCompany,
  jobType, workStyle, desiredPhase, transferTiming, onboardingCompleted, createdAt }
```

### 4-2. ② フィルタ追加の実現可否

**十分に実現可能**。

`can_talk_to_hr` フラグを `ow_users` に追加すれば:
1. `page.tsx` の SELECT に `can_talk_to_hr` を追加
2. candidates オブジェクトに `canTalkToHr: boolean` を追加
3. `CandidatesClient.tsx` にトグルフィルタ（「話してOKのみ表示」）を追加

既存のフィルタ構造（chip/toggle）との整合性も高い。

企業が候補者にコンタクトを取る導線として現状あるのは:
- `/u/[id]` の `can_casual_meeting=true` のとき表示されるカジュアル面談ボタン（企業経由）
- DM スタート（`/api/dm/start`）— 存在するが UI からの導線が限定的

「話してOK」フラグを選択した場合、DM スタートや予約フローへの導線を `/u/[id]` に追加すると②の「受け皿」になる。

---

## 5. 全体設計の叩き台

### 5-1. DB に追加するもの

**Migration A: ow_users に 2 カラム追加**

```sql
ALTER TABLE ow_users
  ADD COLUMN IF NOT EXISTS can_talk_to_candidates BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_talk_to_hr BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ow_users.can_talk_to_candidates IS
  '①本人が設定。他の候補者に話しかけられることを許可する。';
COMMENT ON COLUMN ow_users.can_talk_to_hr IS
  '②本人が設定。企業の人事担当者に話しかけられることを許可する。';
```

RLS: 本人が自分のレコードを UPDATE できれば十分（既存 ow_users の self-update ポリシーを確認してから適用）。

### 5-2. UI をどこに置くか（プロフィール編集）

`src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` の **Section 3「アカウント設定」タブ** に、`is_open_to_work` トグルと同じパターンで 2 つのトグルを追加:

```
転職検討中          [既存トグル]

① 他の候補者と話してOK   [新トグル]
「同じような立場の候補者からの話しかけを受け付けます」

② 企業の人事と話してOK   [新トグル]
「企業の人事担当者からの話しかけを受け付けます（面談依頼が届きます）」
```

**API の変更:**
`/api/jobseeker/profile/route.ts` の `allowed` 配列に `can_talk_to_candidates` と `can_talk_to_hr` を追加するだけ。

### 5-3. ① 候補者向けフィルタの実装案（新タブ or 新ページ）

**推奨: `/people` に「候補者と話せる人」タブを追加**

`/people/page.tsx` を拡張:
- `tab=peers` のとき `ow_users.can_talk_to_candidates = true` の候補者一覧を表示
- tab なし（デフォルト）は既存の ambassador 一覧
- `PeopleListClient.tsx` にタブ切り替え UI を追加

候補者一覧カードには: 名前・職種・テーマ（自由記述）・`/u/[id]` へのリンク

### 5-4. ② 企業向けフィルタの実装案

**`/biz/candidates` に「話してOKのみ」トグルフィルタを追加:**

```tsx
// CandidatesClient のフィルタ Row 1 付近に追加
<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
  <input
    type="checkbox"
    checked={talkToHrOnly}
    onChange={(e) => setTalkToHrOnly(e.target.checked)}
  />
  <span style={{ fontSize: 12 }}>話してOKのみ</span>
</label>
```

`/biz/candidates/page.tsx` で `can_talk_to_hr` を SELECT に追加し candidates に含める。

**企業側の「話す」受け皿:**
現状 `can_casual_meeting=true` かつ `isCurrentCompanyKnown` のときのみカジュアル面談ボタンが表示される（`/u/[id]`）。
`can_talk_to_hr=true` の場合は別のフロー（DM / 予約）が必要になる可能性があるが、既存の予約フロー（`ow_mentor_reservations`、migration 197）を再利用できる。

### 5-5. 実装分割案（コミット単位）

| # | コミット内容 | リスク |
|---|------------|--------|
| 1 | Migration: `ow_users` に `can_talk_to_candidates` / `can_talk_to_hr` 追加 | 低（カラム追加のみ） |
| 2 | ProfileEditClient: 2つのトグル追加 + `/api/jobseeker/profile` 更新 | 低（既存パターンの複製） |
| 3 | `/u/[id]`: `can_talk_to_hr=true` のとき「話しかける」ボタン表示 | 低〜中（導線設計が必要） |
| 4 | `/biz/candidates`: `can_talk_to_hr` フィルタ追加（page.tsx + Client） | 低（今日やったフィルタ追加と同パターン） |
| 5 | `/people` にタブ追加（① 候補者同士の一覧） | 中（新機能ページ、フィルタ設計が必要） |

**推奨順序**: 1→2→4→3→5（企業側から先に整備、候補者向け一覧は後）

### 5-6. 想定リスク・注意点

**① `can_casual_meeting` との混在リスク**
- 現在 `/u/[id]` のカジュアル面談ボタンは `can_casual_meeting=true`（管理者付与）が必要
- `can_talk_to_hr=true`（本人設定）の人が企業から話しかけられる導線を新設すると、2種類の「話せる」フラグが共存する
- 設計上の整合性を保つため、将来的に `can_casual_meeting` を廃止して `can_talk_to_hr` に一本化する方針を検討すべき

**② /people ページへの影響**
- ambassador（企業担当者）と候補者の一覧を同一ページに混在させると、訪問者が混乱しやすい
- タブ切り替えで明確に分ければ問題ないが、page タイトル・description の調整が必要

**③ RLS の確認が必要**
- `ow_users` の self-update ポリシーが `can_talk_to_candidates` / `can_talk_to_hr` の UPDATE を許可するか確認
- `/api/jobseeker/profile` の PUT が `allowed` リストでホワイトリスト管理されているため、そこへの追加だけで OK（パッチ当てやすい）

**④ スパム・悪用リスク**
- 「話してOK」フラグを立てた候補者に対して無差別に連絡が来るリスク
- 当面は既存の予約フロー（編集部が仲介する `ow_mentor_reservations`）を経由させることで緩和できる
- 「直接 DM」は後回しにするのが安全

**⑤ メンター用語の残存**
- `ow_mentor_reservations` テーブル（migration 197）の変数名・コメントに "mentor" が残っているが、実態は ambassador への予約テーブル
- 新機能実装時に混乱しないよう、ファイル内コメントの整理を同時に行うと良い

---

## まとめ

| 確認事項 | 結論 |
|---------|------|
| メンター廃止の現状 | DB（ow_mentors）は既に削除済み。ambassador に移行完了 |
| dead code | queries.ts の ow_mentors クエリブロック、ow_users.is_mentor |
| 新フラグの要否 | **必要**。ow_users に 2 カラム追加（can_talk_to_candidates / can_talk_to_hr） |
| ProfileEdit の既存 UI | is_open_to_work トグルがそのまま流用できる |
| ① の置き場所 | /people にタブ追加（新規ページより自然な文脈） |
| ② の追加可否 | /biz/candidates に簡単に追加可能（フィルタ構造が整備済み） |
| 最大リスク | can_casual_meeting（管理者付与）との二重管理化 |

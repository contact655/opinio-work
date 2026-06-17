# キャリアSNS転換 — データ設計提案

> **ステータス: 設計提案文書（実装禁止）**  
> ベース調査: `docs/audit/current-state-report.md`（2026-06-17 時点、commit `87d688f`）  
> 現在の最大マイグレーション番号: **172**（次は 173 から）

---

## 0. 設計方針

### 基本思想
- **「とりあえず全カラム追加」禁止。最小で最大の価値を出す設計**を志向する。
- 年収・転職理由はセンシティブ情報。**RLS と visibility 設計を全設計の前提**に置く。
- `ow_mentors` の構造的断絶（user_id 全件 NULL）を放置したまま SNS 化しない。
- 既存の採用フロー（`ow_conversations`）は壊さない。

### visibility の共通定義（全テーブルで統一）

| 値 | 意味 | 閲覧できる対象 |
|----|------|--------------|
| `public` | 完全公開 | 未ログイン含む全員 |
| `login_only` | 登録者限定 | ログイン済みユーザーのみ |
| `private` | 非公開 | 本人のみ |

> **「登録ゲート」設計との接続**: `login_only` データは非ログイン時にブラー表示し、登録後に解除するパターンに直結する。転職理由はデフォルト `login_only` とし、「なぜ転職したか」を登録の動機に据える。

---

## 1. 設計A — 年収推移

### 現状のギャップ
`ow_experiences` に salary カラムが存在しない。「27歳で転職→年収+150万」のような推移の表現が不可能。

---

### 案 A-1: `ow_experiences` にサラリーカラムを追加

```sql
-- Migration 173 (予定番号)
ALTER TABLE ow_experiences
  ADD COLUMN salary_min       INTEGER,          -- 万円単位（税前）
  ADD COLUMN salary_max       INTEGER,          -- 万円単位（税前）
  ADD COLUMN salary_visibility TEXT NOT NULL
               DEFAULT 'private'
               CHECK (salary_visibility IN ('public', 'login_only', 'private'));
```

**データ意味**: その「経験期間」での年収帯。転職のたびに1レコード存在するので、`ow_experiences` を時系列で見れば自動的に「年収推移」になる。

| メリット | デメリット |
|---------|-----------|
| 既存スキーマに乗る。移行コスト最小 | 同一企業内での昇給・降格を表現できない |
| `ow_experiences.started_at` と組み合わせると「何歳でいくら」がそのまま計算できる | `salary_min/max` がない時期（入社後すぐ等）の扱いが曖昧 |
| UI: CareerHistoryEditor に salary 入力欄を追加するだけで完結 | 「推移のグラフ」を描くには `salary_min` がある経験のみでフィルタが必要 |

---

### 案 A-2: 別テーブル `ow_career_milestones` で独立管理

```sql
-- Migration 173 (予定番号)
CREATE TABLE ow_career_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  experience_id    UUID REFERENCES ow_experiences(id) ON DELETE SET NULL,
  -- experience_id NULL = 特定の経験に紐づかない独立マイルストーン
  occurred_at      DATE NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'joined',      -- 入社時年収
                     'promoted',    -- 昇給・役職変更
                     'transferred', -- 異動
                     'left'         -- 退職時年収
                   )),
  salary_min       INTEGER,         -- 万円単位
  salary_max       INTEGER,
  salary_visibility TEXT NOT NULL DEFAULT 'private'
                   CHECK (salary_visibility IN ('public', 'login_only', 'private')),
  memo             TEXT,            -- 「この転職でX社のオファーが条件面で決め手だった」等の補足
  memo_visibility  TEXT NOT NULL DEFAULT 'private'
                   CHECK (memo_visibility IN ('public', 'login_only', 'private')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ow_career_milestones ENABLE ROW LEVEL SECURITY;

-- SELECT: visibility に応じて段階制御
CREATE POLICY "salary_select" ON ow_career_milestones FOR SELECT USING (
  user_id = auth.uid()                          -- 本人は常に閲覧可
  OR salary_visibility = 'public'               -- public は全員
  OR (salary_visibility = 'login_only' AND auth.uid() IS NOT NULL)  -- login_only はログイン者
);

-- INSERT/UPDATE/DELETE: 本人のみ
CREATE POLICY "salary_write" ON ow_career_milestones FOR ALL USING (user_id = auth.uid());
```

| メリット | デメリット |
|---------|-----------|
| 同一企業内の昇給・降格も時系列で表現できる | テーブルが増える |
| `event_type` で転職・昇給・退職を区別できる | ユーザーへの入力負荷が高い（「どのイベントか」を選ばせる必要がある） |
| 将来的に「30代前半の中央値年収」統計等に使えるデータ構造 | `experience_id` との整合性管理が必要 |
| `memo` + `memo_visibility` で意思決定のメモも残せる | 実装コスト: CareerHistoryEditor の大幅改修が必要 |

---

### 案 A-3（Claude Code 提案）: A-1 + オプショナルな昇給記録

**推奨案。**

A-1 の `ow_experiences` にサラリーカラムを追加し（転職時年収を最小コストで取得）、将来必要になった段階で A-2 の `ow_career_milestones` を追加する 2 段階アプローチ。

```
フェーズ1（今回の提案範囲）: ow_experiences に salary_min / salary_max / salary_visibility を追加
フェーズ2（将来）: ow_career_milestones を追加して昇給履歴の詳細追跡を可能に
```

**理由**:
- 「転職のたびに年収が変わる」という最頻値ユースケースは A-1 で 100% カバーできる。
- 入社後の昇給履歴は SNS の文脈では「チラ見せ」程度の価値しかなく、登録負担が大きい。
- 「シード→シリーズA→上場で年収がどう変わったか」の統計は A-1 のデータだけで計算可能。

**表示レンジ制御の実装方針**:

```
salary_visibility = 'public'     → 実数表示（「450〜550万円」）
salary_visibility = 'login_only' → ログイン後に解除（ブラー表示）
salary_visibility = 'private'    → 「非公開」アイコンのみ表示
```

---

## 2. 設計B — 転職理由 / キャリアの意思決定ストーリー

### 現状のギャップ
「なぜ選んだか / なぜ辞めたか」のデータがどこにも存在しない。ここが登録ゲートの目玉になる情報。

### 推奨テーブル: `ow_career_stories`

```sql
-- Migration 174 (予定番号)
CREATE TABLE ow_career_stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  experience_id   UUID NOT NULL REFERENCES ow_experiences(id) ON DELETE CASCADE,
  story_type      TEXT NOT NULL CHECK (story_type IN (
                    'why_join',   -- なぜこの会社を選んだか
                    'why_leave',  -- なぜ辞めたか
                    'what_learned' -- 何を得たか（オプション）
                  )),
  content         TEXT NOT NULL,  -- 本文（200〜1000文字程度を想定）
  visibility      TEXT NOT NULL DEFAULT 'login_only'
                  CHECK (visibility IN ('public', 'login_only', 'private')),
  is_moderated    BOOLEAN NOT NULL DEFAULT false,
  -- is_moderated=true: 管理者が確認済み（特定コンテンツへのフラグではなく、品質確認済みの印）
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ow_career_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON ow_career_stories FOR SELECT USING (
  user_id = auth.uid()
  OR visibility = 'public'
  OR (visibility = 'login_only' AND auth.uid() IS NOT NULL)
);

CREATE POLICY "stories_write" ON ow_career_stories FOR ALL USING (user_id = auth.uid());

-- 1経験 × 1story_type につき1レコードのみ
CREATE UNIQUE INDEX ow_career_stories_uniq
  ON ow_career_stories(experience_id, story_type);
```

### 設計の論点

**Q: `ow_experiences` に TEXT カラム追加するだけでは駄目か？**

> NG。理由は以下:
> 1. `visibility` を experience 全体ではなくストーリー単位で制御したい（「職歴は公開、でも退職理由は login_only」が普通）
> 2. 将来的に `why_join` と `why_leave` を別々に表示したり、`what_learned` を追加する拡張に対応できない
> 3. 管理者が「ストーリーのみ」モデレーションするユースケースに対応できる（`is_moderated` フラグ）

**公開範囲のデフォルト推奨**:

| story_type | デフォルト visibility | 理由 |
|-----------|---------------------|------|
| `why_join` | `login_only` | 登録ゲートの目玉。「なぜ選んだか」は比較的ポジティブで公開しやすいが、登録障壁に使いたい |
| `why_leave` | `login_only` | 退職理由はセンシティブ。未ログイン閲覧は不可とすべき |
| `what_learned` | `public` | 比較的ポジティブな学びの共有は公開でも問題少ない |

---

## 3. 設計C — フォロー / つながり関係

### 推奨テーブル: `ow_follows`

```sql
-- Migration 175 (予定番号)
CREATE TABLE ow_follows (
  follower_id   UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)  -- 自己フォロー禁止
);

-- インデックス（フォロワー一覧・フォロー中一覧の両方向クエリを高速化）
CREATE INDEX ow_follows_follower_idx  ON ow_follows(follower_id);
CREATE INDEX ow_follows_following_idx ON ow_follows(following_id);

-- RLS
ALTER TABLE ow_follows ENABLE ROW LEVEL SECURITY;

-- SELECT: フォロー関係は全員閲覧可（誰がフォローしているか）
-- ただし、将来 visibility='private' を持つユーザーへのフォローは制限を検討
CREATE POLICY "follows_select" ON ow_follows FOR SELECT USING (true);

-- INSERT: ログイン済みユーザーが自分のフォローを作成
CREATE POLICY "follows_insert" ON ow_follows FOR INSERT WITH CHECK (follower_id = auth.uid());

-- DELETE: 自分のフォローのみ削除（アンフォロー）
CREATE POLICY "follows_delete" ON ow_follows FOR DELETE USING (follower_id = auth.uid());
```

### フォロワー数カウントの持ち方

**方針: ビューやカウントカラムは持たず、COUNT クエリで都度取得（現状の規模では十分）**

```sql
-- フォロワー数
SELECT COUNT(*) FROM ow_follows WHERE following_id = :user_id;

-- フォロー数
SELECT COUNT(*) FROM ow_follows WHERE follower_id = :user_id;

-- 相互フォロー判定（AとBが相互フォロー中か）
SELECT EXISTS(
  SELECT 1 FROM ow_follows WHERE follower_id = :a AND following_id = :b
) AS a_follows_b,
EXISTS(
  SELECT 1 FROM ow_follows WHERE follower_id = :b AND following_id = :a
) AS b_follows_a;
```

**将来スケールした場合の選択肢**（要判断 — 今は実装しない）:
- Option X: `ow_users` に `follower_count INT`, `following_count INT` を追加し、トリガーで更新
- Option Y: マテリアライズドビューを1分ごとにリフレッシュ
- Option Z: Redis カウンタ（Supabase Edge Functions 経由）

> **今は Option X/Y/Z 全て実装しない。** フォロー数が 100 万を超えるまで COUNT で十分。

### フィードとの接続（設計のみ、実装は別タスク）

フォロー関係ができれば、`/feed` の `ow_posts` クエリを以下に変更できる:

```sql
-- 「フォローしているユーザーの投稿のみ表示」クエリ例
SELECT p.* FROM ow_posts p
WHERE p.user_id IN (
  SELECT following_id FROM ow_follows WHERE follower_id = auth.uid()
)
ORDER BY p.created_at DESC
LIMIT 20;
```

---

## 4. メンター機能の統合方針

### 現状の問題（調査レポート §8①）

```
ow_mentors.user_id → 全件 NULL（実質断絶）
ow_mentors.current_role → 全件 "supabase_read_only_user"（バグ）
ow_users.is_mentor → アプリ側フラグ（13名）
```

メンター情報は `ow_mentors` に、アカウント情報は `ow_users` にあり、JOIN できない状態。

### 推奨方針: `ow_users` への属性統合（`ow_mentors` 段階的廃止）

「特別なメンター」を廃止し、**全ユーザーが等しくキャリアを公開し話を聞ける**思想への転換に合致する。

#### ステップ 1: `ow_users` にメンター属性カラムを追加

```sql
-- Migration 176 (予定番号)
ALTER TABLE ow_users
  ADD COLUMN mentor_bio          TEXT,
  ADD COLUMN mentor_themes       TEXT[],   -- question_tags に対応
  ADD COLUMN mentor_concerns     TEXT,     -- worries/concerns に対応
  ADD COLUMN mentor_is_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN mentor_display_order INTEGER;

-- 既存の is_mentor フラグはそのまま利用
-- mentor_is_available: 相談受付中かどうか（is_mentorとは分離。is_mentor=trueでもis_available=falseは「受付停止」）
```

#### ステップ 2: `ow_mentors` → `ow_users` へのデータ移行

```sql
-- Migration 177 (予定番号)
-- ow_mentors の既存 13 名データを ow_users に移植
-- ※ ow_mentors.user_id が全件 NULL のため、name による照合が必要

-- 例: 柴久人の場合
UPDATE ow_users
SET
  mentor_bio          = (SELECT bio FROM ow_mentors WHERE name = '柴久人'),
  mentor_themes       = (SELECT question_tags FROM ow_mentors WHERE name = '柴久人'),
  mentor_concerns     = (SELECT concerns FROM ow_mentors WHERE name = '柴久人'),
  mentor_is_available = (SELECT is_available FROM ow_mentors WHERE name = '柴久人'),
  mentor_display_order= (SELECT display_order FROM ow_mentors WHERE name = '柴久人'),
  is_mentor           = true,
  -- photo_url は ow_users.avatar_url に統合（Storage パスは変更なし）
  avatar_url          = COALESCE(avatar_url, (SELECT photo_url FROM ow_mentors WHERE name = '柴久人'))
WHERE name = '柴久人';

-- 13名全員分の UPDATE を記述（名前マッチングが唯一の照合手段）
```

> **⚠️ 要判断**: 名前照合が唯一の手段のため、同姓同名の `ow_users` が存在する場合に誤移行が起きる。移行前に管理画面から手動紐づけ UI を提供する方が安全かもしれない。

#### ステップ 3: 参照箇所の変更（コード変更、別タスク）

| 変更箇所 | 現在 | 変更後 |
|---------|------|--------|
| `getMentors()` in `queries.ts` | `FROM ow_mentors` | `FROM ow_users WHERE is_mentor=true AND mentor_is_available=true` |
| `/mentors/[id]/page.tsx` | `ow_mentors.id` で参照 | `ow_users.id` で参照 |
| `CompanyMentorsSection` | `ow_mentors.current_company ILIKE` | `ow_experiences.company_id` で正確に照合（精度向上） |
| `ow_mentor_reservations.mentor_id` | FK → `ow_mentors.id` | FK → `ow_users.id` に変更が必要（**破壊的変更**） |

#### ステップ 4: `ow_mentor_reservations` の FK 変更（最も慎重に）

```sql
-- Migration 178 (予定番号) — 破壊的変更
-- 現在: ow_mentor_reservations.mentor_id → ow_mentors.id
-- 目標: ow_mentor_reservations.mentor_id → ow_users.id

-- 現在の予約データは 0 件のため、データロスは発生しない
ALTER TABLE ow_mentor_reservations
  DROP CONSTRAINT ow_mentor_reservations_mentor_id_fkey,
  ADD CONSTRAINT ow_mentor_reservations_mentor_id_fkey
    FOREIGN KEY (mentor_id) REFERENCES ow_users(id) ON DELETE CASCADE;
```

> **前提条件**: `ow_mentor_reservations` の件数が 0 件（現状確認済み）であるため、FK 変更時のデータ損失リスクはない。本番で予約が入り始めた後は、この変更に移行スクリプトが必要になる。

#### ステップ 5: `ow_mentors` テーブルの廃止（最終）

```sql
-- Migration 179 (予定番号) — 最終段階
-- コードから ow_mentors 参照が完全に除去されたことを確認後に実行
DROP TABLE ow_mentors;
```

> **⚠️ 廃止のタイミング**: コード変更（ステップ 3）が完了し、Vercel デプロイ後に実行。DROP は一度行うと取り消せないため、バックアップとして `ow_mentors_backup` にコピーしてから DROP することを推奨。

### 既存データの保全手順（まとめ）

```
1. ow_mentors の全データを ow_users に移植（Migration 177）
2. コードを ow_users 参照に変更してデプロイ
3. 1週間本番観察（エラーがないことを確認）
4. ow_mentor_reservations FK 変更（Migration 178）
5. さらに1週間観察
6. ow_mentors DROP（Migration 179）
```

---

## 5. DM基盤の方針

### 現状の問題（調査レポート §8⑤）

`ow_conversations` は `candidate_user_id, mentor_user_id, company_id, kind` というスキーマで採用面談専用。SNS のユーザー間フリー DM には構造的に不適。

### 推奨テーブル: `ow_direct_messages`（新設）

```sql
-- Migration 180 (予定番号)
CREATE TABLE ow_direct_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES ow_users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CHECK (sender_id != recipient_id)  -- 自己DMを禁止
);

-- インデックス（DM 一覧取得を高速化）
CREATE INDEX ow_dm_sender_idx    ON ow_direct_messages(sender_id, created_at DESC);
CREATE INDEX ow_dm_recipient_idx ON ow_direct_messages(recipient_id, created_at DESC);

-- RLS
ALTER TABLE ow_direct_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: 送信者または受信者のみ閲覧可
CREATE POLICY "dm_select" ON ow_direct_messages FOR SELECT USING (
  sender_id = auth.uid() OR recipient_id = auth.uid()
);

-- INSERT: 送信者 = 自分のみ
CREATE POLICY "dm_insert" ON ow_direct_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
);

-- UPDATE: 自分が受信したメッセージの is_read のみ変更可
CREATE POLICY "dm_update_read" ON ow_direct_messages FOR UPDATE USING (
  recipient_id = auth.uid()
) WITH CHECK (
  recipient_id = auth.uid()
  -- is_read のみ変更可能。content の変更はアプリ層で禁止
);

-- DELETE: 送信者のみ削除可（"送信取り消し"）
CREATE POLICY "dm_delete" ON ow_direct_messages FOR DELETE USING (
  sender_id = auth.uid()
);
```

### `ow_conversations` との棲み分け

| 用途 | テーブル | kind / 区別方法 |
|------|---------|---------------|
| カジュアル面談申込・採用面談 | `ow_conversations` + `ow_messages` | `kind = 'casual_meeting' / 'job_application'` |
| ユーザー間フリーDM（SNSのDM） | `ow_direct_messages` | 新設、採用文脈なし |
| メンター相談（現在は `ow_conversations kind='direct_message'` で転用中） | 移行後: `ow_direct_messages` | Migration 170 の応急処置を解消 |

> **⚠️ 要判断**: Migration 170 で `ow_conversations kind='direct_message'` として応急実装されたメンター相談 DM をどのタイミングで `ow_direct_messages` に移行するか。既存の会話データが存在する場合は移行スクリプトが必要。

### リアルタイム対応
`ow_direct_messages` も `ow_messages` と同様に Supabase Realtime（`supabase.channel().on('INSERT', ...)`) で対応可能。既存の `/mypage/conversations/[id]` のリアルタイム実装パターンをそのまま流用できる。

---

## 6. 既存テーブル・既存マイグレーションとの整合性

### マイグレーション番号計画

| 番号 | 内容 | 依存 |
|------|------|------|
| 173 | `ow_experiences` に `salary_min / salary_max / salary_visibility` 追加 | なし |
| 174 | `ow_career_stories` テーブル作成 | `ow_experiences` (173以前から存在) |
| 175 | `ow_follows` テーブル作成 | `ow_users` (既存) |
| 176 | `ow_users` に `mentor_*` カラム追加 | なし |
| 177 | `ow_mentors` → `ow_users` データ移行 SQL | 176 完了後 |
| 178 | `ow_mentor_reservations.mentor_id` FK 変更 | 177 完了・コード変更デプロイ後 |
| 179 | `ow_mentors` DROP（コードから参照除去後） | 178 完了後 |
| 180 | `ow_direct_messages` テーブル作成 | `ow_users` (既存) |

### 既存テーブルへの影響

| テーブル | 変更 | 影響 |
|---------|------|------|
| `ow_experiences` | salary 3カラム追加 | CareerHistoryEditor の入力欄追加が必要 |
| `ow_users` | mentor_* 5カラム追加 | 後方互換（nullable, default付き） |
| `ow_mentors` | 段階的廃止 | getMentors(), `/mentors/*` の変更が必要 |
| `ow_mentor_reservations` | FK 変更 | 予約件数0件のため移行データなし |
| `ow_conversations` | 変更なし | 採用フロー専用として維持 |

### 既存マイグレーションとの重複確認
- 172 まで使用済み → **173 から開始**（重複なし）
- Migration 161 (`ow_posts`, `ow_post_likes`, `ow_post_comments`) は今回の設計と独立しており競合なし
- Migration 170 (DM RLS fix) は `ow_conversations` の修正。`ow_direct_messages` とは別テーブルのため競合なし

---

## 7. データ移行が必要な箇所と手順の概要

### 移行が必要な箇所

**① `ow_mentors` → `ow_users` 属性移行**

| フィールド | ow_mentors | 移行先 ow_users |
|-----------|-----------|----------------|
| `bio` | `mentor_bio` | `mentor_bio` (新カラム) |
| `catchphrase` | `catchphrase` | `catchphrase` (既存) |
| `photo_url` | `photo_url` | `avatar_url` (既存、NULLのみ上書き) |
| `question_tags` | `TEXT[]` | `mentor_themes` (新カラム) |
| `concerns` | `TEXT` | `mentor_concerns` (新カラム) |
| `is_available` | `BOOLEAN` | `mentor_is_available` (新カラム) |
| `display_order` | `INTEGER` | `mentor_display_order` (新カラム) |
| `roles` | `TEXT[]` | → ow_experiences.role_category_id で代替（重複データのため移行不要） |
| `current_company` | "supabase_read_only_user"（バグ） | → ow_experiences.company_id で代替（移行不要） |
| `current_role` | "supabase_read_only_user"（バグ） | → ow_experiences.role_category_id で代替（移行不要） |

**照合方法**: `ow_mentors.name` と `ow_users.name` を突合（13名全員を手動確認推奨）

**② `ow_mentor_reservations.mentor_id` FK 変更**

```
現在: mentor_id → ow_mentors.id (UUID)
目標: mentor_id → ow_users.id (UUID)
```

`ow_mentors.id` と `ow_users.id` は別の UUID を持つため、**直接の値変換は不可能**。
正しい手順:

```sql
-- 1. migration_mapping テーブルを作成（mentor_id の新旧対応表）
CREATE TEMP TABLE mentor_id_mapping AS
SELECT
  m.id AS old_mentor_id,
  u.id AS new_user_id
FROM ow_mentors m
JOIN ow_users u ON u.name = m.name; -- 名前照合

-- 2. ow_mentor_reservations の mentor_id を更新
UPDATE ow_mentor_reservations r
SET mentor_id = mm.new_user_id
FROM mentor_id_mapping mm
WHERE r.mentor_id = mm.old_mentor_id;

-- 3. FK 制約の張り替え
-- (現在の予約件数が0件であれば、UPDATE ステップは事実上 no-op)
```

---

## 8. 実装する場合の推奨順序

### フェーズ1: 基盤（依存なし、リスク低）

```
Migration 173: ow_experiences に salary カラム追加
  → ユーザーが職歴編集画面で年収を入力できるようになる
  → 既存データへの影響なし（nullable カラムの追加のみ）

Migration 175: ow_follows テーブル作成
  → フォロー機能の UI 実装が可能になる
  → 既存テーブルへの影響なし

Migration 180: ow_direct_messages テーブル作成
  → ユーザー間 DM の実装が可能になる
  → 既存 ow_conversations には影響なし
```

### フェーズ2: コンテンツ（フェーズ1に依存）

```
Migration 174: ow_career_stories テーブル作成
  → 173 完了後（ow_experiences の存在が前提）
  → 「なぜ転職したか」の入力 UI を実装
```

### フェーズ3: メンター統合（最も慎重に、複数ステップ）

```
Migration 176: ow_users に mentor_* カラム追加
Migration 177: ow_mentors → ow_users データ移行
  → コードを ow_users 参照に変更してデプロイ
  → 1週間観察後
Migration 178: ow_mentor_reservations FK 変更
  → さらに1週間観察後
Migration 179: ow_mentors DROP（最終確認後）
```

### 推奨しない順序

- ❌ Migration 178（FK 変更）の前に Migration 177（データ移行）を飛ばす
- ❌ コードデプロイ前に `ow_mentors` を DROP する
- ❌ フェーズ3 を他のフェーズと並行して進める（メンター参照の切り替えは一度に行う）

---

## 9. この設計で対応「しない」と判断したこと（スコープ外の明示）

### A. 年収の「レンジ統計」機能

「〇〇歳の中央値年収」「〇〇会社の平均年収」等の統計ダッシュボードは今回スコープ外。
`ow_experiences.salary_min/max` のデータが蓄積された後の別フェーズで実装する。

### B. フォロー通知

`ow_follows` テーブル作成はするが、フォロー時の通知（プッシュ通知・メール通知）は含まない。
Supabase Realtime の `INSERT` トリガーで実装可能だが、通知インフラ整備が別タスクになる。

### C. ブロック機能

フォロー機能に付随するブロック（`ow_blocks` テーブル等）は今回提案しない。
SNS 運営上必要になるタイミングで別設計とする。

### D. 推薦コメント（Recommendation）

`RecommendationCard.tsx` / `RecommendationForm.tsx` コンポーネントは存在するが、バックエンドテーブルが未確認（`ow_recommendations` が存在するかどうか未調査）。
推薦コメントのデータ設計は別タスクとして分離する。

### E. `ow_career_milestones`（同一企業内の昇給履歴）

設計 A-2 として提示したが、**今回は実装しない**。A-1（`ow_experiences` へのカラム追加）で最大価値が出せると判断。

### F. pg_trgm / pgvector によるキャリア検索

「年収帯 × フェーズ × 職種」での人材検索はユースケースとして自然に想定されるが、インデックス設計が別の技術タスクになるため今回スコープ外。

### G. フィードのアルゴリズム化

`ow_follows` でフォロー基盤は整えるが、フォロー外のユーザーの投稿をどう推薦するか（「おすすめ」タブ相当）は今回設計しない。

---

## 10. 要判断事項（推測で確定しなかった点）

| 番号 | 論点 | 選択肢 |
|------|------|--------|
| J-1 | `ow_follows` の SELECT RLS: フォロワー数は全員に公開すべきか？ | A: 全公開（Twitter的） / B: ログイン者のみ（LinkedIn的） |
| J-2 | `ow_career_stories` の `is_moderated` フラグの運用: 誰が何をトリガーに確認するか | A: 初回投稿時に管理者通知 / B: 閲覧数一定以上でレビュー / C: 任意（管理者の手動確認のみ） |
| J-3 | `ow_mentors` → `ow_users` 移行時の名前照合: 同姓同名への対策 | A: 管理者が手動 UUID 紐づけ / B: 移行前に UI で本人確認 |
| J-4 | メンター相談の DM を `ow_direct_messages` に移行するタイミング | A: ow_mentors 廃止と同時 / B: 独立した別タスクとして先行 |
| J-5 | `ow_direct_messages` の content サイズ上限 | A: 1000文字 / B: 5000文字 / C: 制限なし |
| J-6 | 年収 `salary_min/max` の単位: 万円単位 INTEGER か、円単位 BIGINT か | 万円単位 INTEGER を推奨するが、国際対応（JPY 以外）を将来考えるなら通貨コード追加も要検討 |

---

*文書作成日: 2026-06-17*  
*作成者: Claude Code（設計提案のみ。実装・DB変更なし）*  
*次のアクション: 要判断事項（J-1〜J-6）をHisatoさんと確認の上、実装タスクへ移行*

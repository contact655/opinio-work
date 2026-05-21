# Claude Code 指示書：/mentors 一覧・詳細ページ実装（最終版）

## 0. プロジェクト前提（必ず確認）

- プロジェクトパス: `/Users/hisato/opinio-work/`
- Supabase project ref: `xtutnecqeamftygufxco`
- デプロイ: `git push origin main` → Vercel auto-deploy
- 安全ルール:
  - **このタスクは規模が大きいので、Phase 単位で都度報告・GO 確認すること**
  - 想定外動作が出たら停止して報告
  - 「〜のはず」禁止、事実確認してから進める
  - `npm run build` を push 前に必ず実行
- 完了後の handover は `docs/handover-YYYY-MM-DD.md` に記載

---

## 1. 戦略的位置付け

「キャリア意思決定インフラ」という north star における中核機能。

- ターゲット: IT/SaaS 業界で漠然としたキャリア不安を持つ 28〜38 歳
- 差別化: Wantedly / Green の「マッチング」ではなく、Opinio は「第三者相談 × 運営仲介」
- 哲学: 数字（マッチ度・実績数）を出さない、運営が責任を持って繋ぐ

---

## 2. 仕様（確定）

### 2.1 既存資産の活用方針（方針 Y: 段階的整理）

事前調査（前セッション）で判明した既存実装:

| 既存資産 | 取り扱い |
|---|---|
| `ow_mentors` テーブル | **活用継続**（廃止しない） |
| `ow_users.is_mentor` / `is_active_mentor` フラグ | **活用継続** |
| `ow_users.mentor_themes` | **活用継続**（メンター本人記述用） |
| `ow_mentors.success_count` / `total_sessions` | UI から削除、**DB は残す** |
| `ow_mentors.calendly_url` | UI から削除、**DB は残す**（将来の判断余地） |
| `ow_mentors.user_id` (nullable) | **NOT NULL 化マイグレーション**を新規作成 |

### 2.2 `/mentors` 一覧ページ

**構造**:

```
[1] ヒーロー
   - 大コピー: 「先輩に、相談する。」
   - サブコピー: 「30分の無料相談・Opinio 編集部が最適な先輩をご紹介します」
   - メンター数の数字表示は削除（揃うまで非表示）
   - 既存の「PdMからCPOに...」検索バーは削除（Phase 2 再検討）

[2] 悩みベースのセクション（主軸・カルーセル）
   - /companies のジャンル別カルーセル（GenreSection）と同じ構造
   - 各セクション: 悩みカテゴリ名 + メンターカード横並び
   - 最初は 4-6 固定カテゴリで開始（後述）

[3] 全メンター一覧
   - フィルタ: 職種 / 業種 / 相談テーマ（既存実装を活用）
   - グリッド表示
```

**「0 名」非表示ロジック**:
- 全体メンター数が 0 ならヒーローのみ表示し、[2] [3] を非表示
- 各悩みカテゴリで該当メンターが 0 ならそのセクションを非表示
- 「メンター 0 名」「相談 0 件」等の数字は一切出さない

### 2.3 悩みカテゴリ（初期セット）

新規マスタテーブル `ow_consultation_categories` を作成し、以下を初期データとして INSERT:

| slug | name | description |
|---|---|---|
| `career_direction` | キャリアの方向性に迷っている | 自分のキャリア軸を見つけたい |
| `market_value` | 自分の市場価値が知りたい | 今の自分の立ち位置を確認したい |
| `job_change_timing` | 転職するか迷っている | 動くべきタイミングを相談したい |
| `current_company` | 今の会社にいるべきか分からない | 残るか出るかの判断に迷っている |
| `side_business` | 副業/独立を考えている | 新しい働き方を模索したい |
| `relationship` | 人間関係/組織に悩んでいる | 上司・同僚・チームのことを話したい |

メンターと悩みカテゴリの紐付けは `ow_mentor_categories`（多対多）。
- メンター本人は `ow_users.mentor_themes` にフリーテキストで記述
- 編集部が後で `ow_mentor_categories` にカテゴリを紐付け（運用）

### 2.4 メンターカード（スペック型・既存 CompanyCardCompact と同トンマナ）

```
┌─────────────────────────┐
│ [アバター画像]           │
│                          │
│ 山田 太郎                │
│ メルカリ PM              │
│ 35歳 / 東京（年齢・居住地は任意）│
│                          │
│ 🗣 相談テーマ              │
│ 30代の転職、PM キャリア   │
│                          │
│ [この人に相談する]        │
└─────────────────────────┘
```

**表示するフィールド**:
- avatar_initial / avatar_color（既存）
- name
- current_company + current_role
- age（任意、ow_users から取得・存在すれば表示）
- location（任意）
- mentor_themes（ow_users.mentor_themes、配列の先頭 2-3 個）または question_tags

**表示しないフィールド**:
- success_count
- total_sessions
- calendly_url（直接予約させない）

### 2.5 `/mentors/[id]` 詳細ページ

```
[A] ヒーロー
   - 顔写真（avatar_color + avatar_initial）
   - 名前 / 年齢（任意） / 居住地（任意）
   - 現職: 会社名 + ポジション
   - [Opinio に相談する] CTA ← 直接予約ではなく相談リクエスト

[B] プロフィール
   - bio（編集部執筆）
   - catchphrase（既存）
   - 経歴タイムライン
     ・ MergedTimeline 流用が理想
     ・ 既存の current_career / previous_career フィールド利用可
     ・ Phase 1 では既存実装維持、Phase 2 で MergedTimeline に統合

[C] 相談できるテーマ
   - mentor_themes / question_tags をタグ表示
   - concerns があれば併記

[D] 接続方法
   - CTA: [Opinio に相談する]
   - クリックで /mentors/[id]/request に遷移 or モーダル
   - フォーム: 悩み内容（自由記述、必須）+ 連絡先（必須）+ メンター指名（自動セット）

[E] 関連メンター（Phase 2、今は未実装）
```

**非表示フィールド**:
- success_count / total_sessions
- calendly_url

### 2.6 相談リクエスト機能

新規テーブル `ow_consultation_requests` を作成:

```sql
CREATE TABLE ow_consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ow_users(id),
  mentor_user_id UUID REFERENCES ow_users(id) NULL,  -- 指名なしも可
  consultation_message TEXT NOT NULL,
  contact_info TEXT NOT NULL,  -- メール/電話/Slack 等
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'matched', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_consultation_requests_status ON ow_consultation_requests(status);
CREATE INDEX idx_consultation_requests_user ON ow_consultation_requests(user_id);
```

**運用フロー**:
1. ユーザーが /mentors/[id] の CTA をクリック
2. フォームに悩み内容と連絡先を入力
3. POST → `ow_consultation_requests` に status='pending' で INSERT
4. Opinio 編集部に通知メール（柴さん宛て）
5. 編集部が手動でメンターアサイン → status='matched' に更新

---

## 3. 作業フェーズ

このタスクは規模が大きいため、**4 セッションに分割**する。各セッション完了時に柴さんへ報告 + GO 確認。

### Phase 1: マイグレーション（1 セッション）

新規マイグレーションを作成・適用:

```
supabase/migrations/108_consultation_categories.sql
supabase/migrations/109_mentor_categories.sql
supabase/migrations/110_consultation_requests.sql
supabase/migrations/111_ow_mentors_user_id_not_null.sql
```

**マイグレーション 108**: 悩みカテゴリマスタ
```sql
CREATE TABLE ow_consultation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ow_consultation_categories (slug, name, description, sort_order) VALUES
  ('career_direction', 'キャリアの方向性に迷っている', '自分のキャリア軸を見つけたい', 10),
  ('market_value', '自分の市場価値が知りたい', '今の自分の立ち位置を確認したい', 20),
  ('job_change_timing', '転職するか迷っている', '動くべきタイミングを相談したい', 30),
  ('current_company', '今の会社にいるべきか分からない', '残るか出るかの判断に迷っている', 40),
  ('side_business', '副業/独立を考えている', '新しい働き方を模索したい', 50),
  ('relationship', '人間関係/組織に悩んでいる', '上司・同僚・チームのことを話したい', 60);
```

**マイグレーション 109**: メンターと悩みカテゴリの紐付け
```sql
CREATE TABLE ow_mentor_categories (
  mentor_user_id UUID REFERENCES ow_users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES ow_consultation_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (mentor_user_id, category_id)
);

CREATE INDEX idx_mentor_categories_mentor ON ow_mentor_categories(mentor_user_id);
CREATE INDEX idx_mentor_categories_category ON ow_mentor_categories(category_id);
```

**マイグレーション 110**: 相談リクエストテーブル
（前述の SQL）

**マイグレーション 111**: ow_mentors.user_id を NOT NULL 化

事前に user_id IS NULL のレコードがあれば手動で修正 or 削除する必要あり。
**事前確認クエリ**:
```sql
SELECT id, name, current_company FROM ow_mentors WHERE user_id IS NULL;
```

結果に応じて柴さんに判断を仰ぐ。レコードが多ければ、NOT NULL 化は Phase 1 のスコープから外し、別タスクに分離。

#### Phase 1 完了条件
- 4 マイグレーション適用済み
- 検証クエリ実行結果を柴さんに報告
- GO 確認後 Phase 2 へ

### Phase 2: 一覧ページ実装

ファイル変更:
- `src/app/(jobseeker)/mentors/page.tsx`: 構造を /companies のジャンル別カルーセル型に変更
- `src/components/mentors/MentorCardCompact.tsx`: 新規作成（CompanyCardCompact 流用）
- `src/lib/mentors.ts` or 既存 queries.ts: 悩みカテゴリ別のメンター取得関数

**主要変更**:
- ヒーローの数字表示を削除
- 既存検索バーを削除
- 6 つの悩みカテゴリでカルーセル表示
- 各カルーセルは「該当メンター 0 名なら非表示」のロジック
- 全体メンター一覧（カテゴリ非依存）を下部に配置

### Phase 3: 詳細ページ実装

ファイル変更:
- `src/app/(jobseeker)/mentors/[id]/page.tsx`: success_count / total_sessions / calendly_url の表示を削除
- 「Opinio に相談する」CTA を追加
- フォーム or 別ページ（/mentors/[id]/request）に遷移する仕組み

### Phase 4: 相談リクエストフォーム実装

- 新規ページ or モーダル
- POST API で ow_consultation_requests に INSERT
- 編集部への通知メール送信（Resend 等の既存仕組み流用）

---

## 4. 完了条件

各 Phase 完了時に以下を報告:

- 変更ファイル一覧
- `npm run build` 結果
- commit hash と Vercel デプロイ状態
- 本番動作確認（最終 Phase のみ）

---

## 5. やらないこと（スコープ外）

- 関連メンター機能（[E] ブロック）
- メンター個別の予約システム（Spir/Calendly 等の連携）
- マッチ度スコアの表示
- メンター本人による直接プロフィール編集 UI
- 評価・レビュー機能
- migration 043 関連の company role 整理（別タスク）

---

## 6. 想定リスクと対処

| リスク | 対処 |
|---|---|
| ow_mentors.user_id が NULL のレコード多数あり、NOT NULL 化困難 | Phase 1 で確認 → 多ければ別タスクに分離 |
| 既存メンター詳細ページの構造が想定と違う | Phase 3 着手前に再度コード確認 |
| ヒーロー部分の数字削除でデザインが崩れる | Phase 2 でレイアウト調整 |
| 悩みカテゴリ未紐付けのメンターが [2] のセクションに出ない | UX として「全メンター一覧」セクションに表示されることで救済 |

---

## 7. セッション分割の推奨

| セッション | フェーズ | 想定工数 |
|---|---|---|
| セッション 1 | Phase 1（マイグレーション 4 本） | 1-2 時間 |
| セッション 2 | Phase 2（一覧ページ） | 2-3 時間 |
| セッション 3 | Phase 3（詳細ページ） | 1-2 時間 |
| セッション 4 | Phase 4（相談リクエスト機能） | 2-3 時間 |

**1 セッション 1 フェーズが原則**。判断疲労を避けるため、欲張らない。

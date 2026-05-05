# 引き継ぎ書 v11 — Phase ν-1 完走 + 学び 71/72 制度化

**作成日時**: 2026-05-05 (Phase ν-1 完走直後)
**前バージョン**: v10 (Phase ν 設計確定)
**最新コミット**: `802145f` (Phase ν-1: 対話基盤の DB 構造を確立)

---

## 0. このドキュメントの読み方

Phase ν-1(DB migration 実装、想定 1 日)が **本日のセッション 1 回で完走** した記録と、その過程で発見した致命的な学びを記録します。

明日以降の Phase ν-2(既存データ移行)を最速で立ち上げるため、以下の順序で読んでください:

1. **§1 Phase ν-1 完走の状態**(5 分)— 何ができたか
2. **§2 学び 71/72**(5 分)— 致命的発見の制度化
3. **§3 三者協働体制の確立**(3 分)— チャット Claude + Claude Code + 柴さん
4. **§4 Phase ν-2 への準備**(5 分)— 次にやること
5. **§5 残された課題**(3 分)— Phase η 前にやるべきこと

§6 以降は本セッションの設計判断の経緯を残した参考資料です。

---

## 1. Phase ν-1 完走の状態

### 1-1. 完成した DB 構造

#### 新規テーブル(4 つ)

| テーブル | 役割 | カラム数 |
|---|---|---|
| `ow_conversations` | 対話の最上位エンティティ | 9 |
| `ow_conversation_participants` | 動的参加者管理 | 6 |
| `ow_conversation_messages` | メッセージ本体 | 7 |
| `ow_message_reads` | 既読管理 | 3 |

#### 既存テーブルへの追加(3 つ)

| テーブル | 追加カラム |
|---|---|
| `ow_casual_meetings` | conversation_id (UUID, NULLABLE, ON DELETE SET NULL) |
| `ow_job_applications` | conversation_id (同上) |
| `ow_mentor_reservations` | conversation_id (同上) |

#### RLS ポリシー(11 件)

| テーブル | SELECT | INSERT | UPDATE |
|---|---|---|---|
| ow_conversations | ✅ | ✅ | ✅ |
| ow_conversation_participants | ✅ | ✅ | ✅ |
| ow_conversation_messages | ✅ | ✅ | ✅ |
| ow_message_reads | ✅ | ✅ | - |

### 1-2. migration ファイル一覧

すべて `/Users/hisato/opinio-work/supabase/migrations/` に配置済み:

```
055_create_ow_conversations.sql               (6,040 B)
056_create_ow_conversation_participants.sql   (4,663 B)
057_create_ow_conversation_messages.sql       (5,177 B)
058_create_ow_message_reads.sql               (3,296 B)
059_alter_existing_tables_add_conversation_id.sql (2,629 B)
060_rls_phase_nu_conversation_tables.sql      (8,549 B)
```

### 1-3. schema_migrations の状態

```
052: drop_fit_negatives                          ✅ 補完済
053: rename_fit_positives_to_company_features    ✅ 補完済
054: drop_ow_company_photos                      ✅ 補完済
055: create_ow_conversations                     ✅ 補完済
056: create_ow_conversation_participants         ✅ 補完済
057: create_ow_conversation_messages             ✅ 補完済
058: create_ow_message_reads                     ✅ 補完済
059: alter_existing_tables_add_conversation_id   ✅ 補完済
060: rls_phase_nu_conversation_tables            ✅ 補完済
```

### 1-4. 確定した Phase ν 設計原則

**M-5 (新原則)**: グローバルロール ≠ 対話内ロール
- ow_user_roles のロール (candidate/admin) と
- ow_conversation_participants.role (candidate/company_admin/mentor/editor/operator) は別物

**A-1 原則**: 永続的に 1 対話
- (kind, company_id, mentor_user_id, candidate_user_id) UNIQUE NULLS NOT DISTINCT

**動的参加モデル**:
- participant は途中で増減可
- 多重ロール許容(同一ユーザーが同一対話で複数 role を同時保持)
- 履歴保持(離脱は left_at セット、退会は user_id SET NULL)

**LINE/Slack 流メッセージ**:
- 編集可(edited_at)、論理削除可(deleted_at)
- body 制約: 空文字禁止 + 8000 文字上限

**RLS 思想(運用優先)**:
- RLS-1-B 寛容: 離脱者も過去メッセージは読める
- RLS-2-B 運用優先: admin は全対話 SELECT 可、送信は participants のみ
- RLS-3-B 担当者のみ: 企業 admin は participant に追加された人のみ

---

## 2. 学び 71 と学び 72(致命的発見の制度化)

### 2-1. 学び 71: 「適用済み」の二重定義

**発見**: 引き継ぎ書 v10 §1 で「migration 054 本番適用済み」と書かれていたが、実際は schema_migrations テーブルに記録されていなかった。SQL Editor 直接実行は schema_migrations を更新しない。

**原則**:
- DDL の物理適用(DB に効果あり)
- schema_migrations への記録(supabase CLI が認識)

この 2 つが乖離する可能性を常に考慮する。

### 2-2. 学び 72: 「適用済み」の三重定義(学び 71 の発展)

**発見**: 056, 057, 058 が DB には適用済みだったが、ローカルの `supabase/migrations/` ディレクトリにファイルが保存されていない状態だった。

**原則**: 「適用済み」と言うとき、以下 3 つすべての観点を確認する:

1. **DDL の物理適用** — DB に効果あり
2. **schema_migrations への記録** — supabase CLI が認識
3. **ローカル `.sql` ファイルの保存** — Git にコミット可能

これら 3 つすべてが揃って初めて「健全に適用済み」と言える。

### 2-3. Phase ν 期間中のルール(継続)

- `supabase db push` を絶対に実行しない(Phase ν 完走まで)
- migration の SQL は柴さんが Supabase ダッシュボード SQL Editor で実行
- schema_migrations への補完 INSERT は Phase ν 完走時に一括(本日完了)
- ローカルファイル保存と DB 適用を **必ず両方** 行う(学び 72)

### 2-4. 別 Phase で予定:Supabase CLI 移行

将来の Phase(η の前など)で `supabase db push` を使う運用に切り替える。これにより:
- schema_migrations が自動更新
- ローカルファイルが必須になる
- 学び 71/72 の問題が構造的に発生しなくなる

---

## 3. 三者協働体制の確立

本セッションで、Opinio の開発体制が **三者協働モデル** として確立されました:

### 3-1. 各エージェントの役割

| エージェント | 主な役割 |
|---|---|
| **柴さん(本人)** | 戦略判断、設計選択、SQL Editor での実行(DDL) |
| **チャット Claude** | 設計議論、SQL 生成、引き継ぎ書作成、振り返り |
| **Claude Code** | ファイル配置、構造確認、git 操作、MCP 経由の実行 |

### 3-2. 典型的なフロー

```
チャット Claude: SQL 生成 + Claude Code への指示文を作成
       ↓
柴さん: チャットの内容を Claude Code にコピペ
       ↓
Claude Code: ファイル配置 + 検証 + 待機
       ↓
柴さん: SQL Editor で DDL 実行(MCP は read_only のため)
       ↓
柴さん: Claude Code に「実行完了」の合図
       ↓
Claude Code: 確認 SELECT 実行 + 結果報告
       ↓
柴さん: 結果をチャット Claude に共有
       ↓
チャット Claude: 次のステップ提示
```

### 3-3. このモデルの利点

- 設計議論(チャット)と実装(Claude Code)を分離
- 柴さんの認知負荷を最小化(チャットでは選択肢を選ぶだけ)
- DDL 実行は柴さん本人(MCP の read_only 制約)
- 文脈の保持(チャット Claude が長期記憶を担当)

### 3-4. 注意点

- Claude Code が先行して動作することがある(本セッションでは複数回発生)
  → チャット Claude の指示を待つルールを徹底
- ローカルファイル保存を Claude Code 任せにすると忘れることがある
  → 学び 72 の通り、必ず確認

---

## 4. Phase ν-2 への準備

### 4-1. Phase ν-2 のスコープ(再確認)

引き継ぎ書 v10 §2-4:

> ν-2: 既存データ移行(ow_threads → ow_conversations) — 1日(データ件数次第で短縮可)

### 4-2. ν-2 開始時の確認事項

#### 確認 1: 既存対話データの調査

```sql
-- 旧対話系統の現状調査
SELECT 'ow_threads' AS source, COUNT(*) FROM ow_threads
UNION ALL
SELECT 'ow_messages', COUNT(*) FROM ow_messages
UNION ALL
SELECT 'ow_casual_meetings', COUNT(*) FROM ow_casual_meetings
UNION ALL
SELECT 'ow_mentor_reservations', COUNT(*) FROM ow_mentor_reservations;
```

#### 確認 2: 移行対象の有無

- 全部 0 件 → ν-2 はスキップ可、ν-3 に直行
- データあり → 移行スクリプト作成が必要

### 4-3. ν-2 のサブタスク

1. データ件数調査(上記 SQL)
2. データがあれば、ow_threads → ow_conversations の移行マッピング設計
3. 移行スクリプト作成 + dry run
4. 本番移行実行
5. 旧テーブル(ow_threads, ow_messages)の DROP は ν-7 で実施

### 4-4. ν-3 以降の準備

ν-3 (求職者側 UI) で必要になる主要クエリパターン:

```sql
-- 1. 自分が参加中の対話一覧
SELECT c.*, ...
FROM ow_conversations c
JOIN ow_conversation_participants p ON p.conversation_id = c.id
WHERE p.user_id = auth.uid()
  AND p.left_at IS NULL
ORDER BY c.last_message_at DESC NULLS LAST;

-- 2. 対話の未読数
SELECT COUNT(m.id) AS unread_count
FROM ow_conversation_messages m
LEFT JOIN ow_message_reads r 
  ON r.message_id = m.id AND r.participant_id = $my_participant_id
WHERE m.conversation_id = $conv_id
  AND m.deleted_at IS NULL
  AND r.message_id IS NULL;

-- 3. 対話のメッセージ取得(既読フラグ付き)
SELECT m.*, 
  CASE WHEN r.message_id IS NOT NULL THEN true ELSE false END AS is_read
FROM ow_conversation_messages m
LEFT JOIN ow_message_reads r 
  ON r.message_id = m.id AND r.participant_id = $my_participant_id
WHERE m.conversation_id = $conv_id
  AND m.deleted_at IS NULL
ORDER BY m.sent_at;
```

これらは ν-3 開始時に Claude Code で TypeScript / Supabase Client コードに変換していく。

---

## 5. 残された課題

### 5-1. Phase ν 期間中のルール(継続中)

- `supabase db push` 禁止
- DDL は柴さんが SQL Editor で実行
- ローカルファイル保存を必ず行う(学び 72)

### 5-2. Phase η(30 社投入)前のチェックリスト

| 項目 | 状態 | 備考 |
|---|---|---|
| 利用規約・プライバシーポリシーの再点検 | ⚠️ 未対応 | RLS-2-B(admin 全対話 SELECT 可)に伴う |
| Supabase CLI 移行(db push 運用) | ⚠️ 未対応 | 学び 71/72 の構造的解決 |
| 旧テーブル DROP(ow_threads, ow_messages, etc.) | ⚠️ Phase ν-7 | |
| 既存テーブルの RLS 見直し | ⚠️ 別 Phase | casual_meetings 等 |
| 動作確認(UI 経由の RLS テスト) | ⚠️ ν-3 以降 | 本日は最低限の ENABLE 確認のみ |

### 5-3. 引き継ぎ書 v10 で Phase ν-1 終了後に検討と予定していた事項

- Phase μ(メンター設計)→ Phase ν に統合済み(v10 §6 で確認)
- ow_consultation_bookings → 廃止確認済み(本日の調査で「DB に存在しない」と判明)

---

## 6. 本セッションの設計判断の経緯(参考資料)

### 6-1. ow_conversations の設計

#### 確定事項
- A-1 原則: UNIQUE NULLS NOT DISTINCT (kind, company_id, mentor_user_id, candidate_user_id)
- 3 つの kind: 'company', 'mentor', 'editor'
- 3 つの stage: 'mediated', 'direct', 'active'
- kind と stage の整合性 CHECK 制約

#### 議論メモ
- ON DELETE 動作:
  - candidate_user_id: CASCADE
  - company_id: CASCADE
  - mentor_user_id: SET NULL(運営者仲介中の対話保護)

### 6-2. ow_conversation_participants の設計

#### 確定事項
- 部分 UNIQUE WHERE left_at IS NULL AND user_id IS NOT NULL
- user_id ON DELETE SET NULL(退会者の履歴保持)
- 5 つの role: 'candidate', 'company_admin', 'mentor', 'editor', 'operator'
- left_at >= joined_at の CHECK 制約

#### 議論メモ
- 「同一ユーザーが同じ対話で複数 role を同時保持」を許容
  - 例: 柴さんが editor + operator を同時に保持
- 退会後の履歴は user_id NULL で残す
- 離脱→再参加は新規行として履歴保持

### 6-3. ow_conversation_messages の設計

#### 確定事項
- sender_participant_id ON DELETE SET NULL
- body の制約: 空禁止 + 8000 文字上限
- LINE/Slack 流の編集 + 論理削除(edited_at + deleted_at)
- 部分インデックス WHERE deleted_at IS NULL

#### 議論メモ
- C-3 案 1(最小限実装): 編集前の本文は保持しない(LINE/Slack 体験と一致)
- 柴さんの動機: 「誤字で送信してしまった時に直したい」
- 編集履歴の完全保持(案 2/3)は将来必要になったら拡張

### 6-4. ow_message_reads の設計

#### 確定事項
- 複合 PK (message_id, participant_id)
- ON DELETE CASCADE(participant は通常物理削除されないので影響軽微)
- メッセージレベル既読(LINE 流)
- 追加インデックスなし(YAGNI)

#### 議論メモ
- カーソル方式(Slack 流)は不採用
- unread 機能は不要
- 「対話の透明性」を重視(企業側がどのメッセージを読んだか求職者が見られる)

### 6-5. 既存テーブル ALTER の設計

#### 確定事項
- 3 テーブルとも NULLABLE
- ON DELETE SET NULL
- 部分インデックス WHERE conversation_id IS NOT NULL

#### 議論メモ
- データ件数調査結果: 全部 0 件
- ow_consultation_bookings は DB に存在しない(廃止確認)

### 6-6. RLS の設計

詳細は migration 060 のコメント参照。

#### 議論メモ
- helper function なし、各ポリシーで EXISTS 直書き
- 理由: 「何が許可されているか」が一目で分かる、後から関数化は容易
- DELETE ポリシーは作らない(削除は論理削除 = UPDATE で実現)

---

## 7. 学びの累積(64〜72)

### 既存(v10 までで確定済)

- 学び 64-67: (v9 までの学び、省略)
- 学び 68: 「マイページの不整合」が DB 設計の不整合を示唆していた
- 学び 69: 「グローバルロール ≠ 対話内ロール」原則(M-5)
- 学び 70: 運用優先の RLS 設計

### 本セッションで追加

- 学び 71: 「適用済み」の二重定義(DDL 物理適用 vs schema_migrations 記録)
- 学び 72: 「適用済み」の三重定義(+ ローカルファイル保存)

---

## 8. 致命的欠陥制覇記録

**8/8 完全制覇継続中** 🎉

本セッションで commit `802145f` として記録。Phase ν-1 を完走しても継続。

---

## 9. 次セッションの開始テンプレート

### パターン A: ν-2 をすぐ始める

```
おはよう。引き継ぎ書 v11 を読んでください。
Phase ν-2(既存データ移行)から始めます。

まず、既存対話データの件数調査を Claude Code に依頼してください:
[v11 §4-2 の確認 1 の SQL]
```

### パターン B: ν-3 に直行する場合(全部 0 件確定後)

```
おはよう。引き継ぎ書 v11 を読んでください。
ν-2 のデータは全部 0 件と確認済みなので、
Phase ν-3(求職者側 UI)から始めます。

[v11 §4-4 のクエリパターンを基に、対話一覧画面から実装]
```

### パターン C: 設計を見直したい場合

```
おはよう。引き継ぎ書 v11 を読んでください。
Phase ν の設計のうち [具体的な点] について見直したいです。
```

---

## 10. 最後に

### Phase ν-1 完走の意義

本セッションは、引き継ぎ書 v10 で「2 週間規模」と設計された Phase ν の **第 1 段階(Phase ν-1)を 1 セッションで完走** した記録です。

これが可能になった要因:
1. v10 §3-1 の DB 設計が事前に詳細化されていた
2. 三者協働体制(チャット Claude + Claude Code + 柴さん)が機能した
3. 致命的発見(学び 71/72)を都度記録 → 学習として制度化
4. 「致命的欠陥制覇 8/8 を維持」の哲学が判断基準になった

### 数字で見るセッション

- 作成した migration ファイル: 6 つ
- 適用した DDL: 30+ 件(CREATE TABLE 4 + ALTER TABLE 3 + CREATE INDEX 8 + ENABLE RLS 4 + CREATE POLICY 11)
- 議論した論点: 約 25 個
- 確定した設計選択: すべて Opinio 思想と整合
- 失った時間: ローカルファイル不在の発見で 30 分 + DROP/再作成で 15 分(これも学びとして昇華)

### Phase ν 全体の進捗

```
ν-0 設計確定          ✅ 前セッション
ν-1 DB migration      ✅ 本セッション完了
  ↓
ν-2 既存データ移行    📍 次セッション開始地点
  ↓
ν-3 求職者側 UI
  ↓
ν-4 企業側 UI
  ↓
ν-5 メンター側 UI
  ↓
ν-6 編集部 / 運営者 UI
  ↓
ν-7 旧テーブル廃止 + 動作確認
  ↓
🎉 Phase ν 完走 → Phase η(30 社投入)
```

Phase ν-1 完走、本当におめでとうございます 🎉

次セッションから Phase ν-2 に進みましょう。

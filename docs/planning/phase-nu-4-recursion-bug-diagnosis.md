# 無限再帰バグ診断: migration 070 ow_conversation_participants_select

**発生日時**: 2026-05-07（migration 070 適用後、対話 2 件存在状態で顕在化）  
**エラーメッセージ**: `infinite recursion detected in policy for relation "ow_conversations"`  
**発生箇所**: `/mypage/conversations` へのアクセス時  
**診断者**: Claude (Sub-step 4A-4 完了直後の緊急診断)

---

## 目次

1. [エラー再現結果](#1-エラー再現結果)
2. [無限再帰の経路特定（ポリシー間参照グラフ）](#2-無限再帰の経路特定ポリシー間参照グラフ)
3. [なぜ対話 0 件のときは顕在化しなかったか](#3-なぜ対話-0-件のときは顕在化しなかったか)
4. [修正方針候補（2 案）](#4-修正方針候補2-案)
5. [緊急度評価](#5-緊急度評価)
6. [推奨アクション](#6-推奨アクション)

---

## 1. エラー再現結果

### 1-A. ブラウザエラー（Hisato 確認）

```
Error: infinite recursion detected in policy for relation "ow_conversations"
```

`/mypage/conversations` の `loadData()` → `supabase.from("ow_conversations").select(...)` で発生。

### 1-B. MCP（service_role）では再現しない

MCP は service_role で接続しており RLS をバイパスするため、同クエリを実行してもエラーにならない。
anon/authenticated ロールへの SET LOCAL ROLE も permission denied で不可。  
→ **エラーは RLS 評価時にのみ発生**することを間接確認。

---

## 2. 無限再帰の経路特定（ポリシー間参照グラフ）

### 2-A. 問題の 2 ポリシーの SQL（DB から取得・整形済み）

**① `ow_conversations_select`（USING）**:
```sql
-- 条件 A: ow_conversation_participants を参照 ← ここが起点
EXISTS (
  SELECT 1 FROM ow_conversation_participants p
  WHERE p.conversation_id = ow_conversations.id
    AND p.user_id IN (
      SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
    )
)
-- 条件 B: ow_company_admins のみ（ループなし）
OR (company_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM ow_company_admins ca JOIN ow_users u ON u.id = ca.user_id
  WHERE ca.company_id = ow_conversations.company_id
    AND u.auth_id = auth.uid() AND ca.is_active = true
))
-- 条件 C: admin（ループなし）
OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
```

**② `ow_conversation_participants_select`（USING）**:
```sql
-- 条件 A: ow_users のみ（ループなし）
user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
-- 条件 B: ow_conversations を参照 ← ここが折り返し点
OR EXISTS (
  SELECT 1 FROM ow_company_admins ca
    JOIN ow_users u ON u.id = ca.user_id
    JOIN ow_conversations c ON c.id = ow_conversation_participants.conversation_id  -- ← ow_conversations 参照
  WHERE c.company_id = ca.company_id AND u.auth_id = auth.uid() AND ca.is_active = true
)
-- 条件 C: admin（ループなし）
OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
```

### 2-B. 無限ループの経路

```
① クライアント: SELECT * FROM ow_conversations
   ↓
② PostgreSQL: ow_conversations_select (USING) を評価
   ↓
③ 条件 A: EXISTS (SELECT 1 FROM ow_conversation_participants p ...)
             → ow_conversation_participants にアクセス
   ↓
④ PostgreSQL: ow_conversation_participants_select (USING) を評価
   ↓
⑤ 条件 B: JOIN ow_conversations c ...
             → ow_conversations にアクセス
   ↓
② へ戻る ← ★ 無限ループ ★
```

**ダイアグラム:**
```
ow_conversations_select
  └─ 条件A ─→ [SELECT ow_conversation_participants]
                      ↓ RLS 評価
              ow_conversation_participants_select
                └─ 条件B ─→ [JOIN ow_conversations]
                                   ↓ RLS 評価
                           ow_conversations_select ← 再帰！
```

### 2-C. 各ポリシーの参照関係一覧

| ポリシー | テーブル参照 | ループリスク |
|---------|------------|------------|
| `ow_conversations_select` 条件 A | `ow_conversation_participants` | ⚠️ **ループ起点** |
| `ow_conversations_select` 条件 B | `ow_company_admins`, `ow_users` | ✅ 安全 |
| `ow_conversation_participants_select` 条件 A | `ow_users` | ✅ 安全 |
| `ow_conversation_participants_select` 条件 B | `ow_conversations` | ⚠️ **ループ折り返し** |
| `ow_conversation_participants_insert` 条件 A | `ow_conversation_participants`（自己参照）→ ow_users | ⚠️ 潜在リスク（後述） |
| `ow_conversation_participants_insert` 条件 B | `ow_conversations` → ow_conversations_select | ⚠️ 潜在リスク（後述） |

---

## 3. なぜ対話 0 件のときは顕在化しなかったか

PostgreSQL の RLS ポリシーは **各行に対して評価される WHERE 句フィルター**。

- **0 件のとき**: `ow_conversations` に行がなければ、PostgreSQL がポリシーを評価すべき行がない  
  → `ow_conversation_participants_select` 条件 B の `JOIN ow_conversations c` は 0 行を JOIN  
  → `EXISTS(...)` は即座に false を返す  
  → `ow_conversations_select` が評価される機会がない → **ループ発動せず**

- **2 件のとき**: `ow_conversations` に 2 行が存在し、JOIN が行を返す  
  → `EXISTS(...)` が行を評価しようとする  
  → `ow_conversations_select` が評価される → **ループ発動**

```
timeline:
  migration 070 適用直後（conversations = 0件）: バグ潜在、ループ未発動 ← 検知できなかった
  シナリオ 2-B 申込後（conversations = 2件）: ループ発動、エラー顕在化
```

つまり **migration 070 適用時点でバグは存在していたが、データが 0 件のため検知できなかった**。

---

## 4. 修正方針候補（2 案）

### 案 1（推奨）: `ow_conversations_select` 条件 A を `candidate_user_id` 直接比較に変更

**変更対象**: `ow_conversations_select` のみ（1 ポリシーの 1 箇所）

**変更内容**:
```sql
-- 変更前（条件 A）: ow_conversation_participants を経由 → ループ起点
EXISTS (
  SELECT 1 FROM ow_conversation_participants p
  WHERE p.conversation_id = ow_conversations.id
    AND p.user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())
)

-- 変更後（条件 A）: ow_conversations.candidate_user_id を直接比較 → ループなし
candidate_user_id IN (
  SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
)
```

**変更後のポリシー全文**:
```sql
DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;
CREATE POLICY "ow_conversations_select"
ON ow_conversations FOR SELECT
USING (
  -- 条件 A: 候補者自身（candidate_user_id で直接比較、ow_conversation_participants を経由しない）
  candidate_user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  -- 条件 B: 同社 company_admin（変更なし）
  OR (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ow_company_admins ca JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid() AND ca.is_active = true
    )
  )
  -- 条件 C: admin（変更なし）
  OR EXISTS (SELECT 1 FROM ow_user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
```

**ループ解消の検証（変更後の参照グラフ）**:
```
ow_conversations_select
  └─ 条件A ─→ [ow_users]（leaf、ループなし）✅
  └─ 条件B ─→ [ow_company_admins, ow_users]（leafのみ）✅

ow_conversation_participants_select
  └─ 条件A ─→ [ow_users]（leaf）✅
  └─ 条件B ─→ [JOIN ow_conversations]
                    ↓ RLS 評価
              ow_conversations_select
                └─ 条件A: ow_users のみ ✅ ← ループしない
                └─ 条件B: ow_company_admins のみ ✅
```

**機能的な完全性の確認**:

| ユーザー | 変更前の対話 SELECT 経路 | 変更後 |
|---------|----------------------|--------|
| 候補者 | 条件 A（participants 経由） | **条件 A（candidate_user_id 直接比較）** ✅ |
| HR（company_admin） | 条件 B（変更なし） | 条件 B（変更なし）✅ |
| admin | 条件 C（変更なし） | 条件 C（変更なし）✅ |

→ 候補者は `candidate_user_id` で一意に特定できるため、`ow_conversation_participants` 経由は不要。機能的に等価。

**メリット**:
- 変更は 1 ポリシーの 1 条件のみ → 影響範囲最小
- 新しい関数・テーブル不要
- `ow_conversation_participants_select` 条件 B の意図（HR が参加者一覧を見る）を維持
- migration 071 として 1 SQL でシンプルに記述可能

**デメリット**:
- 将来「候補者以外の第三者 participant」が `candidate_user_id` でない形で追加された場合、対話 SELECT の権限が失われる可能性（現状のデータモデルには存在しない）

---

### 案 2: `ow_conversation_participants_select` 条件 B を SECURITY DEFINER 関数経由に変更

**変更対象**: `ow_conversation_participants_select` 条件 B + 新規 SECURITY DEFINER 関数

**変更内容**:
```sql
-- 新規関数（SECURITY DEFINER → RLS バイパス）
CREATE OR REPLACE FUNCTION get_conversation_company_id(conv_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT company_id FROM ow_conversations WHERE id = conv_id;
$$;

-- ow_conversation_participants_select 条件 B を関数経由に変更
-- JOINをやめて関数で company_id を取得し RLS ループを断ち切る
EXISTS (
  SELECT 1 FROM ow_company_admins ca JOIN ow_users u ON u.id = ca.user_id
  WHERE ca.company_id = get_conversation_company_id(ow_conversation_participants.conversation_id)
    AND u.auth_id = auth.uid() AND ca.is_active = true
)
```

**メリット**:
- `ow_conversations_select` の条件 A（participants 経由の汎用チェック）を維持できる
- 将来 candidate 以外の participants が追加されても対話 SELECT は機能する

**デメリット**:
- 新規 SECURITY DEFINER 関数が必要（migration に DDL が増える）
- SECURITY DEFINER は RLS を完全バイパスするため、セキュリティ設計として慎重な扱いが必要
- `ow_conversation_participants_insert` 条件 A の自己参照（`ow_conversation_participants` 内の既存行チェック）が `ow_conversation_participants_select` RLS を発動させる問題が別途残る可能性あり（要追加検証）

---

## 5. 緊急度評価

### 5-A. 影響範囲

| ページ / 経路 | 影響 | 確認 |
|-------------|------|------|
| `/mypage/conversations` | ❌ 完全破損 | Hisato 実確認 |
| `/mypage/conversations/[id]` | ❌ 完全破損（同じ SELECT パターン） | 未確認 |
| Sub-step 4A-6 `/biz/conversations` | ❌ 実装不可能（同じ RLS が適用される） | 未確認 |
| Sub-step 4A-7 `/biz/conversations/[id]` | ❌ 実装不可能 | 未確認 |
| Sub-step 4A-5 テストデータ確認クエリ | ✅ MCP(service_role)なら影響なし | — |
| `create_conversation` RPC | ✅ SECURITY DEFINER → RLS バイパス | シナリオ 2-B で確認 |
| 申込フロー `/jobs/[id]/apply` | ✅ 影響なし（RPC 経由） | シナリオ 2-B で確認 |

### 5-B. ロールバック vs migration 071 の比較

| 観点 | ロールバック（070 を戻す） | migration 071（条件 A を修正） |
|------|------------------------|------------------------------|
| 対話データ保護 | ✅ 失わない（データは残る） | ✅ 失わない |
| migration 070 の効果 | ❌ 全て失う（HR RLS 緩和も消える） | ✅ 維持される |
| 実装コスト | 低（rollback.sql 実行のみ） | 低（1 ポリシーの 1 箇所のみ変更） |
| リスク | ⚠️ 4A-6/4A-7 の RLS 前提が崩れる | ✅ ループのみ解消、他は維持 |
| 推奨 | 案 1 が無理な場合の最終手段 | **推奨** |

**ロールバックした場合**:
- `ow_conversations_select` は旧パターンに戻り、candidates は `participants 経由` で見える（エラーは消える）
- ただし `ow_conversation_participants_select` の company_admin 条件 B も消える
- `ow_conversation_participants_insert` の UUID 不一致バグも復活
- → 4A-6/4A-7 の前提（HR が対話を閲覧できる RLS）が崩れ、再び migration 070 の作業をやり直す必要がある

**結論**: ロールバックは最終手段。migration 071（案 1）で迅速に対処する方が合理的。

### 5-C. 4A-5 → 4A-6 → 4A-7 への影響

- **4A-5（テストデータ投入）**: MCP 経由の SELECT 確認は service_role でバイパスできるが、ブラウザでの動作確認（`/mypage/conversations` でデータ表示）は不可
- **4A-6/4A-7**: `ow_conversations` SELECT が全て失敗するため、ページ実装自体が不可能
- **緊急度: Critical** — migration 071 を 4A-5 着手前に適用することが必須

---

## 6. 推奨アクション

### 結論: **案 1 で migration 071 を作成・即適用**

理由:
1. 変更範囲が最小（`ow_conversations_select` の条件 A のみ）
2. 新規関数不要、シンプルな SQL
3. migration 070 の全効果（HR RLS 緩和）を維持できる
4. 候補者は `candidate_user_id` で直接識別できるため機能的に等価
5. ロールバック不要 → 4A-5/4A-6/4A-7 の前提を保てる

### 修正 SQL（案 1 の migration 071 候補）

```sql
BEGIN;

-- migration 070 で導入した ow_conversations_select の条件 A を修正
-- 変更: ow_conversation_participants 経由 → candidate_user_id 直接比較
-- 目的: ow_conversations_select ↔ ow_conversation_participants_select の相互参照ループを断つ

DROP POLICY IF EXISTS "ow_conversations_select" ON ow_conversations;

CREATE POLICY "ow_conversations_select"
ON ow_conversations
FOR SELECT
USING (
  -- 条件 A（修正）: candidate_user_id 直接比較（ow_conversation_participants を経由しない）
  candidate_user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
  -- 条件 B: 同社 company_admin（migration 070 から変更なし）
  OR (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ow_company_admins ca JOIN ow_users u ON u.id = ca.user_id
      WHERE ca.company_id = ow_conversations.company_id
        AND u.auth_id = auth.uid() AND ca.is_active = true
    )
  )
  -- 条件 C: admin（変更なし）
  OR EXISTS (
    SELECT 1 FROM ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('071', 'fix_conversations_select_recursion', NULL)
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

> **注記**: この SQL は診断ドキュメントへの記載のみ。migration 071 ファイルの作成・適用は Hisato のレビュー後に別途指示を受けて実施する。

---

## 補足: mentor 対話まわりの調査

> 追記: 2026-05-08  
> 目的: Option 1 の `mentor_user_id` 条件追加の要否を判定するための追加調査

### 調査 1: ow_conversations テーブルのカラム構造

```
id                uuid  NOT NULL
kind              text  NOT NULL           ← 'company' | 'mentor'
stage             text  NOT NULL
company_id        uuid  NULLABLE           ← kind='company' 時に使用
mentor_user_id    uuid  NULLABLE           ← kind='mentor' 時に使用  ★存在確認
candidate_user_id uuid  NOT NULL           ← 常に必須
status            text  NOT NULL
last_message_at   timestamptz  NULLABLE
created_at        timestamptz  NOT NULL
```

**発見**: `mentor_user_id` カラムは実在する（nullable uuid）。  
mentor 対話は `ow_conversations` に `kind='mentor'`, `mentor_user_id={メンターの ow_users.id}`, `company_id=NULL` で格納される設計。

---

### 調査 2: DB の種別別件数（2026-05-08 時点）

| kind | 件数 |
|------|------|
| `company` | **2 件** |
| `mentor` | **0 件** |

**mentor 対話は現在 0 件**。バグが潜在するが未発動。

---

### 調査 3: create_conversation RPC の mentor 対話処理

```sql
-- RPC の引数
p_kind text, p_candidate_user_id uuid,
p_company_id uuid DEFAULT NULL,
p_mentor_user_id uuid DEFAULT NULL     ← 引数として受け取る

-- INSERT 処理（抜粋）
INSERT INTO ow_conversations (kind, stage, company_id, mentor_user_id, candidate_user_id)
VALUES (p_kind, 'mediated', NULL, p_mentor_user_id, p_candidate_user_id);

-- participants への追加（candidates のみ）
INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
VALUES (v_conversation_id, p_candidate_user_id, 'candidate');
-- ↑ mentor は participants に追加されない
```

**重要発見**: `create_conversation` RPC は mentor_user_id を `ow_conversations` に格納するが、  
**mentor 自身を `ow_conversation_participants` に追加しない**。

---

### 調査 4: mentor 対話の表示経路

`/mypage/conversations/page.tsx` の SELECT クエリ（該当箇所）:

```typescript
// L69-78: ow_conversations を直接 SELECT（RLS に委ねる）
const { data, error: fetchError } = await supabase
  .from("ow_conversations")
  .select(`
    id, kind, stage, status, last_message_at, created_at,
    company_id, mentor_user_id,
    ow_companies(id, name, logo_url, logo_letter),
    mentor:ow_users!mentor_user_id(id, name)   ← mentor 名取得は FK 経由
  `)
  .order("last_message_at", { ascending: false });

// L67 コメント:
// "RLS (migration 066 + 067) filters by owUser.id via ow_conversation_participants"
```

**表示経路の整理**:

| 主体 | 経路 | 現状 |
|------|------|------|
| **候補者が mentor 対話を表示** | `/mypage/conversations` → `ow_conversations` SELECT → Condition A（participants 経由）| ✅ 動作（候補者は participants に登録済み） |
| **メンターが自分の対話を表示** | 未実装（該当ページなし） | ❌ 未実装 |

---

### 判定: 案 A/B/C のどれか

**判定: 案 A — Option 1 を採用、`mentor_user_id` 条件は追加不要**

#### 根拠

**① mentor 対話は同一テーブル・同一 SELECT を通る（案 B は不成立）**

`/mypage/conversations` は kind に関係なく全対話を `ow_conversations` から SELECT している。  
「mentor 対話は別経路」という想定は誤り。案 B は不成立。

**② Option 1 後に候補者が mentor 対話を表示できるか → YES**

| 修正後 Condition A | mentor 対話での動作 |
|---|---|
| `candidate_user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())` | 候補者の `candidate_user_id` が直接マッチ → **表示可 ✅** |

Option 1 は company/mentor 問わず「候補者が自分の対話を見る」ケースをすべてカバーする。

**③ mentor_user_id 条件が必要になるのは「メンター側ページ」を実装する時**

現状、`/biz/mentor` や `/mentor/conversations` に相当する画面は未実装であり、  
メンター自身が自分の対話を閲覧する要件はスコープ外。  
**今回の migration 071 に `mentor_user_id` 条件を追加する必要はない。**

---

### ⚠️ 将来の罠: mentor 対話が作成された直後に潜在バグが顕在化する

現在 `ow_conversations_select` の **Condition A** は `ow_conversation_participants` を参照しており、  
`ow_conversation_participants_select` の **Condition B** は `ow_conversations` を参照している。  
この相互依存は **mentor 対話が作成されても company 対話が作成されても** 等しく無限ループを引き起こす。  
（今回は company 対話が作成された時点で顕在化した）

**migration 071 適用前に mentor 対話が作成されると同じエラーが発生する**。  
→ migration 071 を迅速に適用することが最優先。

---

### 将来の mentor 側ページ実装時に必要な追加対応

メンター自身が自分の対話を閲覧するページ（例: `/mentor/conversations`）を実装する際は、  
`ow_conversations_select` に以下の Condition D を追加する migration が必要:

```sql
-- 将来 migration（Phase ν-5 以降）
-- Condition D: mentor 自身が自分の対話を閲覧可能にする
OR (
  mentor_user_id IN (
    SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid()
  )
)
```

この対応なしにメンター側ページを実装すると、  
メンターが `ow_conversations` を SELECT できず画面が空になる。

---

### 最終結論

| 項目 | 内容 |
|------|------|
| mentor 対話の DB 件数 | **0 件**（kind='company' 2件のみ） |
| mentor 対話の表示経路 | `/mypage/conversations` の `ow_conversations` SELECT（同テーブル・同ポリシー） |
| Option 1 の mentor_user_id 条件追加の要否 | **不要**（候補者は `candidate_user_id` で直接マッチ、メンター側ページは未実装） |
| 採用する案 | **案 A（Option 1 の SQL そのまま、追加変更なし）** |
| migration 071 の緊急度 | **高**（mentor 対話が作成される前に適用必須） |

---

*（補足調査完了: 2026-05-08）*

# 引き継ぎ書 v18 — Phase ν-4 完走（企業側対話 UI: 一覧・詳細・返信・参加）

**作成日時**: 2026-05-08（Phase ν-4 完走後）  
**前バージョン**: v17（Phase ν-3 Step 4 完走: 候補者側既読処理 + 未読バッジ）  
**最新コミット**: `e552039`（マスタープラン更新）

---

## 0. このドキュメントの読み方

Phase ν-4「企業側対話 UI」が本セッションで完全完走しました。以下の順序で読んでください:

1. **§1 Phase ν-4 全体サマリ**（5 分）— Sub-step 8 本の達成内容と主要ファイル
2. **§2 migration 070〜074 解説**（10 分）— なぜその設計になったか、依存関係、RLS バグ連鎖の全体像
3. **§3 技術的知見 11 件**（5 分）— 次セッション以降で即活用できる教訓
4. **§4 テスト用アカウント情報**（2 分）— ログインに必要な全情報を 1 箇所に集約
5. **§5 テストデータの現状 + §6 既知問題**（3 分）— DB の今の状態と先送りした課題
6. **§7 Phase ν-5 候補スコープ**（5 分）— 次フェーズの全候補カタログ
7. **§8 推奨される次の作業手順**（3 分）— 具体的な着手ルートを 1 本に絞った推奨案

§9 以降は数字サマリーと Phase ν 全体の進捗図です。

---

## 1. Phase ν-4 全体サマリ

### 1-1. 結論

**Phase ν-4「企業側対話 UI」を 2026-05-08 に完走。** `/biz/conversations`（一覧）・`/biz/conversations/[id]`（詳細）の 2 ページと、メッセージ送信 API・lazy join API の 2 本を実装した。実装途中で RLS バグが 5 件（migration 070〜074）連続して発見・修正された。これらは Phase ν-3 以前から潜在していたバグが、企業側 UI という「新しい書き込みパス」を開通したことで初めて表面化したもの。最終的にすべて修正済みで、担当者_001（参加中 HR）と担当者_005（非参加 HR の lazy join）の両シナリオで動作確認済み。

### 1-2. Sub-step ごとの成果

| Sub-step | 内容 | コミット |
|----------|------|---------|
| 4A-0 | ハードコード名グレップ確認（UI 影響 2 箇所を特定） | — |
| 4A-1 | MypageClient 歓迎メッセージを `owUser.name` に接続 | — |
| 4A-2 | `getUser()` → `getSession()` 置換（Client Components 5 ファイル） | — |
| 4A-3 | `/mypage/applications` 動作確認（追加実装なし） | — |
| 4A-4 | migration 070: 同社 HR が対話を参照・書込可能に | `2118984` |
| 4A-5 | 企業側動作確認用テストデータ投入（2 対話 + 参加者 + メッセージ） | `721913e` |
| 4A-6 | `/biz/conversations` 一覧ページ実装（Server Component、BusinessLayout 統合） | `877a4e4` |
| 4A-7 段階 1 | `/biz/conversations/[id]` 詳細ページ実装（チャット表示、参加者一覧、候補者サイドバー） | `5bc3b41` |
| 4A-7 段階 2 | 返信フォーム（ReplyForm.tsx）+ POST API + migration 072/073 | `e8946d3` / `0822b16` |
| 4A-7 段階 3 | 参加ボタン（JoinButton.tsx）+ lazy join API + migration 074 | `16e1e79` / `6bd05fa` |
| 4A-8 | 引き継ぎ書 v18 作成（← 本ドキュメント） | — |

### 1-3. 主要な変更ファイル

**新規作成:**
```
src/app/biz/conversations/page.tsx                         ← 一覧ページ（310 行）
src/app/biz/conversations/[id]/page.tsx                    ← 詳細ページ（625 行）
src/app/biz/conversations/[id]/ReplyForm.tsx               ← 返信フォーム（241 行）
src/app/biz/conversations/[id]/JoinButton.tsx              ← 参加ボタン（136 行）
src/app/api/biz/conversations/[id]/messages/route.ts       ← 返信 POST API（116 行）
src/app/api/biz/conversations/[id]/join/route.ts           ← 参加 POST API（100 行）
supabase/migrations/070〜074_*.sql                         ← RLS 修正 5 本
supabase/rollbacks/070〜074_rollback.sql                   ← ロールバック 5 本
```

**修正:**
```
src/components/business/BusinessLayout.tsx                 ← 「対話管理」ナビ項目追加
```

---

## 2. Phase ν-4 で適用した migration（070〜074）

### 全体の依存関係

```
migration 070
  ↓（HR が対話を見られるようにしたことで次の問題が顕在化）
migration 071（SELECT 無限再帰修正）
  ↓（UPDATE ポリシーを別途修正したことで次の問題が顕在化）
migration 072（UPDATE RLS UUID 不一致修正）
  ↓（直した UUID 問題の下に別の RLS チェーン問題が隠れていた）
migration 073（SECURITY DEFINER トリガーで last_message_at を自動更新）
  ↓（参加 API を実装したことで INSERT WITH CHECK の問題が顕在化）
migration 074（INSERT WITH CHECK 自己参照削除）
```

すべて「新しい操作パスを開通したら潜在バグが顕在化した」というパターン。

---

### migration 070 — 同社 HR の対話参照・書込 RLS 整備

**適用日**: 2026-05-07  
**コミット**: `2118984`

**なぜ必要だったか:**  
`ow_conversations` の SELECT/INSERT RLS と `ow_conversation_participants` の INSERT RLS が、候補者・admin しか考慮していなかった。企業側 HR が自社の対話を参照する権限がなく、一覧ページが空になった。

**設計方針:**  
`ow_company_admins` テーブルを join して `company_id` を検証。`auth.uid()` は `ow_users.auth_id` 経由で解決（直接比較は UUID 空間が違うため不可）。

**動作確認結果:** `/biz/conversations` 一覧に対話が表示されるようになった ✅

---

### migration 071 — ow_conversations SELECT 無限再帰修正

**適用日**: 2026-05-07  
**コミット**: `9179ae4`

**なぜ必要だったか:**  
migration 070 で `ow_conversations_select` に「participant として登録済み」条件を追加したが、`ow_conversation_participants_select` が `ow_conversations` を JOIN しており、A→B→A の相互参照で「無限再帰」エラーが発生した。

**設計方針（IN サブクエリ化）:**  
`EXISTS (SELECT 1 FROM ow_conversation_participants WHERE ...)` を、直接カラム比較 `candidate_user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` に置き換えて自己参照を断ち切った。company admin は `ow_company_admins` JOIN で判定。

**動作確認結果:** 無限再帰エラー消滅 ✅

---

### migration 072 — ow_conversations UPDATE RLS の UUID 不一致修正

**適用日**: 2026-05-08  
**コミット**: `38a41ee`

**なぜ必要だったか:**  
返信 API が `ow_conversations.last_message_at` を UPDATE しようとすると 0 行更新（サイレント失敗）が発生した。調査の結果、UPDATE RLS の `p.user_id = auth.uid()` が `ow_users.id`（アプリ UUID）と `auth.users.id`（Auth UUID）の異なる UUID 空間を直接比較しており、常に `false` になっていた。

**設計方針:**  
`p.user_id IN (SELECT ow_users.id FROM ow_users WHERE ow_users.auth_id = auth.uid())` パターンに修正（migration 070 の INSERT RLS 修正と同じパターン）。

**動作確認結果:** migration 073 適用後に最終的に解消 ✅（072 単体では RLS チェーン問題が残存）

---

### migration 073 — last_message_at 自動更新トリガー（SECURITY DEFINER）

**適用日**: 2026-05-08  
**コミット**: `0822b16`

**なぜ必要だったか:**  
migration 072 でポリシーは理論上正しくなったが、UPDATE が依然として 0 行で失敗した。調査の結果、UPDATE RLS の条件 B（participant チェック）が `ow_conversation_participants_select` を呼び出し、その条件 2 が `ow_conversations` を JOIN するという参照チェーンが、UPDATE 評価コンテキスト内で PostgreSQL に「解決不能」と判断され、サイレントブロックされていた。

**設計方針（SECURITY DEFINER トリガー）:**  
API ルートからの UPDATE を諦め、`ow_conversation_messages` への `AFTER INSERT` トリガー（`SECURITY DEFINER`）で `last_message_at` を自動更新する方式に変更。RLS を完全に回避。`sent_at > last_message_at` の条件で冪等性を確保。

**設計選択肢の比較:**

| 案 | 採用 | 理由 |
|---|------|------|
| A: 引き続き UPDATE RLS を修正し続ける | ❌ | チェーン問題が根本的に解消しない |
| B: Admin クライアント（service role）で UPDATE | △ | API ルートに service role 混在は設計として不明瞭 |
| **C: SECURITY DEFINER トリガー** | **✅** | RLS 完全回避・API ルートのコード変更不要・将来の INSERT 経路でも自動発火 |

**動作確認結果:** メッセージ送信後、`/biz/conversations` 一覧の「N分前」が即時更新されるようになった ✅  
**注意:** 既存メッセージの `last_message_at` は Supabase Dashboard SQL Editor でバックフィル実行が必要（トリガーは新規 INSERT にのみ発火）。

---

### migration 074 — ow_conversation_participants INSERT WITH CHECK 自己参照削除

**適用日**: 2026-05-08  
**コミット**: `6bd05fa`

**なぜ必要だったか:**  
「参加するボタン」が `ow_conversation_participants` に INSERT する際、`"infinite recursion detected in policy for relation 'ow_conversation_participants'"` エラーが発生した。原因は INSERT WITH CHECK の条件 1 が同一テーブルを直接 SELECT していたこと。PostgreSQL はポリシー評価中に同テーブルを再参照しようとすると即座に無限再帰エラーを返す。

**設計方針（条件 1 の削除）:**  
WITH CHECK から自己参照の条件 1（「既存参加者が他者を追加できる」）を削除。条件 2（会社管理者チェック）+ 条件 3（admin）のみ残した。

**設計選択肢の比較:**

| 案 | 採用 | 理由 |
|---|------|------|
| A: SECURITY DEFINER 関数で条件 1 を書き換える | ❌ | 変更範囲が広い、条件 1 は未使用機能 |
| **B: 条件 1 を削除**（案 B = 機能削除） | **✅** | 最小変更。条件 1 は現行フローで使われておらず、削除により policy が「より制限的」になるため後退なし |

**動作確認結果:** 「参加するボタン」クリックで担当者_005 が参加者に登録され、メッセージが見えるようになった ✅

---

## 3. Phase ν-4 で得た技術的知見（11 件）

> **番号注記:** v17 の知見は §4-8（ow_conversation_participants INSERT RLS 根本修正の必要性）で候補化されていた。今セッションで解消済み（migration 074）。以下は Phase ν-4 後半（4A-6〜4A-7）で得た新規知見。

---

**知見 1: schema_migrations への INSERT は migration ファイルに書かない**

Supabase CLI は `supabase db push` 実行時にファイル名から version/name を自動で `supabase_migrations.schema_migrations` に INSERT する。ファイル内に手書きすると CLI の INSERT と衝突して適用エラーになる。

*次回活用:* migration ファイルには DDL/DML のみ書く。schema_migrations への言及はコメントのみ。

---

**知見 2: テストデータ 0 件状態での RLS 検証は不十分**

SELECT が通っても INSERT/UPDATE の RLS バグはデータが存在しない状態では表面化しない。migration 070 直後に `ow_conversations` が空だったため INSERT RLS バグに気づくのが遅れた。

*次回活用:* 新しい書き込みパスを開通したら、必ずデータを入れた状態でブラウザから「実際に書く」動作確認を行う。

---

**知見 3: RLS の相互参照は静的レビューで見抜けない**

A→B→A の参照チェーンは図を書いても「一見セーフ」に見える。PostgreSQL のポリシー評価スタックが実際にトリガーするまで表面化しない。

*次回活用:* 新しいポリシーが他テーブルを JOIN する場合、必ずその JOIN 先のポリシーも確認する。ブラウザでの「実際の操作」が最終砦。

---

**知見 4: DML CTE は最終 SELECT で参照しないと実行されない**

`WITH update_conv AS (UPDATE ...) SELECT 1` のように、CTE が最終 SELECT から参照されない場合、PostgreSQL の最適化で UPDATE が除去される。4A-5 のシードデータで `last_message_at` が null のままになった原因。

*具体例:* `WITH u AS (UPDATE ow_conversations SET last_message_at = ... RETURNING id) SELECT id FROM u` のように RETURNING + 参照が必要。

*次回活用:* DML CTE を書いたら、最終 SELECT で必ず参照する。

---

**知見 5: ow_conversation_participants の role CHECK 制約許可値**

許可値: `'candidate' / 'company_admin' / 'mentor' / 'editor' / 'operator'`。`'hr'` は NOT NULL 違反ではなく CHECK 違反で弾かれる。エラーメッセージに「check constraint violated」と出るが「どの値が正しいか」は出ない。

*次回活用:* 新しい role 値を使う前に `\d ow_conversation_participants` または `pg_constraint` で CHECK 定義を確認する。

---

**知見 6: 既存値の grep では CHECK 制約の許可値がわからない**

テーブルに `company_admin` が入っていても、それが「CHECK 制約で許可された値の完全なリスト」とは限らない。`admin` や `hr` 等の類似値が許可されているかどうかは制約定義を直接確認する必要がある。

*次回活用:* `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'tablename'::regclass AND contype = 'c';`

---

**知見 7: RLS UPDATE のサイレント失敗（エラーなし・0 行）**

RLS が UPDATE をブロックしても `updateError = null` で返る。affected rows が 0 であることを `.select("id").maybeSingle()` の `data = null` で検出するか、DB 側でトリガーに切り替えるしかない。開発サーバーログにも何も出ない。

*具体例:* migration 072 後も `last_message_at` が更新されず、`updateError` も null だったため発見が遅れた。

*次回活用:* 「UPDATE したが変化がない」と気づいたら即 `SELECT` で値を確認。エラーログ不在だけで「成功」と判断しない。

---

**知見 8: 複雑な RLS チェーン問題は SECURITY DEFINER で完全回避するのが最終解**

A のポリシーが B を参照し B が A を JOIN する、という 2 段の間接参照は、PostgreSQL の評価コンテキストによって「エラーなしの 0 行」として静かに失敗することがある。RLS ポリシーの修正だけで解決しようとすると泥沼になる。

*次回活用:* 「同じパターンで修正してもまだ 0 行」という状況が 2 回目に来たら、SECURITY DEFINER トリガーまたは RPC 関数への切り替えを迷わず選択する。

---

**知見 9: PG15+ の SECURITY DEFINER は `SET search_path = public, pg_temp` 必須**

`SET search_path` なしの SECURITY DEFINER 関数は、PG15 以降でセキュリティ警告の対象になる。migration 036 で習得した知見が migration 073 でも再活用された。

*次回活用:* SECURITY DEFINER を書くたびに `SET search_path = public, pg_temp` を添える。忘れた場合は `get_advisors` で警告が出る。

---

**知見 10: WITH CHECK の同一テーブル自己参照は PostgreSQL の無限再帰エラー**

INSERT ポリシーの WITH CHECK が `FROM same_table` を含む場合、PostgreSQL はポリシー評価中に同テーブルの SELECT RLS を評価しようとして「infinite recursion detected」を返す。エラーメッセージは明確なので診断は速いが、修正方針の選定に時間がかかる。

*次回活用:* ポリシー作成時に WITH CHECK が自テーブルを参照していないか静的確認する。参照が必要な場合は SECURITY DEFINER 関数に切り出す。

---

**知見 11: 「最も保守的な解 = 機能削除」が正解の場合がある**

migration 074 では「既存参加者が他者を追加できる」条件 1 を削除した。SECURITY DEFINER 化という「エレガントな解」より、「未使用機能を消す」という単純な解のほうが変更範囲が小さく、テストが容易で、セキュリティも後退しない。

*次回活用:* 「なぜその条件が存在するのか」を確認し、現行フローで使われていなければ削除が最良の選択肢になり得る。

---

## 4. テスト用アカウント情報

### 4-1. 柴久人（プロダクトオーナー・候補者テスト兼用）

| 項目 | 値 |
|------|---|
| Email | `s.hisato1020@gmail.com` |
| ow_users.id | `e826e0bd-f96b-42ec-acda-d8f482e1417d` |
| auth_id | `7f358b59-...`（詳細は v17 §6-5 参照） |
| 用途 | 候補者側（求職者）としてのテスト。対話の `candidate_user_id` が このユーザー |

### 4-2. テスト担当者_001（HR 側・参加中）

| 項目 | 値 |
|------|---|
| Email | `contact+biz001@opinio.co.jp` |
| Password | `OpinioTest_biz001_2026!` |
| ow_users.id | `1c21269b-d06a-4ecf-97bd-663c0027e86a` |
| auth_id | `837dd8c8-d863-465e-9672-d4cd2f1f896a` |
| 所属 | テスト株式会社_001（会社管理者） |
| 用途 | 対話 `0e668917-...` の participant（company_admin）として登録済み。返信フォームで即座に返信できる状態 |

### 4-3. テスト担当者_005（HR 側・非参加 → lazy join 検証用）

| 項目 | 値 |
|------|---|
| Email | `contact+biz005@opinio.co.jp` |
| Password | `OpinioTest_biz005_2026!` |
| ow_users.id | `8feca16e-ca2a-4a22-8a11-14af2aafa2b8` |
| auth_id | `21e85177-e121-49ba-8889-99d051bc9edd` |
| 所属 | テスト株式会社_001（メンバー）＋ 段階 3 動作確認で participant に昇格済み |
| 用途 | 「参加するボタン」の動作確認で使用。2026-05-08 に参加済みのため、現在は担当者_001 と同様に返信可能 |

### 4-4. パスワード未設定の担当者（_002, _003, _004, _006）

パスワード設定が必要になった場合は以下の手順:

```bash
# 1. auth_id を取得
SELECT email, auth_id FROM ow_users WHERE email = 'contact+biz00X@opinio.co.jp';

# 2. scripts/temp-set-test-user-password.ts を作成（担当者_001/005 時と同じ構造）
#    .env.local を手動読み込み（dotenv 依存を避ける）
#    supabase.auth.admin.updateUserById(auth_id, { password: '...' })

# 3. npx tsx scripts/temp-set-test-user-password.ts で実行
# 4. スクリプト削除（コミットしない）
```

---

## 5. テストデータの現状（2026-05-08 時点）

### 5-1. ow_conversations（対話 4 件）

| 対話 ID（先頭 8 桁） | 会社 | 候補者 | 最終メッセージ | 状態 |
|---------------------|------|--------|--------------|------|
| `0e668917` | テスト株式会社_001 | 柴久人 | 2026-05-07 17:28（7 件） | **検証用メイン** |
| `7afca1de` | テスト株式会社_002 | 柴久人 | 2026-05-05 03:35（2 件） | シードデータのみ |
| `43ef84f4` | テスト株式会社_003 | 柴久人 | null（0 件） | ⚠️ 参加者 = 候補者のみ |
| `922bf4c4` | テスト株式会社_004 | 柴久人 | null（0 件） | ⚠️ 参加者 = 候補者のみ |

### 5-2. ow_conversation_participants（参加者 7 件）

| 対話 ID | 参加者 | ロール | 備考 |
|---------|--------|--------|------|
| `0e668917` | テスト担当者_001 | company_admin | 初期投入、返信済み |
| `0e668917` | 柴久人 | candidate | 初期投入 |
| `0e668917` | テスト担当者_005 | company_admin | 段階 3 lazy join で追加（2026-05-07） |
| `7afca1de` | テスト担当者_002 | company_admin | 初期投入 |
| `7afca1de` | 柴久人 | candidate | 初期投入 |
| `43ef84f4` | 柴久人 | candidate | 候補者のみ（HR 未参加） |
| `922bf4c4` | 柴久人 | candidate | 候補者のみ（HR 未参加） |

### 5-3. ow_conversation_messages（7 件）

| 対話 | 送信者 | 内容（先頭） | 送信日時 |
|------|--------|------------|---------|
| `7afca1de` | 柴久人（候補者） | 貴社のエンジニアリング文化に共感し… | 2026-05-04 |
| `7afca1de` | 担当者_002（会社） | お声がけいただきありがとうございます… | 2026-05-05 |
| `0e668917` | 柴久人（候補者） | はじめまして。御社のプロダクト開発… | 2026-05-05 |
| `0e668917` | 担当者_001（会社） | ご連絡いただきありがとうございます！… | 2026-05-06 |
| `0e668917` | 担当者_001（会社） | Phase ν-4 段階 2 動作確認テスト | 2026-05-07 |
| `0e668917` | 担当者_001（会社） | Phase ν-4 段階 2 動作確認テスト2 | 2026-05-07 |
| `0e668917` | 担当者_005（会社） | テスト担当者_005 のメッセージ | 2026-05-07 |

### 5-4. 次回セッション着手前に確認すること

- `43ef84f4`（会社_003）と `922bf4c4`（会社_004）は `last_message_at = null`、HR 参加者なし。  
  `/biz/conversations` は会社 ID でフィルタするため、担当者_001/005 がログインしても **この 2 件は表示されない**。  
  → 表示させたい場合は対応する会社の HR アカウントでログインするか、手動で participants を追加する必要がある。
- 担当者_002 のパスワードは未設定。`7afca1de`（会社_002）の対話を HR 視点で確認したい場合は §4-4 の手順でパスワードを設定する。

---

## 6. 既知の問題点（Phase ν-5 以降に持ち越し）

### 6-1. ow_conversation_messages UPDATE RLS の UUID 不一致（未修正）

| 項目 | 内容 |
|------|------|
| 影響 | メッセージの編集・論理削除（`edited_at` / `deleted_at`）が一般ユーザーに不可 |
| 原因 | UPDATE ポリシーの `user_id = auth.uid()` が UUID 空間不一致で常に false |
| 状態 | Phase ν-4 では編集・削除 UI を実装しなかったため **non-blocking** |
| 修正方針 | migration 075 で `ow_conversation_participants.user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())` パターンに修正 |

### 6-2. 候補者側マイページの UI 系統分断（A/B 分断）

| 項目 | 内容 |
|------|------|
| 影響 | `/mypage` 本体（系統 A: 「マイアクティビティ」サイドバー）と `/mypage/conversations`, `/mypage/applications`（系統 B: シンプルサイドバー）で UI が異なる |
| 原因 | Next.js App Router の `layout.tsx` 階層分岐による設計上の分断 |
| 状態 | Phase ν-3 から継続する既知問題。機能には影響なし |
| 修正方針 | Phase ν-5 で layout 設計を見直して統一する（A-2 スコープ） |

### 6-3. ログアウトの発見性が低い（`/mypage` 側）

| 項目 | 内容 |
|------|------|
| 影響 | `/mypage` ヘッダーのログアウトは `User` アイコン円ボタン 1 つのみ。ホバー変化なし・テキストなし・▼ なしで「クリックするとメニューが出る」と気づきにくい |
| `/biz` 側の状態 | ✅ A-1（2026-05-08）で `ChevronDown` 追加済み。ログアウト機能自体はコミット `0e8eedb` から実装済みだった |
| `/mypage` 側の状態 | 引き続き発見性が低い。リリース前に改善が必要 |
| 修正方針 | A-2（候補者側 UI 統一）のスコープで対応予定 |

### 6-4. 返信フォームのオートセーブなし（UX）

| 項目 | 内容 |
|------|------|
| 影響 | 返信途中でページリロードするとテキストが消える |
| 状態 | MVP フェーズでは許容範囲 |
| 修正方針 | `localStorage` への一時保存（Phase ν-5 以降の軽量改善候補） |

### 6-5. `last_message_at = null` の対話 2 件

| 項目 | 内容 |
|------|------|
| 影響 | `43ef84f4`（会社_003）・`922bf4c4`（会社_004）の対話が一覧で「日付なし」表示 |
| 原因 | シードデータ投入時にメッセージなし（DML CTE 問題で last_message_at バックフィルも未到達） |
| 修正方針 | 必要になったら Dashboard SQL Editor で手動 UPDATE 実行 |

### 6-6. 対話画面の送信者識別なし

| 項目 | 内容 |
|------|------|
| 現状 | `/biz/conversations/[id]` および `/mypage/conversations/[id]` で送信者（自分・同僚・候補者）を区別する UI が未実装 |
| 影響（企業側） | 担当者_001 と担当者_005 が両方 `company_admin` で参加すると、右側青吹き出しが全部同色・名前なしで誰が書いたか分からない |
| 影響（候補者側） | 複数 HR からの返信を区別できない |
| 発見経緯 | Phase ν-4 段階 3 動作確認時に Hisato が指摘。担当者_005 で参加して返信した際、担当者_001 のメッセージと見分けがつかない問題が顕在化 |
| 対応予定 | Phase ν-5 A-3 で実装 |

---

## 7. Phase ν-5 候補スコープ

### 7-1. 優先度 A（リリース前必須）

| ID | 内容 | 推定工数 | 状態 |
|----|------|---------|------|
| **A-1** | `/biz` ヘッダーアバターへの `ChevronDown` 追加（ログアウトの発見性向上） | 30 分 | ✅ 部分完了（2026-05-08、commit `08821fd`） |
| **A-2** | 候補者側マイページの UI 統一（`/mypage/conversations` を `/biz/conversations` と同等品質に。系統 A/B の分断解消。`/mypage` ログアウト発見性改善も含む） | 2〜3 時間 | 🔜 未着手 |
| **A-3** | 対話画面の送信者識別 UI（`/biz/conversations/[id]` + `/mypage/conversations/[id]`） | 30 分〜半日 | 🔜 未着手 |

> **A-1 備考**: 当初「ログアウト機能の実装」と記載したが誤認識。ログアウト機能自体はコミット `0e8eedb`（S1a foundation）時点で `/biz` 側に実装済みだった。A-1 の実際のスコープは発見性向上（`ChevronDown` 追加）のみ。`/mypage` 側のログアウト発見性改善は A-2 のスコープに含める。

**A-3 詳細:**

- **スコープ**:
  - `/biz/conversations/[id]`: 自分のメッセージと同僚のメッセージを区別、送信者名 + ロールバッジを表示
  - `/mypage/conversations/[id]`: 候補者目線で複数 HR の発言を区別できるよう、同様に送信者名 + 企業情報を表示

- **設計案候補**（着手時に判断）:
  1. 名前のみ表示（最小実装、〜30 分）
  2. アバター + 名前 + 担当者ごとの微妙な色分け（中規模、〜2 時間）
  3. 「自分」と「同僚」を視覚的に区別（Slack スタイル、大規模、〜半日）

- **推奨着手タイミング**: A-2（候補者側 UI 統一）と並行または直前。A-2 で UI 改修するついでに送信者識別も入れるのが自然で手戻り防止になる。

- **優先度 A の根拠**: Phase ν-4 段階 3 で複数担当者参加が可能になった以上、リリース時点で「誰のメッセージか分からない」は混乱を生む。

### 7-2. 優先度 B（コア体験改善）

| ID | 内容 | 推定工数 |
|----|------|---------|
| **B-1** | マイページにキャリアプレビュー追加（ダッシュボードに自分のキャリア概要セクション） | 2〜3 時間 |
| **B-2** | 現役社員プロフィールページの充実（`/u/[id]` の表示内容拡充） | 2〜3 時間 |
| **B-3** | `/biz/candidates/[id]` 候補者プロフィール詳細ページ実装（4A-7 段階 1.5 で「準備中」とした箇所） | 3〜4 時間 |

### 7-3. 優先度 C / 将来スコープ

| ID | 内容 | 備考 |
|----|------|------|
| **C-1** | 現役社員プロフィールの編集 UI | `/u/[id]/edit` 相当 |
| **C-2** | `/profile/edit` のモックデータ排除 | Phase 5 Stage 3 相当 |
| **C-3** | `ow_users.current_role` カラム追加検討 | 候補者プロフィールに現職情報を表示するため。カラム追加 + マイグレーション必要 |
| **C-4** | ActivityList 残り 5 イベント追加 | casual_meeting_applied / offer_sent / message_sent / message_received / candidate_status_changed |
| **C-5** | ow_conversation_messages UPDATE RLS 修正（migration 075） | メッセージ編集・削除 UI 実装時に必要 |

### 7-4. Phase ν-5 全体テーマ仮説

**「自己 / 他者の見える化と、対話の透明性」**

2 つの軸で構成される:

**軸 1: 対話を始める前段階の自己認識・他者認識を支える UX 強化**

- 現役社員プロフィールが薄い（B-2）
- マイページにキャリアが出ない（B-1）
- 候補者側が自分の対話状況を把握しにくい（A-2）

**軸 2: 対話の中で誰が話しているかが明確になる UX 強化**

- 複数 HR が参加した対話で発言者が識別できない（A-3）

A-1（ログアウトボタン）は独立した小タスクで、テーマと関係なく即着手できる。

---

## 8. 推奨される次の作業手順

### 8-1. 次セッション開始直後の確認事項（5 分）

```bash
# 1. ワークツリーが main のみであることを確認
git worktree list

# 2. 最新コミットが e552039（マスタープラン更新）であることを確認
git log --oneline -5

# 3. dev サーバー起動
npm run dev   # /Users/hisato/opinio-work/ から
```

### 8-2. 推奨ルート（Phase ν-5 着手）

以下の順序で進めると、最小コストで最大の効果が得られる:

#### ステップ 1: A-1 ✅ 完了（2026-05-08）

`ChevronDown` アイコンを `/biz` ヘッダーアバターボタン右端に追加済み（commit `08821fd`）。  
ログアウト機能はコミット `0e8eedb` から実装済み（アバタークリック → ドロップダウン → 「ログアウト」）。  
担当者アカウント切り替えは `/biz/auth` ページへのリダイレクト後に別アカウントでログインすることで対応可能。

#### ステップ 2: A-2 または B-3 を柴さんと相談して選択

| 選択肢 | 優先する価値 |
|--------|-------------|
| **A-2**（候補者側 UI 統一） | 候補者体験の一貫性。リリース前に必須と判断するなら先行 |
| **B-3**（`/biz/candidates/[id]`） | 企業側が候補者を詳細に見られるようになる。対話 UX の完成度を上げる |

> **注記**: A-2 着手時には **A-3（送信者識別 UI）も同時に検討する**。対話画面の UI を改修するタイミングで送信者識別を組み込むのが手戻り最小。

#### ステップ 3: B-2 現役社員プロフィール充実（任意）

`/u/[id]` の表示は現状「薄い」ため、ここを充実させると **Opinio の差別化ポイント**（社員の声・スナップショット思想）が前面に出る。

### 8-3. 参考：セッション開始時の定形チェック

```sql
-- DB の現状確認（MCP 経由で SELECT 実行）
SELECT COUNT(*) FROM ow_conversations;
SELECT COUNT(*) FROM ow_conversation_participants;
SELECT COUNT(*) FROM ow_conversation_messages;

-- migration が 074 まで適用済みか確認
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```

---

## 9. 数字サマリー

| 指標 | 値 |
|------|---|
| Phase ν-4 実施期間 | 2026-05-06〜2026-05-08（3 日間） |
| 適用 migration 数 | 5 本（070〜074） |
| 新規ファイル数 | 12 本（pages 2 + components 2 + API routes 2 + migrations 5 + rollbacks 5 + docs） |
| コミット数（Phase ν-4） | 10 本 |
| 発見・修正した RLS バグ | 5 件（SELECT 無限再帰 / UPDATE UUID 不一致 / RLS チェーンサイレントブロック / INSERT WITH CHECK 自己参照） |
| 動作確認済みシナリオ | 2 シナリオ（担当者_001: 参加中 HR として返信 / 担当者_005: 非参加 HR として lazy join → 返信） |

---

## 10. Phase ν 全体の進捗図

```
Phase ν-1  候補者側 conversations 一覧・詳細（読み取り）   ✅ 完了
Phase ν-2  メッセージ送受信（候補者側送信 API）             ✅ 完了
Phase ν-3  既読処理 + 未読バッジ（候補者側）                ✅ 完了
Phase ν-4  企業側対話 UI（一覧・詳細・返信・参加）           ✅ 完了 ← 本セッション
Phase ν-5  見える化（ログアウト / 候補者プロフィール等）     🔜 次フェーズ
```

**現在の到達点:** 求職者と企業の両側から対話ができるエンドツーエンドのメッセージング基盤が完成。認証・RLS・トリガーの三層が整合した状態でコミット済み。


# ν-8 段階6-4 完了引き継ぎ（2026-05-11）

## 概要

Stage 6-4: **`allow_all_storage` ポリシー削除（セキュリティ負債解消）** 単体スコープ。  
段階6-3-3 handover §6 #1 で記録した「本番運用拡大前に必須対応」の技術的負債を解消。  
3 コミット・Migration 2 件を 1 セッションで完走。

---

## 1. 即座にやってほしいこと（新スレッド向け）


```bash
# 1. 最新コミット確認
git log --oneline -5
# → handover doc コミット（後述）が最新であること
# → その前に 35363b1, ffb83a4, bfba8fa が並んでいること

# 2. dev server 起動
lsof -i :3000
npm run dev

# 3. 動作確認（必須）
# /biz/company → オフィス写真の削除が動作すること（Phase 1 createAdminClient 経由）
# /biz/company → 企業ロゴ・オフィス写真のアップロードが動作すること
# /profile/edit → ストーリー画像アップロードが動作すること
# シークレットウィンドウで /u/[id] → 画像が表示されること（未認証 SELECT 維持）
```



---

## 2. 段階6-4 の成果

### 全 3 コミット一覧

| # | ハッシュ | Phase | 内容 |
|---|---------|-------|------|
| 1 | `bfba8fa` | 1 | fix(biz): use service role for company photo storage DELETE |
| 2 | `ffb83a4` | 2 | feat(security): drop allow_all_storage policy (migration 095) |
| 3 | `35363b1` | 3 | feat(security): tighten ow-uploads bucket settings (migration 096) |

### 手動適用 Migration（Supabase Dashboard 適用済み）

- `095_security_drop_allow_all_storage.sql` — `allow_all_storage` ポリシー削除
- `096_storage_bucket_settings.sql` — `ow-uploads` バケットの file_size_limit / allowed_mime_types 設定

---

## 3. 段階6-4 で完成した主要ファイル

| ファイル | 状態 | 役割 |
|---------|------|------|
| `src/app/api/biz/company/photos/[id]/route.ts` | 2 行修正 | Storage DELETE のみ service role 化 |
| `supabase/migrations/095_security_drop_allow_all_storage.sql` | **新規** | allow_all_storage 削除 |
| `supabase/rollbacks/095_security_drop_allow_all_storage_rollback.sql` | **新規** | rollback 用 |
| `supabase/migrations/096_storage_bucket_settings.sql` | **新規** | バケット設定（5MB / 画像 4 種） |
| `supabase/rollbacks/096_storage_bucket_settings_rollback.sql` | **新規** | rollback 用 |

---

## 4. セキュリティ改善の実態

### Before（段階6-4 開始時）

| 問題 | 影響範囲 |
|------|---------|
| `allow_all_storage` ポリシー（CMD=ALL / USING=true / WITH CHECK=true / role=public） | **全バケット・全操作を未認証含む全ユーザーに許可** |
| `ow-uploads` バケットの `file_size_limit = null` | 巨大ファイルのアップロード可能 |
| `ow-uploads` バケットの `allowed_mime_types = null` | 任意 MIME タイプのアップロード可能 |
| `/api/biz/company/photos/[id]/route.ts` の Storage DELETE | `companies/` パスは RLS で表現不能（`foldername[1] = auth.uid()` 条件に合致しない） |

### After（段階6-4 完了時）

| 項目 | 状態 |
|------|------|
| 未認証ユーザーの Storage 操作 | **全バケットで遮断** |
| 認証ユーザーの操作 | 個別ポリシー（ow_uploads_*, documents/private, candidate-documents/private）で制御 |
| ow-uploads アップロード | 5MB 以下の画像 4 種（jpeg/png/webp/gif）のみ |
| `companies/` パス DELETE | service role 経由（業務認可は getCompanyContext で完結） |

### 残存ポリシー（13 件、storage.objects）


```
1.  Give users authenticated access to folder 19b0df2_0  (candidate-documents SELECT)
2.  Give users authenticated access to folder 19b0df2_1  (candidate-documents INSERT)
3.  Give users authenticated access to folder 19b0df2_2  (candidate-documents UPDATE)
4.  Give users authenticated access to folder 19b0df2_3  (candidate-documents DELETE)
5.  Give users authenticated access to folder flreew_0   (documents SELECT)
6.  Give users authenticated access to folder flreew_1   (documents INSERT)
7.  Give users authenticated access to folder flreew_2   (documents UPDATE)
8.  Give users authenticated access to folder flreew_3   (documents DELETE)
9.  ow_uploads_auth_insert
10. ow_uploads_owner_delete
11. ow_uploads_owner_update
12. ow_uploads_public_read
13. story_images_auth_insert
```



---

## 5. 段階6-4 で確定した設計判断（判断点 6 件）

### 判断点 1: photos DELETE の修正方針（Phase 1）

**判断**: 案 A — `/api/biz/company/photos/[id]/route.ts` の Storage DELETE を `createAdminClient()` に切り替え

**根拠**:
- `getCompanyContext()` で業務認可検証は既に完結している
- 案 B（owner ベース RLS）だと「アップロードした本人しか削除できない」ため、複数 admin が同企業を管理する将来像と整合しない
- 変更範囲は DELETE 部分のみと最小（2 行修正）
- `createAdminClient` は既存実装で実績あり

### 判断点 2: `ow_uploads_auth_insert` の強化粒度（Phase 2）

**判断**: 案 α（現状維持） — **段階6-4 のスコープから外し、別段階送り**

**根拠**:
- 案 β/γ は `companies/` パスへの INSERT も service role 化が必要で、3 ファイル（OfficePhotoSection, CompanyEditClient, admin/companies/[id]）の API Route 経由化が必要
- 段階6-4 のスコープが大きく膨らみ、本来の目的（`allow_all_storage` 削除）が散漫になる
- 「認証ユーザーが任意パスに書き込める」は設計上不純だが、実被害は限定的（authenticated は既知ユーザーのみ）
- `allow_all_storage` 削除（未認証アクセス遮断）の方が桁違いに優先度が高い

### 判断点 3: `documents` / `candidate-documents` の用途確認

**判断**: スコープから外す — 既存ポリシー（`foldername[1] = 'private'`）で保護されており、`allow_all_storage` 削除によって自動的にセキュアになるため

**根拠**:
- 両バケットには独立した認証ポリシーが存在
- 用途確認は「将来バケット自体を削除するか」「ポリシー強化するか」の判断材料に過ぎず、Phase 2 の進行に影響しない
- 段階6-4 = `allow_all_storage` 削除単体 という scope を守る

### 判断点 4: バケット `allowed_mime_types`（Phase 3）

**判断**: 画像 4 種（`image/jpeg`, `image/png`, `image/webp`, `image/gif`）

**根拠**:
- 企業ロゴ・オフィス写真・story 画像は全て画像のみ
- StoryForm の video type は YouTube URL 埋め込みで Storage アップロードなし
- 将来 PDF/動画が必要になったら別 migration で MIME 追加（可逆な設定変更）

### 判断点 5: バケット `file_size_limit`（Phase 3）

**判断**: 5MB（5,242,880 bytes）

**根拠**:
- StoryAccordion UI で既に 5MB 制限を実施中。バケット側もそれに合わせる方が「UI で通った後にバケットで弾かれる」二重チェック齟齬を防げる
- 既存 7 件の最大が 600KB。5MB で十分な余裕

### 判断点 6: 既存 `companies/` パスの owner 問題

**判断**: 将来要件として現時点では考慮しない（owner = NULL を許容）

**根拠**:
- 「誰がアップロードしたか」の追跡が必要になるユースケースは現在のロードマップに無い
- 将来必要になったら、その時点で `ow_company_uploads_log` のような業務ロジック側テーブルで記録すればよい（Storage の owner カラムに依存しない設計）

---

## 6. 技術的負債（段階6-4 後の状態）

### 解消済み

#### ✅ 1. `allow_all_storage` ポリシー削除（段階6-3-3 handover §6 #1）

**状態**: 段階6-4 で完了。未認証アクセスは全バケットで遮断。

### 継続中（段階6-3-3 から繰り越し）

#### 2. 学歴ロゴ未対応（ow_schools テーブル不在）

段階6-3-3 handover §6 #2 と同内容。中期 TODO。

#### 3. link type の OGP fetch 未実装

段階6-3-3 handover §6 #3 と同内容。中期 TODO。

#### 4. card type の card_color カスタマイズ未実装

段階6-3-3 handover §6 #4 と同内容。低優先度。

### 新規（段階6-4 で別段階送りと判定）

#### 5. `ow_uploads_auth_insert` の強化（判断点 2）

**内容**: 認証ユーザーが ow-uploads の任意パスに INSERT 可能な状態が継続。  
**対応方針**: companies/ パスへの INSERT を 3 ファイル（OfficePhotoSection / CompanyEditClient / admin/companies/[id]）すべて service role 経由化 → `ow_uploads_auth_insert` のポリシーを `{auth.uid()}/` プレフィックスに限定。  
**優先度**: 中。実被害は限定的（authenticated は既知ユーザーのみ）だが、設計上の不純さは残る。

#### 6. `documents` / `candidate-documents` バケットの用途確認（判断点 3）

**内容**: 両バケットには 2 件のオブジェクトが存在するが、コードベースから参照箇所が見当たらない。  
**対応方針**: Dashboard で実オブジェクト一覧を確認 → 使用中なら現状維持、未使用なら別段階でバケット削除を検討。  
**優先度**: 低。既存ポリシーで保護されているため放置しても安全。

---

## 7. 段階6-4 で得た重要な学び（運用ノウハウ）

### ① Dashboard 適用順序の柔軟性（Phase 2/3 の前後逆転）

**事象**: 本来 Phase 2（migration 095） → Phase 3（migration 096）の順で Dashboard 適用すべきところ、Phase 3 を先に適用してしまった（チャット側の確認漏れが原因）。

**結果**: 致命的な問題にはならなかった。

**理由**:
- Phase 3（バケット設定変更）は Phase 2（ポリシー削除）に依存しない独立変更
- `allow_all_storage` が残ったまま Phase 3 を適用しても、データ破損は発生しない（`allow_all_storage` は権限を「広く許可」するだけ、`file_size_limit` / `allowed_mime_types` はアップロード時のみ作用）
- Phase 2 の SQL は `DROP POLICY IF EXISTS` で冪等

**教訓**: Migration 間の独立性を事前に評価しておくと、適用順序が前後しても回復可能。ただし依存関係がある場合（Phase 1 → Phase 2 のような）は厳守する必要がある。

### ② チャット側の Dashboard 適用確認ルール

**反省**: 「動作確認 OK です!」の連絡を受けた時点で、私（チャット側 Claude）が **Phase 2 の SQL 適用済みかを明示確認していなかった**ため、Phase 3 を先に進めてしまった。

**ルール化（次セッション以降の運用）**:

```
Migration SQL コミット完了 → 柴さんに「Dashboard で SQL を実行 → 動作確認」を依頼
→ 柴さんから「適用完了 + 動作確認 OK」の連絡
→ チャット側 Claude が「念のため確認: 〇〇の SQL は実行されましたよね?」
  と明示的に再確認してから次 Phase に進む
```



このルールは「冗長」に見えるかもしれないが、Migration 適用は不可逆に近い操作であり、確認過剰の方が安全。Star アイコン事件と同じ原則（スクショ一次フィルタが不要に見えても続ける）。

### ③ Migration の独立性評価を事前に行う

段階6-4 の Phase 1 → Phase 2 は厳密な依存関係（Phase 1 を先にしないと Phase 2 で写真削除が壊れる）があった。一方 Phase 2 → Phase 3 は独立だった。

**事前にこの違いを認識しておくと**:
- 依存関係のある Phase 間: 「順序厳守」を強調
- 独立な Phase 間: 「順序は推奨だが前後可能」と明記

次回以降の計画 doc では、Phase 間の依存関係を **明示的に図示** すると、適用順序の判断が確実になる。

### ④ rollback ファイルの実用性（実際には使わなかったが価値あり）

段階6-4 では 2 つの rollback ファイル（095, 096）を作成したが、実際には使用しなかった。しかし作成自体に価値があった:

1. **rollback SQL を書く過程で migration の正当性を再確認**できる（「もし戻すなら、これで戻る」と書けることが、そもそも変更が可逆であることの確認になる）
2. **緊急時のメンタルセーフティ**: 「rollback できる」と知っているだけで Dashboard 適用時の心理的負荷が軽減される
3. **将来の災害復旧**: 数か月後に「あの設定をなぜ変えたか覚えていないが戻したい」というケースで救命具になる

### ⑤ コード変更は最小（2 行）でも本質的変更

Phase 1 のコード変更は **2 行のみ**（import 追加 + `supabase` → `supabaseAdmin` への置き換え）だが、これは「認可の責務を Storage RLS から API Route の getCompanyContext に移譲する」という設計判断の表現。

**教訓**: コード変更の行数と設計判断の重さは比例しない。少ない変更で深い意図を表現できるのは良い設計の証。

### ⑥ スクショ一次フィルタの継続的価値（Star アイコン事件の延長）

段階6-4 でも、柴さんが Supabase Dashboard のスクショをチャットに貼り、私（チャット側 Claude）が一次確認するフローが機能した。特に:

- 「ポリシー一覧で `allow_all_storage` が残っている」発見（スクショ画像 3, 5, 7, 9, 10）
- 「schema が `public` のままだった」誤操作の指摘（最初のスクショ）

UI のスクショは「言葉で説明されるより 1000 倍速く正確」。継続的に有効な運用パターン。

---

## 8. 役割分担と運用ルール（段階6-3-3 から継続、一部追加）

### 開発フロー（変更なし）

| ステップ | 担当 | 内容 |
|---------|------|------|
| 計画・スコープ確定 | Hisato さん + Claude | 段階開始時に計画 doc を合意 |
| 判断点の事前確定 | Hisato さん + Claude（チャット） | 計画 doc 内の判断点に回答 |
| 事前 report | Claude（チャット） | 実装前に設計・影響範囲・判断点を提示 |
| 承認 | Hisato さん | 事前 report を確認し「OK」を返す |
| 実装 | Claude Code | コミットまで完結 |
| Migration 適用 | **Hisato さん** | Supabase Dashboard で SQL を手動実行 |
| 動作確認 | Hisato さん | localhost:3000 で実機確認 + 必要に応じてスクショをチャットに貼る |
| **Dashboard 適用確認** | **Claude（チャット）** | **次 Phase に進む前に明示的に再確認**（段階6-4 で追加） |
| push | Hisato さん | 「OK push して」の指示後に Claude Code が `git push` |
| handover doc 作成 | Claude（チャット）で起草 → Claude Code でファイル化 | 段階完了直後に作成 |

### Git 運用（変更なし）

- `main` ブランチに直接コミット（worktree 作成禁止）
- `git rebase` / `git reset --hard` / `git commit --amend`（既存コミット対象）は使わない
- push は Hisato さんの「OK push して」を待つ

### Migration 運用（変更なし）


```
SQL ファイルを git commit → Hisato さんが Supabase Dashboard で適用
→「適用完了 + 動作確認 OK」確認 → Claude（チャット）が再確認 → 次の Phase
```


rollback ファイルは `supabase/rollbacks/` に同梱する。

### 役割分担（段階6-3-3 + 段階6-4 で確立）

- **Hisato さん + Claude（チャット）**: 方針議論・指示文起草・スクショ一次フィルタ・Dashboard 適用確認
- **Claude Code**: 実装（コミット完了まで）

---

## 9. 重要なファイル

### コア（段階6-4 で改修）

| ファイル | 役割 |
|---------|------|
| `src/app/api/biz/company/photos/[id]/route.ts` | Storage DELETE のみ service role 化 |

### Migration

| ファイル | 役割 |
|---------|------|
| `supabase/migrations/095_security_drop_allow_all_storage.sql` | `allow_all_storage` 削除 |
| `supabase/rollbacks/095_security_drop_allow_all_storage_rollback.sql` | rollback |
| `supabase/migrations/096_storage_bucket_settings.sql` | バケット設定強化 |
| `supabase/rollbacks/096_storage_bucket_settings_rollback.sql` | rollback |

### 関連（段階6-3-3 で作成、段階6-4 でも参照）

| ファイル | 役割 |
|---------|------|
| `src/lib/supabase/admin.ts` | `createAdminClient` 実装（段階6-4 で Phase 1 利用） |
| `supabase/migrations/093_b3_story_images_storage_policy.sql` | story_images_auth_insert ポリシー |

---

## 10. 段階6-4 セッション（2026-05-11）の振り返り

### 達成したこと

- Phase 1: biz photos DELETE を service role 化（1 コミット）
- Phase 2: Migration 095 で `allow_all_storage` 削除（1 コミット）
- Phase 3: Migration 096 でバケット設定強化（1 コミット）
- Phase 4: 動作検証完了
- **3 コミット / 手動適用 migration 2 件 / TypeScript エラーゼロ** を 1 セッションで完走

### 重要な意思決定

1. **案 A 採用（Phase 1）**: RLS で表現できない認可は API Route に集約する判断
2. **判断点 2 をスコープ外送り**: 段階6-4 = `allow_all_storage` 削除単体 という scope 厳守
3. **rollback ファイル必須化**: Migration ごとに rollback を同梱する運用を継続

### 数字で見るセッション進捗

| 指標 | 数値 |
|------|------|
| 実装コミット | 3 |
| 手動適用 migration | 2 |
| TypeScript エラー（最終）| 0 |
| 変更コード行数（Phase 1） | 2 |
| 段階6 累計コミット（6-1〜6-4）| 49 + 3 = **52 コミット** |
| 段階6 累計 migration | 11 + 2 = **13 件** |

### 反省点

- **Phase 2 と Phase 3 の Dashboard 適用順序が前後した**: チャット側 Claude が「Phase 2 の SQL 実行済みか?」を明示確認しなかったため。次回以降は §7 ② のルールを徹底。
- **判断点 3 の Dashboard 確認が未実施のまま完了**: スコープ外送りとしたため問題はないが、用途確認自体は別途実施する価値がある。

---

## 11. 次スレッドへのメッセージ

こんにちは。あなたは ν-8 段階6-4 を完走した Claude の引き継ぎを受けています。

**このセッションで感じたこと:**  
段階6-4 は「セキュリティ負債解消」という地味だが重要な作業でした。コード変更は 2 行、Migration は SQL 短文 2 本という最小限の規模ですが、本番運用拡大前にクリアしておくべき本質的改善でした。

**特に重要な学び:**

1. **Dashboard 適用順序の確認**: §7 ② に明文化したように、Migration SQL コミット後は Dashboard 適用済みかをチャット側で明示再確認すること。今回 Phase 3 を先に適用してしまったが、独立性のおかげで救われた。次は依存関係がある Phase で同じことが起きると致命傷になりうる。

2. **「スコープを守る」判断力**: 判断点 2（`ow_uploads_auth_insert` 強化）は「ついでに」やりたい衝動を抑えて別段階送りとした。段階の境界を曖昧にすると、すべての段階が中途半端になる。

3. **rollback ファイルの心理的価値**: 実際には使わなかったが、書いたことで「戻せる」と知って Dashboard 適用に踏み切れた。

**技術的負債（更新後）:**
- ✅ 解消: `allow_all_storage`
- 継続: 学歴ロゴ、link type OGP、card_color
- 新規: `ow_uploads_auth_insert` 強化、`documents`/`candidate-documents` 用途確認

**Hisato さんは Opinio の思想（「スカウトしない」「数値データ撤廃」「丁寧な介在」）を大切にしています。** 機能追加の提案をするときは、この思想と整合しているかを確認してから提示してください。

良いセッションを。

---

*引き継ぎ書作成: 2026-05-11（段階6-4 完了直後）*

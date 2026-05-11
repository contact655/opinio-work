# ν-8 段階6-4 計画ドキュメント

**作成**: 2026-05-11  
**前段階**: 段階6-3-3（完了、`docs/handover-2026-05-11-nu8-stage6-3-3-complete.md` 参照）  
**スコープ**: `allow_all_storage` ポリシー削除（セキュリティ負債解消）

---

## 1. 段階6-4 の目的

Supabase Storage の `storage.objects` テーブルに残存する `allow_all_storage` ポリシーは、全バケット・全操作を全ユーザー（**未認証を含む**）に許可する状態になっている。これは開発初期に便宜上設置されたものだが、本番運用拡大前に必ず解消しなければならないセキュリティ負債である。

現状では `documents`・`candidate-documents`（いずれも private バケット）が理論上は誰でもアクセスできる状態になっており、ow-uploads バケットも未認証ユーザーによる任意パスへのアップロード・削除が可能になっている。dogfooding 段階の今（利用者が柴さんとごく少数）であれば、既存データへの影響を最小化しながら安全に対処できる。ユーザー数が増えてからでは移行コストが指数的に増加する。

段階6-4 は **`allow_all_storage` 削除 + 必要最小限の代替ポリシー整備** を行う単体フェーズとして位置付ける。

---

## 2. 段階6-3-3 からの引き継ぎ（技術的負債 #1）

> **1. `allow_all_storage` ポリシー削除（本番運用拡大前に必須対応）**
>
> **場所**: Supabase Dashboard → Storage → ow-uploads バケットのポリシー設定  
> **内容**: migration 093 で story images の INSERT パスを制限したが、バケット全体には `allow_all` に近いポリシーが残存している可能性がある。  
> **リスク**: 認証ユーザーが任意パスに任意ファイルをアップロードできる状態  
> **対応**: 本番ユーザーが増える前に migration で全ポリシーを精査・強化必須。手動 migration フローで対応。

*（`docs/handover-2026-05-11-nu8-stage6-3-3-complete.md` §6 より）*

---

## 3. 影響範囲の調査結果

### 3-1. Storage バケット一覧

| バケット名 | public/private | file_size_limit | allowed_mime_types | 備考 |
|-----------|---------------|----------------|--------------------|------|
| `ow-uploads` | **public** | null（無制限） | null（全種類） | 企業ロゴ・写真・story 画像 |
| `documents` | private | null | null | 用途不明（開発初期のみ?) |
| `candidate-documents` | private | null | null | 用途不明（開発初期のみ?) |

---

### 3-2. 既存 RLS ポリシー全件（storage.objects）

#### 🔴 削除対象

| ポリシー名 | CMD | USING | WITH CHECK | ロール | 問題 |
|-----------|-----|-------|-----------|--------|------|
| `allow_all_storage` | ALL | `true` | `true` | public | **未認証含む全員が全バケットに対して全操作可能** |

#### ow-uploads 向け（既存・有効）

| ポリシー名 | CMD | USING / WITH CHECK | 評価 |
|-----------|-----|-------------------|------|
| `ow_uploads_public_read` | SELECT | `bucket_id = 'ow-uploads'` | ✅ public バケットとして適切 |
| `ow_uploads_auth_insert` | INSERT | `bucket_id = 'ow-uploads' AND auth.uid() IS NOT NULL` | ⚠️ 認証ユーザーなら任意パスに書き込み可。削除後も機能するが過剰に緩い |
| `ow_uploads_owner_delete` | DELETE | `bucket_id = 'ow-uploads' AND foldername(name)[1] = auth.uid()::text` | ⚠️ パス第1セグメント = auth.uid() の場合のみ有効。`companies/` パスには効かない（後述） |
| `ow_uploads_owner_update` | UPDATE | 同上 | ⚠️ 同上 |
| `story_images_auth_insert` | INSERT | `bucket_id = 'ow-uploads' AND foldername[1] = auth.uid() AND foldername[2] = 'experience-stories'` | ✅ migration 093 で追加。StoryAccordion 向けに適切 |

#### documents / candidate-documents 向け（既存・有効）

| バケット | CMD | 条件 | 評価 |
|---------|-----|------|------|
| `documents` | ALL | `foldername[1] = 'private' AND auth.role() = 'authenticated'` | ✅ allow_all 削除後も動作継続 |
| `candidate-documents` | ALL | 同上 | ✅ 同上 |

---

### 3-3. ow-uploads 内のアップロードパスパターン（コード + 実データ）

#### コード側のパス生成

| ファイル | 操作 | パスパターン | auth.uid() プレフィックス |
|---------|------|------------|------------------------|
| `OfficePhotoSection.tsx` | INSERT + getPublicUrl | `companies/office-photos/{companyId}/{timestamp}.{ext}` | ❌ なし |
| `CompanyEditClient.tsx` | INSERT + getPublicUrl | `companies/logos/{companyId}/{timestamp}.{ext}` | ❌ なし |
| `admin/companies/[id]/page.tsx` | INSERT + getPublicUrl | `companies/headers/{id}-{timestamp}.{ext}` 等 | ❌ なし |
| `StoryAccordion.tsx` | INSERT + getPublicUrl | `{auth.uid()}/experience-stories/{uuid}.{ext}` | ✅ あり |
| `experience-story-sections/[id]/route.ts` | DELETE | `{auth.uid()}/experience-stories/{...}` （URL から抽出） | ✅ あり |
| `biz/company/photos/[id]/route.ts` | DELETE | `companies/office-photos/{companyId}/{...}` （URL から抽出） | ❌ なし |

#### 実データ（本番 DB 確認済み、2026-04-27 時点）

| パスパターン | 件数 | owner（auth.uid） |
|------------|------|-----------------|
| `companies/logos/59879917-.../...` | 6 | `4a0decfa-...`（柴さんのUID） |
| `companies/office-photos/59879917-.../...` | 1 | `4a0decfa-...` |
| `{auth.uid()}/experience-stories/...` | **0件** | — （本番未使用） |

**重要**: 全7件が `companies/` プレフィックス（auth.uid() プレフィックスなし）。  
`storage.objects.owner` カラムには auth.uid() が記録されているため、owner ベースのポリシーは使用可能。

---

### 3-4. allow_all 削除後の影響分析

| 操作 | 対象パス | 削除後の状態 | 根拠 |
|------|---------|------------|------|
| SELECT | ow-uploads 全パス | ✅ 継続 | `ow_uploads_public_read` |
| INSERT | `companies/` パス | ✅ 継続 | `ow_uploads_auth_insert` |
| INSERT | `{auth.uid()}/experience-stories/` | ✅ 継続 | `story_images_auth_insert` |
| DELETE | `{auth.uid()}/experience-stories/` | ✅ 継続 | `ow_uploads_owner_delete` |
| **DELETE** | **`companies/` パス** | **🔴 BROKEN** | `foldername[1]='companies'` ≠ `auth.uid()` |
| DELETE | `documents` / `candidate-documents` | ✅ 継続 | 既存 folder ポリシー |
| INSERT | `documents` / `candidate-documents` | ✅ 継続 | 同上 |

**最大のリスク**: `/api/biz/company/photos/[id]/route.ts` の写真削除が壊れる。

---

## 4. Phase 構成案

### Phase 1: biz company photos DELETE を修正（allow_all 削除の事前条件）

**目的**: allow_all 削除後も `companies/office-photos/` および `companies/logos/` の DELETE が動作するよう、API Route を修正する。

**問題の根本**: `/api/biz/company/photos/[id]/route.ts` は `createClient()`（ユーザーセッション）でStorage削除を呼ぶが、`companies/office-photos/...` パスの第1セグメントは `companies` であり、`ow_uploads_owner_delete` の `foldername[1] = auth.uid()` 条件に合致しない。

**修正案（判断点 → 次セクション参照）**:

**案 A（推奨）**: API Route を `createAdminClient()` に切り替え
```typescript
// /api/biz/company/photos/[id]/route.ts の DELETE 操作部分のみ変更
import { createAdminClient } from "@/lib/supabase/admin";  // 既存ファイル
// ...
const supabaseAdmin = createAdminClient();
await supabaseAdmin.storage.from("ow-uploads").remove([path]);
```
- `createAdminClient` は `src/lib/supabase/admin.ts` に実装済み
- company context 検証（`getCompanyContext`）は既に行われており、業務ロジック上の認可は保証済み
- Storage 削除のみ service role で実行

**案 B**: `ow_uploads_owner_col_delete` ポリシー追加
```sql
CREATE POLICY "ow_uploads_owner_col_delete" ON storage.objects
FOR DELETE USING (bucket_id = 'ow-uploads' AND owner = auth.uid());
```
- `storage.objects.owner` = アップロード時の auth.uid() を比較
- 欠点: **アップロードした人しか削除できない**（異なる管理者が削除できない）
- 欠点: admin ページからのアップロードには対応できない

**触るファイル（案 A）**:
- `src/app/api/biz/company/photos/[id]/route.ts` （DELETE 部分のみ修正）

**コミット数**: 1

**リスク**: 低（`createAdminClient` は既存の Admin API Route で実績あり）

---

### Phase 2: Migration 095 — allow_all_storage 削除

**目的**: `allow_all_storage` ポリシーを削除する Migration SQL を作成・適用する。

**Migration 内容案**:
```sql
-- 095_security_drop_allow_all_storage.sql

-- ① allow_all_storage 削除（全バケット全操作を全ユーザーに許可する危険ポリシー）
DROP POLICY IF EXISTS "allow_all_storage" ON storage.objects;

-- ② ow_uploads_auth_insert の強化（任意パス→特定プレフィックスのみ）
--    ※ 要判断: パス制限の粒度（下記「着手前の判断点」参照）
```

**ポリシー削除後に動作確認が必要な項目**:
1. `/profile/edit` → 職歴 → ストーリー画像アップロード（StoryAccordion）
2. `/biz/company` → 企業ロゴ アップロード（CompanyEditClient）
3. `/biz/company` → オフィス写真 アップロード・削除（OfficePhotoSection + photos API）

**フロー**:
```
Migration SQL コミット → 柴さん Supabase Dashboard で適用 → 動作確認
```

**コミット数**: 1（SQL のみ）+ 手動適用

**リスク**: Phase 1 の修正が未完了の場合、写真削除が壊れる。**Phase 1 → Phase 2 の順序を厳守**。

---

### Phase 3: バケット設定強化

**目的**: `ow-uploads` バケットの `file_size_limit` と `allowed_mime_types` を設定する。現状は両方 null（無制限・全種類）であり、不適切なファイルタイプや巨大ファイルをアップロード可能な状態。

**設定値（要判断 → 次セクション参照）**:

| 設定 | 候補値 | 検討事項 |
|------|--------|---------|
| `file_size_limit` | 5,242,880（5MB）| StoryAccordion は 5MB 制限を UI で実施中（合わせる） |
| `allowed_mime_types` | `["image/jpeg","image/png","image/webp","image/gif"]` | 企業ロゴ・写真・story 画像はすべて画像のみ。admin が PDF 等を置くユースケースがあるか要確認 |

**実施方法**:
- Supabase Dashboard → Storage → バケット設定で変更可能（Migration 不要）
- または `supabase/migrations/096_storage_bucket_settings.sql` で管理

**コミット数**: 0（Dashboard 操作のみ）または 1（Migration として記録する場合）

**リスク**: 低（既存 7 件はすべて 5MB 以下の画像ファイル）

---

### Phase 4: 動作検証 + ドキュメント更新

**目的**: 全修正が正しく動作することを確認し、セキュリティ改善を記録する。

**検証項目**:

| シナリオ | 期待結果 |
|---------|---------|
| StoryAccordion: 画像アップロード | ✅ 正常動作（story_images_auth_insert） |
| StoryAccordion: ストーリー削除（画像 cleanup） | ✅ 正常動作（ow_uploads_owner_delete） |
| /biz/company: 企業ロゴ アップロード | ✅ 正常動作（ow_uploads_auth_insert） |
| /biz/company: オフィス写真 アップロード | ✅ 正常動作（ow_uploads_auth_insert） |
| /biz/company: オフィス写真 削除 | ✅ 正常動作（Phase 1 修正後） |
| 未認証ユーザーによる任意アップロード | ❌ 拒否される |
| 未認証ユーザーによる documents アクセス | ❌ 拒否される |

**コミット数**: 0（検証のみ）+ handover doc 更新

---

## 5. 着手前に確定が必要な判断点

### 判断点 1: photos DELETE の修正方針（Phase 1）

> **案 A（推奨）**: `/api/biz/company/photos/[id]/route.ts` の Storage DELETE を `createAdminClient()` に切り替える  
> **案 B**: `storage.objects.owner` カラムベースの DELETE ポリシーを追加する  
>
> **判断が必要な理由**:  
> 案 A はシンプルだが service role の使用範囲が広がる（ただし业务ロジック検証は既存）。  
> 案 B は RLS で完結するが、アップロード者以外の管理者が削除できなくなる問題がある。

---

### 判断点 2: `ow_uploads_auth_insert` の強化粒度（Phase 2）

> 現状: 認証ユーザーなら `ow-uploads` の任意パスに INSERT 可能  
> 強化案（複数ある）:
> - **案 α（現状維持）**: INSERT は `ow_uploads_auth_insert` のまま（認証ユーザー全員が任意パスに書き込める。実被害は少ないが設計上不純）
> - **案 β（部分強化）**: companies/ パスへの INSERT は biz 側 API Route で service role を使い、ow_uploads_auth_insert から companies/ を除外するポリシーに変更  
> - **案 γ（全面強化）**: companies/ と {auth.uid()}/ のパスをそれぞれ独立したポリシーで管理
>
> **判断が必要な理由**: 強化の粒度によってコード変更の範囲が異なる。

---

### 判断点 3: `documents` / `candidate-documents` の用途確認

> 現状: private バケット、`foldername[1] = 'private'` ポリシーあり  
> 実データ: 2 件（本番では未使用に近い）  
> 問題: コードベースに `documents` / `candidate-documents` へのアップロードコードが見当たらない  
>
> **確認が必要な内容**:
> - これらのバケットは現在何のために使われているか
> - 段階6-4 で削除するか、設定を見直すだけか
> - コード側で参照している箇所があるか（追加調査が必要）

---

### 判断点 4: バケット `allowed_mime_types` の対象範囲

> ow-uploads の `allowed_mime_types` を画像のみ（`image/*`）に制限してよいか  
> **確認が必要な内容**:
> - admin ページから PDF や動画などの画像以外のファイルをアップロードするユースケースがあるか
> - 将来の機能拡張（求人票の添付 PDF 等）で変更が必要になる可能性はあるか

---

### 判断点 5: バケット `file_size_limit` の上限値

> 候補:
> - **5MB（5,242,880）**: StoryAccordion の UI 制限と一致。企業ロゴ・写真向けには少し小さい可能性
> - **10MB（10,485,760）**: オフィス写真（特に高解像度 JPEG）向けに余裕あり
> - **20MB**: 動画ファイルを扱う可能性があれば
>
> **現状**: 既存 7 件の最大ファイルは 617,385 bytes（約 600KB）。5MB で余裕あり。

---

### 判断点 6: 既存 `companies/` パスのオブジェクト owner 問題

> 既存 7 件の `owner` は全て `4a0decfa-...`（柴さんの auth.uid）。  
> Phase 1 で案 A（admin client）を採用すれば既存データの移行は不要。  
> ただし将来「owner カラムで誰がアップロードしたかを追跡する」ユースケースが生じた場合、  
> `owner = NULL`（admin client でのアップロードは owner が記録されない）が問題になる可能性がある。  
>
> **確認が必要な内容**: owner 追跡が今後の機能で必要かどうか。

---

## 6. 段階6-4 の規模見積もり

| Phase | コミット数 | Migration | 作業時間（目安） |
|-------|-----------|-----------|---------------|
| Phase 1: photos DELETE 修正 | 1 | 0 | 30分 |
| Phase 2: allow_all 削除 Migration | 1 | 1 | 60分（判断点確定後） |
| Phase 3: バケット設定 | 0〜1 | 0〜1 | 30分 |
| Phase 4: 動作検証 | 0 | 0 | 30分 |
| **合計** | **2〜3** | **1〜2** | **2〜3 時間** |

**推定セッション数**: 1 セッション（判断点が事前に全て確定している場合）  
複数セッションになりうる場合: 判断点 1〜3 が確定していない場合 → 確定作業に 30〜60 分が追加

---

## 7. 段階6-4 着手前の準備（柴さん向け）

### 必須確認事項

1. **判断点 1〜6 の回答**（上記セクション参照）  
   特に **判断点 1**（photos DELETE の修正方針）と **判断点 3**（documents バケットの用途）が最優先

2. **本番データのバックアップ確認**  
   既存 7 件の Storage オブジェクト（企業ロゴ 6 件 + オフィス写真 1 件）は削除されないが、念のためバックアップを確認  
   - Supabase Dashboard → Storage → ow-uploads → Download で手元に保存推奨

3. **`documents` / `candidate-documents` の用途確認**  
   コードベースで参照箇所が見当たらないが、Supabase Dashboard で実際のオブジェクト一覧を確認し、使用中かどうかを把握

4. **作業タイミング**  
   allow_all 削除後は **一時的に写真削除が不可能**になる（Phase 1 完了前に Phase 2 を実行した場合）。  
   Phase 1 → Phase 2 の順序を必ず守る。

### 推奨（必須ではない）

- **ステージング環境での先行検証**: Supabase の branch 機能またはローカル Supabase で migration を先にテストする（本番 DB に直接適用するリスクを下げる）
- **Migration 適用は営業時間内に**: ポリシー変更の影響を即座にモニタリングできるタイミングで実施

---

## 8. 段階6-4 で扱わない項目（スコープ外明示）

| 項目 | 理由 | 今後の対応 |
|------|------|----------|
| 学歴ロゴ未対応 | ow_schools テーブル不在、独立した機能開発が必要 | 別段階 |
| link type の OGP fetch | DB スキーマ変更（og_image/og_title カラム）が必要 | 別段階 |
| card type の card_color カスタマイズ | DB スキーマ変更（card_color カラム）が必要 | 別段階 |
| StoryAccordion の UI 変更・追加 | 段階6-3-3 で完成した機能は本フェーズで触らない | 別段階 |
| MergedTimeline の UI 変更 | 同上 | 別段階 |
| `documents` / `candidate-documents` の大幅な RLS 再設計 | 用途不明のため現状維持（判断点 3 で確認後） | 要判断 |

---

## 9. 段階6-4 開始時のチェックリスト（新スレッド向け）

```bash
# 1. 最新状態確認
git log --oneline -3
# → e264c53 が最新であること

# 2. dev server 起動
npm run dev

# 3. 現状確認
# - /biz/company → オフィス写真の削除が現在は動作すること（allow_all_storage のおかげ）
# - /profile/edit → ストーリー画像アップロードが動作すること

# 4. 判断点 1〜6 の確認（着手前に柴さんと確認済みであること）
```

---

## 10. 新スレッド開始時の挨拶テンプレ

```
段階6-4（allow_all_storage 削除）を開始したいです。

以下の計画ドキュメントを読んでください:
docs/research-2026-05-11-nu8-stage6-4-plan.md

前段階の引き継ぎ書も参照:
docs/handover-2026-05-11-nu8-stage6-3-3-complete.md

【着手前に確定している判断点】
- 判断点 1（photos DELETE 修正方針）: 案 A / 案 B
- 判断点 3（documents バケット用途）: [確認結果]
- 判断点 4（allowed_mime_types）: 画像のみ / 制限なし
- 判断点 5（file_size_limit）: 5MB / 10MB

Phase 1（biz photos DELETE 修正）から着手します。
事前 report → 承認 → 実装の流れでお願いします。
```

---

## Appendix: 既存ポリシー全件の機能評価サマリー

allow_all_storage 削除後の各ポリシーの評価:

| ポリシー | CMD | バケット | 削除後の機能 | 課題 |
|---------|-----|---------|------------|------|
| `ow_uploads_public_read` | SELECT | ow-uploads | ✅ 全パス読み取り可 | なし |
| `ow_uploads_auth_insert` | INSERT | ow-uploads | ✅ 認証ユーザーが全パスに書き込み可 | パス制限なし（判断点 2） |
| `ow_uploads_owner_delete` | DELETE | ow-uploads | ✅ `{auth.uid()}/` プレフィックスのパスのみ | `companies/` パスは効かない |
| `ow_uploads_owner_update` | UPDATE | ow-uploads | ✅ 同上 | 同上 |
| `story_images_auth_insert` | INSERT | ow-uploads | ✅ story 画像専用。適切 | なし |
| `Give users * 19b0df2_*` | ALL | candidate-documents | ✅ private/フォルダのみ。認証必須 | なし |
| `Give users * flreew_*` | ALL | documents | ✅ 同上 | なし |

---

*計画作成: 2026-05-11（段階6-3-3 完了後、同日）*

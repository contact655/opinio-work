# UUID 直アクセス検証レポート

調査日: 2026-05-14  
調査対象: `/companies/[id]` 公開ページへの is_published=false 企業の直アクセス可否

---

## 結論（2行）

- **is_published=false でも `status='active'` の企業は UUID 直アクセスで内容が丸見え**: RLS ポリシーが `is_published=true OR status='active'` という OR 条件のため、`status='active'` のまま非公開設定した企業はすり抜ける。テスト商事\_20260513\_1 と 株式会社Opinio（重複作成分）が該当。
- **hotfix スコープ**: `src/lib/supabase/queries.ts` の `getCompanyById()` に `.eq("is_published", true)`（本番のみ）を1行追加。加えて `src/app/(jobseeker)/companies/[id]/posts/page.tsx` の company クエリにも同様の追加が必要。

---

## 1. 実機検証結果

### 本番環境

`work.opinio.co.jp` は Next.js アプリの URL ではなく、ホスティングプロバイダーの「無効なURLです」エラーを返す別インフラ。HTTP 404 だが Next.js の notFound() ではない。

本番 Next.js アプリの URL が特定できなかったため、以下はコード + DB 解析による論理的検証に切り替えた。

### ローカル dev サーバー

`localhost:3000` は起動していないため直アクセス不可。

### 論理的検証の結論

| 企業名 | id（先頭8桁） | is_published | status | アクセス結果 |
|--------|--------------|-------------|--------|------------|
| テスト商事\_20260513\_1 | 52c1fea2 | false | **active** | **表示される（RLS 素通り）** |
| 株式会社Opinio（重複作成分） | cf44d740 | false | **active** | **表示される（RLS 素通り）** |
| 株式会社Third Box（初期登録分） | 100e46fe | false | draft | **notFound() になる（RLS でブロック）** |

---

## 2. RLS の実効性

### 現在有効なポリシー（pg_policies 実測）

`ow_companies` テーブルには SELECT ポリシーが **3本** 存在する:

| ポリシー名 | cmd | USING 句 |
|-----------|-----|----------|
| `ow_companies_public_read` | SELECT | `status = 'active'` |
| `ow_companies_published_read` | SELECT | `is_published = true OR status = 'active'` |
| `ow_companies_own_select` | SELECT | `auth.uid() = user_id` |

### 問題の構造

Postgres の RLS は **Permissive ポリシー同士は OR で結合**される。
つまり、上記3本のいずれか1本でも条件を満たせばアクセス可。

`ow_companies_public_read` が `status = 'active'` のみで判定しているため、
**`is_published=false` であっても `status='active'` の企業は完全に素通りする**。

`ow_companies_published_read` を後から追加した際、旧ポリシー (`ow_companies_public_read`) を
削除しなかったこと、かつ新ポリシーの USING 句にも `status='active'` を含めたことで、
`is_published` フラグが事実上無効化されている。

### is_published=false 企業の status 値（実測）

```
テスト商事_20260513_1       id=52c1fea2-df07-434e-b78d-b5a309f8e469  status=active
株式会社Opinio（重複）      id=cf44d740-b835-454d-91a3-f1e2eddc7251  status=active
株式会社Third Box（初期）   id=100e46fe-5b4d-45ba-ba4a-9316264555dd  status=draft
```

`/api/biz/company` PATCH（公開フラグ操作）が `is_published`, `published_at`, `updated_at` しか
書き込まないため、`status` カラムは非公開に戻しても変化しない。

---

## 3. getCompanyById() 呼び出し箇所

### 関数定義

**ファイル**: `src/lib/supabase/queries.ts` L382-413

```typescript
export async function getCompanyById(id: string): Promise<...> {
  const supabase = createClient();  // anon key（SSR）

  const { data, error } = await supabase
    .from("ow_companies")
    .select(COMPANY_DETAIL_COLS)
    .eq("id", id)
    .single();             // ← is_published フィルターなし
  //                          ↑ RLS のみに依存している
  ...
}
```

### 呼び出し箇所一覧

| ファイル | 行 | 呼び出し前の is_published チェック | notFound() の条件 |
|---------|----|---------------------------------|------------------|
| `src/app/(jobseeker)/companies/[id]/page.tsx` | L35 (metadata) | **なし** | result が null のみ |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | L2651 (page本体) | **なし** | result が null のみ（L2677） |
| `src/app/(jobseeker)/companies/[id]/casual-meeting/page.tsx` | L20 | **なし** | result が null のみ（L21） |

**全3箇所ともアプリケーション層の is_published チェックは存在しない**。
セキュリティはすべて RLS に委任されているが、上述の通り RLS が機能していない。

---

## 4. 関連ページの状況

### `/companies/[id]/posts/page.tsx`（L14-47）

```typescript
// generateMetadata（L16-20）
await supabase
  .from("ow_companies")
  .select("name")
  .eq("id", params.id)
  .single();   // ← is_published フィルターなし

// CompanyPostsPage（L32-37）
await supabase
  .from("ow_companies")
  .select("id, name, logo_gradient, logo_letter")
  .eq("id", params.id)
  .single();   // ← is_published フィルターなし
```

**status=active かつ is_published=false の企業は posts/ でも企業名・ロゴが表示される**。
ただし `ow_company_external_links.is_published=true` でフィルターされるため投稿内容は出ない。

### `/companies/[id]/casual-meeting/page.tsx`

`getCompanyById()` を呼んで null なら notFound() — posts 同様 is_published 無考慮。

### その他サブページ

`companies/[id]/` 配下は上記3ファイルのみ（jobs/, mentors/, articles/ などのサブパスは存在しない）。

### `/companies`（一覧ページ）

`getCompaniesForList()` が本番環境のみ `.eq("is_published", true)` を明示的に付与しており、
**一覧ページは正しく防御されている**（実装済み確認済み）。

---

## 5. 推奨される hotfix

### 重要度の整理

| 問題 | 対象 | 緊急度 |
|------|------|--------|
| `status='active'` 企業が UUID で詳細全文丸見え | `getCompanyById` + RLS | **高** |
| `posts/` ページで企業名・ロゴが出る | `posts/page.tsx` | 中 |
| `casual-meeting/` で申込フォームが表示される | `casual-meeting/page.tsx` | 中 |

### Option A: アプリ層での修正（最小スコープ、推奨）

`getCompaniesForList()` と同じパターンを `getCompanyById()` に適用する。

**`src/lib/supabase/queries.ts`（getCompanyById 内）:**

```typescript
// 変更前
const { data, error } = await supabase
  .from("ow_companies")
  .select(COMPANY_DETAIL_COLS)
  .eq("id", id)
  .single();

// 変更後
let companyQuery = supabase
  .from("ow_companies")
  .select(COMPANY_DETAIL_COLS)
  .eq("id", id);
if (process.env.NODE_ENV !== "development") {
  companyQuery = companyQuery.eq("is_published", true);
}
const { data, error } = await companyQuery.single();
```

**`src/app/(jobseeker)/companies/[id]/posts/page.tsx`（L16-20, L32-37 の company クエリ 2箇所）:**

同様に `is_published=true` フィルターを本番のみ追加。

**効果**: UUID を知っていても、is_published=false の企業は notFound() になる（dev は全件表示継続）。

**注意点**: `/biz/company` の編集プレビュー機能（is_published=false でも自社は確認したい）は
この修正の影響を受けない（`/biz/company` は `/companies/[id]` を呼ばず、独自の管理ページ）。

### Option B: RLS 修正（DB レベル、より根本的）

旧ポリシー `ow_companies_public_read` を削除し、`ow_companies_published_read` から `status='active'` を除去する。

```sql
-- migration として実行
DROP POLICY IF EXISTS "ow_companies_public_read" ON ow_companies;
DROP POLICY IF EXISTS "ow_companies_published_read" ON ow_companies;
CREATE POLICY "ow_companies_published_read"
  ON ow_companies FOR SELECT
  USING (is_published = true);
```

**注意点**: `status='active'` という判定軸を他の箇所でも使っている可能性がある。
影響範囲の確認（`getCompanies()` など）が必要。

### 推奨アクション

1. **まず Option A を実施**（1〜2行の変更、影響範囲が明確）
2. **中期的に Option B も検討**（`status` と `is_published` の役割整理を含む設計見直し）

---

## 付録: 今回の調査で確認した主要ファイル

```
src/lib/supabase/queries.ts                              getCompanyById() 定義
src/app/(jobseeker)/companies/[id]/page.tsx              詳細ページ（3箇所で getCompanyById 呼び出し）
src/app/(jobseeker)/companies/[id]/casual-meeting/       申込ページ（is_published 未チェック）
src/app/(jobseeker)/companies/[id]/posts/page.tsx        発信一覧（直接クエリ、is_published 未チェック）
supabase/migrations/031_opinio_phase1_core_schema.sql    RLS ポリシー定義元
```

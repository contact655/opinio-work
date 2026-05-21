# Claude Code 指示書：/companies カード改修（Opinio 登録者数表示）

## 0. プロジェクト前提（必ず確認）

- プロジェクトパス: `/Users/hisato/opinio-work/`
- Supabase project ref: `xtutnecqeamftygufxco`
- デプロイ: `git push origin main` → Vercel auto-deploy
- 安全ルール:
  - 1 セッション 1 タスク
  - 想定外動作が出たら停止して報告
  - 「〜のはず」禁止、事実確認してから進める
  - `npm run build` を push 前に必ず実行
- 完了後の handover は `docs/handover-2026-05-23.md` に記載

---

## 1. 背景と目的

`/companies` の企業カードに、Opinio Work 登録者ベースの「現役社員数」「OBOG 社員数」を表示する。
求人ごとに差異がある「面談OK」「勤務形態」タグは誤情報の温床になるため削除する。

### 北極星

- 「キャリア意思決定インフラ」として、その会社に Opinio に登録している現役・OBOG が何人いるかが**意思決定の最重要シグナル**になる
- 求人ベースの「面談OK」「フルリモート」は求人詳細で見ればよく、企業カードからは外す

---

## 2. 仕様（確定）

### カードレイアウト

**上段**
- 会社名

**中段**
- 都道府県
- 従業員数 300（会社規模・既存）
- 募集中 1

**下段（新規）**
- `現役 N名 / OBOG M名`（0 名でも表示、シンプルラベル）

### 削除する要素
- 「面談OK」バッジ
- 「ハイブリッド / 出社 / フルリモート」タグ

### データ定義
- **現役社員数**: `ow_user_experiences` で当該 `company_id` かつ `is_current = true` の `COUNT(DISTINCT user_id)`
- **OBOG社員数**: `ow_user_experiences` で当該 `company_id` かつ `is_current = false` の `COUNT(DISTINCT user_id)`
- 同一ユーザーが同じ会社で複数 experience を持つケース（IS→FS、出戻り等）はユニーク化して 1 名カウント
- 0 名でも `現役 0名 / OBOG 0名` と表示

### プライバシー
- 小規模企業での特定リスクは許容（追加ロジックなし）
- 全社一律で表示

### パフォーマンス設計
- `ow_companies` テーブルに `current_member_count` / `obog_count` カラムを追加
- `ow_user_experiences` への INSERT / UPDATE / DELETE 時にトリガーで自動更新
- カード表示時は `ow_companies` の直接 SELECT のみで完結（COUNT クエリを実行時に走らせない）

---

## 3. 作業フェーズ

### Phase 0: 事前調査（実装前に必ず）

以下を確認してから Phase 1 に進む。

1. `/companies` ページの実装ファイル特定
   - `src/app/(jobseeker)/companies/page.tsx`（あるいは類似パス）
   - 企業データ取得関数（おそらく `getCompaniesForListing()` 系）
   - カードコンポーネントの実装ファイル（`CompanyCard.tsx` あるいは `companies/page.tsx` 内のインライン）

2. 現状の SELECT 句で取得しているカラム一覧を確認
   - 「面談OK」「勤務形態」がどのカラムから来ているか
   - `ow_companies` テーブルに既に該当カラムが無いか確認（重複追加防止）

3. `ow_user_experiences` テーブルの構造確認
   - `company_id`, `user_id`, `is_current` カラムの存在確認
   - 既存インデックスの確認

4. 既存のマイグレーション最新番号を確認
   - `supabase/migrations/` 配下、最新が 104 のはず
   - → 新規マイグレーションは **105** にする

#### 調査出力フォーマット（厳格）

```
===== /companies 実装ファイル =====
- ページ: <パス>
- カード: <パス>（インラインなら "ページ内インライン"）
- データ取得: <関数名 + パス>

===== 現状の SELECT 句 =====
<該当箇所をコピペ>

===== 面談OK / 勤務形態の取得元 =====
- 面談OK: <カラム名 or 推定ロジック>
- 勤務形態: <カラム名 or 推定ロジック>

===== ow_user_experiences 構造 =====
- 必要カラム (company_id, user_id, is_current) 存在: YES / NO
- 既存インデックス: <一覧>

===== 既存マイグレーション最新 =====
- 最新番号: <番号>
- 新規番号: 105
```

**Phase 0 完了後、柴さんに報告して GO を待つこと。** 想定外（カラム名が違う、is_current が無い等）があればここで停止。

---

### Phase 1: マイグレーション 105 作成・適用

ファイル: `supabase/migrations/105_add_company_member_counts.sql`

```sql
-- migration: 105_add_company_member_counts.sql
-- ow_companies に Opinio 登録者カウントカラムを追加し、トリガーで自動更新する

-- 1. カラム追加
ALTER TABLE ow_companies
  ADD COLUMN IF NOT EXISTS current_member_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS obog_count INTEGER NOT NULL DEFAULT 0;

-- 2. 既存データの再集計
UPDATE ow_companies c
SET
  current_member_count = COALESCE((
    SELECT COUNT(DISTINCT user_id)
    FROM ow_user_experiences
    WHERE company_id = c.id AND is_current = true
  ), 0),
  obog_count = COALESCE((
    SELECT COUNT(DISTINCT user_id)
    FROM ow_user_experiences
    WHERE company_id = c.id AND is_current = false
  ), 0);

-- 3. インデックス（COUNT 再集計の高速化）
CREATE INDEX IF NOT EXISTS idx_ow_user_experiences_company_user
  ON ow_user_experiences(company_id, user_id);

-- 4. トリガー関数
CREATE OR REPLACE FUNCTION update_company_member_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_company_id UUID;
BEGIN
  -- INSERT / UPDATE / DELETE のいずれでも対象 company_id を特定
  target_company_id := COALESCE(NEW.company_id, OLD.company_id);

  IF target_company_id IS NOT NULL THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_user_experiences
        WHERE company_id = target_company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_user_experiences
        WHERE company_id = target_company_id AND is_current = false
      ), 0)
    WHERE id = target_company_id;
  END IF;

  -- UPDATE で company_id が変わったケース（旧 company も再集計）
  IF TG_OP = 'UPDATE'
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_user_experiences
        WHERE company_id = OLD.company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_user_experiences
        WHERE company_id = OLD.company_id AND is_current = false
      ), 0)
    WHERE id = OLD.company_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. トリガー設定
DROP TRIGGER IF EXISTS trg_update_company_member_counts ON ow_user_experiences;
CREATE TRIGGER trg_update_company_member_counts
AFTER INSERT OR UPDATE OR DELETE ON ow_user_experiences
FOR EACH ROW
EXECUTE FUNCTION update_company_member_counts();
```

#### 適用手順
1. ファイル作成
2. Supabase MCP 経由でマイグレーション適用（柴さんに確認の上）
3. 適用後の検証クエリ:
   ```sql
   -- カラムが追加されたか
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'ow_companies'
     AND column_name IN ('current_member_count', 'obog_count');
   
   -- 集計が走ったか（サンプル 5 社）
   SELECT id, name, current_member_count, obog_count
   FROM ow_companies
   ORDER BY current_member_count DESC
   LIMIT 5;
   
   -- トリガーが登録されたか
   SELECT trigger_name, event_manipulation, action_timing
   FROM information_schema.triggers
   WHERE event_object_table = 'ow_user_experiences';
   ```

#### トリガー動作確認
適用後、以下で動作検証：
1. 任意の `ow_user_experiences` レコードを 1 件 INSERT（テスト用）
2. 対応する company の `current_member_count` / `obog_count` が +1 されたか確認
3. テストレコードを DELETE
4. カウントが -1 されて元に戻ったか確認

**Phase 1 完了後、柴さんに報告。検証結果を貼って GO を待つこと。**

---

### Phase 2: データ取得ロジック修正

`/companies` ページのデータ取得関数（Phase 0 で特定したもの）の SELECT 句に以下を追加：

```typescript
.select(`
  id,
  name,
  // 既存カラム...
  current_member_count,  // 追加
  obog_count             // 追加
`)
```

TypeScript の型定義（おそらく `Company` 型 or `CompanyForListing` 型）に追加：
```typescript
current_member_count: number;
obog_count: number;
```

---

### Phase 3: カード UI 改修

#### 削除
- 「面談OK」バッジの描画箇所を削除
- 勤務形態（出社/ハイブリッド/フルリモート）タグの描画箇所を削除

#### 追加
カード下段に新規セクションを追加：

```tsx
<div className="flex items-center gap-3 text-sm text-gray-600 mt-2">
  <span className="flex items-center gap-1">
    <UserIcon className="w-4 h-4" />
    現役 {company.current_member_count}名
  </span>
  <span className="text-gray-300">/</span>
  <span className="flex items-center gap-1">
    OBOG {company.obog_count}名
  </span>
</div>
```

※ アイコンは既存のものに合わせる（lucide-react の Users / UserCheck など、現状のカードで使われているものに揃える）。

#### レイアウト確認ポイント
- 既存の「都道府県 / 従業員数 / 募集中」セクションとの行間
- 縦方向の高さが増えるため、カルーセル内の他カードと高さが揃うか
- モバイル表示での折返し

---

### Phase 4: ビルド・デプロイ・動作確認

1. `npm run build` 成功確認（TypeScript エラー 0 件）
2. ローカル `npm run dev` でカード表示の目視確認
3. `git add` → `git commit` → `git push origin main`
4. Vercel デプロイ完了を **commit hash で目視確認**（"Ready" ステータスだけで判断しない）
5. 本番 `/companies` で以下を確認:
   - 面談OK バッジが消えている
   - 勤務形態タグが消えている
   - 現役・OBOG カウントが表示されている
   - 既知の登録者がいる企業（Salesforce 等、c3664ef1）で実際の数字が出る

---

## 4. 完了条件

- [ ] マイグレーション 105 が本番適用済み
- [ ] トリガーの動作確認（INSERT/DELETE で カウント変動）が取れている
- [ ] `/companies` のカードに現役・OBOG カウントが表示されている
- [ ] 面談OK / 勤務形態タグが削除されている
- [ ] ジャンル別カルーセル 8 セクションが全部正常表示
- [ ] commit hash が Vercel ダッシュボードに反映済み
- [ ] handover-2026-05-23.md に記録

---

## 5. 想定リスクと対処

| リスク | 対処 |
|---|---|
| 既存の SELECT 句が複雑で型エラー多発 | Phase 0 で SELECT 句を先に把握、型定義の整合性を Phase 2 で確認 |
| トリガーが既存の経歴編集（/profile/edit）と干渉 | Phase 1 のトリガー動作確認で実データを 1 件操作して検証 |
| カード高さが揃わずカルーセルがガタつく | Phase 3 で `min-h-` 指定 or flexbox で固定化を検討 |
| 「面談OK」が削除困難な深い構造になっている | Phase 0 で位置特定、想定外なら停止報告 |

---

## 6. やらないこと（スコープ外）

- 求人ごとの面談OK / 勤務形態を求人カードに統合する作業（別タスク）
- ow_companies の他カラム整理
- `groupStints()` の連続走査書き直し（別タスクで実施予定、5/22 handover 参照）
- ジャンル別カルーセルのデザイン変更

---

## 7. セッション終了時のお願い

- 全 Phase 完了後、`docs/handover-2026-05-23.md` を作成
- 想定外があれば即停止して柴さんに報告
- 各 Phase 完了時に都度報告（一気通貫で進めない）

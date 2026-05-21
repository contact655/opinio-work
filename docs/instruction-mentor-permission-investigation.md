# Claude Code 指示書：メンター権限の設計判断のための事前調査

## 0. プロジェクト前提

- プロジェクトパス: `/Users/hisato/opinio-work/`
- Supabase project ref: `xtutnecqeamftygufxco`
- 安全ルール:
  - **このタスクは「調査のみ」**。コード変更・マイグレーション作成は禁止
  - 「〜のはず」禁止、事実確認してから報告
  - 想定外があれば即停止して報告

---

## 1. 背景

`/mentors` 一覧・詳細ページ実装に先立ち、「メンター権限をどう表現するか」を決めたい。

判断選択肢は 2 つ:
- **方式 A**: `ow_mentor_profiles` テーブル（新規）の存在 + `is_published = true` で判定
- **方式 B**: 既存の `ow_user_roles` に `role = 'mentor'` を追加して管理

memory にある前提:
- `ow_user_roles` は migration 043 で `candidate / admin` のみに整理された（company role 廃止）
- 「経歴 ≠ 権限」原則
- ow_users は jobseeker / mentor / company staff 共通

この前提が**現在のコードでも実際にそうなっているか**を確認した上で、A/B どちらが自然か判断したい。

---

## 2. 調査タスク

### タスク 1: ow_user_roles テーブルの現状確認

以下を Supabase MCP 経由で確認:

1. **テーブル構造**
   ```sql
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'ow_user_roles'
   ORDER BY ordinal_position;
   ```

2. **role カラムの enum / check 制約**
   ```sql
   -- enum 型なら
   SELECT t.typname, e.enumlabel
   FROM pg_type t
   JOIN pg_enum e ON t.oid = e.enumtypid
   WHERE t.typname LIKE '%role%';
   
   -- CHECK 制約なら
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'ow_user_roles'::regclass;
   ```

3. **現在登録されている role の実データ分布**
   ```sql
   SELECT role, COUNT(*) FROM ow_user_roles GROUP BY role;
   ```

### タスク 2: 既存のメンター関連実装の有無を確認

`/mentors` ページが既に動いている前提で、現状どう実装されているかを把握:

1. **`/mentors` のページ実装ファイルを特定**
   ```
   src/app/(jobseeker)/mentors/ あるいは src/app/mentors/ 配下を grep
   ```

2. **メンターのデータ取得元を特定**
   - どのテーブル/カラムからメンター情報を取得しているか
   - `ow_users` の何らかのフラグで判定しているか
   - 専用テーブルがすでに存在するか（`ow_mentor_*` などの命名）

3. **メンター詳細ページ実装の有無を確認**
   - `src/app/(jobseeker)/mentors/[id]/page.tsx` は存在するか
   - 存在する場合、現状どんなフィールドを表示しているか

### タスク 3: memory にある前提との整合性チェック

memory ベースで「ow_users は jobseeker/mentor/company staff 共通テーブル」とあるが、コード上でこれを示す証拠を探す:

1. `ow_users` のカラムに `is_mentor` 等のフラグ列があるか
2. 既存コードで「ユーザーがメンターか判定する」処理がどこかにあるか（grep `mentor`）

### タスク 4: 関連マイグレーションの確認

- migration 043（company role 廃止）の SQL 全文確認
- mentor 関連の既存マイグレーションがあるか確認

---

## 3. 報告フォーマット（厳格）

以下のフォーマットで報告すること。**全項目に YES/NO + 根拠（クエリ結果や該当行）を必ず明記**。

```
===== タスク 1: ow_user_roles の現状 =====
- カラム構成:
  <クエリ結果をテーブル形式で>
- role の許容値（enum or check）:
  <制約定義をコピペ>
- role の実データ分布:
  <COUNT 結果>

===== タスク 2: 既存のメンター実装 =====
- /mentors ページのファイルパス:
  <パス>
- メンターのデータ取得元:
  <SELECT 句または取得関数のコード>
- /mentors/[id] の存在: YES / NO
  - 存在する場合の現状フィールド: <一覧>

===== タスク 3: memory との整合性 =====
- ow_users に is_mentor 等のフラグカラムが存在するか: YES / NO
- メンター判定ロジックの所在:
  <該当コード or "存在しない">

===== タスク 4: 関連マイグレーション =====
- migration 043 の SQL 全文:
  <コピペ>
- mentor 関連の既存マイグレーション:
  <ファイル名一覧 or "なし">

===== 調査結論（Claude Code 自身の評価） =====
- 現状の設計に最も自然な選択肢: A / B
- 理由: <2-3 行で説明>
- 想定外の発見: <あれば記載>
```

---

## 4. 完了条件

- 上記フォーマットでの報告が柴さんに提示されること
- **コードやマイグレーションは一切作成しないこと**
- 報告を受けて、柴さんが A/B どちらに進むか判断する

---

## 5. やらないこと

- マイグレーション作成
- コード変更
- /mentors ページの実装
- A/B どちらかへの誘導（事実だけ報告、結論評価は最後の 2-3 行のみ）

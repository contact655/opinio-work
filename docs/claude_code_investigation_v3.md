MergedTimeline 横断対応プロジェクトの実装着手前、最終データ取得です。
**実装は一切不要、読み取りと出力のみ**。

## 前提（昨日確定済みの方針）

- 同社グループ化ロジックは **MergedTimeline.tsx 内部に追加**（career.ts は触らない）
- 型は **snake_case の CareerEntry に統一**（MergedTimeline の現状型を維持）
- `RenderEntry` に新バリアントを追加し、`buildTimeline → groupBySameCompany → groupParallelEntries` のパイプラインで処理する想定

この方針の最終確定と実装着手のため、以下4点の全文取得をお願いします。

---

## 取得対象（4ファイル全文）

### 1. `src/components/profile/MergedTimeline.tsx`（最重要・970行）

**全文出力してください**。省略禁止。長い場合はメッセージ分割可。

特に以下のセクションは設計判断に直結するため、確実に全文含めること：

- `buildParallelMap()` の実装（同社グループ化ロジックを挟む位置の判断材料）
- `buildTimeline()` の実装（パイプライン全体の流れ）
- `groupParallelEntries()` の実装（discriminated union の扱い方の参考）
- `RenderEntry` 型定義の周辺（新バリアント追加箇所）
- `CareerContent` / `ParallelCareerCard` の JSX（同社グループ化後の UI 設計の参考）

### 2. `src/app/(jobseeker)/mypage/MypageClient.tsx` の関連部分

ファイル全体は38,845バイトと大きいため、以下の **3範囲のみ** を抽出してください：

```bash
# (a) import 文（先頭〜30行目）
sed -n '1,30p' "src/app/(jobseeker)/mypage/MypageClient.tsx"

# (b) MergedTimeline をレンダリングしている箇所（前後20行ずつ）
grep -n "MergedTimeline" "src/app/(jobseeker)/mypage/MypageClient.tsx"
# → 上記で行番号が分かったら、その行の前後20行を表示
# 例: 行番号が 1234 だったら sed -n '1214,1254p' で出力

# (c) Props 型定義（MypageClient が受け取る型の宣言部分）
grep -n "type.*Props\|interface.*Props" "src/app/(jobseeker)/mypage/MypageClient.tsx"
# → 該当行から30行ほど出力
```

### 3. `src/app/(jobseeker)/mypage/page.tsx` の経歴データ取得部分

ファイル全文は285行ですが、以下の**2範囲のみ**抽出してください：

```bash
# (a) ow_experiences の Supabase クエリ部分
grep -n "ow_experiences" "src/app/(jobseeker)/mypage/page.tsx"
# → 該当行の前後30行を表示

# (b) MypageClient への props 渡し部分（timelineCareers の構築箇所）
grep -n "timelineCareers\|MypageClient" "src/app/(jobseeker)/mypage/page.tsx"
# → 該当行の前後20行を表示
```

### 4. `src/app/(jobseeker)/u/[id]/page.tsx` の経歴データ取得部分

ファイル全文は432行ですが、以下の**2範囲のみ**抽出してください：

```bash
# (a) ow_experiences の Supabase クエリ部分
grep -n "ow_experiences" "src/app/(jobseeker)/u/[id]/page.tsx"
# → 該当行の前後30行を表示

# (b) MergedTimeline をレンダリングしている箇所
grep -n "MergedTimeline" "src/app/(jobseeker)/u/[id]/page.tsx"
# → 該当行の前後30行を表示（careers props にどう渡しているかが重要）
```

---

## 出力フォーマット（厳守）

```
# 調査結果 v3

===== 1. MergedTimeline.tsx 全文 =====
<全970行、省略なし>

===== 2. MypageClient.tsx 関連部分 =====

--- (a) import 文 ---
<出力>

--- (b) MergedTimeline レンダリング箇所（行番号: XXX） ---
<前後20行>

--- (c) Props 型定義 ---
<出力>

===== 3. mypage/page.tsx 経歴データ取得部分 =====

--- (a) ow_experiences クエリ ---
<前後30行>

--- (b) timelineCareers / MypageClient への props 渡し ---
<前後20行>

===== 4. u/[id]/page.tsx 経歴データ取得部分 =====

--- (a) ow_experiences クエリ ---
<前後30行>

--- (b) MergedTimeline レンダリング箇所 ---
<前後30行>
```

---

## 確認事項（出力時に追記してください）

以下3点を、上記コードを見た上で **YES / NO + 該当行番号** で回答してください：

1. **`/mypage` 側で MergedTimeline は MypageClient.tsx から呼ばれている？**
   （mypage/page.tsx ではなく MypageClient.tsx が直接 MergedTimeline をレンダリングしているか）

2. **MypageClient.tsx が受け取る `timelineCareers` の型は snake_case の CareerEntry？**
   （camelCase 変換層が page.tsx と MypageClient.tsx の間にないか）

3. **`/u/[id]/page.tsx` から MergedTimeline に渡される careers の型も snake_case？**
   （3画面で型が揃っているかの最終確認）

---

## 注意事項

- **編集は一切しない**
- MergedTimeline.tsx は **省略禁止で全文**（970行、サマリーや `...` は不可）
- 他3ファイルは指定範囲のみで OK（全文不要）
- 1メッセージに収まらない場合は分割可、ただし省略は不可
- 確認事項3点の回答は最後に明記

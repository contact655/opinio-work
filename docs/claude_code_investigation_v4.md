A案（CareerEntry に company_id を追加）の実装コスト確定のため、
`buildTimelineCareerEntriesFromRaw` の実装を確認します。
**実装は一切不要、読み取りと出力のみ**。

## 背景

MergedTimeline 横断対応の設計判断で、同社グループ化のキーとして `company_id` を使いたい。
しかし MergedTimeline の `CareerEntry` 型には company_id フィールドが存在しない。

確認したいのは：
- `buildTimelineCareerEntriesFromRaw()` が内部で expRow.company_id を読んでいるか
- もし読んでいるなら、CareerEntry に company_id を追加するのは数行で済むはず
- もし読んでいないなら、もう少し改修範囲が広がる

---

## 取得対象（2ファイル）

### 1. `src/lib/utils/timeline.ts` 全文

調査1の結果に含まれていたファイル。`buildTimelineCareerEntriesFromRaw` の定義場所として最有力。

```bash
cat src/lib/utils/timeline.ts
```

**全文出力してください**。省略禁止。

### 2. `buildTimelineCareerEntriesFromRaw` の import 元確認

念のため、`buildTimelineCareerEntriesFromRaw` がどこから import されているかを確認：

```bash
grep -rn "buildTimelineCareerEntriesFromRaw" src/ --include="*.tsx" --include="*.ts"
```

結果を全行出力してください。

### 3. `RawExperienceRow` 型の定義確認

`buildTimelineCareerEntriesFromRaw` の引数型 `RawExperienceRow` がどこで定義されているか：

```bash
grep -rn "RawExperienceRow" src/ --include="*.tsx" --include="*.ts"
```

結果を全行出力してください。定義箇所が timeline.ts でない場合は、その定義ファイルも全文出力してください。

### 4. `CompanyLogoInfo` 型の定義確認

同じく `CompanyLogoInfo` の定義箇所：

```bash
grep -rn "CompanyLogoInfo" src/ --include="*.tsx" --include="*.ts"
```

結果を全行出力してください。定義箇所が timeline.ts でない場合は、その定義ファイルも全文出力してください。

---

## 出力フォーマット（厳守）

```
# 調査結果 v4

===== 1. src/lib/utils/timeline.ts 全文 =====
<全文、省略なし>

===== 2. buildTimelineCareerEntriesFromRaw の import 元 =====
<grep結果>

===== 3. RawExperienceRow 定義 =====
<grep結果>
<定義ファイル全文（timeline.ts でない場合）>

===== 4. CompanyLogoInfo 定義 =====
<grep結果>
<定義ファイル全文（timeline.ts でない場合）>
```

---

## 確認事項（出力時に追記してください）

以下3点を、コードを見た上で **YES / NO + 該当行番号** で回答：

1. **`buildTimelineCareerEntriesFromRaw` は内部で `expRow.company_id` を読んでいる？**
   （logo 情報を引くための companyInfoById のキーとして使っているはずだが、CareerEntry に乗せているか）

2. **MergedTimeline の `CareerEntry` を返している関数で、すでに company_id を握っている変数が存在する？**
   （関数内のローカル変数として company_id を保持している箇所があれば、return オブジェクトに1行追加するだけで A 案完成）

3. **`RawExperienceRow` 型に company_id フィールドは含まれている？**
   （含まれていなければ型定義の修正も必要）

---

## 注意事項

- **編集は一切しない**
- `src/lib/utils/timeline.ts` は全文（省略禁止）
- 確認事項3点の回答は最後に明記

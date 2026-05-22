経歴表示画面の調査をお願いします。**実装は一切不要、読み取りと出力のみ**。

handover-2026-05-21.md で `MergedTimeline.tsx` と `src/lib/utils/career.ts` の存在は
既に確定済みですが、念のため周辺ファイルの実在パスを grep で確定させた上で、
明日の作業で触る確定ファイル群の全文を取得します。

**1メッセージで grep 結果 + ファイル全文を全部返してください。**

---

## 調査1: ow_experiences を参照しているファイル一覧

```bash
grep -rln "ow_experiences" src/ --include="*.tsx" --include="*.ts"
```

実行結果を全部出力してください。

## 調査2: マイページと公開プロフィールのディレクトリ構造

```bash
ls -la src/app/mypage/ 2>/dev/null
ls -la "src/app/(jobseeker)/mypage/" 2>/dev/null
ls -la src/app/u/ 2>/dev/null
ls -la "src/app/(jobseeker)/u/" 2>/dev/null
ls -la "src/app/(jobseeker)/u/[id]/" 2>/dev/null
```

存在するディレクトリの中身をすべて表示してください。

## 調査3: TIMELINE 関連コンポーネント

```bash
grep -rln "TIMELINE" src/ --include="*.tsx" --include="*.ts"
grep -rln "Timeline" src/ --include="*.tsx" --include="*.ts"
grep -rln "MergedTimeline" src/ --include="*.tsx" --include="*.ts"
```

3つすべての結果を出力してください（`MergedTimeline` がどこからインポートされているかが重要）。

## 調査4: 経歴の旧表示ロジック

```bash
grep -rln "在籍中" src/ --include="*.tsx" --include="*.ts"
grep -rln "ow_companies" src/ --include="*.tsx" --include="*.ts"
grep -rln "groupOverlappingCareers" src/ --include="*.tsx" --include="*.ts"
grep -rln "calculateTenure" src/ --include="*.tsx" --include="*.ts"
```

4つすべての結果を出力してください。

---

## 調査5: 該当ファイルの全文出力

以下の **4ファイル** の中身を、cat 同等の生コードで全文出力してください。
ファイルが存在しない場合は「存在しません」と明記してください。
それぞれ `===== <ファイルパス> =====` のヘッダーで区切ってください。

1. `src/components/profile/MergedTimeline.tsx`（確定済み・最重要）
2. `src/lib/utils/career.ts`（確定済み・共通関数群）
3. `/mypage` の page.tsx
   - 候補1: `src/app/mypage/page.tsx`
   - 候補2: `src/app/(jobseeker)/mypage/page.tsx`
   - 存在する方を出力
4. `/u/[id]` の page.tsx
   - 候補1: `src/app/u/[id]/page.tsx`
   - 候補2: `src/app/(jobseeker)/u/[id]/page.tsx`
   - 存在する方を出力

---

## 出力フォーマット（厳守）

```
# 調査結果

## 調査1
<grep結果>

## 調査2
<ls結果>

## 調査3
<grep結果 × 3>

## 調査4
<grep結果 × 4>

## 調査5

===== src/components/profile/MergedTimeline.tsx =====
<全文>

===== src/lib/utils/career.ts =====
<全文>

===== <実在した /mypage の page.tsx のフルパス> =====
<全文>

===== <実在した /u/[id] の page.tsx のフルパス> =====
<全文>
```

---

## 注意事項

- 編集は**一切**しない
- 全文出力時に省略（`...`）を**入れない**。トークン制限で1メッセージに収まらない場合のみ、
  メッセージを分割して全文を完全に出力してください
- ファイルが大きくても省略禁止（明日の設計判断の元データになるため）
- grep 結果は順序維持で全行出力

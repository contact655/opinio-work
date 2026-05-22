経歴表示画面の調査をお願いします。実装は不要、読み取りと出力のみ。

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
```

存在するディレクトリの中身をすべて表示してください。

## 調査3: TIMELINE 関連コンポーネント

```bash
grep -rln "TIMELINE" src/ --include="*.tsx" --include="*.ts"
grep -rln "Timeline" src/ --include="*.tsx" --include="*.ts"
```

両方の結果を出力してください。

## 調査4: 経歴の旧表示ロジック

以下のキーワードでも grep してください（経歴表示で使われている可能性が高い文字列）：

```bash
grep -rln "在籍中" src/ --include="*.tsx" --include="*.ts"
grep -rln "ow_companies" src/ --include="*.tsx" --include="*.ts"
```

## 調査5: 該当ファイルの中身

調査1〜4 で見つかったファイルのうち、以下に該当するもの全部の中身を cat 同等の生コードで全文出力してください：

- src/app/mypage/ または src/app/(jobseeker)/mypage/ 配下の page.tsx
- src/app/u/ または src/app/(jobseeker)/u/ 配下の [id]/page.tsx
- 経歴表示に使われていそうな TIMELINE コンポーネント

長くなる場合は、まず調査1〜4の結果を出してください。そこから僕（柴さん）が「この3ファイルを見せて」と指定します。

## 注意事項
- 編集は一切しない
- 結果は1メッセージで返す（可能なら）

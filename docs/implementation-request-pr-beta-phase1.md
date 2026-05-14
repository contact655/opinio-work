# 実装依頼: PR-β Phase 1 — GenreChipSelector 共通コンポーネント新規作成

## 背景

PR-β（企業作成/編集フォームのジャンル化）を4フェーズに分けて実装する。
本依頼は **Phase 1（土台となる共通コンポーネント作成）** のみ。

事前調査レポート: `docs/research-2026-05-17-pr-beta-company-form-genres.md`
思想決定文書: `docs/decision-2026-05-16-genre-as-first-class.md`

## 確定済みの思想・方針（再掲・必読）

### 入力 UI
- **チップ群**（8ジャンル全部表示、タップで選択/解除）
- 選択は **任意**、**複数選択可**、上限なし
- 表示順は `ow_genres.display_order` 昇順

### データ
- `ow_genres` テーブル確認済み: `id (UUID), slug (text), name (text), description (text), display_order (int), is_active (boolean)`
- 8ジャンル全件 `is_active = true`、display_order 1〜8
- **保存は slug 配列で扱う**（id ではない）

### 保存方式（Phase 2 以降の話、Phase 1 では扱わない）
- autosave に乗せる
- 方式A: draft_data 内に `genres: string[]`（slug 配列）として保持
- 「変更を公開する」時に ow_company_genres へ全置換（DELETE → INSERT、パターンX）

## Phase 1 のスコープ

**新規作成する共通コンポーネントのみ。既存ファイルの修正は一切しない。**

### ファイル
`src/components/ui/GenreChipSelector.tsx` を新規作成。

### Props 設計

```typescript
type Genre = {
  slug: string;
  name: string;
  display_order: number;
};

type GenreChipSelectorProps = {
  genres: Genre[];           // 親（Server Component）から渡される ow_genres 全件
  selected: string[];        // 現在選択中の slug 配列
  onChange: (newSelected: string[]) => void; // 選択変更時のコールバック
  disabled?: boolean;        // 編集不可状態（オプション）
};
```

### 振る舞い

- `genres` を `display_order` 昇順でソートして表示（親側でソート済みでも、念のため内部でも保証）
- 各ジャンルを「チップ」として表示
- チップタップで `selected` に slug が含まれていれば外す、なければ追加
- 上限なし、最低0個 OK
- `disabled=true` の時はタップ無効、視覚的にも淡くする

### スタイル要件

- 既存の Opinio Work のデザイントークン（LP v6 配色との整合性）に沿う
- 選択中チップ: 背景色強調 + 白文字 or 濃い色文字
- 未選択チップ: 枠線のみ or 淡い背景
- ホバー・タップフィードバックあり
- モバイル対応（折り返し許容、横並び）
- 既存の `src/components/ui/` に Chip 系コンポーネントがゼロなことを調査で確認済み → 完全新規でよい

### 実装上の注意

- "use client" を冒頭に明記（onChange コールバック、タップハンドラのため）
- 内部 state は持たない（完全な制御コンポーネント）。state は呼び出し側で管理
- アクセシビリティ: `role="button"`、`aria-pressed={isSelected}`、キーボード操作（Enter/Space）対応

### 確認用 Storybook 的なテスト方法

Phase 1 では既存画面に組み込まないので、動作確認は以下のいずれかで:

- **オプションA**: `src/app/_dev/genre-chip-test/page.tsx` のような確認用ページを新規作成（dev 環境のみアクセス可能、`process.env.NODE_ENV === 'development'` で 404 にする）
- **オプションB**: コンポーネントの動作確認は Phase 2（CompanyEditClient 適用時）に持ち越し、Phase 1 は型と実装のみ

**推奨はオプションA**。Phase 2 以降の組み込みリスクを減らすため、コンポーネント単体での挙動を先に確認したい。

## 受け入れ基準

1. `src/components/ui/GenreChipSelector.tsx` が作成されている
2. Props 型が上記仕様通り
3. `npm run build` が通る
4. オプションA を採用した場合、`/dev/genre-chip-test`（または同等の path）で8ジャンルのチップが表示され、タップで選択/解除できる
5. モバイル幅（375px）で折り返し挙動が崩れない
6. `git push origin main` までセットで完了

## やらないこと（Phase 2 以降）

- 既存4ファイル（biz/auth/page.tsx, CompanyEditClient.tsx, CreateCompanyClient.tsx, admin の CompanyDetailClient.tsx）には一切触らない
- autosave 連携も触らない
- PATCH handler の ow_company_genres 反映ロジックも触らない
- draft_data スキーマ変更も触らない

## コミットメッセージ案

```
feat: add GenreChipSelector common component (PR-β Phase 1)

- New reusable chip-based selector for company genres
- Controlled component with selected (slug[]) + onChange props
- Sorted by display_order, supports unlimited multi-select
- Accessibility: aria-pressed, keyboard nav (Enter/Space)
- Dev-only test page at /dev/genre-chip-test for verification

Part of PR-β series. Phase 2-4 will integrate this into:
- B: CompanyEditClient (biz/company/)
- C: CreateCompanyClient (biz/companies/add/new/)
- A: biz/auth multi-step form
```

## 完了後の報告事項

実装完了後、以下を報告:

1. コミット hash
2. Vercel デプロイ完了確認
3. `/dev/genre-chip-test`（または採用 path）の動作確認結果
4. モバイル幅での挙動
5. Phase 2 着手前に Claude（戦略担当）に投げ返したい論点があれば列挙

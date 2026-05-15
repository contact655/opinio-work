# 実装依頼: PR-β Phase 4 — biz/auth 多段フォームへのジャンル統合（PR-β 最終フェーズ）

## 背景

PR-β（企業作成/編集フォームのジャンル化）の最終フェーズ。
- Phase 1: GenreChipSelector 作成（コミット `12ebb2d`、完了）
- Phase 2: CompanyEditClient 統合（コミット `4917ff6`、完了）
- Phase 3: CreateCompanyClient 統合（コミット `ae5b489`、完了）
- **Phase 4: biz/auth 多段フォーム統合（本依頼）**

事前調査レポート: `docs/research-2026-05-17-pr-beta-company-form-genres.md`
Phase 1-3 実装依頼書: `docs/implementation-request-pr-beta-phase{1,2,3}.md`

## このフェーズの位置付け

事前調査レポートで **「最も複雑」** とされた箇所。
- sessionStorage を経由した多段フロー
- 2本の API ルートが絡む
- 通常フロー と invite フロー の2系統

**実装前に「対象箇所の調査レポート → Hisato 確認 → 実装」の2段階で進める。** Phase 2/3 のように一気に実装しない。

## 確定済みの方針（論点①②③）

### 論点①: invite フローは触らない

biz/auth には2つのフローがある:
- **通常フロー**: 新規ユーザー → 認証 → 企業を新規作成 → 完了
- **invite フロー**: 既存 admin から招待された人 → 認証 → 既存企業へ admin として参加

**invite フローはジャンル選択 UI を出さない**。既存企業に参加するだけで、企業のジャンルは既に設定済み（または後で B 画面 = CompanyEditClient で編集可能）。invite フローのコードには触らない。

### 論点②: 新規 API は作らない

企業作成時のジャンル送信は **既存の `/api/biz/companies` POST（Phase 3 で genres 対応済み）** を使い回す。新規 API ルート（`/api/biz/companies/[id]/genres` のような）は作らない。

つまり Phase 4 は:
- sessionStorage に `genres: string[]` を退避するフィールドを追加
- handleAfterAuth() で POST 時に genres を含める
- POST 先は Phase 3 で実装済みの経路を再利用

### 論点③: ジャンル一覧の取得

Server Component で ow_genres を取得 → Client Component に props で渡す。Phase 2/3 と同じパターン。

## Phase 4 のスコープ（2段階で進める）

### Stage 1: 対象箇所の調査レポート（実装前・必須）

**実装に着手する前に**、以下を調査してレポートとして提出してください:

`docs/research-2026-05-17-pr-beta-phase4-biz-auth.md` として保存。

#### 調査項目

1. **biz/auth/page.tsx の全体構造**
   - Server Component / Client Component の境界
   - 多段フォームのステップ一覧（何ステップあるか、各ステップで何を入力するか）
   - 通常フローと invite フローの分岐ロジック（どのパラメータで判断しているか）

2. **PendingCompany のスキーマ**
   - sessionStorage に保存される構造（TypeScript の型定義箇所）
   - 現在 PendingCompany に入っているフィールド全リスト
   - PendingCompany を読み書きしている全ファイル（grep で網羅）

3. **handleAfterAuth() の実装**
   - 関数の定義場所
   - 認証完了後に何をしているか（PendingCompany 復元 → POST /api/biz/companies の流れ）
   - 通常フローと invite フローでの分岐

4. **ジャンル選択 UI を入れるステップの特定**
   - 多段フォームのどのステップに入れるべきか（企業情報入力ステップ）
   - 通常フローのみで表示、invite フローでは非表示にする条件分岐の場所

5. **影響範囲ファイル一覧**
   - 修正が必要なファイルの完全リスト
   - 各ファイルでの修正概要

#### 注意事項

- Stage 1 では **実装は一切しない**。調査のみ
- レポートには「Hisato + Claude への質問」セクションを末尾に設けて、判断が必要な論点があれば列挙
- レポート完成後、Stage 2 着手の許可を Hisato から得るまで止まる

### Stage 2: 実装（Stage 1 レポートを Hisato が確認・承認後）

Stage 1 のレポートを Hisato が確認し、承認したら以下を実装。Stage 1 で発見された論点が解決されてから着手すること。

#### 想定される変更（Stage 1 で確定する）

1. `src/app/biz/auth/page.tsx`（Server Component）
   - ow_genres を取得
   - Client Component に `availableGenres` を props で渡す

2. `src/app/biz/auth/AuthClient.tsx`（または相当する Client Component）
   - 通常フローの企業情報入力ステップに GenreChipSelector を組み込み
   - フォーム state に `genres: string[]` を追加
   - 「次へ」ボタン押下時に sessionStorage の PendingCompany に genres を含めて保存
   - invite フロー時は GenreChipSelector を表示しない

3. PendingCompany 型定義（場所は Stage 1 で特定）
   - `genres: string[]` フィールド追加（オプショナルではなく、デフォルト `[]`）

4. handleAfterAuth()（場所は Stage 1 で特定）
   - PendingCompany から genres を取り出して POST body に含める
   - POST 先: `/api/biz/companies`（Phase 3 で genres 対応済み）

5. （触らない）`/api/biz/companies` POST handler
   - Phase 3 で既に genres 受け入れ + ow_company_genres INSERT 対応済み

#### 配置位置とラベル

- ステップ: 「企業情報入力」ステップ（Stage 1 で特定）
- 配置: 業種・フェーズ入力の下あたり（Phase 2/3 と統一）
- 見出し: 「ジャンル」または「企業ジャンル（任意・複数選択可）」
- ヘルプテキスト: 「該当するジャンルを選択してください。検索や一覧表示で活用されます。」

## 受け入れ基準

1. Stage 1 のレポートが作成され、Hisato が承認している（Stage 2 着手の前提条件）
2. 通常フローでジャンルチップ8個が適切なステップで表示される
3. ジャンル選択状態が次のステップに進んでも保持される（sessionStorage 経由）
4. 認証完了後の handleAfterAuth() で、選択した genres が `/api/biz/companies` POST に含まれる
5. POST 後、ow_company_genres に正しく INSERT される
6. invite フロー時はジャンル UI が表示されない
7. ジャンル未選択（0件）でも認証・企業作成が成功する
8. 既存のフローに regression がない（通常フロー・invite フロー両方）
9. `npm run build` 通過
10. `git push origin main` までセット
11. Vercel デプロイ確認

## やらないこと（明示）

- invite フローのコード修正（論点①）
- 新規 API ルートの追加（論点②）
- CompanyEditClient（B）、CreateCompanyClient（C）、admin（D）のコード修正
- 共通コンポーネント `GenreChipSelector` 自体の修正

## コミットメッセージ案（Stage 2 完了時）

```
feat: integrate GenreChipSelector into biz/auth flow (PR-β Phase 4)

- Add availableGenres prop to biz/auth page from Server Component
- GenreChipSelector shown in company info step (normal flow only)
- Invite flow remains unchanged
- PendingCompany schema extended with genres: string[]
- handleAfterAuth() passes genres to POST /api/biz/companies
- No new API routes (reuses Phase 3 endpoint)
- Completes PR-β series: company genre management across all 4 entry points
```

## 完了後の報告事項（Stage 2 完了時）

1. Stage 1 レポートの保存パス
2. コミット hash（Stage 2 実装）
3. Vercel デプロイ完了確認
4. 動作確認シナリオ:
   - 通常フロー: 認証 → ステップ進行 → ジャンル選択 → 完了 → DB 反映確認
   - invite フロー: ジャンル UI が出ないこと
   - ジャンル0件で通常フロー完了
5. PR-β 全体の総括（Phase 1-4 の合算で何ファイル / 何行 / どんな価値が達成されたか）

## PR-β 完了の意味（思想的位置付け）

Phase 4 完了で PR-β（企業作成/編集フォームのジャンル化）が完成する。これにより:

- ユーザー（企業側）は 4 つの入口（auth 新規作成 / 認証後の新規作成 / 自社編集 / admin）のうち 3 つでジャンル設定が可能に
- 残る admin 画面（D）は既存の独自実装が動作中（方式②: 当面そのまま）
- /companies のジャンル別カルーセル（PR-α で実装済み）と連動し、企業作成時点から正しいカテゴリ分類が可能に
- 「キャリア意思決定インフラ」の構成要素として、ジャンルが first-class な属性として確立

## 重要: 既存運用ルールの遵守

- `npm run build` 必須
- `git push origin main` 必ず実行（commit hash で Vercel deployments 目視確認）
- Stage 1 → Hisato 確認 → Stage 2 の順序を厳守（途中で実装に着手しない）

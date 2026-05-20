# /companies カルーセル列数・カード再設計 実装仕様書

**作成日**: 2026-05-17
**作成**: Hisato + Claude (Opus 4.7、design session)
**Claude Code への依頼**: 本仕様書に基づく実装、ビルド、push、デプロイ確認まで
**前提モック**: `companies-carousel-mock.html`（ブラウザで動作確認済み）

---

## 0. 背景

### 現状の課題
- `/companies` のジャンル別カルーセルで、4列目が中途半端に途切れて表示される
- カード内の情報量が多く、視認性が悪い

### 解決方針
**「探索」と「詳細」の二段構え** にカードの責務を再設計する:

- カルーセル上のカード（探索層）= **ロゴ + 最小限の情報密度** に絞る
- 説明文・アクションボタンは **カード全体クリックで遷移する詳細ページ** に集約

### 議論で確定した方針
- **列数**: 5列（カード幅 約280px、LinkedIn企業カードと同等の視認性）
- **カードに残す要素**:
  - B1: ロゴ重視（カード上部、アスペクト比 16:10）
  - B2: 業種・規模・募集職種数（1行）/ 面談OK・勤務形態タグ
- **カードから削除する要素**:
  - B3: 企業説明文（カードから削除、詳細ページに集約）
  - B4: 「詳細を見る」ボタン（カード全体をクリッカブルに）
- **peekデザイン**: カルーセル右端で次カードが少し見切れる仕様（「続きあり」を直感的に示す）

---

## 1. 影響範囲

### 1.1 推定される変更対象ファイル

事前に Claude Code が `ls src/app/` および `ls src/components/ui/` で既存資産を確認し、以下の見当をつける:

- `/companies` ページのページコンポーネント
  - 想定パス: `src/app/companies/page.tsx` または近傍
- ジャンル別カルーセルセクションのコンポーネント
  - 想定パス: `src/components/companies/GenreCarousel.tsx` など
  - カルーセル自体のラッパー（grid-auto-columns、gap、padding-right 等の設定）
- 企業カードのコンポーネント
  - 想定パス: `src/components/companies/CompanyCard.tsx` など
  - **このコンポーネントが /companies 以外でも使われている場合、別バリアントとして分岐するか、新規コンポーネントを作るかを判断**
- 関連する型定義・データフェッチャは変更不要の想定

### 1.2 データモデルへの影響

**なし**。

- `ow_companies` テーブルおよび `ow_company_genres` テーブルへの変更は不要
- 説明文（description フィールド等）は DB に保持したまま、UI で表示しないだけ
- マイグレーション不要

### 1.3 他ページへの影響範囲確認

カードコンポーネントが共有資産の場合、影響範囲を要確認:

- `/companies/[id]` 詳細ページ: 影響なし想定（詳細ページのカード表示は別UI）
- 他ページの企業表示: 検索ヒットしたら影響確認、必要なら別バリアント化
- admin 画面（D）: 影響範囲外（PR-βの議論時に方式②で先送り済み）

---

## 2. 実装仕様

### 2.1 カードコンポーネントの構造

```
┌─────────────────────────┐
│                         │
│      [ロゴ or          │ ← aspect-ratio: 16/10
│       プレースホルダー]  │   背景: #f5f7fa or 多色パステル
│                         │
├─────────────────────────┤
│ テスト株式会社_023      │ ← font-size: 14px, font-weight: 700
│ IT ・ 300名 ・ 募集中1  │ ← font-size: 12px, color: secondary
│ [面談OK] [hybrid]       │ ← tag: 11px
└─────────────────────────┘
```

### 2.2 デザイントークン

モック（`companies-carousel-mock.html`）に定義済みの CSS 変数を踏襲。既存の Opinio Work のデザイントークンと整合する場合はそちらを優先する。

| トークン | 値 | 用途 |
|---|---|---|
| `--text-primary` | `#1a1d24` | 社名 |
| `--text-secondary` | `#5b6471` | 業種・規模等のメタ情報 |
| `--text-tertiary` | `#8b95a3` | 区切り文字（・） |
| `--border` | `#e6e9ef` | カード境界（box-shadow で表現） |
| `--accent` | `#1e63d8` | 「すべて見る」リンク |
| `--tag-bg` | `#f3f5f9` | 通常タグ背景 |
| `--tag-success-bg` | `#e6f5ed` | 「面談OK」タグ背景 |
| `--tag-success-text` | `#1f7a48` | 「面談OK」タグ文字色 |

### 2.3 カードのインタラクション

- カード全体が `<Link>` で詳細ページへの遷移リンク（`/companies/[id]`）
- ホバー時: `transform: translateY(-2px)` と shadow 強調
- transition: `0.18s ease`

### 2.4 カルーセル構造（grid-auto-flow: column + scroll-snap）

```css
.carousel {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc((100% - 14px * 4 - 32px) / 5);
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-right: 32px;  /* peek 表現のためのスペース */
  padding-bottom: 8px;
}
.carousel > .card {
  scroll-snap-align: start;
}
```

- 5列固定（デスクトップ）
- 14px gap、最後のカードのために 32px の padding-right（peek 効果）
- スクロールバーは細め（webkit/firefox 両対応）

### 2.5 レスポンシブ対応

ローンチ時点では PC 想定を優先するが、最低限のレスポンシブは必要:

| ブレークポイント | 列数 |
|---|---|
| `< 640px` (モバイル) | 1.2列（次のカードを少し見せる） |
| `640px – 1024px` (タブレット) | 2.5列 |
| `1024px – 1280px` | 3列 |
| `>= 1280px` (デスクトップ) | 5列 |

実装は `grid-auto-columns` をメディアクエリで切り替える形:

```css
@media (max-width: 640px) {
  .carousel { grid-auto-columns: calc((100% - 14px - 32px) / 1.2); }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .carousel { grid-auto-columns: calc((100% - 14px * 2 - 32px) / 2.5); }
}
@media (min-width: 1025px) and (max-width: 1280px) {
  .carousel { grid-auto-columns: calc((100% - 14px * 2 - 32px) / 3); }
}
@media (min-width: 1281px) {
  .carousel { grid-auto-columns: calc((100% - 14px * 4 - 32px) / 5); }
}
```

### 2.6 ロゴ・プレースホルダー処理

既存の方針（許諾済み企業のみ手動アップロード、`public/logos/<domain>.png`）を維持。

- ロゴ画像あり: `<img>` で表示、`max-width: 70%; max-height: 60%; object-fit: contain;`
- ロゴ画像なし: 社名イニシャル（先頭1文字）または「テ」のプレースホルダー
  - 背景色: パステル系の多色（決定論的に企業IDから色を選ぶ実装が望ましい）
  - モックでは6色を循環: `#d4f0e3`(緑), `#fce8b8`(黄), `#fcd5dc`(ピンク), `#d8e6ff`(青), `#e8dcf5`(紫), `#f5f7fa`(グレー)
  - 文字色は背景に合わせた濃色

### 2.7 削除する要素

カードコンポーネントから以下を **削除**:

- 企業説明文（`company.description` 等のフィールド表示）
- 「詳細を見る」ボタンまたは類似の明示的なアクション要素

カードの高さは結果として現状より低くなる想定。

---

## 3. 実装の進め方

### 3.1 推奨手順

1. **事前調査** (Claude Code)
   - `ls src/app/companies/`, `ls src/components/` でファイル特定
   - 既存の CompanyCard コンポーネントが他で共有されているかを確認
   - 共有されている場合、別バリアント化 or 新規コンポーネント化の判断

2. **実装** (Claude Code)
   - カードコンポーネントの修正（説明文・ボタン削除、ロゴ領域の比率調整、タグ整理）
   - カルーセルコンポーネントの修正（grid-auto-columns で 5列、peek の padding-right）
   - レスポンシブ対応のメディアクエリ追加

3. **検証** (Claude Code)
   - `npm run build` 必須
   - 型エラー・lint エラーの解消
   - ローカルで `/companies` を開いて、5列表示・peek 効果・ホバー動作を目視確認

4. **デプロイ** (Claude Code)
   - `git add` → `git commit`（コミットメッセージは下記参照）
   - **`git push origin main` を必ず実行**（2026-05-13 に7コミット未push事故があった経緯）
   - Vercel deployments で新しいデプロイを commit hash で目視確認

5. **動作確認** (Hisato)
   - 本番環境で `/companies` を開いて確認
   - 全ジャンルセクション（8ジャンル）でカルーセルが5列表示されているか
   - peek 効果が機能しているか
   - カードクリックで詳細ページに遷移するか
   - レスポンシブ動作（モバイル・タブレット・PC）

### 3.2 コミットメッセージ案

```
feat(companies): redesign genre carousel cards to 5-column with logo-focused layout

- Reduce card content to logo + name + meta + tags (remove description, action button)
- Make entire card clickable as a link to detail page
- Implement peek effect at carousel right edge (padding-right: 32px)
- Add responsive breakpoints (mobile: 1.2 cols, tablet: 2.5 cols, desktop: 5 cols)
- Maintain existing data model (no DB migration needed)

Refs: design session 2026-05-17, mock companies-carousel-mock.html
```

---

## 4. 注意事項・既知の論点

### 4.1 既存の運用ルール（必須・厳守）

引き継ぎ書（2026-05-16）の運用ルール:

1. 新規実装後 `npm run build` 必須
2. **`git push origin main` を必ず実行**
3. Vercel deployments で commit hash 目視確認
4. 新規ルート前に `ls src/app/`、新規UIコンポーネント前に `ls src/components/ui/` で既存資産確認

### 4.2 後続タスク（本タスクには含めない）

- 企業詳細ページ（`/companies/[id]`）の説明文・アクションボタン強化（B3/B4を詳細ページに集約する方向）
- /jobs ページのカード設計の見直し（同様の論点があれば別タスクで）
- /about /industries の 404 修正（引き継ぎ書 Outstanding 項目）
- ヒーロー職種ローテーションアニメ（引き継ぎ書 Outstanding 項目）

### 4.3 既知のリスク・確認事項

- **CompanyCard の共有状況**: 他ページで使われている場合、別バリアント or props で表示モード切り替えが必要
- **TypeScript の型エラー**: 説明文フィールドを参照していた箇所が型エラーになる可能性
- **テスト**: 既存のテストが説明文表示に依存していたら更新が必要
- **アクセシビリティ**: カード全体をリンク化する際、`<Link>` で正しくラップ、内部の `<button>` 等を避ける（ネストリンクは無効）

---

## 5. 参考資料

- モック: `companies-carousel-mock.html`（5列、6列、3.5列の切り替え可能）
- 設計議論（2026-05-17）:
  - 列数の検討: A1（5〜6列）→ 物理的裁量問題 → 方向1（探索と詳細の二段構え）
  - 情報の見やすさ: B1+B2+B3+B4 → 方向1により B1+B2 のみカルーセル、B3+B4は詳細ページ
  - 最終確定: 5列、peekデザイン、カードは B1+B2 のみ、カード全体クリッカブル

## 6. 完了基準

以下がすべて満たされたら完了:

- [ ] `/companies` ページのすべてのジャンルセクションが 5列表示
- [ ] カード右端で「次のカードが少し見える」peek 効果が機能
- [ ] カード内容: ロゴ / 社名 / 業種・規模・募集職種数 / 面談OK・勤務形態タグ のみ
- [ ] 説明文・アクションボタンが削除されている
- [ ] カード全体がクリッカブルで `/companies/[id]` に遷移
- [ ] レスポンシブ動作確認（モバイル・タブレット・PC）
- [ ] `npm run build` 成功
- [ ] `git push origin main` 実行
- [ ] Vercel で新しいデプロイが反映、本番で動作確認

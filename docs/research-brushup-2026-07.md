# UI/UX ブラッシュアップ調査レポート（2026-07）

> 調査日: 2026-07-08  
> 対象ブランチ: `main`  
> 方針: コード変更なし・調査のみ

---

## 1. UI/UXデザインの土台

### 1-1. デザイントークンの管理状況

#### globals.css（939行）
```
src/app/globals.css
```

`:root` に CSS カスタムプロパティとして以下を定義済み:

| カテゴリ | 変数例 | 状態 |
|----------|--------|------|
| ブランドカラー | `--royal`, `--royal-50`, `--royal-100`, `--accent` | ✅ 整備済み |
| テキスト | `--ink`, `--ink-soft`, `--ink-mute` | ✅ 整備済み |
| ステータス | `--success`, `--warm`, `--purple`, `--error`, `--pink` | ✅ 整備済み |
| スペーシング | `--space-1` 〜 `--space-32`（8pxグリッド） | ✅ 整備済み |
| タイポグラフィ | `--text-xs` 〜 `--text-3xl`, `--leading-*`, `--tracking-*` | ✅ 整備済み |
| ボーダー半径 | `--radius-sm/md/lg/xl` | ✅ 整備済み |
| シャドウ | `--shadow-xs/sm/md/lg` | ✅ 整備済み |
| 最大幅 | `--max-w-page`, `--max-w-biz`, `--max-w-form` 等 | ✅ 整備済み |

#### tailwind.config.ts
Tailwind の `extend` に以下を追加:

- `colors.primary` = `#002366`（`--royal` と一致）
- `borderRadius.card` = `16px`（`--radius-lg` と一致）
- `boxShadow.card`, `card-hover` 定義済み
- フォントファミリー: Inter / Noto Sans JP / Noto Serif JP

**評価**: トークン体系自体は整備されており一貫性がある。ただし以下の問題が存在する。

---

### 1-2. ブランドカラーの一貫性問題

**⚠️ 注意: 質問で言及された `navy #16213A / orange #F39C12` はコードベースに存在しない。**  
実際のブランドカラーは `--royal: #002366`（navy系）と `--warm: #F59E0B`（amber）。

#### 問題: インライン `style={}` が6,542件

コード全体で `style={{}}` インラインスタイル使用箇所が **6,542件** と非常に多い。  
主要ファイルのサイズと内容：

| ファイル | 行数 | 主な用途 |
|----------|------|----------|
| `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx` | 4,485行 | プロフィール編集全体 |
| `src/app/(jobseeker)/companies/[id]/page.tsx` | 3,700行 | 企業詳細ページ |
| `src/app/(jobseeker)/jobs/JobsClient.tsx` | 2,208行 | 求人一覧クライアント |
| `src/app/(jobseeker)/u/[id]/page.tsx` | 2,074行 | 公開プロフィール |

CSS 変数は使われているが、`color: "#002366"` のようなハードコードも **115件** 存在する（主に `--royal` 色相）。  
`var(--gold)` / `var(--royal-deep)` などの未定義変数参照も数件残存（非表示だが技術的負債）。

---

### 1-3. src/components/ui/ の共通コンポーネント一覧と利用状況

```
src/components/ui/
├── CareerSalarySparkline.tsx  — キャリア軌跡の給与スパークライン
├── ConfirmDialog.tsx          — 確認ダイアログ（使用4件）
├── GenreChipSelector.tsx      — ジャンルチップ選択（使用5件）
├── GlobalToast.tsx            — グローバルトースト（使用1件: layout）
├── ImageUpload.tsx            — 画像アップロード
├── InitialAvatar.tsx          — イニシャルアバター（使用2件）
├── Toast.tsx                  — トーストUI（使用6件）

src/components/common/
├── StatusPill.tsx             — ステータスバッジ（使用8件）
├── Avatar.tsx                 — アバター

src/components/jobseeker/
├── JobseekerHeader.tsx        — 求職者ヘッダー（layout統合済み）
├── JobseekerFooter.tsx        — フッター
├── MobileBottomNav.tsx        — モバイルボトムナビ（5タブ）
├── FloatingCTA.tsx            — フローティングCTA
├── OnboardingGuard.tsx        — オンボーディング誘導
├── BookmarkButton.tsx         — ブックマークボタン
├── CountUp.tsx                — カウントアップアニメーション
├── PostCard.tsx               — 記事カード
├── BackToTop.tsx              — トップへ戻る
├── CompanyLogo.tsx            — 企業ロゴ
└── ReadingProgress.tsx        — 読了プログレス

src/components/business/（企業側専用: 36ファイル）
```

**⚠️ 問題: StatusPill系の重複実装**  
`src/components/ui/StatusPill.tsx`（汎用）に加え、  
`src/components/business/MeetingStatusBadge.tsx`・`JobStatusBadge.tsx` が別に存在し、  
似たステータス表示をそれぞれ独自実装している。利用箇所の統一が必要。

**⚠️ 問題: ページ内重複実装が多い**  
`companies/[id]/page.tsx`（3,700行）や `u/[id]/page.tsx`（2,074行）は  
コンポーネント分割がなされておらず、ページファイル自体が巨大な単一コンポーネントになっている。

---

### 1-4. レスポンシブ対応の現状

**整備済みの点:**
- `MobileBottomNav` が `md:hidden` でデスクトップ非表示
- `globals.css` に `-webkit-text-size-adjust: 100%` などモバイル基本対応あり
- `safe-area-inset-bottom` 対応あり

**⚠️ 崩れが疑われる箇所:**

| 場所 | 懸念 |
|------|------|
| `companies/[id]/page.tsx` | 3,700行のインラインスタイル中心。メディアクエリが `@media` の文字列で埋め込まれている（CSS-in-JS風）。デバッグが困難で一貫性がない |
| `JobsClient.tsx`（求職者） | `style={{}}` 内で overflow/flex 設定を都度書いており、モバイルで水平スクロールが発生しうる |
| ヘッダーのナビゲーション | デスクトップ用テキストナビがモバイルでどう崩れるか要確認 |
| `/biz` 系全般 | `--max-w-biz: 1200px` が設定されているが、モバイルでの余白確認不十分な可能性 |

---

## 2. 求職者の登録・オンボーディング体験

### 2-1. 登録フロー全体

```
/auth（メイン認証ページ）
  └── (auth)/auth/page.tsx（1,025行・"use client"）
       ├── メールアドレス + パスワード登録
       ├── Google OAuth 対応
       ├── パスワード強度インジケーター（リアルタイム）
       └── 新規登録後 → /onboarding へリダイレクト

/onboarding
  └── OnboardingClient.tsx（562行・"use client"）
       ├── 5ステップ（職種 → 経験年数 → 悩み → 志望フェーズ → リモート希望）
       └── 完了後 → /companies へリダイレクト
```

**`/auth` ページの主要機能:**
- モード切替: サインアップ / ログイン（同一ページで `?mode=login`）
- Google OAuth / メール認証の両対応
- パスワード強度バー（3段階: 弱/中/強）
- 登録後の流れ: `callback/route.ts` → `onboarding_completed` チェック → 未完了なら `/onboarding?next=...`

**OnboardingGuard（常時監視）:**
```
src/components/jobseeker/OnboardingGuard.tsx
```
ログイン済みユーザーが `onboarding_completed = false` の状態でどのページを見ても `/onboarding` へ強制リダイレクト。

---

### 2-2. オンボーディングの現状と離脱ポイント

**現在のステップ数: 5ステップ**

| ステップ | 質問 | 選択肢数 |
|---------|------|---------|
| 1 | 職種は？ | 17個（多い） |
| 2 | 社会人経験は何年？ | 4個 |
| 3 | 今一番の悩みは？ | 6個 |
| 4 | 志望企業フェーズは？（推測） | 数個 |
| 5 | リモート希望は？（推測） | 数個 |

**⚠️ 離脱リスクが高い箇所:**

| 優先度 | 問題 | 理由 |
|--------|------|------|
| **P0** | ステップ1の職種選択肢が17個で多すぎる | スクロールが必要で、選択肢過多による決断疲れが生じる |
| **P1** | 「戻る」ボタンはあるが目立たない | 小さいテキストリンクで見つけにくい（`fontSize: 12, color: "var(--ink-soft)"` のスタイル） |
| **P1** | スキップ手段がない | ステップをスキップして後で設定できるオプションがない |
| **P2** | 完了後に `/companies` へ直行する | ウェルカムメッセージや「次にすること」ガイドがない（`/mypage?welcome=1` は新規ユーザー + next=/companies の場合のみ） |
| **P2** | 進捗バーはあるが残りステップ数がわかりにくい | プログレスドット表示のみ |

**下書き保存の状況:**  
オンボーディングにはブラウザ離脱による下書き保存機能は**なし**。  
プロフィール編集（`ProfileEditClient.tsx`）は `localStorage` を使った通知設定保存はあるが、  
キャリア情報の自動保存はAPI呼び出し（学歴の `isSaving` フラグあり）。  
700msデバウンスの自動保存は実装されているが、**セッション切断時のリカバリはない**。

---

### 2-3. 求職者フロー関連ファイル構成

```
認証
  src/app/(auth)/auth/page.tsx         — メインログイン/サインアップページ（1,025行）
  src/app/auth/callback/route.ts       — OAuthコールバック・onboarding分岐（7,487行）
  src/app/auth/reset-password/page.tsx — パスワードリセット
  src/app/auth/update-password/page.tsx

オンボーディング
  src/app/onboarding/page.tsx          — Suspense + OnboardingClient
  src/app/onboarding/OnboardingClient.tsx（562行）
  src/components/jobseeker/OnboardingGuard.tsx — 強制リダイレクト

プロフィール編集
  src/app/(jobseeker)/profile/edit/    — ProfileEditClient.tsx（4,485行）
```

---

## 3. 企業側の掲載・求人管理体験

### 3-1. 求人掲載フロー全体

```
/biz/auth → /biz/select-company → /biz/dashboard
                                        └── /biz/jobs（求人一覧）
                                              ├── /biz/jobs/new（求人新規作成）
                                              └── /biz/jobs/[id]/edit（求人編集）
```

**認証後の企業紐づけ:**  
`getTenantContext()` → `ow_user_roles.tenant_id` → 企業を特定。  
複数企業所属の場合は `CompanySwitcher` でテナント切り替え。

---

### 3-2. 求人管理画面の実装状況

**`/biz/jobs`（一覧）— `src/app/biz/jobs/JobsClient.tsx`（906行実質）**

| 機能 | 状態 |
|------|------|
| ステータス別タブ（全件/公開/審査中/下書き/却下） | ✅ 実装済み |
| テキスト検索 | ✅ 実装済み |
| 楽観的更新（ステータス変更・削除） | ✅ 実装済み |
| インライン削除確認（window.confirm なし） | ✅ 実装済み |
| 複製機能 | ✅ 実装済み |
| 応募数表示 | ✅ 実装済み |

**ステータス定義（`src/lib/business/mockJobs.ts`）:**
```
draft → pending_review → published（公開）/ rejected（却下）
```

**`/biz/jobs/new` & `/biz/jobs/[id]/edit` — `src/components/business/JobEditForm.tsx`（906行）**

| フィールド | 状態 |
|-----------|------|
| タイトル・職種カテゴリ・雇用形態 | ✅ 実装済み |
| 給与レンジ・勤務地・リモート対応 | ✅ 実装済み |
| 必要スキル・歓迎スキル（タグ入力） | ✅ 実装済み |
| 選考フロー・採用フロー（ステップ編集） | ✅ 実装済み |
| マークダウンエディタ（詳細説明） | ✅ 実装済み |
| キャッチコピー・ハイライト文 | ✅ 実装済み |

---

### 3-3. publish ボタンの状態管理

**現在の実装（`JobEditForm.tsx`）:**

```typescript
const [isPublishing, setIsPublishing] = useState(false);
// 保存ではなく「公開申請」ボタン
// → API PATCH { action: "status", value: "pending_review" }
// → 編集部レビュー後に published になる
```

**フロー:**
1. 企業担当者が入力 → 「公開申請する」ボタン
2. `isPublishing` フラグで二重送信防止（`disabled` + グレーアウト）
3. API が `pending_review` に変更 → 編集部の承認を待つ
4. 却下の場合は `JobRejectionBanner.tsx` で却下理由を表示（`status === "rejected"` 条件）

**⚠️ 問題: 自動保存がない**  
`JobEditForm` には 700ms デバウンス自動保存はなく、**明示的な「下書き保存」ボタンのみ**。  
長時間の入力後にブラウザが落ちた場合、入力内容が消える。

**⚠️ 問題: 下書き状態でのプレビューが未実装**  
`preview` ボタンが `window.open('/jobs/{jobId}')` に直接飛ぶが、  
`draft` 状態の求人は公開ページでは表示されない（求職者側は `published` のみ表示）。

---

## 改善余地まとめ（優先度順）

### 🔴 P0: 即時対応が必要

| # | 箇所 | 問題 | なぜ重要か |
|---|------|------|-----------|
| P0-1 | `OnboardingClient.tsx` | 職種選択肢が17個で多すぎる | 登録直後の最重要CVポイント。離脱率に直結 |
| P0-2 | `companies/[id]/page.tsx`（3,700行） | 巨大単一ファイル。スタイルが混在 | メンテ不能になっており、以降の改善がすべて困難 |

### 🟡 P1: 早期対応推奨

| # | 箇所 | 問題 | なぜ重要か |
|---|------|------|-----------|
| P1-1 | `StatusPill` 系重複 | `StatusPill.tsx` / `MeetingStatusBadge` / `JobStatusBadge` が並立 | 見た目の不統一が発生しやすい |
| P1-2 | `ProfileEditClient.tsx`（4,485行） | プロフィール編集が単一巨大ファイル | タブごとに分割すべき |
| P1-3 | オンボーディング「スキップ」なし | 5ステップを強制完走しないと何も見られない | 離脱リスク大 |
| P1-4 | `JobEditForm` の自動保存なし | 企業側の求人入力が消えうる | 企業体験に直結 |

### 🟢 P2: 中期的に対応

| # | 箇所 | 問題 | なぜ重要か |
|---|------|------|-----------|
| P2-1 | ハードコード色115件 | `#002366` 等がCSS変数を使わずに埋め込まれている | ブランド変更時に全ファイル修正が必要になる |
| P2-2 | `globals.css` のページ別スタイル肥大 | `.trajectory-*`, `.traj-*` 等がグローバルに散在（939行） | CSS汚染が進むと競合が起きやすい |
| P2-3 | biz側モバイル対応 | `/biz` 系ページはデスクトップ前提のレイアウトが多い | モバイルで企業担当者が操作する際に崩れる可能性 |
| P2-4 | オンボーディング完了後のウェルカム体験 | `/companies` にサイレントに飛ぶだけ | 「次にすること」を示すと次のアクション率が上がる |

---

## 最初に着手すべきファイル提案

### 領域1（デザイン土台）から手をつけるなら
```
src/components/common/StatusPill.tsx
src/components/business/MeetingStatusBadge.tsx   ← StatusPill に統合して削除
src/components/business/JobStatusBadge.tsx       ← StatusPill に統合して削除
```
StatusPill への統合から始めると、最小変更で最大の視覚一貫性改善ができる。

### 領域2（求職者オンボーディング）から手をつけるなら
```
src/app/onboarding/OnboardingClient.tsx
```
職種の17選択肢を「カテゴリ選択 → サブ選択」2ステップに変更するだけで離脱率が改善できる。  
あわせてスキップ機能（`/companies` へ直行リンク）の追加も1箇所の変更で対応可能。

### 領域3（企業側求人管理）から手をつけるなら
```
src/components/business/JobEditForm.tsx
```
700msデバウンス自動保存（`draft` 状態への随時 PATCH）の追加が最も高インパクト。  
`ProfileEditClient.tsx` の `isSaving` パターンをそのまま流用できる。

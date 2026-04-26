# Phase 3: Enterprise Side Royal Blue Unification — Complete

**完成日**: 2026-04-26  
**実装期間**: 1日（集中実装セッション）  
**対象**: `/biz/*` enterprise 6画面の royal blue デザイン統一  
**コミット数**: 10 commits (S1a → S5)  
**Backup branches**: 14本

---

## 完成画面

### /biz/dashboard (S1a / S1a-mock / S1b)
- 8 components: UpgradeBanner / EditorInvitation / PendingMeetings / ActivityList / MatchCandidates / JobStatusCards / TeamMembers / RecruiterProfile
- 240px sidebar + topbar + plan upgrade widget
- Plan-gated UX: free tier は招待・採用分析機能をブロック（blur + lock）
- Mock mode で開発確認、本番 Supabase 接続は Phase 4 で対応

### /biz/meetings (S2a / S2b)
- 3カラム full-height layout（sidebar: 240px / list: 320px / detail: 1fr）
- 6ステータスタブ: pending / company_contacted / scheduling / scheduled / completed / declined
- モック申込 12件、全ステータスを網羅
- Optimistic status update（ステータス変更 → 次の申込に自動移動）
- メモ autosave: 1500ms debounce、idle→saving→saved 状態機械
- Prev/Next ナビゲーション（端検知あり）
- 辞退確認 dialog / 完了直接実行
- `scheduling` ステータス: UX上必要だが DB migration は Phase 4 で対応

### /biz/jobs list (S3a)
- ステータスサマリー5カード（rejected は urgent スタイル）
- 6フィルタータブ + 検索ボックス
- ステータス別左ボーダーカラー
- 5アクションボタンパターン（rejected / published / pending_review / draft / private）
- モック求人8件、全ステータス網羅

### /biz/jobs/[id]/edit + /biz/jobs/new (S3b)
- 共通 `JobEditForm` コンポーネント（`mode='new' | 'edit'`）
- 7セクション: basic / salary / content / requirements / process / assignee / visibility
- 700ms debounce autosave（idle→saving→saved）
- chip-options / tag-input-wrap / process-step 固有 UI パターン
- Markdown スタイルツールバー（UI のみ）
- Rejection banner（rejected 求人の再申請フロー）
- `/biz/jobs/new`: 491行 → 54行（90%削減、JobEditForm 共通化による）

### /biz/company (S4a / S4b)
- 6セクション: basic / about / data / workstyle / photos / settings
- `MarkdownEditor` コンポーネント（ツールバー8操作 + テキストエリア + ヘルプ）
- 4カテゴリ写真グリッド（workspace / meeting / welfare / event、各最大5枚）
- HTML5 ネイティブ D&D による写真並び替え（`useRef` で re-render 回避）
- Unsplash Source API で即時写真プレビュー
- `CompanyPublishStatusBar`: warm（未公開変更あり）/ success（最新公開中）
- `CompanyEditSubNav`: 最終公開日カード + 「公開ページを見る」ボタン + 入力進捗バー
- 元 828行 → 696行（members セクション削除 + 再構成）

### /biz/auth (S5)
- 2モード単一ページ（signup / login）
- 2カラムレイアウト: 左 royal グラデーション ブランドパネル + 右フォームパネル（440px）
- `?mode=login` ディープリンク対応
- Signup 7フィールド: 企業名 / 業種(8択) / 従業員数(6択) / 担当者名 / 部署・役職 / 企業メール / パスワード
- 個人ドメインメール警告 hint（warm カラー）
- 既存ユーザー検知（mock 配列、slideIn アニメーション通知）
- Supabase 本番接続:
  - `supabase.auth.signUp` with `raw_user_meta_data.name`
  - migration 032 トリガーで `ow_users` 自動作成
  - `/api/company/register` 経由で `ow_companies` INSERT
  - `ow_company_admins` INSERT（department / role_title / permission='admin'）
- `/biz/auth/signup`: 655行 5ステップウィザード → 4行 redirect
  （UX哲学: signup はエントリーポイント、詳細情報は `/biz/company` で後から入力）

---

## 共通インフラ

### useAutoSave hook (`src/hooks/useAutoSave.ts`)
```typescript
export type SaveState = "idle" | "saving" | "saved";
export function useAutoSave(options?: { delayMs?: number; savedResetMs?: number })
```
- `useRef` タイマーでアンマウント時に確実にクリーンアップ
- `delayMs` (default 700ms) / `savedResetMs` (default 2000ms) で設定可能
- 使用箇所: JobEditForm (700ms) / /biz/company (700ms) / /biz/meetings (1500ms は独自実装)

### BusinessLayout variant prop
```
'default'   → padding: 28px 36px 60px（通常ページ）
'fullBleed' → padding: 0（meetings / jobs edit / company edit など全高グリッド用）
```

### Royal blue デザイントークン (globals.css)
```css
--royal: #002366;      /* プライマリブランド */
--royal-deep: #001A4D; /* グラデーション端 */
--royal-50: #EFF3FC;   /* 選択背景 */
--royal-100: #DCE5F7;  /* 薄背景 */
--accent: #3B5FD9;     /* グラデーション中間 */
/* ステータス: --success / --warm / --purple / --error（各 -soft 付き）*/
```

### Mock mode インフラ
- `NEXT_PUBLIC_BIZ_MOCK_MODE` 環境変数（client-side）
- `BIZ_MOCK_MODE` 環境変数（Edge Runtime / middleware）
- 各 `/biz/*` ページパターン: `page.tsx` → mock check → Client Component

### 共通 UI パターン
- `StatusBadge` コンポーネント（Meeting / Job 別実装、同一デザイン言語）
- `EmptyState` コンポーネント（Meeting / Job 別実装）
- カスタム topbar（52px height）: アクションボタン + save state ピル
- Sub-nav（240px）: セクション一覧 + 完成バッジ + 進捗バー

---

## 実装量サマリー

| セッション | コミット | 内容 | 主要ファイル |
|---|---|---|---|
| S1a | `0e8eedb` | dashboard 基盤 + BusinessLayout rewrite | 8 files, +840 |
| S1a-mock | `70355e1` | mock mode 追加 | 3 files, +266 |
| S1b | `dda9b02` | 8 dashboard コンポーネント完成 | 14 files, +962 |
| S2a | `b487de2` | meetings 3カラム静的レイアウト | 11 files, +1,465 |
| S2b | `351371a` | meetings インタラクション完成 | 3 files, +246 |
| S3a | `4e03a08` | jobs リストページ | 8 files, +1,050 |
| S3b | `ee043e4` | JobEditForm 共通化 + new/edit | 8 files, +1,344 |
| S4a | `977b1a3` | company 6セクション + useAutoSave | +49,773※ |
| S4b | `9147f19` | company photos D&D | 3 files, +547 |
| S5  | `06403ba` | auth 2モード + Supabase signup | 3 files, +1,112 |

※ S4a の大幅増はパッケージ lock file 更新を含む。アプリケーションコード実質 ~800行。

**Phase 3 アプリケーションコード実質増**: 約 **8,000行以上**  
**Backup branches**: **14本**（全セッション分保持）

---

## デザイン哲学

### Editorial × Serene Tech
- **Noto Serif JP**: 見出し（editorial な奥行き感）
- **Noto Sans JP**: 本文（清潔な可読性）
- **Inter**: 数値・ラベル（技術的精度）
- **Royal blue (#002366)**: 洗練 + 信頼
- **余白のリズム**: Aesop ミニマリズム — 情報密度より読み心地を優先

### 「読む採用」
- 求人詳細・企業情報などのロングフォームコンテンツは、情報密度より可読性を優先
- 数値・スコアによる比較を排除（Hisato 思想: 求職者が自分で判断する）

### 一貫した状態表現
- save state: `idle → saving → saved`（全フォームで統一）
- status badge: 6色 (pending/amber, contacted/royal, scheduling/purple, scheduled/purple, completed/gray, declined/error)
- draft badge: warm-soft 背景「下書きあり」

---

## 残タスク (Phase 4-5 で対応)

### 1. Supabase 本格連携
各画面の mock state → 実 Supabase write に切り替え

**meetings の scheduling ステータス migration (要 DDL)**:
```sql
ALTER TABLE ow_casual_meetings DROP CONSTRAINT IF EXISTS 
  ow_casual_meetings_status_check;
ALTER TABLE ow_casual_meetings ADD CONSTRAINT 
  ow_casual_meetings_status_check 
  CHECK (status IN ('pending', 'company_contacted', 'scheduling', 
                    'scheduled', 'completed', 'declined'));
```

**company テーブルの不足カラム**:
- `office_photos` (JSONB or 別テーブル)
- `notification_emails` (TEXT)
- `last_published_at` (TIMESTAMPTZ)
- `nearest_station` (TEXT)

### 2. 認証フロー補完
- パスワードリセット機能（forgot password リンクは UI のみ）
- signup 後のメール確認フロー検討

### 3. 権限制御
- `ow_company_admins.permission` ('admin' | 'member') によるアクセス制御
- `ow_user_roles` legacy table の段階的廃止 → `ow_company_admins` への一本化

### 4. 写真アップロード本番化
- `/biz/company` photos セクション現状は Unsplash Source API（モック）
- Supabase Storage 連携で実ファイルアップロードに置き換え

### 5. Phase 5 の継続
- Phase 5 Stage 2 以降（認証フロー / プロフィール / マイページの Supabase 接続）

### 6. Phase 6 構想 (求職者側 royal blue 統一)
- 既存 `/jobs`, `/companies`, `/articles`, `/mentors` 等は緑 (#1D9E75) のまま
- 求職者側 UX 哲学に合わせた調整が別途必要

---

## 開発体制

| 役割 | 担当 |
|---|---|
| Product / Strategy / Visual confirmation | Hisato (柴 久人) |
| Strategy / Planning / Code review | Claude (chat / Sonnet 4.6) |
| Implementation / File operations / Build | Claude Code (CLI) |
| 外部エンジニア | なし |

---

## 開発手法

### 「事前調査 → 判断 → 実装」サイクル

各セッションで:
1. Claude Code がモック HTML と既存コードを精読、差分レポートを出力
2. Hisato + Claude (chat) で方針確定（共通化 / 分割 / 優先度）
3. Claude Code が実装、ビルド確認
4. ブラウザで動作確認（screenshot / snapshot）
5. コミット + push

### バックアップブランチ戦略
全セッション開始前に `backup/before-<session>-<timestamp>` を作成。14本全てを保持。

### Mock mode-first 開発
本番 Supabase 接続より先に mock データで全画面を動作確認。
- デザイン確認の高速化
- バックエンド設計の柔軟性確保
- mock → 本番の段階的移行を安全に実施

Auth のみ production Supabase 接続を実装（他画面は Phase 4-5 で順次対応）。

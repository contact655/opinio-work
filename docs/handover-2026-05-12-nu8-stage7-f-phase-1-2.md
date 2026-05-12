**作成日**: 2026-05-12
**段階**: ν-8 段階7-F Phase 1 + 2 — 編集者向け管理画面(認可基盤 + school_requests 一覧)
**状態**: ✅ Phase 1 + Phase 2 完了、push 済み、本番反映 ● Ready 確認済み

---

## エグゼクティブサマリ

段階7-F は、段階6-8 で完成した「ユーザー側の学校追加リクエスト送信経路」と
対をなす **運営側の管理経路** を実装する大段階。複数 Phase 想定で、本日は
Phase 1(認可基盤)+ Phase 2(school_requests 一覧表示)を完了した。

- **Phase 1**: 認可基盤 `isAdmin()` + 既存 /admin への「学校追加リクエスト管理」ナビ追加
- **Phase 2**: GET API `/api/admin/school-requests` + ページ `/admin/school-requests`

これにより、ユーザーが送信したリクエストを運営が **管理画面で一覧確認できる**
状態になった。承認/却下機能は Phase 3/4 で実装する。

本日のセッションで:
- ユーザー側(段階6-8)→ 運営側(段階7-F)の **エンドツーエンド連携が初めて動作**
- 「丁寧な介在」思想の運用フローが両側で揃った

**規模**: 2 Phase / 3 実装コミット(7d55cda + 93aded4 + 251a20d)/ 環境変数追加 1 件

---

## 段階7-F の出発点と判断

### 出発点

段階6-8 完了時点で、ユーザーが学校追加リクエストを送れる仕組みは完成したが、
運営側(柴さん)が承認するには Supabase Dashboard SQL を手動で書く必要があった。
これは運用負荷が高く、また承認手順を間違えると DB 整合性が崩れるリスクもある。

段階7-F は柴さんの「おすすめで!」の即決で着手。複数 Phase で進める方針を確定。

### 段階7-F 全体方針(着手時に確定)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | 運営判定ロジック | 案 a: 環境変数 `ADMIN_EMAILS` |
| 2 | 管理画面のパス | 案 P: `/admin/...` |
| 3 | 認可外アクセス | 案 Z: 404 表示 → **実装時に既存仕様で `/` リダイレクトに上書き** |
| 4 | コンポーネント設計 | 案 ii: Server(認可)+ Client(UI) |

### Phase 構成(着手時に確定、Phase 4 以降は未着手)

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | 認可基盤 + /admin レイアウト | ✅ 完了 |
| Phase 2 | school_requests 一覧ページ | ✅ 完了 |
| Phase 3 | 承認 API | 未着手 |
| Phase 4 | 却下 API + UI | 未着手 |
| Phase 5 | logo_letter / logo_gradient 入力 UI | 未着手 |
| Phase 6 | handover doc | 未着手 |

---

## 🚨 Phase 1 で発覚した重要事実(最大の発見)

### 既存 `/admin` セクションが完全実装済みだった

私(チャット側 Claude)の指示文起草時、**既存 /admin の実装を完全に見落としていた**。
Claude Code が現場で発見:

> 既存の /admin セクションが完全に実装済みです
> (ダークサイドバー + auth_is_admin RPC 認可 + ダッシュボード)

| 私の前提 | 実際 |
|---------|------|
| `/admin` は新規ルート | **既存実装あり** |
| 認可方式 = `ADMIN_EMAILS` 環境変数 | **既存 = `auth_is_admin` RPC + `ow_user_roles` テーブル** |
| 認可外 → 404 | **既存 = `/` リダイレクト** |
| シンプルなメニューページ | **本格 KPI ダッシュボード** |
| 専用 AdminHeader(オレンジ) | **ダークサイドバー + 全 8 項目ナビ** |

これは段階7-F の根幹に関わる前提崩壊だった。

### Claude Code の対応(評価すべき判断)

Claude Code は既存実装を破壊せず、**統合形** で再設計:
1. `isAdmin.ts` = RPC プライマリ + ADMIN_EMAILS フォールバックの **二段構え**
2. `layout.tsx` = 既存サイドバー NAV_ITEMS に「学校追加リクエスト管理」項目を追加
3. `page.tsx` = 既存 KPI ダッシュボードを保全
4. `AdminHeader.tsx` = 作成したが死にファイル(後で削除)

→ 後続コミット `93aded4` で死にファイル削除。

### 教訓と新運用ルール提案

**「新規ルート作成前に `ls src/app/` で既存実装を網羅的に確認する」**

これは段階6-7 で確立した「`npm run build` 必須」と同じレベルの重要運用ルール。
本 handover doc に永続化することで未来の自分(と次のセッションの私)を救う。

---

## 🚨 Phase 1 で発見した DB 構造の重要事実

### `ow_user_roles.user_id` の FK 参照先

| カラム | data_type | 参照先 |
|--------|---------|------|
| id | uuid | - |
| **user_id** | **uuid** | **`auth.users.id`**(`ow_users.id` ではない!) |
| role | text | - |
| created_at | timestamptz | - |
| tenant_id | uuid | `ow_companies.id`(nullable) |

**重要**:
- `ow_users.id` ≠ `auth.users.id`
- `ow_users.auth_id` カラムが `auth.users.id` を参照
- `ow_user_roles.user_id` は **直接 `auth.users.id`** を参照

### s.hisato1020@gmail.com の正しい ID

| テーブル | id |
|---------|---|
| `ow_users.id` | `e826e0bd-f96b-42ec-acda-d8f482e1417d` |
| `auth.users.id` | `7f358b59-2269-41fa-9324-4298c3c82cd2` |

**s.hisato1020@gmail.com は既に `ow_user_roles` で `role='admin'` を保持**(本日の調査で発覚、4/30 以前から)。これにより `auth_is_admin` RPC で /admin にアクセス可能。

### Phase 3 以降への重要前提

承認 API 等で `ow_user_roles` を扱う時は、必ず `auth.users.id` を `user_id` に入れる。
`ow_users.id` を入れると FK 違反エラーになる。

---

## 🚨 Phase 1 で発見した環境変数の混在

### Vercel 環境変数の状況

| 変数名 | 設定状態 | 値 | 用途 |
|--------|---------|-----|------|
| `ADMIN_EMAIL`(単数) | 既存(4/30 追加) | `contact@opinio.co.jp` | 用途不明、おそらく Resend 経由のメール通知先 |
| **`ADMIN_EMAILS`(複数)** | **本日追加(Production + Preview)** | `s.hisato1020@gmail.com` | Phase 1 `isAdmin.ts` のフォールバック |

### 技術的負債(次回整理候補)

- `ADMIN_EMAIL`(単数)の正確な用途は未確認
- `ADMIN_EMAILS`(複数)を新規追加したが、本来は単数を統一して使う設計もあり得た
- Phase 1 では新規追加で対応(既存を触ると別機能を壊すリスク)

---

## Phase 別実装サマリ

### Phase 1: 認可基盤 + /admin 統合

**コミット**: `7d55cda` + `93aded4`(死にファイル削除)

#### 新規ファイル

- `src/lib/auth/isAdmin.ts`(RPC プライマリ + ADMIN_EMAILS フォールバックの二段構え)

#### 改修ファイル

- `src/app/admin/layout.tsx`(NAV_ITEMS に「学校追加リクエスト管理」追加、11 行)

#### 設計上のポイント

- 私の指示文は新規構築前提だったが、Claude Code が既存統合形に切り替え
- `auth_is_admin` RPC が既存実装の認可で動いている
- `ADMIN_EMAILS` 環境変数はフォールバック(現状未使用、将来活用余地あり)

#### 確定済みミニ判断点(Phase 1 着手時)

| # | 判断点 | 確定 |
|---|------|------|
| 5 | /admin トップ構成 | (既存ダッシュボード保全) |
| 6 | ヘッダー | (既存ダークサイドバー保全) |
| 7 | スタイリング | (既存 Tailwind に統合) |

### Phase 2: school_requests 一覧

**コミット**: `251a20d`

#### 新規ファイル

- `src/app/api/admin/school-requests/route.ts`(GET ハンドラ、admin 認可付き)
- `src/app/admin/school-requests/page.tsx`(Server Component、Tailwind、一覧表示)

#### 確定済み判断点(Phase 2)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | ページのパス | `/admin/school-requests` |
| 2 | GET API | `/api/admin/school-requests` |
| 3 | 表示する status | pending のみ |
| 4 | 表示情報 | 最小限(school_name, kana, 送信者, 日時) |
| 5 | ソート順 | created_at DESC(新着上) |
| 6 | 件数表示 | 「pending N 件」 |

#### 設計上のポイント

- **service role 使用**: RLS が「自分のリクエストのみ SELECT 可」なので、admin が全件取得するには service role が必須。これは段階6-4 で確立した「不必要な service role を避ける」原則の **正当な例外ケース**
- **既存パターン継承**: `createAdminClient()` を `@/lib/supabase/admin` から import
- **Supabase FK 1:1 推論問題に対応**: 段階6-6 で発見した「`ow_users!ow_school_requests_requested_by_fkey` JOIN 時の TypeScript 推論問題」を `as unknown as` キャストで解決
- **空状態の実装**: 0 件時に「現在 pending のリクエストはありません」を表示

#### 動作確認(6 シナリオ、全合格)

- シナリオ 1: ナビからアクセス ✅
- シナリオ 2: 0 件状態 ✅
- **シナリオ 3 ⭐: エンドツーエンド連携**(段階6-8 → 段階7-F)✅
- シナリオ 4: 複数件 + ソート ✅
- シナリオ 5: 認可外アクセス → リダイレクト ✅
- シナリオ 6: API 直接呼び出し ✅(任意)

特に **シナリオ 3** が本フェーズの最重要検証ポイントだった。

---

## コミット一覧

| 順 | コミット | Phase | 内容 |
|---|--------|------|------|
| 1 | `7d55cda` | Phase 1 | 認可基盤 + /admin 統合 |
| 2 | `93aded4` | Phase 1 仕上げ | 死にファイル AdminHeader 削除 |
| 3 | `251a20d` | Phase 2 | school_requests 一覧 API + ページ |
| 4 | (このコミット) | Phase 2 handover | handover doc |

---

## 環境変数設定(本セッションで実施)

### Vercel 環境変数

新規追加:

```
Key: ADMIN_EMAILS
Value: s.hisato1020@gmail.com
Environments: Production, Preview
Sensitive: OFF
```

設定後、Redeploy で本番反映確定。

---

## 運用課題と反省点

### 反省点 1: 既存実装の事前調査不足(最大の反省)

私(チャット側 Claude)が Phase 1 の指示文起草時、既存 `/admin` の実装を見落とした。
Claude Code が現場で発見・統合形に再設計したため、致命的な問題にはならなかったが、
これは指示文起草プロセスの改善余地。

### 新運用ルール(本セッションで確立、未来のセッションへ)

**「新規ルート作成前に `ls src/app/` で既存実装を網羅的に確認する」**

具体的な確認コマンド:

```bash
# 該当パスのディレクトリが既に存在するか
ls src/app/<path>/ 2>/dev/null && echo "既存実装あり" || echo "新規"

# 該当 API パスが既に存在するか
ls src/app/api/<path>/ 2>/dev/null
```

これは段階6-7 で確立した「`npm run build` 必須」と同じレベルの重要運用ルール。

### Phase 2 で確認できた既存運用ルールの効果

- **`npm run build` 必須**: 4 度目の実践、定着済み
- **Vercel deployments 目視確認**: Phase 1 / Phase 2 とも ● Ready 確認済み
- **本番反映を完走の定義に組み込む**: 本セッションで遵守

### 技術的負債(本セッションで発覚、次回整理候補)

- `ADMIN_EMAIL`(単数)vs `ADMIN_EMAILS`(複数)の用途整理
- 既存 `/admin` の認可ロジックを memory 永続化(本 handover doc で記録済み)

---

## 次の段階に向けて

### 段階7-F Phase 3 候補(自然な延長、未着手)

**承認 API 実装**

仕様の概要(本 handover doc で整理):

```
エンドポイント: POST /api/admin/school-requests/[id]/approve

処理内容(atomic transaction 推奨):
1. ow_schools に新規 INSERT(name, name_kana, logo_letter, logo_gradient)
   - logo_letter, logo_gradient は body で受け取る or サーバ側で自動生成
2. ow_school_requests を approved 状態に UPDATE
   - status = 'approved'
   - approved_school_id = (1) で生成された UUID
   - approved_at = now()
   - approved_by = (admin の auth.users.id)
3. ow_user_educations を UPDATE
   - school_id = (1) で生成された UUID
   - WHERE user_id = (request の requested_by) AND school = (request の school_name) AND school_id IS NULL

要件:
- service role(RLS バイパス)
- admin 認可
- 3 つの UPDATE/INSERT を一つの transaction にまとめる(Supabase の RPC FUNCTION 推奨)
```

### 段階7-F Phase 4 候補(却下 API + UI 統合)

```
エンドポイント: POST /api/admin/school-requests/[id]/reject

処理内容:
1. ow_school_requests を rejected 状態に UPDATE
   - status = 'rejected'
   - approved_at = now()
   - approved_by = (admin の auth.users.id)

Phase 2 で作った一覧ページに「承認」「却下」ボタンを追加。
```

### 段階7-F Phase 5 候補(logo_letter / logo_gradient 入力 UI)

承認時に運営が logo_letter(漢字 1 文字)、logo_gradient(CSS グラデーション)を入力する UI。
ow_schools の品質を保つために必要。

### 段階7-F Phase 6 候補(全体 handover doc)

Phase 1-5 完了後、段階7-F 全体の総括 handover doc を作成。

---

## 段階6 + 段階7 の全体状況(本日完了時点)

- **完了済み段階**: 6-1, 6-2, 6-3-1, 6-3-1.5, 6-3-2, 6-3-3, 6-4, 6-5, 6-6, 6-7, 6-8, **7-F Phase 1**, **7-F Phase 2**
- 段階6 累計: 約 74 コミット + 19 migration
- 段階7 着手: Phase 1 + 2 完了、Phase 3-6 未着手
- 残存技術的負債:
  - 段階6-4 判断点 2: `ow_uploads_auth_insert` 強化
  - 段階6-4 判断点 3: documents/candidate-documents 用途確認
  - 段階6-3-3 §6 #4: card_color カスタマイズ
  - 段階7-F: `ADMIN_EMAIL`(単数)と `ADMIN_EMAILS`(複数)の整理

---

## ファイル一覧

### 新規ファイル

- `src/lib/auth/isAdmin.ts`(Phase 1)
- `src/app/api/admin/school-requests/route.ts`(Phase 2、新規)
- `src/app/admin/school-requests/page.tsx`(Phase 2、新規)

### 改修ファイル

- `src/app/admin/layout.tsx`(Phase 1、NAV_ITEMS に項目追加)

### 削除ファイル

- `src/components/admin/AdminHeader.tsx`(Phase 1 仕上げ、死にファイル削除)

### Vercel 環境変数

- `ADMIN_EMAILS`(新規追加、Production + Preview)

### handover doc

- `docs/handover-2026-05-12-nu8-stage7-f-phase-1-2.md`(本ファイル)

---

## 本セッションの総括

### 完走した段階(本日 1 日で 3 段階)

- **段階6-7**(キャッシュ最適化 + カナ検索 + Vercel ビルドエラー解消 hotfix)
- **段階6-8**(schools マスター追加運用フロー、ユーザー側経路完成)
- **段階7-F Phase 1 + 2**(管理画面の認可基盤 + 一覧表示、運営側経路の着手)

### 数字

- 完走段階: 3 段階(うち段階7-F は Phase 1 + 2)
- 実装コミット: 約 11 件
- handover doc: 3 件(6-7 + 6-8 + 7-F)
- Migration: 1 件(100)
- TypeScript エラー: 常時ゼロ
- ESLint エラー: hotfix 後ゼロ
- `npm run build`: 全段階で成功(4 度実践)
- Vercel ● Ready: すべて確認済み
- 本番反映: すべて完了

### 印象的な瞬間

1. **段階6-7 hotfix で Vercel ビルドエラー長期見逃しの発見**: 5/6 以降の本番未反映を解消
2. **段階6-8 で「丁寧な介在」思想を実装する重要段階完走**: マスター追加リクエストの半自動承認フロー
3. **段階7-F Phase 1 で既存 /admin 発見**: 前提崩壊だったが Claude Code が統合形に着地
4. **段階7-F Phase 2 のエンドツーエンド連携確認**: ユーザー側(段階6-8)→ 運営側(段階7-F)の連鎖が初めて本番で動く状態に
5. **段階7-F Phase 1 で `ow_user_roles` FK 構造解明**: Dashboard SQL 4-5 回繰り返して `user_id → auth.users.id` を確定

### 本日確立した運用ルール(新規 1 件、永続化済み)

| ルール | 永続化先 |
|------|---------|
| **新規ルート作成前に `ls src/app/` で網羅確認** | **本 handover doc** |

---

**段階7-F Phase 1 + 2 完了**
**作成者**: Claude(チャット) + 柴久人
**作成日**: 2026-05-12

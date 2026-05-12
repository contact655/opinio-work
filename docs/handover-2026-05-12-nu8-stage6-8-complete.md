**作成日**: 2026-05-12
**段階**: ν-8 段階6-8 — schools マスター追加運用フロー(ユーザーリクエスト経路)
**状態**: ✅ Phase 1-4 全 Phase 完了、push 済み、本番反映 ● Ready 確認済み

---

## エグゼクティブサマリ

段階6-8 は、段階6-6 で完成した学歴ロゴ機能を **運用面で完成させる** 段階。段階6-6 で 30 校マスター + school_id FK + SchoolLogoImg を構築し、段階6-7 でキャッシュ最適化 + カナ検索を加えたが、**マスターに無い学校(31 校目以降)を追加する経路** が存在しなかった。

段階6-8 はこの欠落を埋めるために、**ユーザーが学校追加リクエストを送信できる仕組み** を実装した。

- **Phase 1**: `ow_school_requests` テーブル作成(リクエスト記録基盤)
- **Phase 2**: POST API `/api/jobseeker/school-requests`(リクエスト送信エンドポイント)
- **Phase 3**: EducationEditor のバナー UI(マスターにない学校を保存後に「リクエスト送る?」と促す)

これにより、ユーザーは自由入力した学校を運営に届けることができる経路を獲得した。承認は当面、運営(柴さん)が Supabase Dashboard SQL で手動実施する運用とした(管理画面 UI は別段階 7-F 等で対応)。

**規模**: 4 Phase / 3 実装コミット + handover コミット / 1 Migration / 約 150 行追加 / 6 シナリオ全動作確認 OK

---

## 段階6-8 の出発点と判断

### 出発点

段階6-7 完了時点で、`ow_schools` マスターは 30 校のシードのみ。ユーザーが入力した学校がマスターになければ、`school_id = null` のまま `<GraduationCap>` フォールバック表示になる。これは判断点 5(漸進的移行)で正しい挙動だが、**ユーザーが「自分の母校もロゴで表示したい」と思った時にアクションできる経路がない** という欠落を抱えていた。

段階6-8 は柴さんの「設けたいです!」という明確な意思表示で着手。**「丁寧な介在」思想の実装**として、自動化と運営判断のバランスを取った半自動承認フローを設計した。

### 確定済み判断点(12 件)

#### 段階開始時に確定(判断点 1-7、設計方針)

| # | 判断点 | 確定 |
|---|------|------|
| 1 | UX トリガー | 案 c: 軽い通知バナー(自由入力保存後)|
| 2 | テーブル設計 | 9 カラム + RLS |
| 3 | 承認後フロー | 案 P: 自動更新(承認時に school_id 自動セット、ただし運営側 UI は別段階)|
| 4 | スコープ | 案 X: ユーザー側のみ実装(運営側 UI は段階7-F 等送り)|
| 5 | Phase 構成 | 4 Phase(Migration → API → UI → handover)|
| 6 | 承認ワークフロー | 案 iii: 承認チェックは後日(柴さん任意のタイミング、Dashboard SQL 手動)|
| 7 | API エンドポイント | 案 a: POST のみ |

#### Phase 3 着手前に確定(判断点 8-12、UI 仕様)

| # | 判断点 | 確定 |
|---|------|------|
| 8 | バナー表示トリガー | 案 a: 保存直後(school_id === null かつ school が空でない場合)|
| 9 | 重複送信 | 案 X: 何度でも送れる(運営判断に委ねる)|
| 10 | バナーデザイン | 案 Q: school_name_kana 任意入力含む |
| 11 | 閉じた状態の永続化 | 案 i: 毎回表示(state リセット時に消える)|
| 12 | 表示タイミング | 案 α: immediately(保存完了と同時)|

### 設計原則

- **「丁寧な介在」思想の実装**: 完全自動化(self-service の即 INSERT)ではなく、運営承認を介在させることでマスターの品質を保つ
- **YAGNI 原則の継続**: GET エンドポイント、リクエスト一覧 UI、メール通知、運営承認 UI 等は段階6-8 のスコープ外。必要になった段階で追加
- **既存設計の継承**: 段階6-6 で確立した「school_id 維持」(シナリオ 4)、段階6-7 で確立した「`npm run build` 必須」運用ルールを継承
- **データ損失ゼロ**: `ON DELETE CASCADE`(requested_by)+ `ON DELETE SET NULL`(approved_school_id, approved_by)で履歴整合性を保ちつつ柔軟性確保

---

## Phase 別実装サマリ

### Phase 1: Migration 100 — ow_school_requests テーブル

**コミット**: `f3156b2`
**Migration**: `100_create_ow_school_requests.sql`
**Rollback**: `100_create_ow_school_requests_rollback.sql`

#### 内容

- 9 カラム: id, requested_by, school_name, school_name_kana, status, approved_school_id, approved_at, approved_by, created_at
- CHECK 制約: status は 'pending' / 'approved' / 'rejected' の 3 値のみ
- `ON DELETE CASCADE`(requested_by): ユーザー削除時はリクエストも削除(個人情報整合性)
- `ON DELETE SET NULL`(approved_school_id, approved_by): マスター/承認者削除時もリクエスト履歴は残す
- インデックス 2 本: requested_by, status
- RLS: SELECT は自分のリクエストのみ、INSERT は自分のリクエストとしてのみ、**UPDATE/DELETE はポリシーなし**(運営が postgres role で手動承認)

#### Dashboard 適用確認(段階6-4 で確立した運用)

- テーブル存在: 1 行 OK
- カラム数: 9 行 OK
- RLS ポリシー: 2 行(select_own = r、insert_authenticated = a)、UPDATE/DELETE なし OK
- CHECK 制約: status の 3 値制限確認 OK
- インデックス: 3 本(pkey + 2 idx) OK

### Phase 2: POST API Route

**コミット**: `181e107`
**ファイル**: `src/app/api/jobseeker/school-requests/route.ts`(94 行、新規)

#### 仕様

- エンドポイント: `POST /api/jobseeker/school-requests`
- リクエスト body: `{ school_name: string (必須), school_name_kana?: string (任意) }`
- バリデーション: 認証 (401)、school_name 必須かつ空でない (400)、長さ制限 200 文字 (400)
- 重複チェック・既存マスター存在チェックは行わない(運営判断に委ねる)
- レスポンス 201: `{ id, school_name, school_name_kana, status: 'pending', created_at }`

#### 設計上のポイント

- **service role 不使用**: RLS の INSERT ポリシーが正しく動くため、authenticated session で十分(段階6-4 で確立した原則の継承)
- **既存パターン踏襲**: `createClient()`(await なし)、`req: Request`、`resolveOwUserId` ヘルパー再利用
- **`maybeSingle()` 採用**: レコード未存在時の堅牢性

#### 動作確認(必須運用ルール `npm run build` 含む)

- TypeScript エラー: ゼロ
- ESLint エラー: ゼロ
- `npm run build`: 成功(72 ページ静的生成)
- シナリオ 1: 未認証 → 401 確認

### Phase 3: EducationEditor のバナー UI(段階6-8 のクライマックス)

**コミット**: `8a014c4`
**変更ファイル**: `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`(SchoolRequestBanner 新規追加 + state + saveAdd/saveEdit 改修)

#### 変更内容

- **SchoolRequestBanner コンポーネント** 新規実装(EducationEditor 直前のローカルコンポーネント)
- **4 状態の state machine**: idle / submitting / success / error
- EducationEditor に state 4 種追加: bannerSchoolName, bannerKana, bannerStatus, bannerError
- **saveAdd / saveEdit の改修**: 保存成功後、`school_id === null && school.trim().length > 0` の条件でバナー state セット
- handleBannerSubmit: POST API 呼び出し + status 遷移
- handleBannerClose: state リセット
- 教育リスト **上** にバナー配置(視線誘導)

#### バナーの UX

1. ユーザーが自由入力で学校を保存
2. `school_id === null` を検知してバナーが現れる(immediately、段階6-8 判断点 12 案 α)
3. ふりがな入力欄(任意、段階6-8 判断点 10 案 Q)
4. 「リクエストを送る」「今は送らない」の二択
5. 送信成功 → 「✓ 送信しました」表示 + 「閉じる」ボタン
6. 「今は送らない」 → 即座に閉じる(API 呼び出しなし)

#### 動作確認(6 シナリオ全合格)

- シナリオ 1: マスターにない学校 → バナー → 送信成功 ✅
- シナリオ 2: Dashboard SQL で pending レコード確認 ✅
- シナリオ 3: マスターにある学校(東京大学等) → バナー出ない ✅
- シナリオ 4 ⭐: 既存 school_id 紐付け済み(獨協大学)編集 → バナー出ない、ロゴ維持 ✅
- シナリオ 5: 「今は送らない」 → API 呼ばれない ✅
- シナリオ 6: ふりがな空欄でも送信成功(school_name_kana: null 記録) ✅

特に **シナリオ 4** は段階6-6 シナリオ 3「school_id 維持」と同じ思想の継承確認で、最も重要な検証ポイントだった。

---

## コミット一覧

| 順 | コミット | Phase | 内容 |
|---|--------|------|------|
| 1 | `f3156b2` | Phase 1 | Migration 100: ow_school_requests テーブル |
| 2 | `181e107` | Phase 2 | POST API endpoint |
| 3 | `8a014c4` | Phase 3 | EducationEditor バナー UI |
| 4 | (このコミット) | Phase 4 | handover doc |

---

## 運用課題と反省点

### 反省点なし(本セッションは順調)

段階6-8 は段階6-7 で確立した運用ルール(`npm run build` 必須、Dashboard 適用確認、判断点事前確定、判断疲労チェック)が完全に機能した。Vercel ビルドエラーも発生せず、全シナリオ動作確認 OK で完走できた。

### 運用ノウハウ(段階6-7 から継承 + 段階6-8 で深化)

- **新運用ルール `npm run build` 必須を 3 度実践**(段階6-7 hotfix → 段階6-8 Phase 2 → Phase 3)、完全に身体に染み込んだ
- **「丁寧な介在」思想の UI 実装パターン**: バナーで「リクエスト送る?」と確認 = 自動でも完全 self-service でもない第三の道。これは段階6-3-3 のセクション編集者介在モデル、段階6-5 の OGP リッチカード(運営が事前 fetch)、段階6-6 の漸進的移行と並ぶ「丁寧な介在」の系譜
- **YAGNI 原則の徹底**: 判断点 7(GET 不要)、判断点 11(localStorage 不要)等で「必要になった時に追加」を一貫した。スコープ膨張を防止
- **シナリオ 4 の検証パターン**: 既存データの破壊的変更がないことを毎段階確認する習慣。段階6-6 で確立、段階6-7 で継承、段階6-8 でも実施

---

## 次の段階に向けて

### 段階6-9 候補(将来候補、未確定)

- **承認時の自動 INSERT スクリプト or ファンクション**: 現状は Dashboard で手動 INSERT ow_schools + UPDATE ow_user_educations.school_id だが、PostgreSQL FUNCTION や Edge Function でワンコマンド化できる
- **承認時の通知**: ユーザーに「あなたのリクエストが承認されました」と通知(メール / Push)
- **リクエスト一覧 UI**: ユーザー自身が「あなたのリクエスト履歴」を見られる画面
- **大学ロゴ画像許諾取得 + logo_url 埋め**: 段階6-6 で先送りした項目

### 段階7 候補(別カテゴリ、未確定)

- **段階7-F: 編集者(Opinio 運営)向け管理画面**: ow_school_requests の pending 一覧、承認/却下ボタン、その他運営業務 UI。段階6-8 のユーザー側経路と対をなす運営側経路
- **段階7-E: 企業側機能の本格着手**: 段階6 まで主に求職者側を作ってきた、企業 admin の自社情報編集、求人投稿等
- **段階7-G: 求人検索エンジンの設計**

### 段階6 全体の状況(段階6-8 完了時点)

- 完了済み段階: 6-1, 6-2, 6-3-1, 6-3-1.5, 6-3-2, 6-3-3, 6-4, 6-5, 6-6, 6-7, **6-8**
- 段階6 累計: 約 **74 コミット + 18 migration**
- 残存技術的負債:
  - 段階6-4 判断点 2: `ow_uploads_auth_insert` 強化
  - 段階6-4 判断点 3: documents/candidate-documents 用途確認
  - 段階6-3-3 §6 #4: card_color カスタマイズ
  - 段階6-8 以降: 大学ロゴ画像許諾取得、運営承認 UI、リクエスト一覧 UI 等

---

## ファイル一覧

### Migration

- `supabase/migrations/100_create_ow_school_requests.sql`(新規)

### Rollback

- `supabase/rollbacks/100_create_ow_school_requests_rollback.sql`(新規)

### 新規 API Route

- `src/app/api/jobseeker/school-requests/route.ts`(94 行、新規)

### 改修ファイル

- `src/app/(jobseeker)/profile/edit/ProfileEditClient.tsx`(SchoolRequestBanner 追加、EducationEditor 改修)

### handover doc

- `docs/handover-2026-05-12-nu8-stage6-8-complete.md`(本ファイル)

---

## 運営の承認ワークフロー(段階6-8 時点の運用、参考)

ユーザーから ow_school_requests に pending レコードが届いた時、運営(柴さん)は以下を手動で行う:

### Dashboard SQL で pending リクエスト確認

```sql
SELECT id, school_name, school_name_kana, requested_by, created_at
FROM ow_school_requests
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### 承認の場合(例: 「ニッチ大学」を承認)

```sql
-- 1. ow_schools にマスター追加(logo_letter, logo_gradient は運営が選定)
INSERT INTO ow_schools (name, name_kana, logo_letter, logo_gradient, country, type)
VALUES ('ニッチ大学', 'にっちだいがく', 'ニ', 'linear-gradient(135deg, #XXX, #YYY)', 'JP', 'university')
RETURNING id;
-- → 新しい school_id をコピー

-- 2. ow_school_requests を approved に更新
UPDATE ow_school_requests
SET status = 'approved',
    approved_school_id = '<コピーした school_id>',
    approved_at = now(),
    approved_by = '<運営の user_id>'
WHERE id = '<該当 request の id>';

-- 3. ユーザーの該当 ow_user_educations に school_id を自動セット
UPDATE ow_user_educations
SET school_id = '<コピーした school_id>'
WHERE user_id = '<request の requested_by>'
  AND school = 'ニッチ大学'
  AND school_id IS NULL;
```

### 却下の場合

```sql
UPDATE ow_school_requests
SET status = 'rejected',
    approved_at = now(),
    approved_by = '<運営の user_id>'
WHERE id = '<該当 request の id>';
```

将来、段階7-F 等で管理画面が実装されたら、この SQL ワークフローはボタン化される予定。

---

## 開発フロー(段階6-7 から継承、運用継続)

| ステップ | 担当 |
|---------|------|
| 計画・スコープ確定 | 柴 + Claude(チャット) |
| 判断点事前確定(段階開始時 + 各 Phase 前) | 柴 + Claude(チャット) |
| 事前 report | Claude(チャット) |
| 承認 | 柴 |
| 実装 | Claude Code |
| **`npm run build` 必須**(新運用ルール) | Claude Code |
| Migration 適用 | 柴(Supabase Dashboard 手動) |
| Migration 適用後の確認 SQL 結果検証 | Claude(チャット)がスクショで一次フィルタ |
| 動作確認 | 柴(localhost:3000 + スクショ貼付) |
| **Vercel deployments 目視確認**(新運用ルール) | 柴 + Claude(チャット) |
| 判断疲労チェック | Claude(チャット)から推奨 |
| handover doc 下書き | Claude(チャット) |
| handover doc ファイル化 | Claude Code |
| push | 柴「OK push して」指示 → Claude Code が `git push` |

---

## 本セッションの総括

### 完走した段階

- 段階6-7(キャッシュ最適化 + カナ検索 + Vercel ビルドエラー解消 hotfix)
- 段階6-8(schools マスター追加運用フロー、本段階)

### 数字

- 完走段階: 2 件
- 実装コミット: 5 件(段階6-7: 2 + hotfix 1、段階6-8: 3)
- handover doc + 反省点記録: 2 件(段階6-7 + 段階6-8)
- Migration: 1 件(100)
- TypeScript エラー: 常時ゼロ
- ESLint エラー: 常時ゼロ
- `npm run build`: 全段階で成功
- 段階6 累計: 約 74 コミット + 18 migration

### 印象的な瞬間

1. **段階6-7 hotfix で Vercel ビルドエラー長期見逃しを発見した瞬間**: 5/6 以降の全本番デプロイが Error と判明した時の衝撃。これは本日(本セッション)最大の発見で、「TypeScript エラーゼロ ≠ ビルド成功」「`npm run build` 必須」という長期的に価値のある運用ルールを生んだ
2. **段階6-8 で 30 校マスターの「外側」を作る決断**: 柴さんの「設けたいです!」という明確な意思表示が、Opinio の「丁寧な介在」思想を実装する重要な段階を生んだ。マスターという「境界」をどう運用するかは、長期的なプロダクトの品質を決める判断
3. **本番反映の確認瞬間(段階6-7 push 後)**: deployment `8PvLf7XFD` が ● Ready になり、過去 6 日間累積していた段階6-4 / 6-5 / 6-6 / 6-7 の全成果が初めて本番に届いた瞬間。「とうきょう」で東京大学候補が本番でも出るようになった

---

**段階6-8 完了**
**作成者**: Claude(チャット) + 柴久人
**作成日**: 2026-05-12

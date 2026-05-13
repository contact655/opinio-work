# Phase 2 仕様書: セルフサーブ・オンボーディングフロー

**作成日**: 2026-05-13
**作成者**: Claude（戦略・設計伴走役）
**前提**: `docs/research-2026-05-13-phase2-pre.md` の調査結果に基づく
**設計方針**: 2026-05-13 朝のセッションで確定した4つの北極星に準拠

---

## 1. 設計の核心思想

### 1.1 北極星との整合

| 北極星 | 本仕様での反映 |
|---|---|
| ビジネスモデル（掲載無料・成果報酬） | 全機能を無料、運営の審査も無料 |
| ターゲット戦略（広く掲載、絞って収益化） | 個人ドメインも許可、誰でも企業作成可 |
| 登録ポリシー（Opinio承認なし、事後巡回） | 参加申請型を撤回、招待型のみに |
| ロール設計（経歴 ≠ 採用権限） | 完全に分離した3動線 |

### 1.2 設計上の最重要原則

**「経歴登録」と「採用権限取得」は完全に別の動線である。**

ユーザーが「Sansan で働いていた」と経歴に登録することは、Sansan の admin になることを一切意味しない。これは LinkedIn / YOUTRUST と同じ構造。

---

## 2. 3つの動線

### 動線A: 経歴登録（誰でも自由、即反映）

```
ユーザーが自分のプロフィールに経歴を追加
  ↓
企業名サジェスト → 既存企業から選択 or 新規入力
  ↓
ow_experiences に INSERT
  ↓
即座に企業ページの「現役社員 / OB-OG」セクションに表示される
```

**承認なし。摩擦ゼロ。**

### 動線B: 1人目の採用担当（企業を新規作成）

```
ユーザーが「企業を新規作成」
  ↓
企業情報入力（社名のみ必須、他は draft 状態で OK）
  ↓
ow_companies に INSERT（status: draft）
  ↓
作成者を ow_company_admins に自動 INSERT（最初の admin）
  ↓
本人が「公開」ボタンを押すと status: active
```

**承認なし。誰でも企業を作成できる。運営は事後巡回のみ。**

### 動線C: 2人目以降の採用担当（既存adminが招待）

```
既存 admin（田中さん）が /biz/members で「招待」ボタン
  ↓
招待したい人のメールアドレスを入力
  ↓
ow_invitations に INSERT（既存テーブル活用）
  ↓
招待メール送信
  ↓
受信者がリンククリック
  ├─ アカウント持ってる場合: ログイン → 受諾 → ow_company_admins に INSERT
  └─ アカウントない場合: アカウント作成 → 受諾 → ow_company_admins に INSERT
```

**参加申請（Pull型）は実装しない。招待（Push型）のみ。**

---

## 3. ロール設計の確認

### 3.1 第1層: ow_user_roles

| role | 意味 | 付与タイミング |
|---|---|---|
| `candidate` | 一般ユーザー（候補者） | サインアップ時に自動付与 |
| `admin` | Opinio 運営（Hisato） | ADMIN_EMAILS で手動指定 |

**重要**: `company` ロールは存在しない（migration 043 で削除済み）。

### 3.2 第2層: 企業との関係性

| テーブル | 意味 | 例 |
|---|---|---|
| `ow_experiences` | 経歴（プロフィール情報） | 「Sansan で 2018-2020 働いた」 |
| `ow_company_admins` | 採用権限 | 「Sansan の求人を出せる」 |

**両者は完全に独立**。経歴を登録しても採用権限は付与されない。採用権限を持っていても経歴は別途登録が必要。

### 3.3 ow_company_admins の権限段階

調査レポートに基づき、現状の仕様を踏襲：

| role | 権限 |
|---|---|
| `admin` | 求人作成・公開、企業ページ編集、メンバー招待、他メンバーの権限変更 |
| `member` | 候補者閲覧、応募管理（編集権限なし） |

**Phase 2 では admin のみで運用開始**。member 権限の活用は Phase 3 以降で検討。

---

## 4. データモデル

### 4.1 既存テーブル（変更なし）

- `ow_users`: ユーザー基本情報
- `ow_user_roles`: candidate / admin
- `ow_experiences`: 経歴（既存稼働中）
- `ow_companies`: 企業マスタ（status: draft / active）
- `ow_company_admins`: 採用権限
- `ow_invitations`: 招待（既存稼働中、調査レポート確認済み）

### 4.2 不要になるテーブル: ow_company_join_requests

昨日 Phase 1 で作成した `ow_company_join_requests` テーブル（migration 103）は、**本仕様では使用しない**。

**判断**: 当面は休眠（drop しない）。理由：
- データは入っていない（昨日作ったばかり）
- 将来「コミュニティ参加」「フリーランス採用代行プラットフォーム」など別ユースケースで使う可能性
- drop してもメリットが小さい

**メモリに記録すべき事項**: 「ow_company_join_requests テーブルは存在するが Phase 2 では使用しない」

---

## 5. 実装スコープ

### 5.1 新規実装が必要なもの

| # | 項目 | 工数感 |
|---|---|---|
| 1 | 企業新規作成 API（POST /api/biz/companies） | 中 |
| 2 | 企業新規作成 UI（/biz/companies/new または /biz/onboarding） | 中 |
| 3 | 企業名サジェスト API（既存 /api/jobseeker/experiences のサジェストロジックを流用または共通化） | 小 |
| 4 | Header のモード切替トグル UI | 小 |
| 5 | 運営側の admin 監視画面（不正な admin の検出・kick） | 中 |

### 5.2 既存実装の活用

| 機能 | 既存実装 | 活用方法 |
|---|---|---|
| 経歴 API | /api/jobseeker/experiences | そのまま使う |
| 企業詳細の社員表示 | 実装済み | そのまま使う |
| 招待 API | /api/biz/members/invite, /accept | そのまま使う |
| 複数企業切替 | select-company | そのまま使う |
| hasBothRoles 判定 | Header.tsx | UI だけ追加 |
| メンバー管理 | /biz/members | そのまま使う |

---

## 6. 新規API仕様

### 6.1 POST /api/biz/companies

**用途**: 新規企業を作成し、作成者を最初の admin として登録

**認証**: Supabase Auth セッション必須（candidate ロール以上）

**リクエスト**:
```json
{
  "name": "Sansan株式会社",
  "description": null,
  "industry": null,
  "size": null,
  "website": null,
  "logo_url": null
}
```

**必須フィールド**: `name` のみ（他は後から /biz/company で編集可能）

**処理フロー**:
1. リクエストユーザーの認証確認
2. `name` の重複チェック（厳密一致のみ。表記ゆれは運営が後から統合）
   - 既に同名企業が存在する場合: 409 Conflict + 既存企業の情報を返す（フロントエンドで「既存企業に参加しますか？」を表示）
3. `ow_companies` に INSERT（status: 'draft'）
4. `ow_company_admins` に INSERT（role: 'admin', user_id: 作成者）
5. 作成された企業情報を返す

**レスポンス（成功）**:
```json
{
  "company": {
    "id": "uuid",
    "name": "Sansan株式会社",
    "status": "draft",
    "created_at": "2026-05-13T...",
    ...
  },
  "redirect_to": "/biz/company?id=uuid"
}
```

**レスポンス（重複）**:
```json
{
  "error": "company_name_exists",
  "existing_company": {
    "id": "uuid",
    "name": "Sansan株式会社",
    "admin_count": 1
  },
  "message": "同名の企業が既に存在します"
}
```

**重複時のフロントエンド挙動**:
- 「既存の Sansan株式会社 が存在します。採用担当として参加したい場合は、その企業の admin に招待を依頼してください」
- 「別企業として新規作成する」ボタンも用意（例：表記ゆれや別法人の場合）。新規作成する場合は `force_create: true` をリクエストに追加

---

### 6.2 GET /api/companies/search

**用途**: 企業名サジェスト（経歴登録時 / 企業作成時の重複チェック時）

**認証**: 不要（公開エンドポイント）

**クエリパラメータ**:
- `q`: 検索文字列（2文字以上）
- `limit`: 最大件数（デフォルト 10）

**処理**:
- `ow_companies` テーブルから `name ILIKE '%q%'` で検索
- status: active のみ返す（draft は除外）
- 部分一致、前方一致を優先

**レスポンス**:
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Sansan株式会社",
      "logo_url": "/logos/sansan.png",
      "industry": "SaaS",
      "admin_count": 1,
      "employee_count": 12
    }
  ]
}
```

**注意**: 既存の経歴 API（/api/jobseeker/experiences）に類似機能があれば共通化を検討。

---

### 6.3 Header モード切替 UI（既存 Header.tsx の改修）

**前提**: `hasBothRoles` 判定ロジックは既存（調査レポート確認済み）

**追加する UI**:
- ヘッダー右上のアバター横に、現在のモード表示
- クリックでドロップダウン展開
- ドロップダウン内容:
  ```
  [✓] 個人モード（候補者として）
      ─────────────
      採用担当として:
        Sansan株式会社
        株式会社リクルート
      ─────────────
      [運営モード]（admin の場合のみ表示）
      [ログアウト]
  ```

**遷移**:
- 個人モード選択 → `/dashboard`
- 採用担当（企業A）選択 → `/biz/dashboard?company_id=A`（既存の select-company を流用）
- 運営モード選択 → `/admin/dashboard`

**セッション管理**:
- `active_role` を sessionStorage に保持（タブごと独立）
- ページリロード時も保持
- ログアウトで消える

---

### 6.4 運営側 admin 監視画面（/admin/companies/[id]/admins）

**用途**: 不正な admin の検出・kick

**前提**: 既存の /admin/companies/[id] に「採用担当者」タブが既存

**追加する機能**:
- 各 admin に「強制 kick」ボタン
- kick 理由を入力（ログとして残す）
- DELETE /api/admin/companies/[id]/admins/[user_id]

**監視ログ**:
- 新規 admin が追加されたら、運営 admin（Hisato）にメール通知
- 異常検知ロジック（短期間に多数の admin が追加された等）は Phase 3 で検討

---

## 7. UI/UX 仕様

### 7.1 動線A（経歴登録）

**変更なし**。既存の経歴入力 UI をそのまま使う。

### 7.2 動線B（企業新規作成）

**新規ページ**: `/biz/onboarding` または `/biz/companies/new`

**画面構成**:
```
┌─────────────────────────────────┐
│ 企業を新規登録                    │
├─────────────────────────────────┤
│ 会社名 *                         │
│ [Sansan株式会社_______________]   │
│                                  │
│ ※サジェスト表示                  │
│ [既に Sansan株式会社 が存在します] │
│ [参加するには既存adminに招待依頼]  │
│                                  │
│ または                            │
│ [別企業として新規作成する]         │
│                                  │
│ ─────────────────────           │
│ [新規企業として登録]              │
└─────────────────────────────────┘
```

**作成後**:
- /biz/company にリダイレクト
- status: draft なので公開ページには出ない
- 編集完了したら「公開」ボタンで status: active

### 7.3 動線C（招待）

**変更なし**。既存の /biz/members の招待フローをそのまま使う。

ただし、招待メールのテンプレート文言は確認が必要：
- 「Opinio Work に招待されました」
- 「Sansan株式会社の採用担当として活動できるようになります」

---

## 8. セキュリティ・運用ルール

### 8.1 悪用リスクと対策

| リスク | 対策 |
|---|---|
| 競合他社が勝手に企業を作って admin になる | 同名企業の重複検出 + 運営による事後 kick |
| スパム企業の大量作成 | 1ユーザーあたりの企業作成上限（Phase 3 で実装、当面は監視のみ） |
| 招待リンクの不正使用 | 既存 invite API のトークン検証ロジックを継続利用 |
| 退職者が admin のまま | 残存 admin による kick（既存 /biz/members で対応済み） |

### 8.2 運営の事後巡回オペレーション

- 週1回、新規企業一覧をチェック（/admin/companies）
- 不審な企業 / admin を非公開化 or kick
- 新規 admin 追加のメール通知でリアルタイム検知も併用

---

## 9. マイグレーション

### 9.1 必要な DB 変更

**なし**（既存テーブルで完結）。

### 9.2 ow_company_join_requests テーブルの扱い

- drop しない、休眠状態のまま保持
- メモリに「Phase 2 では使用しない」と記録
- 将来の別ユースケースで活用の可能性を残す

---

## 10. 実装の順序

### Sprint 1: バックエンド（API）
1. POST /api/biz/companies の実装
2. GET /api/companies/search の実装（または既存ロジックの流用判断）
3. DELETE /api/admin/companies/[id]/admins/[user_id] の実装

### Sprint 2: フロントエンド（UI）
4. /biz/onboarding ページの実装
5. Header のモード切替ドロップダウン
6. /admin/companies/[id]/admins タブの kick ボタン追加

### Sprint 3: 通知・運用
7. 新規 admin 追加時のメール通知
8. 招待メール文言の最終確認・調整

### Sprint 4: 動作確認・本番リリース
9. E2E テスト（biz002 アカウントで全動線確認）
10. 本番デプロイ
11. Vercel deployments の Ready 確認

---

## 11. テストシナリオ

### シナリオ1: 田中さんが Sansan を新規作成
1. 田中さんがサインアップ
2. /biz/onboarding で「Sansan株式会社」と入力
3. 重複なし → 新規作成
4. 田中さんが Sansan の admin になる
5. /biz/company で企業情報を編集
6. 「公開」ボタン → status: active
7. /companies/sansan で公開ページが表示される

### シナリオ2: 佐藤さんが Sansan に経歴登録
1. 佐藤さんがサインアップ
2. プロフィール画面で経歴追加
3. 「Sansan株式会社」をサジェストから選択（田中さんが作った企業）
4. 期間入力（2020-2023）
5. 保存
6. /companies/sansan ページの「OB-OG」セクションに佐藤さんが表示される
7. **佐藤さんは Sansan の admin にはなっていない**（重要）

### シナリオ3: 田中さんが鈴木さんを招待
1. 田中さんが /biz/members で「招待」ボタン
2. 鈴木さんのメールアドレスを入力
3. 鈴木さんにメール届く
4. 鈴木さんがリンククリック → アカウント作成 or ログイン
5. 受諾ボタン
6. 鈴木さんが Sansan の admin になる
7. 鈴木さんも求人を出せるようになる

### シナリオ4: モード切替
1. 田中さん（Sansan admin、自分の経歴に Sansan を登録済み）がログイン
2. デフォルトは個人モード（/dashboard）
3. ヘッダーで「Sansan（採用担当）」を選択
4. /biz/dashboard?company_id=sansan に遷移
5. もう一度切替で個人モードに戻れる

---

## 12. 残課題（Phase 3 以降）

- member 権限の活用（編集権限なしのサブメンバー）
- 企業作成上限（スパム対策）
- 異常検知（短期間に大量の admin 追加等）
- 招待リンクの有効期限管理（既存にあるか要確認）
- 通知システム（メールだけでなくアプリ内通知も）
- 表記ゆれ統合の運用ツール（管理画面で「2つの企業を統合」ボタン）

---

## 13. 朝のセッションでの設計判断ログ

時系列で記録（将来の振り返り用）:

1. **10:00頃** 当初の Phase 2 想定: 「参加申請（Pull型）」前提で5本のAPI実装
2. **議論経過**: Hisato さんから「Wantedly のように、Opinio で審査しない」方針提示
3. **整理**: 参加申請を Opinio 審査なしにすると → 企業 admin が承認することに → でもそれも歩留まり下がる
4. **核心の気付き（Hisato 主導）**: 「経歴登録は admin 権限とは別」「LinkedIn / YOUTRUST と同じ」
5. **重要な気付き（Hisato 主導）**: 「参加申請、承認待ちって不要では？」
6. **最終解（Hisato 主導）**: 「採用担当の追加は招待型のみ。アカウント持っている前提でメール招待」
7. **結論**: 参加申請型を完全撤回、招待型 + 経歴自由登録の3動線設計に到達

この設計判断のシンプル化は、本セッションの最大の成果。

---

**仕様書ここまで**

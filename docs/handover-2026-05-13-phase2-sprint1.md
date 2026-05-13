# Handover: Phase 2 Sprint 1 — バックエンド API

実装日: 2026-05-13  
担当: Claude Code（柴ディレクション）  
関連spec: docs/spec-2026-05-13-phase2-self-serve-onboarding.md  
commit: c0f2d0e

---

## 1. 実装サマリ

Phase 2（セルフサーブ・オンボーディングフロー）Sprint 1 として、3本の API Route を実装した。  
**DB マイグレーションなし**（既存テーブルで完結）。  
**UI 変更なし**（Sprint 2 で実装予定）。

---

## 2. 実装ファイル一覧

### 新規作成（3ファイル）

| ファイル | HTTP | 役割 |
|---|---|---|
| `src/app/api/biz/companies/route.ts` | POST | 企業新規作成 + 作成者を最初の admin に登録 |
| `src/app/api/companies/search/route.ts` | GET | 企業名サジェスト（公開エンドポイント） |
| `src/app/api/admin/companies/[id]/admins/[user_id]/route.ts` | DELETE | 運営による admin 強制 kick |

### 変更なし

既存ファイルへの変更はゼロ。

---

## 3. API 仕様詳細

### 3.1 POST /api/biz/companies

**認証**: Supabase Auth セッション必須

**リクエスト**:
```json
{
  "name": "Sansan株式会社",
  "description": null,
  "industry": null,
  "size": null,
  "website": null,
  "logo_url": null,
  "force_create": false
}
```

**フロー**:
1. `createClient()` で認証チェック
2. `name` 空チェック → 400
3. `force_create` が false のとき、`name` 完全一致で重複チェック
   - 重複あり → 409 + `{ error: "company_name_exists", existing_company: { id, name, admin_count } }`
4. `createAdminClient()` で `ow_companies` INSERT（status: 'draft', plan: 'free'）
5. auth_id → ow_users.id 変換 → `ow_company_admins` INSERT（permission: 'admin'）
6. Cookie `biz_current_company_id` をセット（30日）
7. 201 + `{ company, redirect_to: "/biz/company?id=uuid" }`

**重複時の推奨フロントエンド挙動**（Sprint 2 で実装）:
- 「既に {name} が存在します。参加したい場合は既存 admin に招待を依頼してください」
- 「別企業として新規作成する」ボタン → `force_create: true` で再リクエスト

---

### 3.2 GET /api/companies/search

**認証**: 不要（公開エンドポイント）

**クエリパラメータ**:
- `q`: 検索文字列
- `limit`: 最大件数（デフォルト 10、上限 50）

**フロー**:
1. `q` が空 → `{ results: [] }` を即返し
2. `createAdminClient()` で `ow_companies` を `name ILIKE '%q%'` 検索（status='active' のみ）
3. ヒット企業の admin_count を `ow_company_admins` から一括取得
4. 結果をマージして返す

**レスポンス**:
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "Sansan株式会社",
      "logo_url": null,
      "industry": "SaaS",
      "admin_count": 1,
      "employee_count": 12
    }
  ]
}
```

---

### 3.3 DELETE /api/admin/companies/[id]/admins/[user_id]

**認証**: `isAdmin()` による運営チェック（Opinio 運営のみ）

**パスパラメータ**:
- `id`: ow_companies.id
- `user_id`: ow_users.id（ow_company_admins.user_id）

**フロー**:
1. `isAdmin()` → false なら 403
2. `ow_company_admins` で対象レコード存在確認 → なければ 404
3. DELETE 実行
4. 200 + `{ success: true, kicked: { company_id, user_id, permission } }`

---

## 4. 動作確認結果

| 確認 | 結果 |
|---|---|
| `npm run build` | ✅ `✓ Compiled successfully` |
| TypeScript エラー | ✅ ゼロ |
| ESLint エラー | ✅ ゼロ |

実際のリクエスト動作確認は Sprint 2（UI 実装後）に E2E テストで実施予定。

---

## 5. 設計上の注意事項

### admin_count の取得方式

`ow_company_admins` テーブルには `user_id IS NULL`（pending 招待）のレコードも存在する。  
admin_count では `NOT (user_id IS NULL)` フィルターを適用し、実際に紐づいているユーザーのみカウントしている。

### status: 'draft' について

`POST /api/biz/companies` で作成した企業は `status: 'draft'` のため：
- `/api/companies/search` の検索結果には出ない（status='active' のみ返す）
- `/companies` 公開一覧にも出ない（既存フィルター依存）
- 企業作成者が `/biz/company` で編集完了後、「公開」ボタンで `status: 'active'` にする（既存 PATCH /api/biz/company を利用）

### ow_company_join_requests テーブルについて

Phase 1 で作成した `ow_company_join_requests`（migration 103）は **Phase 2 では使用しない**。  
drop せず休眠状態のまま保持（将来の別ユースケース用）。

---

## 6. Sprint 2 への引き継ぎ事項

### Sprint 2 で実装すべきもの（UI層）

| 項目 | ファイル（予定） | 概要 |
|---|---|---|
| 企業新規作成ページ | `src/app/biz/onboarding/page.tsx` | 社名入力 → サジェスト → 重複確認 → 作成 |
| Header モード切替 | `src/components/Header.tsx` | hasBothRoles → ドロップダウン UI |
| admin kick ボタン | `src/app/admin/companies/[id]/CompanyDetailClient.tsx` | 「採用担当者」タブに追加 |

### 企業新規作成ページの設計ポイント

- URL: `/biz/onboarding` または `/biz/companies/new`
- フォーム: 社名のみ必須（他オプション）
- サジェスト: `GET /api/companies/search?q=` でリアルタイム検索
- 重複検知: `POST /api/biz/companies` → 409 を受け取ったら確認ダイアログ
- 作成成功: `redirect_to` の URL へリダイレクト（`/biz/company?id=uuid`）
- 作成後: `/biz/company` で企業情報を編集し、「公開」ボタンで status: active に

### Header モード切替の設計ポイント

- `hasBothRoles` 判定ロジックは既存（調査レポート確認済み）
- `sessionStorage` で `active_role` を保持
- 個人モード → `/dashboard`
- 採用担当（企業A） → `/biz/dashboard?company_id=A`（既存 select-company を流用）
- 運営モード → `/admin/dashboard`（admin のみ表示）

---

**フェーズ: Phase 2 Sprint 1 完了**  
作成者: Claude Code + 柴久人  
作成日: 2026-05-13

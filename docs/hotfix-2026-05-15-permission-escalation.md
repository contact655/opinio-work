# Hotfix レポート: B-1 権限エスカレーション脆弱性

**対応日**: 2026-05-15  
**commit**: `705a801`  
**影響ファイル**: `src/app/api/biz/members/[id]/route.ts` のみ  
**push**: origin/main へ反映済み

---

## 1. 脆弱性の概要

### 問題

`PATCH /api/biz/members/:id` の `permission` / `deactivate` / `reactivate` action に管理者チェックが存在しなかった。

`update_profile` action のみ冒頭でインライン admin チェックを持っていたが、残り3 action はメンバーシップ確認（同一企業か）と自己操作防止（isSelf）のみで、**呼び出し元が admin かどうかを確認していなかった**。

### 悪用可能な操作

| action | 悪用シナリオ |
|--------|------------|
| `permission` | member が `{ action: "permission", value: "admin" }` を**自分自身の id** に送ると admin に昇格できる |
| `permission` | member が他のメンバーを admin に昇格できる（攻撃に意味はないが仕様違反） |
| `deactivate` | member が admin を無効化して企業アカウントを事実上乗っ取れる（最後の1人は "LAST_ADMIN" ガードで弾かれるが、admin が2人以上いる場合は悪用可能） |
| `reactivate` | member が deactivate 済みのメンバーを復活させられる |

---

## 2. 修正内容

### 差分

```diff
+ import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";

  const { owUserId: actorOwUserId, companyId, allMemberships } = ctx;

+ // 全アクション共通: admin 権限チェック（B-1 hotfix）
+ try { requireAdmin(allMemberships, companyId); } catch { return permissionDeniedResponse(); }

  // 対象の ow_company_admins row を取得
```

```diff
  else if (body.action === "update_profile") {
-   // actor が admin であることを確認（自分自身の編集も可）
-   const actorMembership = allMemberships.find((m) => m.companyId === companyId);
-   if (actorMembership?.permission !== "admin") {
-     return NextResponse.json({ error: "役職・部署の変更は管理者のみ可能です" }, { status: 403 });
-   }
-
+   // admin チェックは PATCH 冒頭で一元実施済み
    // 空文字は null に正規化、最大 100 文字
```

### 修正の方針

- PATCH ハンドラー冒頭（`getCompanyContext` 取得直後）で **全 action に対して** `requireAdmin()` を一括実行
- 各 action 分岐内の個別チェックは `update_profile` のみ存在していたので削除（冒頭で代替済み）
- 既存の業務ガード（自己降格防止 / 最後の admin 保護）はそのまま残す

### 修正後のガード順序（PATCH）

```
1. 認証チェック (401)
2. JSON parse (400)
3. getCompanyContext — メンバーシップ確認 (403)
4. requireAdmin() — admin のみ通過 ★ 追加 ★ (403)
5. 対象レコード取得 (404)
6. 同一企業チェック (403)
7. action 別業務ガード（自己降格防止 / 最後の admin 保護）
8. DB UPDATE
```

---

## 3. ビルド確認

```
✅ npm run build — エラーなし（Warnings は既存の img タグ警告のみ）
```

---

## 4. curl 検証

**注**: 実環境の member セッション cookie が手元にないため、コード解析による予測挙動を記載。  
Hisato さんによる手動検証（シナリオ 9-10）で実ブラウザ確認を推奨。

### 修正後の期待挙動

| リクエスト | 修正前 | 修正後 |
|-----------|-------|-------|
| member が `{ action: "permission", value: "admin" }` を自分 id へ | **200 OK** (脆弱) | **403 `permission_denied`** |
| member が `{ action: "deactivate" }` を admin id へ | **200 OK** (脆弱) | **403 `permission_denied`** |
| member が `{ action: "reactivate" }` を any id へ | **200 OK** (脆弱) | **403 `permission_denied`** |
| member が `{ action: "update_profile" }` を any id へ | 403（既存インライン） | **403 `permission_denied`**（冒頭で同等に弾く） |
| admin が `{ action: "permission", value: "member" }` を送る | 200 OK | **200 OK**（既存挙動維持） |
| admin が `{ action: "deactivate" }` を送る | 200 OK | **200 OK**（既存挙動維持） |
| admin が最後の admin を降格しようとする | 400 `LAST_ADMIN` | **400 `LAST_ADMIN`**（既存ガード維持） |
| admin が自分を降格しようとする | 403 `SELF_DEMOTION` | **403 `SELF_DEMOTION`**（既存ガード維持） |

---

## 5. W-1 調査: jobs POST 複製モード（admin チェックなし）

### 該当コード

`src/app/api/biz/jobs/route.ts` line 48-98

```typescript
// ── 複製モード ──────────────────────────────────────────
// sourceId がある場合: RLS が自社求人のみアクセスを保証するため
// getCompanyContext は不要（SELECT 自体が RLS で保護）
if (body.sourceId) {
  const sourceId = body.sourceId as string;
  const { data: source } = await supabase
    .from("ow_jobs")
    .select("company_id, title, ...")
    .eq("id", sourceId)
    .single();
  
  // ... admin チェックなしで INSERT
  const { data: newJob } = await supabase
    .from("ow_jobs")
    .insert({ ...source, title: `${source.title} のコピー`, status: "draft", ... })
    ...
}
```

### 現状挙動

- `sourceId` がある場合、`getCompanyContext()` を呼ばない（コメントに「RLS が保護」と明記）
- **admin チェックなし** — member ユーザーが `POST /api/biz/jobs { sourceId: "xxx" }` を送ると求人を複製できる
- 新規作成モード（`sourceId` なし）は `requireAdmin` でガード済みのため、複製のみが穴になっている

### 影響の評価

| 観点 | 評価 |
|------|------|
| 他社求人の複製 | 不可（RLS で自社求人のみ SELECT 可能） |
| 自社求人の複製（member が実行） | **可能**（admin チェックなし） |
| 複製した求人の公開 | 不可（公開は `PATCH /api/biz/jobs/[id]` が admin 限定） |
| 複製した求人の編集 | 不可（`PUT /api/biz/jobs/[id]` が admin 限定） |
| 実害の深刻度 | **低**（複製は draft 状態で作成される。閲覧・公開・編集は admin 限定のため、member が複製しても触れない孤立 draft が増えるだけ） |

### 修正方針候補

**案 A（推奨）: admin のみに制限**
- 新規作成と対称にする。「求人の作成」行為は admin 権限と定義
- 複製モードでも `getCompanyContext()` + `requireAdmin()` を実行
- 変更規模: 5行程度

**案 B: member も複製可とする**
- 複製 draft は触れないため実質的な影響がないことを踏まえ、現状維持
- member に「仕様上は複製できるが編集・公開できない」という非直感的な挙動が残る

**推奨**: 案 A。UI で「新規求人を作成」ボタンを admin にしか見せていない一貫性から、API 側も admin 限定にするのが自然。ただし深刻度は低いため hotfix ではなく次の通常 commit で対応可。

---

## 6. まとめ

| 項目 | 状態 |
|------|------|
| B-1 権限エスカレーション修正 | ✅ commit `705a801` でリリース済み |
| ビルド確認 | ✅ エラーなし |
| push | ✅ origin/main に反映済み |
| W-1（jobs 複製 admin チェックなし） | ⚠️ 実害低・修正方針は案 A 推奨・次 commit で対応 |
| W-2（permission が DB text 型） | 別タスク（migration 追加が必要） |

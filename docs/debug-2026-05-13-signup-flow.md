# Debug: /biz/auth 新規登録フロー 二重会社作成バグ

調査日: 2026-05-13  
分類: **Case A — UXバグ（APIは正常動作）**  
commit: （下記参照）

---

## 1. 症状

1. ビジネスLP `/business` の「企業を新規登録（無料）」CTAをクリック
2. ミドルウェアが `/biz/auth?next=/biz/companies/add/new/` にリダイレクト
3. 新規登録フォームで会社情報を入力・送信
4. **意図せず `/biz/companies/add/new/` に遷移 → 2枚目の会社登録フォームを提示**
5. ユーザーが再び会社情報を入力・送信
6. ダッシュボードで「企業アカウントを追加しますか？」エラー or 重複会社が作成される

---

## 2. DB 調査結果（hshiba+01@third-box.jp）

### auth.users + ow_users

| テーブル | auth_id | ow_user_id | created_at |
|---------|---------|-----------|-----------|
| auth.users | e6196319-718d-41cf-a671-a023c8a3308c | — | 2026-05-13 11:30:27 |
| ow_users | — | 60a6544e-8a42-4787-ad39-1705ea4e3aa5 | 2026-05-13 11:30:27 ← トリガー正常動作 |

### ow_companies（2件重複作成）

| company_id | name | created_at | 作成元 |
|-----------|------|-----------|-------|
| cf44d740-... | **株式会社Opinio** | 11:30:29 | `/api/company/register`（signup時） |
| 100e46fe-... | **株式会社Third Box** | 11:32:03 | `/api/biz/companies`（二重フォーム） |

### ow_company_admins（2件重複）

| user_id | company_id | created_at | is_active |
|---------|-----------|-----------|---------|
| 60a6544e | cf44d740 (Opinio) | 11:30:31 | true |
| 60a6544e | 100e46fe (Third Box) | 11:32:04 | true |

> **結論**: ow_users トリガーは正常動作（タイミング問題なし）。
> APIも正常動作（ow_company_admins も正常挿入）。
> 問題は純粋に UX フロー設計にある。

---

## 3. 根本原因

### フロー図（バグ前）

```
LP CTA → /biz/companies/add/new/
  ↓ (ミドルウェア: 未認証)
/biz/auth?next=/biz/companies/add/new/
  ↓ (signup + /api/company/register → 会社A作成 ✅)
router.push(next)  ← ← ← ここがバグ
  ↓
/biz/companies/add/new/  ← 不要なページ（再び会社フォーム）
  ↓ (ユーザーが再入力 + /api/biz/companies → 会社B作成 ❌)
/biz/dashboard  ← 2社重複
```

### バグの正体

`/api/company/register` は signup 時にインライン会社作成を行い、
`{ success: true, redirectTo: "/biz/dashboard" }` を返す。

しかし signup の `handleSubmit`（`src/app/biz/auth/page.tsx`）は
この `redirectTo` を無視し、URL パラメータの `next` をそのまま使用していた:

```typescript
// ❌ バグ（修正前）
router.push(next);  // next = "/biz/companies/add/new/" → 二重フォームへ

// ✅ 修正後
router.push("/biz/dashboard");  // 常にダッシュボードへ直行
```

---

## 4. 修正内容

### 修正 1: `src/app/biz/auth/page.tsx`（signup handleSubmit）

```diff
- router.push(next);
+ // 新規登録時は会社が inline で作成済みのため、next（/biz/companies/add/new など）を
+ // 無視してダッシュボードへ直行する。二重会社作成バグを防ぐ。
+ router.push("/biz/dashboard");
```

**影響範囲**: signup のみ（login の `router.replace(next)` は変更なし）

### 修正 2: `src/components/business/BusinessHero.tsx`（CTA リンク）

```diff
- href="/biz/companies/add/new/"
+ href="/biz/auth"
```

**効果**: LP CTA が直接 `/biz/auth` に遷移するため、ミドルウェアが
`next=/biz/companies/add/new/` をセットしなくなる（修正1との二重防御）。

---

## 5. ログイン フロー（修正なし・意図的）

ログインの場合は `router.replace(next)` のまま変更しない。

理由: 既存ログイン済みユーザーが `/biz/companies/add/new/` から
2社目を追加する正当なユースケースがあるため、`next` の追従が正しい動作。

---

## 6. フロー図（修正後）

```
LP CTA → /biz/auth （next なし）
  ↓ (signup + /api/company/register → 会社作成 ✅)
router.push("/biz/dashboard")  ← 固定
  ↓
/biz/dashboard  ← 正常！
```

---

## 7. 残存データ（要手動クリーンアップ）

hshiba+01@third-box.jp には不要な 2社が残存:
- `cf44d740` — 株式会社Opinio（signup 時に誤入力された会社名）
- `100e46fe` — 株式会社Third Box（本来の会社）

ow_company_admins も両方 `is_active=true` のまま。
ダッシュボード動作には支障ないが（cookie で Third Box を参照）、
将来的に `cf44d740` の `is_active=false` 化 または削除を推奨。

```sql
-- 不要な Opinio 社を非活性化（参考）
UPDATE ow_company_admins SET is_active = false
WHERE user_id = '60a6544e-8a42-4787-ad39-1705ea4e3aa5'
  AND company_id = 'cf44d740-b835-454d-91a3-f1e2eddc7251';
```

---

**作成者**: Claude Code  
**作成日**: 2026-05-13

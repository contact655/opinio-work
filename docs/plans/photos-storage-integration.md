# Photos Supabase Storage 接続 — 実装計画書

**作成日**: 2026-04-27 (深夜)
**ステータス**: 事前調査完了 / 実装待ち
**想定セッション数**: 3 セッション連続実行で 1.5〜2 時間
**対象**: /biz/company の最後の残課題（オフィス写真 + ロゴ画像の本番接続）

---

## 🎯 ゴール

`/biz/company` の以下を本番接続:

1. **オフィス写真 4 カテゴリ × 各最大 5 枚** の Supabase Storage アップロード + DB 保存
2. **企業ロゴ画像** のアップロード（同じパターンで対応）
3. **Phase 4 を真の 100% 完了**にする

---

## 📦 スコープ

### ✅ このセッションで実装する

1. **migration 038**: category 制約修正 (`work` → `workspace`) + WITH CHECK 追加
2. **`ow_company_office_photos` の CRUD API Route** 新規作成
3. **OfficePhotoSection の差し替え**: Unsplash URL → 実ファイルアップロード
4. **handlePhotosChange の永続化**: setState のみ → API 経由で DB + Storage
5. **企業ロゴアップロード接続**: alert → ImageUpload コンポーネント

### ❌ このセッションでやらない

- 画像最適化（WebP 変換、リサイズ等）
- 画像のトリミング UI
- `src/components/ImageUpload.tsx` と `src/components/ui/ImageUpload.tsx` の 2 本統合（別途）
- Storage バケットの permission 厳密化（public のまま）

---

## 🏗️ 実装戦略

### 既存資産の最大活用

| 既存資産 | 流用方法 |
|---|---|
| `ow-uploads` バケット | パス `companies/office-photos/{companyId}/{timestamp}.{ext}` で再利用 |
| `src/components/ImageUpload.tsx` | OfficePhotoSection の「写真を追加」ボタンに組み込み |
| `OfficePhotoSection.tsx` の UI 骨格 | 並び替え・削除・caption 編集はそのまま |
| `getCompanyId` helper（route.ts 内） | 同じパターンで認証 + tenantId 取得 |
| migration 035/036/037 で整った RLS | そのまま機能、新規修正は最小 |

### 事前調査で判明した重要事実

1. **`ow-uploads` バケット既存稼働中** → 新規バケット作成不要
2. **category 不一致**: フロント `workspace` vs DB `work` → migration で `workspace` に統一
3. **`admin_manage` policy に WITH CHECK が無い** → migration で追加
4. **ロゴアップロードも alert のまま** → 同セッションで対応
5. **migration 037 で間接 RLS は既に解消済み** → 新たな RLS 修正は最小限

---

## 📐 詳細設計

### 1. Migration 038

**ファイル名**: `supabase/migrations/038_fix_office_photos_category_and_check.sql`

```sql
-- ============================================================================
-- 038: Fix ow_company_office_photos category + WITH CHECK
-- ============================================================================
-- Problem 1: category CHECK uses 'work' but frontend uses 'workspace'.
--            Frontend's PhotoCategory type drives UI labels and gradients,
--            so updating the DB constraint is cleaner than client-side mapping.
-- Problem 2: admin_manage policy lacks WITH CHECK, leaving INSERT/UPDATE
--            theoretically open to inserting rows for other company_ids.
-- ============================================================================

-- Part 1: Rename existing 'work' rows (if any) to 'workspace'
UPDATE public.ow_company_office_photos
SET category = 'workspace'
WHERE category = 'work';

-- Part 2: Replace category CHECK constraint
ALTER TABLE public.ow_company_office_photos
  DROP CONSTRAINT IF EXISTS ow_company_office_photos_category_check;

ALTER TABLE public.ow_company_office_photos
  ADD CONSTRAINT ow_company_office_photos_category_check
  CHECK (category IN ('workspace', 'meeting', 'welfare', 'event'));

-- Part 3: Add WITH CHECK to admin_manage policy
DROP POLICY IF EXISTS "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos;

CREATE POLICY "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos
  FOR ALL
  USING (auth_is_company_admin(company_id))
  WITH CHECK (auth_is_company_admin(company_id));

-- Note: ow_company_office_photos_public_read (FOR SELECT USING true) is unchanged
```

**ロールバック**: `supabase/rollbacks/038_rollback.sql`

```sql
-- 038 ロールバック
UPDATE public.ow_company_office_photos
SET category = 'work'
WHERE category = 'workspace';

ALTER TABLE public.ow_company_office_photos
  DROP CONSTRAINT IF EXISTS ow_company_office_photos_category_check;

ALTER TABLE public.ow_company_office_photos
  ADD CONSTRAINT ow_company_office_photos_category_check
  CHECK (category IN ('work', 'meeting', 'welfare', 'event'));

DROP POLICY IF EXISTS "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos;

CREATE POLICY "ow_company_office_photos_admin_manage"
  ON public.ow_company_office_photos
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM ow_company_admins
      WHERE user_id IN (SELECT id FROM ow_users WHERE auth_id = auth.uid())
        AND is_active = true
    )
  );
```

### 2. データ層: `src/lib/business/photos.ts`（新規、約 120 行）

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type PhotoCategory = "workspace" | "meeting" | "welfare" | "event";

export type DbOfficePhoto = {
  id: string;
  company_id: string;
  category: PhotoCategory;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
};

export type OfficePhoto = {
  id: string;
  url: string;
  caption: string;
  category: PhotoCategory;
};

export const MAX_PHOTOS_PER_CATEGORY = 5;

export function dbPhotoToForm(db: DbOfficePhoto): OfficePhoto {
  return {
    id: db.id,
    url: db.image_url,
    caption: db.caption ?? "",
    category: db.category,
  };
}

export async function fetchOfficePhotosForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<OfficePhoto[]> {
  const { data, error } = await supabase
    .from("ow_company_office_photos")
    .select("*")
    .eq("company_id", companyId)
    .order("category")
    .order("display_order");

  if (error) {
    console.error("[fetchOfficePhotosForCompany]", error);
    return [];
  }
  return (data ?? []).map(dbPhotoToForm);
}

export function buildStoragePath(
  companyId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return `companies/office-photos/${companyId}/${Date.now()}.${ext}`;
}

export function buildLogoStoragePath(
  companyId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  return `companies/logos/${companyId}/${Date.now()}.${ext}`;
}
```

### 3. API Route: `src/app/api/biz/company/photos/route.ts`（新規、約 180 行）

```typescript
// 想定エンドポイント:
// POST    /api/biz/company/photos          → 新規写真追加
// PATCH   /api/biz/company/photos/[id]     → caption 更新 / display_order 更新
// DELETE  /api/biz/company/photos/[id]     → 削除（DB + Storage）

// POST request body:
//   { category, image_url, caption?, display_order? }
//
// 処理フロー:
// 1. supabase.auth.getUser() で認証
// 2. getCompanyId(supabase, user.id) で company_id 取得
// 3. 同 category の既存件数チェック (>= 5 で 400)
// 4. ow_company_office_photos に INSERT
// 5. 200 でレスポンス（INSERT した行を返す）
//
// エラー時: 401 / 400 / 404 / 500 を適切に返す

// PATCH/DELETE は別ファイル [id]/route.ts として作成
// DELETE 時は DB delete → Storage remove の順
//   ※ Storage の orphan は容認（手動清掃可、コスト微小）
```

**重要なポイント**:
- 認証 + companyId 取得は `src/app/api/biz/company/route.ts` の `getCompanyId` をエクスポートして再利用、または `src/lib/business/company.ts` に切り出す
- Storage 操作は **クライアント側**（OfficePhotoSection）から直接 `supabase.storage.from("ow-uploads").upload()` を呼ぶ。API Route は DB 操作のみ
- DELETE 時のみ、API Route 側で DB delete → Storage remove を直列実行

### 4. UI 層

#### 4-a. `OfficePhotoSection.tsx` 改修

**現状**: 「写真を追加」ボタン → `getUnsplashUrl(category)` で URL 生成 → onAdd 通知

**変更後**:

```tsx
// 追加: hidden file input + handleFileSelected
const fileInputRef = useRef<HTMLInputElement>(null);
const [isUploading, setIsUploading] = useState(false);

async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  // バリデーション
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    alert("JPEG / PNG / WebP のみ対応しています");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert("ファイルサイズは 5MB 以下にしてください");
    return;
  }

  setIsUploading(true);
  try {
    // 1. Supabase Storage にアップロード
    const path = buildStoragePath(companyId, file.name);
    const { error: uploadError } = await supabase.storage
      .from("ow-uploads")
      .upload(path, file);
    if (uploadError) throw uploadError;

    // 2. publicUrl 取得
    const { data: { publicUrl } } = supabase.storage
      .from("ow-uploads")
      .getPublicUrl(path);

    // 3. API Route に POST して DB 保存
    const res = await fetch("/api/biz/company/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        image_url: publicUrl,
        caption: "",
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { data: newPhoto } = await res.json();

    // 4. 親コンポーネントに通知
    onAdd(dbPhotoToForm(newPhoto));
  } catch (error) {
    console.error("[OfficePhotoSection upload]", error);
    alert("アップロードに失敗しました");
  } finally {
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
}

// JSX:
// <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
//   onChange={handleFileSelected} />
// <button onClick={() => fileInputRef.current?.click()}
//   disabled={isUploading || photos.length >= MAX_PHOTOS_PER_CATEGORY}>
//   {isUploading ? "アップロード中..." : "写真を追加"}
// </button>
```

#### 4-b. `CompanyEditClient.tsx` 修正

```tsx
type Props = {
  initialCompany: BizCompany;
  initialPhotos: OfficePhoto[];   // 追加
  companyId: string;              // 追加（API 呼び出し用）
};

export function CompanyEditClient({
  initialCompany,
  initialPhotos,
  companyId,
}: Props) {
  const [photos, setPhotos] = useState(initialPhotos);

  // 追加処理（OfficePhotoSection から呼ばれる）
  function handlePhotoAdded(newPhoto: OfficePhoto) {
    setPhotos(prev => [...prev, newPhoto]);
  }

  // 削除処理
  async function handlePhotoDelete(photoId: string) {
    const res = await fetch(`/api/biz/company/photos/${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } else {
      alert("削除に失敗しました");
    }
  }

  // caption 更新（debounce 700ms で PATCH 送信）
  async function handleCaptionUpdate(photoId: string, caption: string) {
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, caption } : p
    ));
    // debounce で PATCH 送信（既存 hasInteracted パターンと同じ思想）
  }

  // ロゴアップロード
  async function handleLogoUpload(file: File) {
    setIsLogoUploading(true);
    try {
      const path = buildLogoStoragePath(companyId, file.name);
      const { error } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(path);

      // form の logo_url を更新 → autosave で永続化
      update("logoUrl", publicUrl);  // または対応するフィールド名
    } catch (error) {
      console.error("[Logo upload]", error);
      alert("ロゴのアップロードに失敗しました");
    } finally {
      setIsLogoUploading(false);
    }
  }
}
```

#### 4-c. `page.tsx` 修正

```tsx
import { fetchOfficePhotosForCompany } from "@/lib/business/photos";

export default async function BizCompanyPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/biz/auth");

  const supabase = createClient();
  const initialCompany = await fetchCompanyForTenant(supabase, ctx.tenantId);
  if (!initialCompany) redirect("/biz/auth");

  const initialPhotos = await fetchOfficePhotosForCompany(supabase, ctx.tenantId);

  return (
    <CompanyEditClient
      initialCompany={initialCompany}
      initialPhotos={initialPhotos}
      companyId={ctx.tenantId}
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient ?? undefined}
      tenantLogoLetter={ctx.logoLetter ?? undefined}
      planType={ctx.planType}
    />
  );
}
```

---

## 🚧 リスクと対策

| リスク | 影響度 | 対策 |
|---|---|---|
| `ow-uploads` バケットが private だとアップロード失敗 | 高 | Session P-1 の最初に Supabase Studio で `Public bucket` 設定を確認 |
| Storage 容量逼迫（大量アップロード） | 中 | API Route で `count >= 5 per category` を弾く |
| 古い photos（mock 由来 Unsplash URL）が DB に残る可能性 | 低 | migration では一切触らず、UI 表示時に空配列スタートで OK |
| Strict Mode で重複アップロード | 中 | `isUploading` ref で防御（hasInteracted と同パターン） |
| 削除した画像の Storage orphan | 低 | 容認（手動清掃可能、コスト微小） |
| caption 自動保存の連発 | 中 | debounce 700ms（autosave と同じパターン） |
| `getCompanyId` の重複定義 | 低 | `src/lib/business/company.ts` に切り出して共有 |

---

## ⏰ セッション分割と所要時間

### Session P-1: migration 038 + データ層（30 分）

**目的**: DB スキーマと fetcher を整える

```
1. Supabase Studio で `ow-uploads` バケットの public 設定確認（5 分）
   → Settings → Storage → ow-uploads → Public bucket = ON
   → もし OFF なら ON に変更（migration 不要、Studio で設定）

2. supabase/migrations/038_*.sql 作成（5 分）
3. supabase/rollbacks/038_rollback.sql 保存（2 分）
4. supabase db push + 検証クエリ（5 分）
   - SELECT category, COUNT(*) FROM ow_company_office_photos GROUP BY category;
   - 関数/policy 確認

5. src/lib/business/photos.ts 新規作成（10 分）
6. tsc 確認（2 分）
7. コミット（push しない）
```

**完了条件**:
- migration 038 push 成功
- バケット設定確認済み
- photos.ts 型エラーなし

### Session P-2: API Route + Storage 連携（30〜40 分）

**目的**: バックエンドを完成させる

```
1. src/app/api/biz/company/photos/route.ts 新規作成（POST 部分）
2. src/app/api/biz/company/photos/[id]/route.ts 新規作成（PATCH/DELETE）
3. getCompanyId を src/lib/business/company.ts に切り出し（リファクタ）
4. 既存 src/app/api/biz/company/route.ts の getCompanyId を import 化
5. tsc + build 確認
6. コミット（push しない）
```

**完了条件**:
- POST /api/biz/company/photos が curl で 401 を返す（未認証時）
- 認証込みで動作確認は P-3 で

### Session P-3: UI 接続 + 動作確認（30〜40 分）

**目的**: フロントを繋いで動かす

```
1. src/components/biz/OfficePhotoSection.tsx 改修（ファイル選択）
2. src/app/biz/company/CompanyEditClient.tsx 修正（initialPhotos props 受け取り、handlers）
3. src/app/biz/company/page.tsx 修正（initialPhotos の fetch + props 渡し）
4. ロゴアップロード接続（CompanyEditClient 内）
5. tsc + build 確認

6. dev server 起動 → ブラウザで動作確認:
   - 4 カテゴリそれぞれで写真アップロード
   - caption 編集 → 自動保存
   - 削除 → DB 反映確認
   - ロゴ画像変更
   - リロードして永続化確認

7. コミット + push
8. Vercel デプロイ確認
```

**完了条件**:
- 各カテゴリにアップロード成功
- ow_company_office_photos に INSERT されているのを Studio で確認
- ow-uploads バケットにファイルが保存されているのを Studio で確認
- リロード後も画像が表示される
- Vercel ビルド成功

**3 セッション合計: 1.5〜2 時間**（連続実行が前提、間に休憩可）

---

## 🎯 各セッションの Claude Code 指示テンプレ

### Session P-1 開始時のプロンプト

```
docs/plans/photos-storage-integration.md を読んで、
Session P-1（migration 038 + データ層）を実行してください。

事前作業:
- 柴さんに Supabase Studio で ow-uploads バケットの Public bucket 設定確認を依頼
- 設定 OFF なら ON に変更してもらう

その後、以下の順で実装:
1. supabase/migrations/038_fix_office_photos_category_and_check.sql 作成
2. supabase/rollbacks/038_rollback.sql 保存
3. supabase db push 実行 + 検証
4. src/lib/business/photos.ts 新規作成
5. tsc 確認
6. コミット（push しない）

コード詳細はすべて docs/plans/photos-storage-integration.md に書いてあります。
完了したら報告してください。
```

### Session P-2 開始時のプロンプト

```
docs/plans/photos-storage-integration.md の Session P-2 を実行してください。

実装内容:
1. src/app/api/biz/company/photos/route.ts 新規作成（POST）
2. src/app/api/biz/company/photos/[id]/route.ts 新規作成（PATCH/DELETE）
3. getCompanyId を src/lib/business/company.ts に切り出し
4. tsc + build 確認
5. コミット（push しない）

コード詳細は計画書参照。完了したら報告してください。
```

### Session P-3 開始時のプロンプト

```
docs/plans/photos-storage-integration.md の Session P-3 を実行してください。

実装内容:
1. OfficePhotoSection.tsx 改修
2. CompanyEditClient.tsx 修正
3. page.tsx 修正
4. ロゴアップロード接続
5. tsc + build 確認
6. dev server 起動 → 柴さんにブラウザ動作確認依頼
7. 全 OK なら push + Vercel 確認

コード詳細は計画書参照。
動作確認で問題があれば即停止して報告してください。
```

---

## 📋 完了時のコミットメッセージ案

### P-1 コミット

```
feat(rls): migration 038 - office photos category fix + WITH CHECK

- Rename category 'work' to 'workspace' to match frontend type
- Add WITH CHECK to admin_manage policy for INSERT/UPDATE safety
- Add fetchOfficePhotosForCompany + path builders in lib/business/photos.ts

Preparation for full Storage integration (see docs/plans/).
```

### P-2 コミット

```
feat(api): photos CRUD endpoints for /biz/company

- POST /api/biz/company/photos (add photo)
- PATCH /api/biz/company/photos/[id] (update caption / order)
- DELETE /api/biz/company/photos/[id] (delete from DB + Storage)
- Extract getCompanyId to lib/business/company.ts for reuse
```

### P-3 コミット

```
feat(biz/company): full Storage integration for photos + logo

Phase 4 truly complete: /biz/company now persists office photos and
logo image to Supabase Storage with proper DB tracking.

- OfficePhotoSection: file picker + Storage upload + DB persist
- Logo upload: alert -> ImageUpload component + form sync
- Photos hydrated from DB on page load (Server Component fetch)
- Strict Mode safe via isUploading ref pattern
```

---

## 🔍 動作確認チェックリスト（Session P-3 完了時）

- [ ] 4 カテゴリそれぞれで写真追加できる
- [ ] 5 枚目を追加しようとするとエラー（または disabled）
- [ ] caption 編集 → 700ms 後に保存
- [ ] 写真削除 → DB から消える + Storage からも消える
- [ ] ロゴアップロード → form に反映 → autosave で DB 保存
- [ ] ページリロードしても写真が残っている
- [ ] DevTools Console にエラーなし
- [ ] DevTools Network で各 API が 200 で返る
- [ ] Vercel デプロイ成功
- [ ] 本番環境で動作確認

---

## 💡 補足: なぜこの設計にしたか

### なぜクライアント側で Storage アップロードか
- API Route 経由だと multipart/form-data の処理が複雑
- Next.js の API Route はファイルサイズ制限がある（4.5MB デフォルト）
- 既存の admin/companies ページが同パターンで動いているので踏襲

### なぜ migration 038 で category を統一するか
- フロント側の `PhotoCategory` 型は UI ラベル・gradient 定義の起点
- DB 側を合わせるほうが影響範囲が小さい
- 既存データに 'work' があれば UPDATE で安全に移行

### なぜ getCompanyId を切り出すか
- 既存 `src/app/api/biz/company/route.ts` で実装済み
- photos endpoint でも同じロジックが必要
- 将来の API Route（meetings, jobs 拡張等）でも再利用可能

---

## 🚀 完了後の状態

Phase 4 が **真の 100% 完了** になり、以下が達成される:

```
✅ /biz/dashboard         - Supabase 接続済み
✅ /biz/meetings           - Supabase 接続済み
✅ /biz/jobs (list)        - Supabase 接続済み
✅ /biz/jobs (CRUD)        - Supabase 接続済み
✅ /biz/company            - Supabase 接続済み + Storage 接続済み ← 新規
✅ /biz/auth               - Supabase 接続済み
```

次は Phase 5（チーム機能 / 認証強化）or Phase 6（求職者側 royal blue 統一）へ進める。

---

**この計画書は 2026-04-27 深夜に作成。実装は翌日以降。**

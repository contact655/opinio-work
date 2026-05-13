# 企業詳細・編集ページ + ジャンルタグ付与UI — 実装仕様書

作成日: 2026-05-13
対象: Opinio Work (`/Users/hisato/opinio-work/`)
担当: Claude Code
前提: 段階7-F Phase 1-4 完了済み、企業ジャンル別カルーセル（migration 044-047）本番稼働中

---

## 1. 概要

`/admin/companies/[id]` は現在ディレクトリが空。これを実装し、以下を実現する：

1. 企業情報の全フィールド編集
2. ロゴのファイルアップロード（Supabase Storage 連携）
3. ジャンルタグの手動付与（ow_company_genres へのINSERT/DELETE）

既存資産（`/biz/company` のCompanyEditClient パターン、`buildLogoStoragePath`、認可基盤）を徹底的に再利用する。

---

## 2. 実装範囲

### 新規ファイル
- `src/app/admin/companies/[id]/page.tsx` — サーバーコンポーネント、データ取得
- `src/app/admin/companies/[id]/CompanyDetailClient.tsx` — クライアントコンポーネント、編集UI
- `src/app/api/admin/companies/[id]/route.ts` — PUT エンドポイント、全フィールド更新
- `src/app/api/admin/companies/[id]/genres/route.ts` — POST/DELETE エンドポイント、ジャンル紐付け

### 修正ファイル
- 動線整備：admin の企業一覧から詳細リンクが動作するように

---

## 3. 事前確認（実装前に必ず実行）

```bash
# 既存資産の構造確認
cat src/app/biz/company/CompanyEditClient.tsx | head -100
cat src/app/api/biz/company/route.ts | head -50
cat src/app/api/biz/company/photos/route.ts | head -50
cat src/lib/business/photos.ts
ls src/components/ui/

# 認可基盤の確認
grep -r "isAdmin" src/lib/ | head -5
grep -r "auth_is_admin" src/lib/ | head -5

# 既存の admin 系コンポーネントの構造
ls src/app/admin/
cat src/app/admin/companies/page.tsx | head -50

# ジャンルマスター取得方法
cat src/lib/genres.ts
```

### 確認すべき重要事項
- `CompanyEditClient.tsx` の `handleLogoUpload` の実装パターン
- `buildLogoStoragePath` の引数と戻り値
- admin認可のチェック方法（既存 admin ページの先頭でどうチェックしているか）
- `ow-uploads` バケットの公開設定（Public か Private か）

---

## 4. Step 1: 企業詳細・編集ページ（基本実装）

### 4-1. `src/app/admin/companies/[id]/page.tsx`

サーバーコンポーネント。データ取得 + 認可チェック + クライアントコンポーネントへの引き渡し。

```tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth'; // 既存の認可関数（要確認）
import { CompanyDetailClient } from './CompanyDetailClient';

type Props = {
  params: { id: string };
};

export default async function AdminCompanyDetailPage({ params }: Props) {
  const supabase = createClient();

  // 認可チェック
  const adminOk = await isAdmin();
  if (!adminOk) {
    redirect('/');
  }

  // 企業データ取得
  const { data: company, error } = await supabase
    .from('ow_companies')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !company) {
    notFound();
  }

  // 全ジャンル取得
  const { data: genres } = await supabase
    .from('ow_genres')
    .select('id, slug, name, description, display_order')
    .eq('is_active', true)
    .order('display_order');

  // この企業に紐付け済みのジャンル取得
  const { data: companyGenres } = await supabase
    .from('ow_company_genres')
    .select('genre_id, is_human_approved, is_ai_suggested')
    .eq('company_id', params.id);

  return (
    <CompanyDetailClient
      company={company}
      allGenres={genres ?? []}
      companyGenres={companyGenres ?? []}
    />
  );
}
```

### 4-2. `src/app/admin/companies/[id]/CompanyDetailClient.tsx`

クライアントコンポーネント。フォーム + 保存 + ロゴアップロード + ジャンル付与。

**全体構造：**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { buildLogoStoragePath } from '@/lib/business/photos';
import { Toast } from '@/components/ui/Toast'; // 既存
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'; // 既存

type Props = {
  company: any; // ow_companies の row 型
  allGenres: { id: string; slug: string; name: string; description: string | null }[];
  companyGenres: { genre_id: string; is_human_approved: boolean; is_ai_suggested: boolean }[];
};

export function CompanyDetailClient({ company, allGenres, companyGenres }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // フォームの state（全フィールド）
  const [formData, setFormData] = useState({
    name: company.name || '',
    description: company.description || '',
    industry: company.industry || '',
    funding_stage: company.funding_stage || '',
    employee_count: company.employee_count || '',
    accepting_casual_meetings: company.accepting_casual_meetings || false,
    remote_work_status: company.remote_work_status || '',
    logo_url: company.logo_url || '',
    is_published: company.is_published || false,
    status: company.status || 'pending',
    // 他のフィールドも既存スキーマに合わせて追加
  });

  // 選択中のジャンルID set
  const initialApprovedGenres = new Set(
    companyGenres.filter(cg => cg.is_human_approved).map(cg => cg.genre_id)
  );
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(initialApprovedGenres);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ロゴアップロード
  const handleLogoUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const path = buildLogoStoragePath(company.id, file.name);
      const { error: uploadError } = await supabase.storage
        .from('ow-uploads')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ow-uploads')
        .getPublicUrl(path);

      setFormData({ ...formData, logo_url: publicUrl });
      // Toast表示：「ロゴをアップロードしました」
    } catch (err) {
      console.error('Upload failed:', err);
      // Toast表示：「アップロードに失敗しました」
    } finally {
      setIsUploading(false);
    }
  };

  // 保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. 企業情報を PUT
      const res = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to save company');

      // 2. ジャンル紐付けを更新
      const initial = new Set(companyGenres.filter(cg => cg.is_human_approved).map(cg => cg.genre_id));
      const toAdd = [...selectedGenres].filter(id => !initial.has(id));
      const toRemove = [...initial].filter(id => !selectedGenres.has(id));

      // 追加
      if (toAdd.length > 0) {
        await fetch(`/api/admin/companies/${company.id}/genres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre_ids: toAdd }),
        });
      }

      // 削除
      if (toRemove.length > 0) {
        await fetch(`/api/admin/companies/${company.id}/genres`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre_ids: toRemove }),
        });
      }

      // Toast：「保存しました」
      router.refresh();
    } catch (err) {
      console.error('Save failed:', err);
      // Toast：「保存に失敗しました」
    } finally {
      setIsSaving(false);
    }
  };

  const toggleGenre = (genreId: string) => {
    const next = new Set(selectedGenres);
    if (next.has(genreId)) {
      next.delete(genreId);
    } else {
      next.add(genreId);
    }
    setSelectedGenres(next);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* パンくず */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/admin">管理</a> / <a href="/admin/companies">企業</a> / {company.name}
      </nav>

      <h1 className="text-2xl font-bold mb-6">{company.name}</h1>

      {/* 基本情報セクション */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">基本情報</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">企業名 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">企業説明</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">業界</label>
              <input
                type="text"
                value={formData.industry}
                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">資金調達ステージ</label>
              <input
                type="text"
                value={formData.funding_stage}
                onChange={e => setFormData({ ...formData, funding_stage: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">従業員数</label>
              <input
                type="text"
                value={formData.employee_count}
                onChange={e => setFormData({ ...formData, employee_count: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">リモートワーク状況</label>
              <select
                value={formData.remote_work_status}
                onChange={e => setFormData({ ...formData, remote_work_status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">選択してください</option>
                <option value="full_remote">フルリモート</option>
                <option value="hybrid">ハイブリッド</option>
                <option value="on_site">出社</option>
              </select>
            </div>
            <div>
              <label className="flex items-center mt-7">
                <input
                  type="checkbox"
                  checked={formData.accepting_casual_meetings}
                  onChange={e => setFormData({ ...formData, accepting_casual_meetings: e.target.checked })}
                  className="mr-2"
                />
                カジュアル面談を受け付ける
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* ロゴセクション */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">ロゴ</h2>

        <div className="flex gap-6">
          {/* プレビュー */}
          <div className="w-48 h-32 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
            {formData.logo_url ? (
              <img
                src={formData.logo_url}
                alt={`${formData.name}のロゴ`}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <span className="text-gray-400 text-sm">ロゴ未設定</span>
            )}
          </div>

          {/* アップロード + URL入力 */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">ファイルアップロード</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
                disabled={isUploading}
                className="block w-full text-sm"
              />
              {isUploading && <p className="text-xs text-gray-500 mt-1">アップロード中...</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">または URL を直接入力</label>
              <input
                type="text"
                value={formData.logo_url}
                onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="/logos/sansan.png または https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ジャンルタグセクション */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">ジャンルタグ</h2>
        <p className="text-sm text-gray-500 mb-4">
          この企業を表すジャンルを選択してください。複数選択可能です。
        </p>

        <div className="grid grid-cols-2 gap-3">
          {allGenres.map(genre => (
            <label
              key={genre.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedGenres.has(genre.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedGenres.has(genre.id)}
                onChange={() => toggleGenre(genre.id)}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-sm">{genre.name}</p>
                {genre.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{genre.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 公開状態セクション */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">公開設定</h2>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_published}
            onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
            className="mr-2"
          />
          公開する（求職者画面に表示する）
        </label>
      </section>

      {/* 保存ボタン */}
      <div className="flex justify-end gap-3 sticky bottom-4 bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
        <button
          onClick={() => router.push('/admin/companies')}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Step 2: 企業情報更新API

### `src/app/api/admin/companies/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 認可チェック
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const body = await request.json();

  // ホワイトリスト：更新を許可するカラムのみ取り出す
  const allowedFields = [
    'name', 'description', 'industry', 'funding_stage',
    'employee_count', 'accepting_casual_meetings',
    'remote_work_status', 'logo_url', 'is_published', 'status',
    // 必要に応じて追加
  ];

  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  const { data, error } = await supabase
    .from('ow_companies')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Update failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ company: data });
}
```

---

## 6. Step 3: ジャンル紐付けAPI

### `src/app/api/admin/companies/[id]/genres/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';

// POST: ジャンル紐付け追加
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const { genre_ids } = await request.json();

  if (!Array.isArray(genre_ids) || genre_ids.length === 0) {
    return NextResponse.json({ error: 'genre_ids is required' }, { status: 400 });
  }

  // 現在のユーザーを取得（approved_by に記録）
  const { data: { user } } = await supabase.auth.getUser();
  const { data: owUser } = await supabase
    .from('ow_users')
    .select('id')
    .eq('auth_id', user?.id)
    .single();

  const rows = genre_ids.map((genre_id: string) => ({
    company_id: params.id,
    genre_id,
    is_human_approved: true,
    approved_by: owUser?.id ?? null,
    approved_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('ow_company_genres')
    .upsert(rows, { onConflict: 'company_id,genre_id' });

  if (error) {
    console.error('Genre insert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE: ジャンル紐付け削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const { genre_ids } = await request.json();

  if (!Array.isArray(genre_ids) || genre_ids.length === 0) {
    return NextResponse.json({ error: 'genre_ids is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ow_company_genres')
    .delete()
    .eq('company_id', params.id)
    .in('genre_id', genre_ids);

  if (error) {
    console.error('Genre delete failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

## 7. Step 4: 動線確認

### 確認事項
- `/admin/companies` の一覧から `/admin/companies/[id]` へのリンクが既に存在するはず
- リンクが正しく動作するか確認
- もし `/admin` のサイドバー等に動線がなければ、必要に応じて追加

---

## 8. RLS / 権限について

### ow_companies の UPDATE
- 既存のRLSポリシーで admin が UPDATE できるか確認
- もし制限があれば、API側で service_role を使う実装に切り替える

### ow_company_genres の INSERT/DELETE
- 現状は SELECT のみ public 公開（migration 044）
- admin による INSERT/DELETE が必要
- API は server-side（service_role 使用可）なので、RLS を緩める必要はない可能性が高い

### Storage（ow-uploads）
- `companies/logos/{companyId}/` への書き込み権限が必要
- 既存の `/biz/company` で動いているので、admin も同じ権限で動くはず
- 念のため、admin の auth_id が Storage policy で許可されているか確認

---

## 9. 動作確認チェックリスト

### Step 1 完了時
- [ ] `/admin/companies/[id]` にアクセスして企業情報が表示される
- [ ] 各フィールドを編集して保存できる
- [ ] 保存後、リロードしても変更が反映されている
- [ ] `/companies`（求職者画面）にも変更が反映される

### Step 2 完了時
- [ ] ロゴをファイルアップロードできる
- [ ] アップロード後、プレビューに表示される
- [ ] 保存後、求職者画面のカードにロゴが表示される
- [ ] URL直打ちでも設定できる（既存パターン互換）

### Step 3 完了時
- [ ] ジャンルチェックボックスが全8ジャンル表示される
- [ ] 現在紐付け済みのジャンルが初期状態でチェック済み
- [ ] チェック変更 + 保存で `ow_company_genres` が更新される
- [ ] 求職者画面のカルーセル配置が正しく変わる

### 最終確認
- [ ] npm run build エラーゼロ
- [ ] git push 完了
- [ ] Vercel ● Ready 確認
- [ ] 本番URL（opinio.jp/admin/companies/[id]）で動作確認

---

## 10. 完了後のハンドオフ

`docs/handover-2026-05-13-admin-company-edit.md` を作成し、以下を記録：

- 実装した機能のサマリ
- 既存資産との接続箇所（buildLogoStoragePath, isAdmin, ow-uploads bucket）
- API エンドポイント一覧
- 残課題（あれば）
- 次フェーズ候補：
  - 企業の新規追加機能（現状は admin/companies のpending 承認フローで対応？要確認）
  - 求人情報の編集機能（/admin/jobs にあるが詳細編集は未実装かも）
  - 企業情報の一括インポート（CSV → 大量登録）

---

## 11. 重要な原則

- **既存パターンの再利用最優先**：`/biz/company` の `CompanyEditClient` を真似る
- **新規実装を最小化**：すでに `buildLogoStoragePath` があるので絶対に新規作成しない
- **ConfirmDialog / Toast は既存のものを使う**：新規UIコンポーネントを作らない
- **エラーハンドリングを丁寧に**：Toast でユーザーに必ずフィードバック
- **保存ボタンは sticky**：長いフォームでもいつでも保存できる位置に

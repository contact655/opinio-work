'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { buildLogoStoragePath } from '@/lib/business/photos';
import Toast from '@/components/ui/Toast';

// ── 型定義 ─────────────────────────────────────────────────────────────────

type Genre = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
};

type CompanyGenre = {
  genre_id: string;
  is_human_approved: boolean;
  is_ai_suggested: boolean;
};

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company: any; // ow_companies の全カラム
  allGenres: Genre[];
  companyGenres: CompanyGenre[];
};

type FormData = {
  name: string;
  description: string;
  industry: string;
  funding_stage: string;
  employee_count: string;
  accepting_casual_meetings: boolean;
  remote_work_status: string;
  logo_url: string;
  is_published: boolean;
  status: string;
};

type ToastState = { message: string; variant: 'default' | 'error' } | null;

// ── コンポーネント ──────────────────────────────────────────────────────────

export function CompanyDetailClient({ company, allGenres, companyGenres }: Props) {
  const router = useRouter();

  // ── フォーム state ─────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    name: company.name ?? '',
    description: company.description ?? '',
    industry: company.industry ?? '',
    funding_stage: company.funding_stage ?? '',
    employee_count: company.employee_count ?? '',
    accepting_casual_meetings: company.accepting_casual_meetings ?? false,
    remote_work_status: company.remote_work_status ?? '',
    logo_url: company.logo_url ?? '',
    is_published: company.is_published ?? false,
    status: company.status ?? 'pending',
  });

  // ── ジャンル state ─────────────────────────────────────────────────────
  const initialApproved = new Set<string>(
    companyGenres.filter((cg) => cg.is_human_approved).map((cg) => cg.genre_id)
  );
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(initialApproved);

  // ── UI state ──────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, variant: 'default' | 'error' = 'default') => {
    setToast({ message, variant });
  }, []);

  // ── フォーム更新ヘルパー ────────────────────────────────────────────────
  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // ── ロゴアップロード ───────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      showToast('JPG・PNG・SVG・WebP のみ対応しています', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('5MB 以内のファイルを選択してください', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const path = buildLogoStoragePath(company.id, file.name);
      const { error: uploadError } = await supabase.storage
        .from('ow-uploads')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ow-uploads')
        .getPublicUrl(path);

      update('logo_url', publicUrl);
      showToast('ロゴをアップロードしました');
    } catch (err) {
      console.error('[CompanyDetailClient] logo upload failed:', err);
      showToast('アップロードに失敗しました', 'error');
    } finally {
      setIsUploading(false);
    }
  }

  // ── ジャンルトグル ─────────────────────────────────────────────────────
  function toggleGenre(genreId: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }
      return next;
    });
  }

  // ── 保存 ──────────────────────────────────────────────────────────────
  async function handleSave() {
    setIsSaving(true);
    try {
      // 1. 企業情報を PUT
      const companyRes = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!companyRes.ok) {
        const err = await companyRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to save company');
      }

      // 2. ジャンル差分を計算して API 呼び出し
      const toAdd = Array.from(selectedGenres).filter((id) => !initialApproved.has(id));
      const toRemove = Array.from(initialApproved).filter((id) => !selectedGenres.has(id));

      if (toAdd.length > 0) {
        const r = await fetch(`/api/admin/companies/${company.id}/genres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre_ids: toAdd }),
        });
        if (!r.ok) throw new Error('Failed to add genres');
      }

      if (toRemove.length > 0) {
        const r = await fetch(`/api/admin/companies/${company.id}/genres`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre_ids: toRemove }),
        });
        if (!r.ok) throw new Error('Failed to remove genres');
      }

      showToast('保存しました');
      router.refresh();
    } catch (err) {
      console.error('[CompanyDetailClient] save failed:', err);
      showToast('保存に失敗しました', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // ── レンダー ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      {/* パンくず */}
      <nav className="text-sm text-gray-500 mb-4 flex items-center gap-1">
        <Link href="/admin" className="hover:text-gray-700">管理</Link>
        <span>/</span>
        <Link href="/admin/companies" className="hover:text-gray-700">企業審査</Link>
        <span>/</span>
        <span className="text-gray-800">{company.name}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-1">{company.name}</h1>
      <p className="text-sm text-gray-500 mb-6">
        ID: {company.id}
        {company.status && (
          <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${
            company.status === 'active' ? 'bg-green-100 text-green-800' :
            company.status === 'pending' ? 'bg-amber-100 text-amber-800' :
            'bg-red-100 text-red-800'
          }`}>
            {company.status}
          </span>
        )}
      </p>

      {/* ── 基本情報 ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">基本情報</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              企業名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">企業説明</label>
            <textarea
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">業界</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => update('industry', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">資金調達ステージ</label>
              <input
                type="text"
                value={formData.funding_stage}
                onChange={(e) => update('funding_stage', e.target.value)}
                placeholder="例: Series A"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">従業員数</label>
              <input
                type="text"
                value={formData.employee_count}
                onChange={(e) => update('employee_count', e.target.value)}
                placeholder="例: 50-100"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">リモートワーク状況</label>
              <select
                value={formData.remote_work_status}
                onChange={(e) => update('remote_work_status', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                <option value="フルリモート">フルリモート</option>
                <option value="ハイブリッド">ハイブリッド</option>
                <option value="出社">出社</option>
                <option value="一部リモート">一部リモート</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.accepting_casual_meetings}
                  onChange={(e) => update('accepting_casual_meetings', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">カジュアル面談を受け付ける</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* ── ロゴ ─────────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">ロゴ</h2>

        <div className="flex gap-6">
          {/* プレビュー */}
          <div className="w-40 h-28 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            {formData.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formData.logo_url}
                alt={`${formData.name}のロゴ`}
                className="w-full h-full object-contain p-3"
              />
            ) : (
              <span className="text-gray-400 text-xs">ロゴ未設定</span>
            )}
          </div>

          {/* アップロード + URL 入力 */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">ファイルアップロード</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {isUploading && (
                <p className="text-xs text-gray-500 mt-1">アップロード中...</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">または URL を直接入力</label>
              <input
                type="text"
                value={formData.logo_url}
                onChange={(e) => update('logo_url', e.target.value)}
                placeholder="/logos/sansan.png または https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── ジャンルタグ ──────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-1">ジャンルタグ</h2>
        <p className="text-sm text-gray-500 mb-4">
          この企業を表すジャンルを選択してください。複数選択可能です。
        </p>

        <div className="grid grid-cols-2 gap-3">
          {allGenres.map((genre) => (
            <label
              key={genre.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedGenres.has(genre.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedGenres.has(genre.id)}
                onChange={() => toggleGenre(genre.id)}
                className="mt-0.5 w-4 h-4"
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

        {allGenres.length === 0 && (
          <p className="text-sm text-gray-400">ジャンルが登録されていません</p>
        )}
      </section>

      {/* ── 公開設定 ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">公開設定</h2>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_published}
            onChange={(e) => update('is_published', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">公開する（求職者画面に表示する）</span>
        </label>
      </section>

      {/* ── 求職者画面リンク ──────────────────────────────────────────── */}
      <div className="mb-24 text-right">
        <Link
          href={`/companies/${company.id}`}
          target="_blank"
          className="text-sm text-blue-600 hover:underline"
        >
          求職者画面で確認する →
        </Link>
      </div>

      {/* ── 保存ボタン（sticky） ──────────────────────────────────────── */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end gap-3 z-10">
        <button
          onClick={() => router.push('/admin/companies')}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存する'}
        </button>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}

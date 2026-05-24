'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { buildLogoStoragePath } from '@/lib/business/photos';
import Toast from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_color: string | null;
};

type CompanyAdmin = {
  id: string;
  user_id: string;
  permission: string;
  role_title: string | null;
  is_active: boolean;
  created_at: string;
  // Supabase の join は配列で返ってくる（多対一でも）
  user: AdminUser[] | AdminUser | null;
};

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company: any; // ow_companies の全カラム
  allGenres: Genre[];
  companyGenres: CompanyGenre[];
  admins: CompanyAdmin[];
};

type FormData = {
  // 既存フィールド
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
  // 基本情報タブ追加フィールド
  mission: string;
  tagline: string;
  why_join: string;
  culture_description: string;
  founded_year: string; // 入力は文字列、保存時に Number() 変換
  url: string;
  ceo_name: string;
  headquarters_address: string;
  nearest_station: string;
  // 採用担当者タブ
  recruiter_name: string;
  recruiter_role: string;
  recruiter_message: string;
  recruiter_avatar_url: string;
  casual_interview_url: string;
  // Opinio独自タブ
  opinio_comment: string;
};

type TabKey = 'basic' | 'recruiter' | 'admins' | 'opinio' | 'logo' | 'genres' | 'publish';

type ToastState = { message: string; variant: 'default' | 'error' } | null;

// ── 採用担当者アバター Storage パス ──────────────────────────────────────────
function buildRecruiterAvatarPath(companyId: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
  return `companies/recruiter-avatars/${companyId}/${Date.now()}.${ext}`;
}

// ── コンポーネント ──────────────────────────────────────────────────────────

export function CompanyDetailClient({ company, allGenres, companyGenres, admins: initialAdmins }: Props) {
  const router = useRouter();

  // ── フォーム state ─────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    // 既存
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
    // 基本情報追加
    mission: company.mission ?? '',
    tagline: company.tagline ?? '',
    why_join: company.why_join ?? '',
    culture_description: company.culture_description ?? '',
    founded_year: company.founded_year != null ? String(company.founded_year) : '',
    url: company.url ?? '',
    ceo_name: company.ceo_name ?? '',
    headquarters_address: company.headquarters_address ?? '',
    nearest_station: company.nearest_station ?? '',
    // 採用担当者
    recruiter_name: company.recruiter_name ?? '',
    recruiter_role: company.recruiter_role ?? '',
    recruiter_message: company.recruiter_message ?? '',
    recruiter_avatar_url: company.recruiter_avatar_url ?? '',
    casual_interview_url: company.casual_interview_url ?? '',
    // Opinio独自
    opinio_comment: company.opinio_comment ?? '',
  });

  // ── ジャンル state ─────────────────────────────────────────────────────
  const initialApproved = new Set<string>(
    companyGenres.filter((cg) => cg.is_human_approved).map((cg) => cg.genre_id)
  );
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(initialApproved);

  // ── UI state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // ── アクセス管理タブ state ───────────────────────────────────────────────
  const [adminList, setAdminList] = useState<CompanyAdmin[]>(initialAdmins);
  const [kickTarget, setKickTarget] = useState<CompanyAdmin | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  const showToast = useCallback((message: string, variant: 'default' | 'error' = 'default') => {
    setToast({ message, variant });
  }, []);

  // ── フォーム更新ヘルパー ────────────────────────────────────────────────
  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  // ── admin kick 処理 ────────────────────────────────────────────────────
  async function handleKickConfirm() {
    if (!kickTarget) return;
    setIsKicking(true);
    try {
      const res = await fetch(
        `/api/admin/companies/${company.id}/admins/${kickTarget.user_id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? 'kick に失敗しました', 'error');
        return;
      }
      // 楽観的更新: リストから除去
      setAdminList((prev) => prev.filter((a) => a.user_id !== kickTarget.user_id));
      const ku = Array.isArray(kickTarget.user) ? (kickTarget.user[0] ?? null) : kickTarget.user;
      showToast(`${ku?.name ?? ku?.email ?? 'ユーザー'} を削除しました`);
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setIsKicking(false);
      setKickTarget(null);
    }
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

  // ── 採用担当者アバターアップロード ────────────────────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('JPG・PNG・WebP のみ対応しています', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('3MB 以内のファイルを選択してください', 'error');
      return;
    }

    setIsAvatarUploading(true);
    try {
      const supabase = createClient();
      const path = buildRecruiterAvatarPath(company.id, file.name);
      const { error: uploadError } = await supabase.storage
        .from('ow-uploads')
        .upload(path, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ow-uploads')
        .getPublicUrl(path);

      update('recruiter_avatar_url', publicUrl);
      showToast('アバターをアップロードしました');
    } catch (err) {
      console.error('[CompanyDetailClient] avatar upload failed:', err);
      showToast('アップロードに失敗しました', 'error');
    } finally {
      setIsAvatarUploading(false);
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
      // founded_year は数値に変換
      const payload = {
        ...formData,
        founded_year: formData.founded_year !== '' ? Number(formData.founded_year) : null,
      };

      // 1. 企業情報を PUT
      const companyRes = await fetch(`/api/admin/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // ── タブ定義 ──────────────────────────────────────────────────────────
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'basic', label: '基本情報' },
    { key: 'recruiter', label: '採用担当者' },
    { key: 'admins', label: `アクセス管理 (${adminList.length})` },
    { key: 'opinio', label: 'OPINIO独自' },
    { key: 'logo', label: 'ロゴ' },
    { key: 'genres', label: 'ジャンル' },
    { key: 'publish', label: '公開設定' },
  ];

  // ── 入力スタイル ──────────────────────────────────────────────────────
  const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{company.name}</h1>
          <p className="text-xs text-gray-400 font-mono">
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
        </div>
        <Link
          href={`/companies/${company.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          求職者画面で確認する
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>

      {/* ── タブバー ─────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-6 gap-0" role="tablist" aria-label="企業詳細セクション">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 基本情報タブ ─────────────────────────────────────────────────── */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold mb-4">会社基本情報</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="acd-name" className={labelCls}>
                  企業名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="acd-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="acd-tagline" className={labelCls}>タグライン</label>
                <input
                  id="acd-tagline"
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => update('tagline', e.target.value)}
                  placeholder="例: テクノロジーで日本の働き方を変える"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="acd-mission" className={labelCls}>ミッション</label>
                <textarea
                  id="acd-mission"
                  value={formData.mission}
                  onChange={(e) => update('mission', e.target.value)}
                  rows={3}
                  placeholder="企業のミッション・ビジョンを記入してください"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="acd-description" className={labelCls}>企業説明</label>
                <textarea
                  id="acd-description"
                  value={formData.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={4}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="acd-industry" className={labelCls}>業界</label>
                  <input
                    id="acd-industry"
                    type="text"
                    value={formData.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acd-funding-stage" className={labelCls}>資金調達ステージ</label>
                  <input
                    id="acd-funding-stage"
                    type="text"
                    value={formData.funding_stage}
                    onChange={(e) => update('funding_stage', e.target.value)}
                    placeholder="例: Series A"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acd-employee-count" className={labelCls}>従業員数</label>
                  <input
                    id="acd-employee-count"
                    type="text"
                    value={formData.employee_count}
                    onChange={(e) => update('employee_count', e.target.value)}
                    placeholder="例: 50-100"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="acd-founded-year" className={labelCls}>設立年</label>
                  <input
                    id="acd-founded-year"
                    type="number"
                    value={formData.founded_year}
                    onChange={(e) => update('founded_year', e.target.value)}
                    placeholder="例: 2018"
                    min={1900}
                    max={2099}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acd-ceo-name" className={labelCls}>代表者名</label>
                  <input
                    id="acd-ceo-name"
                    type="text"
                    value={formData.ceo_name}
                    onChange={(e) => update('ceo_name', e.target.value)}
                    placeholder="例: 山田 太郎"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acd-url" className={labelCls}>企業 URL</label>
                  <input
                    id="acd-url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => update('url', e.target.value)}
                    placeholder="https://example.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="acd-headquarters-address" className={labelCls}>本社所在地</label>
                  <input
                    id="acd-headquarters-address"
                    type="text"
                    value={formData.headquarters_address}
                    onChange={(e) => update('headquarters_address', e.target.value)}
                    placeholder="例: 東京都渋谷区〇〇 1-2-3"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="acd-nearest-station" className={labelCls}>最寄り駅</label>
                  <input
                    id="acd-nearest-station"
                    type="text"
                    value={formData.nearest_station}
                    onChange={(e) => update('nearest_station', e.target.value)}
                    placeholder="例: 渋谷駅 徒歩5分"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="acd-remote-work-status" className={labelCls}>リモートワーク状況</label>
                <select
                  id="acd-remote-work-status"
                  value={formData.remote_work_status}
                  onChange={(e) => update('remote_work_status', e.target.value)}
                  className={inputCls}
                >
                  <option value="">選択してください</option>
                  <option value="フルリモート">フルリモート</option>
                  <option value="ハイブリッド">ハイブリッド</option>
                  <option value="出社">出社</option>
                  <option value="一部リモート">一部リモート</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="accepting_casual"
                  checked={formData.accepting_casual_meetings}
                  onChange={(e) => update('accepting_casual_meetings', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="accepting_casual" className="text-sm cursor-pointer">
                  カジュアル面談を受け付ける
                </label>
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold mb-4">カルチャー・採用メッセージ</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="acd-why-join" className={labelCls}>なぜ入社するか（why_join）</label>
                <textarea
                  id="acd-why-join"
                  value={formData.why_join}
                  onChange={(e) => update('why_join', e.target.value)}
                  rows={4}
                  placeholder="この企業に入社する理由・魅力を記入してください"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="acd-culture-description" className={labelCls}>カルチャー説明</label>
                <textarea
                  id="acd-culture-description"
                  value={formData.culture_description}
                  onChange={(e) => update('culture_description', e.target.value)}
                  rows={4}
                  placeholder="チームの雰囲気・文化・バリューなどを記入してください"
                  className={inputCls}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── 採用担当者タブ ───────────────────────────────────────────────── */}
      {activeTab === 'recruiter' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold mb-4">採用担当者</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="acd-recruiter-name" className={labelCls}>担当者名</label>
                <input
                  id="acd-recruiter-name"
                  type="text"
                  value={formData.recruiter_name}
                  onChange={(e) => update('recruiter_name', e.target.value)}
                  placeholder="例: 鈴木 花子"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="acd-recruiter-role" className={labelCls}>役職・部署</label>
                <input
                  id="acd-recruiter-role"
                  type="text"
                  value={formData.recruiter_role}
                  onChange={(e) => update('recruiter_role', e.target.value)}
                  placeholder="例: HR・採用担当"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="acd-recruiter-message" className={labelCls}>担当者メッセージ</label>
              <textarea
                id="acd-recruiter-message"
                value={formData.recruiter_message}
                onChange={(e) => update('recruiter_message', e.target.value)}
                rows={5}
                placeholder="求職者へのメッセージを記入してください"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>担当者アバター</label>
              <div className="flex gap-4 items-start">
                {/* プレビュー */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                    {formData.recruiter_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formData.recruiter_avatar_url}
                        alt="採用担当者アバター"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs text-center px-2">未設定</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={isAvatarUploading}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                    {isAvatarUploading && (
                      <p className="text-xs text-gray-500 mt-1">アップロード中...</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={formData.recruiter_avatar_url}
                      onChange={(e) => update('recruiter_avatar_url', e.target.value)}
                      placeholder="または URL を直接入力"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="acd-casual-interview-url" className={labelCls}>カジュアル面談 URL</label>
              <input
                id="acd-casual-interview-url"
                type="url"
                value={formData.casual_interview_url}
                onChange={(e) => update('casual_interview_url', e.target.value)}
                placeholder="https://calendly.com/..."
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">
                Calendly や Meety など、カジュアル面談の予約 URL を入力してください
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Opinio独自タブ ────────────────────────────────────────────────── */}
      {activeTab === 'opinio' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold mb-1">OPINIO 編集部コメント</h2>
          <p className="text-sm text-gray-500 mb-4">
            編集部独自の企業評価・コメントです。求職者には非公開の内部メモとしても活用できます。
          </p>
          <div>
            <label htmlFor="acd-opinio-comment" className={labelCls}>コメント</label>
            <textarea
              id="acd-opinio-comment"
              value={formData.opinio_comment}
              onChange={(e) => update('opinio_comment', e.target.value)}
              rows={10}
              placeholder="この企業の特徴、編集部の評価、取材メモなどを記入してください..."
              className={inputCls}
            />
          </div>
        </section>
      )}

      {/* ── ロゴタブ ─────────────────────────────────────────────────────── */}
      {activeTab === 'logo' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold mb-4">ロゴ</h2>

          <div className="flex gap-6">
            {/* プレビュー */}
            <div className="w-48 h-32 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {formData.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.logo_url}
                  alt={`${formData.name}のロゴ`}
                  className="w-full h-full object-contain p-3"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                  style={{ background: company.logo_gradient || 'linear-gradient(135deg, #002366, #3B5FD9)' }}
                >
                  {company.logo_letter || (company.name?.[0] ?? '?')}
                </div>
              )}
            </div>

            {/* アップロード + URL 入力 */}
            <div className="flex-1 space-y-3">
              <div>
                <label htmlFor="acd-logo-file" className={labelCls}>ファイルアップロード</label>
                <input
                  id="acd-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {isUploading && (
                  <p className="text-xs text-gray-500 mt-1">アップロード中...</p>
                )}
                <p className="text-xs text-gray-400 mt-1">JPG・PNG・SVG・WebP、5MB 以内</p>
              </div>

              <div>
                <label htmlFor="acd-logo-url" className={labelCls}>または URL を直接入力</label>
                <input
                  id="acd-logo-url"
                  type="text"
                  value={formData.logo_url}
                  onChange={(e) => update('logo_url', e.target.value)}
                  placeholder="/logos/example.png または https://..."
                  className={`${inputCls} font-mono`}
                />
              </div>

              {formData.logo_url && (
                <button
                  type="button"
                  onClick={() => update('logo_url', '')}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  ロゴを削除（グラデーション表示に戻す）
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── ジャンルタブ ─────────────────────────────────────────────────── */}
      {activeTab === 'genres' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
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

          {selectedGenres.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                選択中: {selectedGenres.size} ジャンル
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── 公開設定タブ ─────────────────────────────────────────────────── */}
      {activeTab === 'publish' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold mb-4">公開設定</h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => update('is_published', e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium">公開する</p>
                <p className="text-xs text-gray-500">求職者画面（/companies）に表示されます</p>
              </div>
            </label>

            <div>
              <label className={labelCls}>審査ステータス</label>
              <select
                value={formData.status}
                onChange={(e) => update('status', e.target.value)}
                className={inputCls}
              >
                <option value="pending">pending（審査中）</option>
                <option value="active">active（承認済み）</option>
                <option value="rejected">rejected（却下）</option>
                <option value="suspended">suspended（停止）</option>
              </select>
            </div>

            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 space-y-1">
              <p>
                <span className="font-medium">公開フラグ:</span>{' '}
                {formData.is_published ? '✅ 公開中' : '⚫ 非公開'}
              </p>
              <p>
                <span className="font-medium">ステータス:</span> {formData.status}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── 保存ボタン（sticky） ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-end gap-3 z-10">
        <button
          onClick={() => router.push('/admin/companies')}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isUploading || isAvatarUploading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存する'}
        </button>
      </div>

      {/* ── アクセス管理タブ ──────────────────────────────────────────────── */}
      {activeTab === 'admins' && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">アクセス管理</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                /biz/ 管理画面にアクセスできる採用担当アカウントの一覧です。
              </p>
            </div>
          </div>

          {/* user が配列で返ってくる場合を正規化 */}
      {adminList.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              採用担当アカウントが登録されていません
            </div>
          ) : (
            <div className="space-y-2">
              {adminList.map((a) => {
                // Supabase join は配列で返す場合があるため正規化
                const u: AdminUser | null = Array.isArray(a.user) ? (a.user[0] ?? null) : a.user;
                const displayName = u?.name ?? u?.email ?? '（名前未設定）';
                const initial = displayName.trim().charAt(0).toUpperCase();
                const avatarColor = u?.avatar_color ?? 'linear-gradient(135deg, #002366, #3B5FD9)';
                const joinedAt = new Date(a.created_at).toLocaleDateString('ja-JP', {
                  year: 'numeric', month: 'long', day: 'numeric',
                });

                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-lg"
                  >
                    {/* アバター */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: avatarColor }}
                    >
                      {initial}
                    </div>

                    {/* 名前・メール */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{displayName}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {u?.email && <span>{u.email} · </span>}
                        {a.role_title ?? a.permission} · {joinedAt} 参加
                      </div>
                    </div>

                    {/* 権限バッジ */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      a.permission === 'admin'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {a.permission}
                    </span>

                    {/* kick ボタン */}
                    <button
                      type="button"
                      onClick={() => setKickTarget(a)}
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors flex-shrink-0"
                    >
                      kick
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDone={() => setToast(null)}
        />
      )}

      {/* ── Kick 確認ダイアログ ───────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={kickTarget !== null}
        title="採用担当者を強制削除"
        message={(() => {
          const ku = kickTarget ? (Array.isArray(kickTarget.user) ? (kickTarget.user[0] ?? null) : kickTarget.user) : null;
          const kname = ku?.name ?? ku?.email ?? 'このユーザー';
          return `${kname} の /biz/ アクセス権を削除します。元に戻すには再度招待が必要です。`;
        })()}
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={isKicking}
        onConfirm={handleKickConfirm}
        onCancel={() => setKickTarget(null)}
      />

      {/* sticky button の余白 */}
      <div className="h-20" />
    </div>
  );
}

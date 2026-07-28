import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { CompanyDetailClient } from './CompanyDetailClient';
import { getAllToolMasters, getCompanyToolsForAdmin } from './toolActions';

// admin layout.tsx で認可チェック済み（isAdmin + redirect）のため再チェック不要

type Props = {
  params: { id: string };
};

export const dynamic = 'force-dynamic';

export default async function AdminCompanyDetailPage({ params }: Props) {
  const supabase = createAdminClient(); // service_role で RLS バイパス

  // 企業データ取得
  const { data: company, error } = await supabase
    .from('ow_companies')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !company) {
    notFound();
  }

  // アクティブなジャンル一覧
  const { data: genres } = await supabase
    .from('ow_genres')
    .select('id, slug, name, description, display_order')
    .eq('is_active', true)
    .order('display_order');

  // この企業に紐付け済みのジャンル（承認済み・未承認問わず全件）
  const { data: companyGenres } = await supabase
    .from('ow_company_genres')
    .select('genre_id, is_human_approved, is_ai_suggested')
    .eq('company_id', params.id);

  // この企業の採用担当アカウント一覧（アクセス管理タブ用）
  const { data: admins } = await supabase
    .from('ow_company_admins')
    .select('id, user_id, permission, role_title, is_active, created_at, user:ow_users!user_id (id, name, email, avatar_color)')
    .eq('company_id', params.id)
    .eq('is_active', true)
    .not('user_id', 'is', null)
    .order('created_at');

  // ツール・技術スタックタブ用
  const [allToolMasters, companyTools] = await Promise.all([
    getAllToolMasters(),
    getCompanyToolsForAdmin(params.id),
  ]);

  return (
    <CompanyDetailClient
      company={company}
      allGenres={genres ?? []}
      companyGenres={companyGenres ?? []}
      admins={admins ?? []}
      allToolMasters={allToolMasters}
      companyTools={companyTools}
    />
  );
}

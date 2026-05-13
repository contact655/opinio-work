import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { CompanyDetailClient } from './CompanyDetailClient';

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

  return (
    <CompanyDetailClient
      company={company}
      allGenres={genres ?? []}
      companyGenres={companyGenres ?? []}
    />
  );
}

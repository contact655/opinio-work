import { CompanyWithdrawPanel } from "./CompanyWithdrawPanel";
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { CompanyDetailClient } from './CompanyDetailClient';
import { getAllToolMasters, getCompanyToolsForAdmin } from './toolActions';
import { loadClassificationMasters, loadCompanyClassification } from '@/lib/companies/classificationMasters';
import { stageCandidateFromEmployees } from '@/lib/companies/classification';
import { loadAiFillData } from '@/lib/admin/aiFill/load';

// admin layout.tsx で認可チェック済み（isAdmin + redirect）のため再チェック不要

type Props = {
  params: { id: string };
  /** ⚠️ `?tab=` は充填状況一覧（/admin/companies/coverage）から直接該当タブへ飛ぶために要る。
   *  クライアント側の useState だけだと外部からリンクできない（2026-08-11 追加）。 */
  searchParams: { tab?: string };
};

export const dynamic = 'force-dynamic';

export default async function AdminCompanyDetailPage({ params, searchParams }: Props) {
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

  /* ★分類の4つの質問（2026-10-12）。選択肢は入力用（出す前の新しい行と、この会社が追加した確認待ちの事業を含む）。
     ⚠️ 旧「事業領域」「対象業界」タブは外した（同じ値を2か所で編集させない） */
  const [masters, current] = await Promise.all([
    loadClassificationMasters(params.id),
    loadCompanyClassification(params.id),
  ]);
  if (!current) notFound();

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
  const [allToolMasters, companyTools, aiFill] = await Promise.all([
    getAllToolMasters(),
    getCompanyToolsForAdmin(params.id),
    loadAiFillData(params.id),
  ]);

  return (
    <>
    {/* ★企業の退会の操作（2026-10-10 / 段5）。30日後に社内メモと社内の状態を消す */}
    <CompanyWithdrawPanel companyId={company.id} withdrawnAt={(company.withdrawn_at as string | null) ?? null} />
    <CompanyDetailClient
      initialTab={searchParams.tab}
      company={company}
      masters={masters}
      initialClassification={current.value}
      stageCandidate={stageCandidateFromEmployees(current.employeeCount)}
      allGenres={genres ?? []}
      companyGenres={companyGenres ?? []}
      admins={admins ?? []}
      allToolMasters={allToolMasters}
      companyTools={companyTools}
      aiFill={aiFill}
    />
    </>
  );
}

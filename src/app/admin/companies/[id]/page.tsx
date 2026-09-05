import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { CompanyDetailClient } from './CompanyDetailClient';
import { getAllToolMasters, getCompanyToolsForAdmin } from './toolActions';
import { fetchBusinessDomainOptions } from '@/lib/companies/businessDomains';

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

  /* 業種マスタ（ow_industries）。
     ⚠️ `is_active` で絞らない。運営が無効化した業種に紐づいている企業を開いたとき、
        セレクトに現在値が出ず、保存すると業種が消えたように見えるため。
        無効な行はセレクト側で「（無効）」と示す。 */
  const { data: industries } = await supabase
    .from('ow_industries')
    /* ★`parent_id` を取る（2026-09-05 に2階層化）。`display_order` は
       **親ごとの相対順**なので、これが無いと並びが壊れる。 */
    .select('id, name, slug, display_order, is_active, requires_business_domain, parent_id')
    .order('display_order');

  /* 事業領域（複数・主が1つ）。⚠️ 選択肢はマスタから。コードに書かない */
  const businessDomains = await fetchBusinessDomainOptions(supabase, 'admin/companies/[id]');

  const { data: companyDomains, error: domainsError } = await supabase
    .from('ow_company_business_domains')
    .select('domain_id, is_primary')
    .eq('company_id', params.id)
    .order('display_order');
  // ⚠️ error を握りつぶさない。0件と取得失敗を同じ「未設定」に見せない
  if (domainsError) {
    console.error('[admin/companies/[id]] 事業領域の取得に失敗:', domainsError.message);
  }

  /* 対象業界（軸2 = 誰に売っているか）。⚠️ 軸1（事業領域）とは別物。
     ⚠️ 語彙は上の `industries`（ow_industries）を業種と共有している。
        選択肢を別に引かないこと（粒度が割れると突合が繋がらない）。 */
  const { data: companyTargets, error: targetsError } = await supabase
    .from('ow_company_target_industries')
    .select('industry_id, is_primary')
    .eq('company_id', params.id)
    .order('display_order');
  // ⚠️ error を握りつぶさない。0件と取得失敗を同じ「未設定」に見せない
  if (targetsError) {
    console.error('[admin/companies/[id]] 対象業界の取得に失敗:', targetsError.message);
  }

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
      initialTab={searchParams.tab}
      company={company}
      allIndustries={industries ?? []}
      allBusinessDomains={businessDomains}
      companyBusinessDomains={companyDomains ?? []}
      companyTargetIndustries={companyTargets ?? []}
      allGenres={genres ?? []}
      companyGenres={companyGenres ?? []}
      admins={admins ?? []}
      allToolMasters={allToolMasters}
      companyTools={companyTools}
    />
  );
}

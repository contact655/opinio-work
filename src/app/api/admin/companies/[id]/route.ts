import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/auth/isAdmin';

// PUT /api/admin/companies/[id] — 企業情報全フィールド更新
// service_role を使用（ow_companies の UPDATE RLS は owner only のため）
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 認可チェック
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ホワイトリスト：更新を許可するカラムのみ抽出
  const allowedFields = [
    // 既存フィールド
    'name',
    'description',
    'industry',
    'funding_stage',
    'employee_count',
    'accepting_casual_meetings',
    'remote_work_status',
    'logo_url',
    'is_published',
    'status',
    // 基本情報追加フィールド
    'mission',
    'tagline',
    'why_join',
    'culture_description',
    'founded_year',
    'url',
    'ceo_name',
    'headquarters_address',
    'nearest_station',
    // 採用担当者フィールド
    'recruiter_name',
    'recruiter_role',
    'recruiter_message',
    'recruiter_avatar_url',
    'casual_interview_url',
    // Opinio独自フィールド
    'opinio_comment',
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  // service_role で RLS バイパス
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ow_companies')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('[PUT /api/admin/companies/[id]]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ company: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/auth/isAdmin';
import { createClient } from '@/lib/supabase/server';

// POST /api/admin/companies/[id]/genres — ジャンル紐付け追加
// service_role を使用（ow_company_genres に INSERT/DELETE ポリシーなし）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let genre_ids: string[];
  try {
    const body = await request.json();
    genre_ids = body.genre_ids;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(genre_ids) || genre_ids.length === 0) {
    return NextResponse.json({ error: 'genre_ids is required' }, { status: 400 });
  }
  if (genre_ids.length > 50) {
    return NextResponse.json({ error: 'Too many genre_ids (max 50)' }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!genre_ids.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
    return NextResponse.json({ error: 'Invalid genre_id format' }, { status: 400 });
  }

  // 承認者（admin）の ow_users.id を取得
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const { data: owUser } = await authClient
    .from('ow_users')
    .select('id')
    .eq('auth_id', user?.id ?? '')
    .maybeSingle();

  const rows = genre_ids.map((genre_id: string) => ({
    company_id: params.id,
    genre_id,
    is_human_approved: true,
    approved_by: owUser?.id ?? null,
    approved_at: new Date().toISOString(),
  }));

  // service_role で upsert（既存レコードは is_human_approved を true に更新）
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ow_company_genres')
    .upsert(rows, { onConflict: 'company_id,genre_id' });

  if (error) {
    console.error('[POST /api/admin/companies/[id]/genres]', error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, added: genre_ids.length });
}

// DELETE /api/admin/companies/[id]/genres — ジャンル紐付け削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminOk = await isAdmin();
  if (!adminOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let genre_ids: string[];
  try {
    const body = await request.json();
    genre_ids = body.genre_ids;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(genre_ids) || genre_ids.length === 0) {
    return NextResponse.json({ error: 'genre_ids is required' }, { status: 400 });
  }
  if (genre_ids.length > 50) {
    return NextResponse.json({ error: 'Too many genre_ids (max 50)' }, { status: 400 });
  }
  const UUID_RE_DEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!genre_ids.every((id: unknown) => typeof id === 'string' && UUID_RE_DEL.test(id))) {
    return NextResponse.json({ error: 'Invalid genre_id format' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ow_company_genres')
    .delete()
    .eq('company_id', params.id)
    .in('genre_id', genre_ids);

  if (error) {
    console.error('[DELETE /api/admin/companies/[id]/genres]', error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, removed: genre_ids.length });
}

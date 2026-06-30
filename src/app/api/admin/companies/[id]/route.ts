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

  const FIELD_LIMITS: Record<string, number> = {
    name: 200, tagline: 300, mission: 1000, description: 5000,
    why_join: 3000, culture_description: 3000, location: 200, industry: 100, phase: 100,
    url: 2048, ceo_name: 200, headquarters_address: 300, nearest_station: 200,
    recruiter_name: 200, recruiter_role: 200, recruiter_message: 2000,
    opinio_comment: 3000, funding_stage: 100,
    logo_url: 2048, recruiter_avatar_url: 2048, casual_interview_url: 2048,
  };
  // URL フィールド: https:// のみ許可
  const URL_FIELDS = new Set(["url", "logo_url", "recruiter_avatar_url", "casual_interview_url"]);

  const ENUM_FIELDS: Record<string, Set<string>> = {
    status: new Set(["active", "inactive", "pending", "suspended"]),
    remote_work_status: new Set(["remote", "hybrid", "on_site", "flexible"]),
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowedFields) {
    if (key in body) {
      const val = body[key];
      if (ENUM_FIELDS[key]) {
        if (typeof val === "string" && ENUM_FIELDS[key].has(val)) {
          updates[key] = val;
        }
        // skip invalid enum values
      } else if (typeof val === "string" && FIELD_LIMITS[key]) {
        const sliced = val.slice(0, FIELD_LIMITS[key]);
        if (URL_FIELDS.has(key) && sliced && !/^https:\/\//i.test(sliced)) {
          // skip invalid URL
        } else {
          updates[key] = sliced;
        }
      } else {
        updates[key] = val;
      }
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ company: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publishedAtPatch } from '@/lib/companies/publishedAt';
import { buildCompanyJoinedRow } from '@/lib/feed/systemPosts';
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

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
    // ⚠️ 'status' は受け付けない（2026-08-05 に削除）。
    //    ow_companies.status は is_approved / is_published と無関係で、掲載の可否を
    //    何もゲートしていない。唯一の編集UI（企業詳細の公開設定タブ）を撤去したので、
    //    ここも閉じて書き込み経路を無くした。承認は is_approved（企業審査の一覧）。
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
    remote_work_status: new Set(["full_remote", "hybrid", "on_site", "other"]),
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
        /* ⚠️ 黙って捨てているところにログを出す（挙動は変えない）。
              切り詰めも URL の除外も、運営には成功に見えるので気づけない。 */
        if (val.length > FIELD_LIMITS[key]) {
          console.warn(`[admin/companies] ${key} を ${val.length} → ${FIELD_LIMITS[key]} 字に切り詰めました`);
        }
        if (URL_FIELDS.has(key) && sliced && !/^https:\/\//i.test(sliced)) {
          console.warn(`[admin/companies] ${key} は https:// で始まらないため保存しませんでした`);
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

  /* ⚠️ published_at の規則は lib/companies/publishedAt.ts に集約している。
        ここに条件を書き写さないこと（is_published を true にできる経路は3つある）。 */
  const nowIso = new Date().toISOString();
  /** 公開に切り替える操作か。フィード投稿（company_joined）の作成条件にも使う */
  const turningPublic = updates.is_published === true;
  if ('is_published' in updates) {
    const { data: cur } = await supabase
      .from('ow_companies').select('published_at').eq('id', params.id).maybeSingle();
    Object.assign(updates, publishedAtPatch(cur?.published_at, updates.is_published === true, nowIso));
  }

  const { data, error } = await supabase
    .from('ow_companies')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('[PUT /api/admin/companies/[id]]', error.message);
    // 未承認のまま公開しようとした場合はここに来る（check_published_requires_approval）
    if (error.code === '23514' && error.message.includes('check_published_requires_approval')) {
      return NextResponse.json(
        { error: '運営の承認が済んでいないため掲載できません。企業審査の一覧で「承認する」を押してください。' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /*
    Feed: company_joined（公開時のみ、best-effort）
    ⚠️ 2026-08-05 まで PATCH /api/biz/company の1箇所にしか無く、
       admin から公開してもフィードに何も出なかった。
    ⚠️ 本文と ref_* の埋め方は lib/feed/systemPosts に集約している。ここで組み立てない。
    ⚠️ 部分UNIQUEインデックス（idx_ow_posts_unique_company）があるので、
       非掲載に戻して再度公開しても投稿は作り直されない。23505 は「既にある」ので無視する。
       つまり本文は最初に公開した瞬間の brand_name / tagline で固定される。
  */
  if (turningPublic && data) {
    try {
      const { error: feedErr } = await supabase.from('ow_posts').insert(
        buildCompanyJoinedRow(params.id, data as { name?: string | null; brand_name?: string | null; tagline?: string | null }),
      );
      if (feedErr && feedErr.code !== '23505') console.error('[feed company_joined]', feedErr.message);
    } catch (feedErr) {
      console.error('[feed company_joined]', feedErr);
    }
  }

  return NextResponse.json({ company: data });
}

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from '@/lib/supabase/admin';
import { publishedAtPatch } from '@/lib/companies/publishedAt';
import { buildCompanyJoinedRow } from '@/lib/feed/systemPosts';
import { isAdmin } from '@/lib/auth/isAdmin';
import { checkPublishable, publishBlockedMessage } from '@/lib/companies/publishable';

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
    /* ⚠️ 業種は **`industry_id`（ow_industries への FK）**。下で「マスタに存在する id か」を検証する。
          ⚠️ **`industry`(text) はここに戻さないこと**（2026-08-25 に外した）。
             検証が長さ100字だけだったため、マスタに無い綴りを運営が保存でき、
             その企業が業種フィルタから静かに消えていた。
             求職者側の表示は当面 `industry`(text) を読むが、書き込み経路はこれで閉じる。 */
    'industry_id',
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
    /* ブランド名。⚠️ **公開側の表示名に効く。** 新規作成時は社名から法人格を
       落とした値が既定で入るので、「HPE」のような例外だけ運営がここで直す。 */
    'brand_name',
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
    name: 200, brand_name: 100, tagline: 300, mission: 1000, description: 5000,
    // ⚠️ `industry: 100` は 2026-08-25 に削除。長さでは分類の正しさを守れない（下の存在検証に置き換えた）
    why_join: 3000, culture_description: 3000, location: 200, phase: 100,
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

  /* ── 業種はマスタに存在する id だけを受ける（2026-08-25）──────────────────
     ⚠️ 不正値を黙って捨てたり既定値に落としたりしない。**400 で弾く**
        （CLAUDE.md「選択肢が決まっている値は UI / API / DB の3つを揃える」）。
     ⚠️ 空文字も弾く。業種を消せてしまうと、この列を運用の軸にしている意味が無くなる。 */
  if ('industry_id' in updates) {
    const v = updates.industry_id;
    if (typeof v !== 'string' || !UUID_RE.test(v)) {
      return NextResponse.json({ error: '業種を選択してください。' }, { status: 400 });
    }
    const { data: industry, error: industryErr } = await supabase
      .from('ow_industries')
      .select('id')
      .eq('id', v)
      .maybeSingle();
    // ⚠️ error を握りつぶさない。捨てると「マスタに無い」と区別が付かなくなる
    if (industryErr) {
      console.error('[PUT /api/admin/companies/[id]] industry lookup:', industryErr.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    if (!industry) {
      return NextResponse.json(
        { error: '選択された業種は業種マスタに存在しません。画面を再読み込みしてください。' },
        { status: 400 },
      );
    }
  }

  /* ⚠️ published_at の規則は lib/companies/publishedAt.ts に集約している。
        ここに条件を書き写さないこと（is_published を true にできる経路は3つある）。 */
  /* ⚠️ 公開ゲート。条件はここに書かず `checkPublishable` を呼ぶ（公開に触れる経路は
        4つあり、書き写すと必ず漏れる）。運営経路なので掲載規約の同意は求めない。
     ⚠️ 取り下げは常に通す。塞ぐのは「見えるようにする一手」だけ。
     ⚠️ **更新を当てる前に見る。** 当てたあとだと、弾いても値は書き換わっている。 */
  if (updates.is_published === true || updates.listing_status === 'listed') {
    const gate = await checkPublishable(params.id, { kind: 'admin' });
    if (!gate.ok) {
      return NextResponse.json({ error: publishBlockedMessage(gate.missing) }, { status: 400 });
    }
  }

  const nowIso = new Date().toISOString();
  /** ディレクトリに載せる操作か。フィード投稿（company_joined）の作成条件。
      ⚠️ 2026-08-13 に is_published から listing_status に移した。
         ページの存在は既定になったので、お知らせは掲載に対して出す。 */
  const turningListed = updates.listing_status === 'listed';
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
    /* 未承認のまま**一覧掲載**しようとした場合はここに来る。
       ⚠️ 2026-08-13 に承認の掛け先をページ公開から一覧掲載へ移したので、
          制約名も check_listed_requires_approval に変わっている。 */
    if (error.code === '23514' && error.message.includes('check_listed_requires_approval')) {
      return NextResponse.json(
        { error: '運営の承認が済んでいないため一覧に掲載できません。企業審査の一覧で「承認する」を押してください。' },
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
  if (turningListed && data) {
    try {
      const { error: feedErr } = await supabase.from('ow_posts').insert(
        buildCompanyJoinedRow(params.id, data as { name?: string | null; brand_name?: string | null; tagline?: string | null }),
      );
      if (feedErr && feedErr.code !== '23505') console.error('[feed company_joined]', feedErr.message);
    } catch (feedErr) {
      console.error('[feed company_joined]', feedErr);
    }
  }

  /* ★キャッシュを捨てる（2026-09-04 追加）。事業領域・対象業界のルートと同じ理由。
     ⚠️★これが無いと、運営が企業情報を直しても `/companies` の絞り込みが古いまま。
        `?industry=` の結果は `createPublicClient` の fetch キャッシュに載っており、
        あのクライアントは**意図して `no-store` にしていない**。
     ⚠️ **migration でデータを変えた場合はここを通らない**（sitemap と同じ穴）。 */
  revalidatePath("/companies");
  revalidateTag("business-domains");

  return NextResponse.json({ company: data });
}

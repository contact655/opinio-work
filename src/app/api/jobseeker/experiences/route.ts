import { createClient } from "@/lib/supabase/server";
import { EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { parseReasonFields } from "@/lib/constants/careerReasons";
import { EXPERIENCE_EDITOR_COLS } from "@/lib/experiences/columns";
import { normalizeYm, isBlankYm as isBlank } from "@/lib/utils/ym";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_ROLES_PER_EXPERIENCE } from "@/lib/constants/experienceRoles";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOwUserId(
  supabase: ReturnType<typeof createClient>,
  authUid: string
): Promise<string | null> {
  const { data } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  return data?.id ?? null;
}

// GET /api/jobseeker/experiences — 自分の職歴一覧を返す
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ experiences: [] });

  /* ⚠️ join_reason を含むので admin で引く。2026-08-06 に authenticated から
        権限を剥がしており、session だとクエリごと 403 になって一覧が空になる。
        対象は owUserId に固定（本人の行のみ）。 */
  const { data: rows, error: rowsErr } = await createAdminClient()
    .from("ow_experiences")
    /* ⚠️ 年収4列（salary_base / salary_bonus / salary_stock / salary_man）は SELECT しない。
          2026-08-06 に authenticated から SELECT 権限を剥奪したので、含めると
          permission denied で職歴一覧が丸ごと空になる。入力UIも既に無い。 */
    /* ⚠️ 列リストは lib/experiences/columns.ts の1箇所に置く。ここに直書きしない。
          mypage/page.tsx と**同じ定数**を見る（2026-08-16 に移設）。割れると
          「片方の経路では保存できるがもう片方では消える」が起きる。
       ⚠️ 理由データ3種（join_reasons / join_reason_primary / leave_reasons）も
          admin でないと読めない。列単位 GRANT を付けていないため
          （20260811184225）。session クライアントで select すると 403 になる。 */
    .select(EXPERIENCE_EDITOR_COLS)
    .eq("user_id", owUserId)
    .order("is_current", { ascending: false })
    .order("started_at", { ascending: false });

  if (rowsErr) {
    console.error("[GET /api/jobseeker/experiences]", rowsErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  /* 入社前後のギャップ（別テーブル）。本人の経歴ぶんだけまとめて引く。
     ⚠️ 非公開データ。この API は本人のセッションでしか呼べず、
        owUserId の行に固定しているので他人のものは混ざらない。 */
  const gapsByExperience = new Map<string, { axis: string; rating: string }[]>();
  const experienceIds = (rows ?? []).map((r) => r.id as string);
  if (experienceIds.length > 0) {
    const { data: gapRows, error: gapErr } = await createAdminClient()
      .from("ow_experience_gaps")
      .select("experience_id, axis, rating")
      .in("experience_id", experienceIds);
    if (gapErr) {
      console.error("[GET /api/jobseeker/experiences gaps]", gapErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    for (const g of gapRows ?? []) {
      const key = g.experience_id as string;
      if (!gapsByExperience.has(key)) gapsByExperience.set(key, []);
      gapsByExperience.get(key)!.push({ axis: g.axis as string, rating: g.rating as string });
    }
  }

  /* 複数職種（`ow_experience_roles`）。
     ⚠️ **主職種しか持たない経歴では行が無い**（1件のときは書かない仕様）。
        その場合は `role_category_id` だけを返す。 */
  const rolesByExperience = new Map<string, string[]>();
  if (experienceIds.length > 0) {
    const { data: roleRows, error: roleErr } = await createAdminClient()
      .from("ow_experience_roles")
      .select("experience_id, role_id, is_primary")
      .in("experience_id", experienceIds)
      .order("is_primary", { ascending: false });
    if (roleErr) {
      console.error("[GET /api/jobseeker/experiences roles]", roleErr.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    for (const r of roleRows ?? []) {
      const key = r.experience_id as string;
      if (!rolesByExperience.has(key)) rolesByExperience.set(key, []);
      rolesByExperience.get(key)!.push(r.role_id as string);
    }
  }

  // Resolve company names for master entries
  const companyIds = (rows ?? [])
    .filter((r) => r.company_id)
    .map((r) => r.company_id as string);
  const companyNameMap = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("ow_companies")
      .select("id, name")
      .in("id", companyIds);
    for (const c of companies ?? []) {
      companyNameMap.set(c.id as string, c.name as string);
    }
  }

  const experiences = (rows ?? []).map((r) => {
    let companyType: "master" | "custom" | "anon";
    let displayCompanyName: string;
    if (r.company_id) {
      companyType = "master";
      displayCompanyName = companyNameMap.get(r.company_id as string) ?? "不明な企業";
    } else if (r.company_text) {
      companyType = "custom";
      displayCompanyName = r.company_text as string;
    } else {
      companyType = "anon";
      displayCompanyName = (r.company_anonymized as string) ?? "非公開企業";
    }

    const roleUuid = r.role_category_id as string;
    return {
      id: r.id as string,
      companyType,
      companyId: r.company_id as string | undefined || undefined,
      companyText: r.company_text as string | undefined || undefined,
      companyAnonymized: r.company_anonymized as string | undefined || undefined,
      displayCompanyName,
      roleCategoryId: roleUuid,
      /* ⚠️ 主職種を**必ず先頭に混ぜる**。行が無い経歴でも配列を返し、
            junction が主職種と違う値だけを持つ経歴でも主職種を落とさない。 */
      roleCategoryIds: Array.from(new Set([roleUuid, ...(rolesByExperience.get(r.id as string) ?? [])])),
      roleTitle: r.role_title as string | undefined || undefined,
      department: (r.department as string | null) ?? undefined,
      rank: (r.rank as string | null) ?? null,
      /* 年収は返さない（SELECT していない）。入力UIも権限も無い */
      startedAt: (r.started_at as string).slice(0, 7),
      endedAt: r.ended_at ? (r.ended_at as string).slice(0, 7) : undefined,
      isCurrent: r.is_current as boolean,
      description: r.description as string | undefined || undefined,
      joinReason: r.join_reason as string | undefined || undefined,
      employmentType: r.employment_type as string | undefined || undefined,
      displayOrder: (r.display_order as number) ?? 0,
      visibilityCompany: (r.visibility_company as "real" | "masked" | "hidden" | undefined) ?? "real",
      visibilityCompanyProfile: (r.visibility_company_profile as "real" | "masked" | "hidden" | undefined) ?? "real",
      visibilitySalary: (r.visibility_salary as boolean | undefined) ?? false,
      visibilityReason: (r.visibility_reason as boolean | undefined) ?? true,
      // ── 勤務地（表示する）
      prefecture: (r.prefecture as string | null) ?? null,
      remoteWorkStatus: (r.remote_work_status as string | null) ?? null,
      /* ── 理由データ（**非公開**。この API は本人専用なので返してよい）
            ⚠️ 公開向けのクエリ・型には絶対に含めないこと。
               /u/[id] /people 企業詳細 スカウト /biz/candidates のどこにも出さない。 */
      joinReasons: (r.join_reasons as string[] | null) ?? [],
      joinReasonPrimary: (r.join_reason_primary as string | null) ?? null,
      leaveReasons: (r.leave_reasons as string[] | null) ?? [],
      gaps: gapsByExperience.get(r.id as string) ?? [],
    };
  });

  return NextResponse.json({ experiences });
}

// POST /api/jobseeker/experiences — 職歴追加
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(supabase, user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const VALID_VISIBILITY = new Set(["real", "masked", "hidden"]);
  /* ⚠️ 許容値は src/lib/constants/careerOptions.ts の1箇所に置く。
        ここに Set を直書きすると UI の選択肢とずれる（2026-07-01 に実際にずれ、
        「派遣社員」「アルバイト・パート」が黙って null に落ちていた）。 */
  const VALID_EMPLOYMENT = new Set<string>(EMPLOYMENT_TYPES);
  const hasCompanyId = !!body.company_id;
  const hasCompanyText = !!body.company_text;
  const hasCompanyAnon = !!body.company_anonymized;
  if ([hasCompanyId, hasCompanyText, hasCompanyAnon].filter(Boolean).length !== 1) {
    return NextResponse.json(
      { error: "Exactly one of company_id / company_text / company_anonymized required" },
      { status: 400 }
    );
  }

  if (!body.role_category_id || !body.started_at) {
    return NextResponse.json({ error: "role_category_id and started_at required" }, { status: 400 });
  }

  const roleId = UUID_RE.test(body.role_category_id as string) ? (body.role_category_id as string) : null;
  if (!roleId) {
    return NextResponse.json({ error: "Invalid role_category_id" }, { status: 400 });
  }

  /* 複数職種（任意）。
     ⚠️ `ow_experiences.role_category_id` は1つしか持てないので、**先頭を主職種**として
        そこに入れ、全部を `ow_experience_roles` に書く。列を増やさないのは、
        既存の表示・マッチングが `role_category_id` を前提にしているため
        （読み側を全部直すまでは、主職種だけでも従来どおり動く必要がある）。
     ⚠️ 不正な UUID は 400。黙って捨てない。 */
  const extraRoleIds = Array.isArray(body.role_category_ids)
    ? (body.role_category_ids as unknown[]).map(String)
    : [];
  if (extraRoleIds.some((r) => !UUID_RE.test(r))) {
    return NextResponse.json({ error: "Invalid role_category_ids" }, { status: 400 });
  }
  /* 主職種を必ず先頭に置いて重複を除く。上限5件（入口で選ばせすぎない）。 */
  const allRoleIds = Array.from(new Set([roleId, ...extraRoleIds])).slice(0, MAX_ROLES_PER_EXPERIENCE);

  const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!DATE_RE.test(body.started_at as string)) {
    return NextResponse.json({ error: "started_at は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (body.ended_at && !DATE_RE.test(body.ended_at as string)) {
    return NextResponse.json({ error: "ended_at は YYYY-MM 形式で入力してください" }, { status: 400 });
  }
  if (hasCompanyId && !UUID_RE.test(body.company_id as string)) {
    return NextResponse.json({ error: "Invalid company_id" }, { status: 400 });
  }

  const companyText = hasCompanyText ? String(body.company_text).slice(0, 200) : null;
  const companyAnon = hasCompanyAnon ? String(body.company_anonymized).slice(0, 200) : null;
  const roleTitle  = typeof body.role_title  === "string" ? body.role_title.slice(0, 100)  : null;
  const department = typeof body.department  === "string" ? body.department.slice(0, 100)  : null;
  const description = typeof body.description === "string" ? body.description.slice(0, 5000) : null;
  /* ⚠️ 300字。UI（CareerHistoryEditor）と PUT と**同じ値**にしてある（2026-08-20）。
        以前は UI 300 / PUT 2000 / POST 5000 と3つとも違った。 */
  const joinReason  = typeof body.join_reason  === "string" ? body.join_reason.slice(0, 300)   : null;

  /* ⚠️ 年月は正規化してから入れる。以前は無検証で `-01` を足しており、
        形式が違うと date のパースエラーで 500 になっていた（educations と同じ形）。 */
  /* ⚠️ 不正値は 400 で返す。黙って null や "real" に落とさない。
        特に visibility_company を既定の "real"（実名公開）に倒すのは、
        本人が選んでいない公開設定を勝手に付けることになる。 */
  if (!isBlank(body.employment_type) && !VALID_EMPLOYMENT.has(body.employment_type as string)) {
    return NextResponse.json({ error: "INVALID_EMPLOYMENT_TYPE", message: "雇用形態の値が不正です。" }, { status: 400 });
  }
  const employmentType = isBlank(body.employment_type) ? null : (body.employment_type as string);
  for (const k of ["visibility_company", "visibility_company_profile"] as const) {
    if (!isBlank(body[k]) && !VALID_VISIBILITY.has(body[k] as string)) {
      return NextResponse.json({ error: "INVALID_VISIBILITY", message: "公開設定の値が不正です。" }, { status: 400 });
    }
  }
  const visibilityCompany = isBlank(body.visibility_company) ? "real" : (body.visibility_company as string);
  const visibilityCompanyProfile = isBlank(body.visibility_company_profile) ? "real" : (body.visibility_company_profile as string);

  const startedAt = normalizeYm(body.started_at);
  const endedAt = normalizeYm(body.ended_at);
  if (startedAt === undefined || endedAt === undefined) {
    return NextResponse.json({ error: "INVALID_PERIOD", message: "在籍期間の形式が正しくありません。" }, { status: 400 });
  }
  if (!startedAt) {
    return NextResponse.json({ error: "started_at required" }, { status: 400 });
  }

  /* ⚠️ 勤務地・理由データの検証は POST / PATCH で**同じ関数**を使う。
        片方にだけ書くと「作成時は保存されるが更新すると消える」が起きる。
     ⚠️ 勤務地は API では必須にしない。オンボーディングが勤務地なしで
        is_current=true の行を作るため。必須は CareerHistoryEditor の UI 層だけ。 */
  const reasons = parseReasonFields(body);
  if (!reasons.ok) {
    return NextResponse.json({ error: reasons.error, message: reasons.message }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("ow_experiences")
    .insert({
      user_id: owUserId,
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: companyText,
      company_anonymized: companyAnon,
      role_category_id: roleId,
      role_title: roleTitle,
      department,
      rank: typeof body.rank === "string" ? body.rank.slice(0, 50) : null,
      started_at: startedAt,
      ended_at: endedAt,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description,
      join_reason: joinReason,
      employment_type: employmentType,
      display_order: (body.display_order as number | undefined) ?? 0,
      /* ⚠️ 年収は新規作成時も書かない。入力UIが無いので常に null になるが、
            「送られてきたら書く」形を残すと、権限を剥奪した意図と食い違う */
      visibility_company: visibilityCompany,
      visibility_company_profile: visibilityCompanyProfile,
      visibility_salary: (body.visibility_salary as boolean | undefined) ?? false,
      visibility_reason: (body.visibility_reason as boolean | undefined) ?? true,
      /* ⚠️ 理由データは authenticated がテーブルレベルの INSERT を持つので
            セッションクライアントのまま書ける。SELECT 権限は無いが、
            .select("id") しか返さないので 403 にならない。 */
      ...reasons.patch,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/jobseeker/experiences]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const newId = inserted.id as string;

  /* 複数職種を `ow_experience_roles` に書く。
     ⚠️ **admin クライアントを使う。** このテーブルは RLS が有効で SELECT のポリシーしか無く、
        authenticated からの INSERT は 0 行で落ちる（GRANT はあるので権限エラーにもならず、
        黙って入らない形になる）。所有者の確認はこの API が上でやっている。
     ⚠️ 1件だけのときは書かない。`role_category_id` と重複するだけで、
        「複数選んだ経歴」と「1つだけの経歴」を後から見分けられなくなる。 */
  if (allRoleIds.length > 1) {
    const { error: roleErr } = await createAdminClient()
      .from("ow_experience_roles")
      .insert(allRoleIds.map((rid, i) => ({
        experience_id: newId,
        role_id: rid,
        is_primary: i === 0,
      })));
    if (roleErr) {
      console.error("[POST /api/jobseeker/experiences roles]", roleErr.message);
      return NextResponse.json(
        { error: "ROLES_SAVE_FAILED", message: "経歴は保存しましたが、職種の保存に失敗しました。", id: newId },
        { status: 500 }
      );
    }
  }

  /* 入社前後のギャップ（別テーブル）。
     ⚠️ 失敗を握り潰さない。経歴だけ作られてギャップが消える状態にしない。 */
  if (reasons.gaps && reasons.gaps.length > 0) {
    const { error: gapErr } = await supabase
      .from("ow_experience_gaps")
      .insert(reasons.gaps.map((g) => ({ experience_id: newId, axis: g.axis, rating: g.rating })));
    if (gapErr) {
      console.error("[POST /api/jobseeker/experiences gaps]", gapErr.message);
      return NextResponse.json(
        { error: "GAPS_SAVE_FAILED", message: "経歴は保存しましたが、入社前後のギャップの保存に失敗しました。", id: newId },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id: newId }, { status: 201 });
}

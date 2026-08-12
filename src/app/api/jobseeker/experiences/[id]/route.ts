import { createClient } from "@/lib/supabase/server";
import { EMPLOYMENT_TYPES } from "@/lib/constants/careerOptions";
import { parseReasonFields } from "@/lib/constants/careerReasons";
import { normalizeYm, isBlankYm as isBlank } from "@/lib/utils/ym";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /api/jobseeker/experiences/[id] — 職歴更新（RLS が本人チェック）
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const VALID_VISIBILITY = new Set(["real", "masked", "hidden"]);
  /* ⚠️ 許容値は src/lib/constants/careerOptions.ts の1箇所に置く。
        ここに Set を直書きすると UI の選択肢とずれる（2026-07-01 に実際にずれ、
        「派遣社員」「アルバイト・パート」が黙って null に落ちていた）。 */
  const VALID_EMPLOYMENT = new Set<string>(EMPLOYMENT_TYPES);
  function safeSalary(v: unknown): number | null {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100000) return null;
    return Math.floor(v);
  }

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

  // ow_users.id を解決して所有者フィルターに使う
  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  function s(v: unknown, max: number): string | null {
    return typeof v === "string" ? v.slice(0, max) || null : null;
  }

  /*
    ⚠️ 年収系（salary_base / salary_bonus / salary_stock / salary_man / visibility_salary）は
       **body にキーが来たときだけ**更新する。
       2026-08-06 に職歴の年収入力UIを外したので、クライアントはこれらを送らなくなった。
       無条件に safeSalary(undefined) を書くと null で潰れ、既存の年収が黙って消える
       （実データ3件はいずれも salary_man だけに値があり、内訳は null なので確実に消える）。
    ⚠️ 列とデータは残す方針。UI を外しただけで、保存経路が値を壊してはいけない。
  */
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

  /* ⚠️ POST と**同じ関数**で検証する。片方にだけ書かないこと。 */
  const reasons = parseReasonFields(body);
  if (!reasons.ok) {
    return NextResponse.json({ error: reasons.error, message: reasons.message }, { status: 400 });
  }

  const salaryPatch: Record<string, unknown> = {};
  for (const k of ["salary_base", "salary_bonus", "salary_stock", "salary_man"] as const) {
    if (k in body) salaryPatch[k] = safeSalary(body[k]);
  }
  if ("visibility_salary" in body) {
    salaryPatch.visibility_salary = (body.visibility_salary as boolean | undefined) ?? false;
  }

  const { data: updated, error } = await supabase
    .from("ow_experiences")
    .update({
      company_id: hasCompanyId ? (body.company_id as string) : null,
      company_text: hasCompanyText ? s(body.company_text, 200) : null,
      company_anonymized: hasCompanyAnon ? s(body.company_anonymized, 200) : null,
      role_category_id: roleId,
      role_title: s(body.role_title, 100),
      department: s(body.department, 100),
      rank: s(body.rank, 100),
      started_at: startedAt,
      ended_at: endedAt,
      is_current: (body.is_current as boolean | undefined) ?? false,
      description: s(body.description, 5000),
      join_reason: s(body.join_reason, 2000),
      employment_type: employmentType,
      visibility_company: visibilityCompany,
      visibility_company_profile: visibilityCompanyProfile,
      visibility_reason: (body.visibility_reason as boolean | undefined) ?? true,
      updated_at: new Date().toISOString(),
      ...salaryPatch,
      ...reasons.patch,
    })
    .eq("id", params.id)
    .eq("user_id", owUser.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[PUT /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* 入社前後のギャップ（別テーブル）。
     ⚠️ gaps キーが無いリクエストでは**触らない**。空配列が来たときだけ全消し。
        「送らなかった」と「全部外した」を同じ扱いにすると、
        ギャップを知らない古いクライアントが黙って全消しすることになる。
     ⚠️ 行の絞り込みは RLS（ow_experience_gaps_own_manage）。
        上の UPDATE が本人の行に当たっていることは .eq("user_id") で確認済み。 */
  if (reasons.gaps !== null) {
    const axes = reasons.gaps.map((g) => g.axis);
    const del = supabase.from("ow_experience_gaps").delete().eq("experience_id", params.id);
    const { error: delErr } = axes.length > 0
      ? await del.not("axis", "in", `(${axes.join(",")})`)
      : await del;
    if (delErr) {
      console.error("[PUT /api/jobseeker/experiences/:id gaps delete]", delErr.message);
      return NextResponse.json({ error: "GAPS_SAVE_FAILED", message: "入社前後のギャップの保存に失敗しました。" }, { status: 500 });
    }
    if (reasons.gaps.length > 0) {
      const { error: upErr } = await supabase
        .from("ow_experience_gaps")
        .upsert(
          reasons.gaps.map((g) => ({ experience_id: params.id, axis: g.axis, rating: g.rating })),
          { onConflict: "experience_id,axis" }
        );
      if (upErr) {
        console.error("[PUT /api/jobseeker/experiences/:id gaps upsert]", upErr.message);
        return NextResponse.json({ error: "GAPS_SAVE_FAILED", message: "入社前後のギャップの保存に失敗しました。" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/jobseeker/experiences/[id] — 職歴削除（RLS + 明示的な所有者チェック）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabase
    .from("ow_experiences")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUser.id);

  if (error) {
    console.error("[DELETE /api/jobseeker/experiences/:id]", error.message);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

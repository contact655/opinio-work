/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { isDesiredRoleCandidate } from "@/lib/roles/desiredRoleOptions";
import { PREFECTURES } from "@/lib/utils/location";
import { COMPANY_SIZE_GROUPS, isCompanySizeGroup } from "@/lib/constants/employeeBand";

/**
 * ★声かけを受け取る範囲の読み書き（2026-10-10 / 段2）。
 * ⚠️ 送れるかの判定はここに書かない（DB 関数 `can_send_company_approach()` の1か所）。
 * ⚠️ 引数の `owUserId` は **ow_users 空間**（`ow_approach_preferences.user_id` が ow_users を指す）。
 */

export type ApproachRange = {
  jobCategories: string[];
  industries: string[];
  sizeGroups: string[];
  prefectures: string[];
  remoteOk: boolean;
};

export const EMPTY_APPROACH_RANGE: ApproachRange = { jobCategories: [], industries: [], sizeGroups: [], prefectures: [], remoteOk: false };

export type RangeOption = { value: string; label: string; /** その選択肢だけを選んだときに送れる企業の数。取れなければ null */ count: number | null };
export type ApproachRangeOptions = {
  jobCategories: RangeOption[];
  industries: RangeOption[];
  sizeGroups: RangeOption[];
  prefectures: RangeOption[];
};

/** 項目のキー（DB の `ow_approach_range_fields.field` と同じ） */
export const APPROACH_RANGE_FIELDS = ["job_categories", "industries", "size_groups", "prefectures", "remote_ok"] as const;
export type ApproachRangeField = (typeof APPROACH_RANGE_FIELDS)[number];
export type ApproachRangeFieldFlags = Record<ApproachRangeField, boolean>;

/**
 * ★項目ごとの有効フラグ（2026-10-10 / 柴さんの指示）。**無効の項目は画面に出さず、判定にも使わない**
 * （判定側は DB 関数 `company_in_approach_range()` がこの表を見る）。
 * ⚠️ 割合で自動に切り替えない。運営が /admin/approach-range で切り替える。
 * 取得に失敗したら null（呼び出し側は節ごと出さない）。行が無い項目は無効の扱い（DB と同じ）。
 */
export async function getApproachRangeFieldFlags(): Promise<ApproachRangeFieldFlags | null> {
  const { data, error } = await createAdminClient().from("ow_approach_range_fields").select("field, enabled");
  if (error) {
    console.error("[approach-range] fields:", error.message);
    return null;
  }
  const out = Object.fromEntries(APPROACH_RANGE_FIELDS.map((f) => [f, false])) as ApproachRangeFieldFlags;
  for (const r of data ?? []) if ((APPROACH_RANGE_FIELDS as readonly string[]).includes(r.field as string)) out[r.field as ApproachRangeField] = r.enabled === true;
  return out;
}

export type ApproachRangeFieldCoverage = { field: ApproachRangeField; enabled: boolean; withClue: number; total: number };

/** 項目ごとの割合（公開中・検証用を除く企業のうち、その項目の手がかりを持つ企業）。失敗したら null */
export async function getApproachRangeFieldCoverage(): Promise<ApproachRangeFieldCoverage[] | null> {
  const { data, error } = await createAdminClient().rpc("approach_range_field_coverage");
  if (error) {
    console.error("[approach-range] coverage:", error.message);
    return null;
  }
  return (data ?? []).map((r: { field: string; enabled: boolean; with_clue: number; total: number }) => ({
    field: r.field as ApproachRangeField, enabled: r.enabled, withClue: r.with_clue, total: r.total,
  }));
}

/**
 * 選べる値（すべての項目ぶん。出すかどうかは呼び出し側がフラグで決める）。
 * ⚠️ 職種は IT/SaaS の大分類だけ（希望職種と同じ母集合。大分類を選ぶと配下の職種にも合う）、
 *    業種は大分類だけ（大分類を選ぶと配下の業種にも合う）。どちらも DB 関数が親子を両方向に見る。
 * ★`owUserId` を渡すと、有効な項目の選択肢ごとに「その選択肢だけを選んだとき送れる企業の数」を付ける
 *   （`approach_range_option_counts()`。判定と同じ関数で数える。受け取らない企業は除く）。
 * 取得に失敗したら null。
 */
export async function getApproachRangeOptions(owUserId?: string, flags?: ApproachRangeFieldFlags | null): Promise<ApproachRangeOptions | null> {
  const db = createAdminClient();
  const [{ data: roles, error: rErr }, { data: inds, error: iErr }] = await Promise.all([
    db.from("ow_roles").select("id, name, parent_id, is_active, is_it_saas, display_order").is("parent_id", null).order("display_order"),
    db.from("ow_industries").select("id, name, parent_id, is_active, display_order").is("parent_id", null).eq("is_active", true).order("display_order"),
  ]);
  if (rErr || iErr) {
    console.error("[approach-range] options:", rErr?.message ?? iErr?.message);
    return null;
  }
  const base: ApproachRangeOptions = {
    jobCategories: (roles ?? []).filter((r) => isDesiredRoleCandidate(r as { is_active: boolean; is_it_saas: boolean | null }))
      .map((r) => ({ value: r.id as string, label: r.name as string, count: null as number | null })),
    industries: (inds ?? []).map((r) => ({ value: r.id as string, label: r.name as string, count: null as number | null })),
    sizeGroups: COMPANY_SIZE_GROUPS.map((g) => ({ value: g.value as string, label: g.label as string, count: null as number | null })),
    prefectures: PREFECTURES.map((p) => ({ value: p as string, label: p as string, count: null as number | null })),
  };
  if (!owUserId || !flags) return base;

  const targets: [keyof ApproachRangeOptions, ApproachRangeField][] = [
    ["jobCategories", "job_categories"], ["industries", "industries"], ["sizeGroups", "size_groups"], ["prefectures", "prefectures"],
  ];
  await Promise.all(targets.filter(([, f]) => flags[f]).map(async ([key, field]) => {
    const { data, error } = await db.rpc("approach_range_option_counts", {
      p_ow_user_id: owUserId, p_field: field, p_values: base[key].map((o) => o.value),
    });
    if (error) {
      console.error("[approach-range] option counts:", field, error.message);
      return; // ⚠️ 取れなければ null のまま（画面は社数を出さず、選択肢は消さない）
    }
    const byValue = new Map<string, number>((data ?? []).map((r: { value: string; companies: number }) => [r.value, r.companies] as [string, number]));
    base[key] = base[key].map((o) => ({ ...o, count: byValue.get(o.value) ?? null }));
  }));
  return base;
}

/** 保存済みの範囲。行が無ければ空（＝こだわらない）。取得に失敗したら null */
export async function getApproachRange(owUserId: string): Promise<ApproachRange | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_approach_preferences")
    .select("job_categories, industries, size_groups, prefectures, remote_ok").eq("user_id", owUserId).maybeSingle();
  if (error) {
    console.error("[approach-range] get:", error.message);
    return null;
  }
  if (!data) return { ...EMPTY_APPROACH_RANGE };
  return {
    jobCategories: (data.job_categories as string[] | null) ?? [],
    industries: (data.industries as string[] | null) ?? [],
    sizeGroups: (data.size_groups as string[] | null) ?? [],
    prefectures: (data.prefectures as string[] | null) ?? [],
    remoteOk: data.remote_ok === true,
  };
}

/** 本文の検証。⚠️ 知らない値は 400（黙って落とさない）。成功なら正規化した範囲を返す */
export function parseApproachRange(raw: unknown, options: ApproachRangeOptions): { ok: true; value: ApproachRange } | { ok: false; error: string } {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null;
  if (!o) return { ok: false, error: "形式が正しくありません" };
  const arr = (key: string, allowed: Set<string>, label: string): string[] | string => {
    const v = o[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return `${label}の形式が正しくありません`;
    const uniq = Array.from(new Set(v as string[]));
    if (uniq.some((x) => !allowed.has(x))) return `${label}に選べない値が含まれています`;
    return uniq;
  };
  const jc = arr("jobCategories", new Set(options.jobCategories.map((x) => x.value)), "職種");
  const ind = arr("industries", new Set(options.industries.map((x) => x.value)), "業種");
  const sg = arr("sizeGroups", new Set(COMPANY_SIZE_GROUPS.map((g) => g.value)), "会社規模");
  const pf = arr("prefectures", new Set<string>(PREFECTURES), "勤務地");
  for (const r of [jc, ind, sg, pf]) if (typeof r === "string") return { ok: false, error: r };
  if (o.remoteOk !== undefined && typeof o.remoteOk !== "boolean") return { ok: false, error: "リモートの形式が正しくありません" };
  if ((sg as string[]).some((v) => !isCompanySizeGroup(v))) return { ok: false, error: "会社規模に選べない値が含まれています" };
  return { ok: true, value: { jobCategories: jc as string[], industries: ind as string[], sizeGroups: sg as string[], prefectures: pf as string[], remoteOk: o.remoteOk === true } };
}

export async function saveApproachRange(owUserId: string, v: ApproachRange): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_approach_preferences").upsert({
    user_id: owUserId,
    job_categories: v.jobCategories,
    industries: v.industries,
    size_groups: v.sizeGroups,
    prefectures: v.prefectures,
    remote_ok: v.remoteOk,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("user_id");
  if (error || !data || data.length !== 1) {
    console.error("[approach-range] save:", error?.message ?? `rows=${data?.length}`);
    return false;
  }
  return true;
}

/** この範囲で声かけを送れる企業の数（公開中・検証用を除く・受け取らない企業を除く）。失敗したら null */
export async function countCompaniesInRange(owUserId: string): Promise<number | null> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("count_companies_in_approach_range", { p_ow_user_id: owUserId });
  if (error) {
    console.error("[approach-range] count:", error.message);
    return null;
  }
  return typeof data === "number" ? data : Number(data);
}

export type ApproachBlockedCompany = { companyId: string; name: string };

/** 受け取らない企業。⚠️ 社名は `companyDisplayName` を通す（ピッカーと同じ名前で見せる）。失敗したら null */
export async function listApproachBlockedCompanies(owUserId: string): Promise<ApproachBlockedCompany[] | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_approach_blocked_companies")
    .select("company_id, created_at").eq("user_id", owUserId).order("created_at", { ascending: true });
  if (error) {
    console.error("[approach-range] blocks:", error.message);
    return null;
  }
  const ids = (data ?? []).map((r) => r.company_id as string);
  if (ids.length === 0) return [];
  const { data: comps, error: cErr } = await db.from("ow_companies").select("id, name, name_en").in("id", ids);
  if (cErr) {
    console.error("[approach-range] blocks companies:", cErr.message);
    return null;
  }
  const byId = new Map((comps ?? []).map((c) => [c.id as string, c]));
  return ids.flatMap((id) => {
    const c = byId.get(id);
    return c ? [{ companyId: id, name: companyDisplayName(c.name as string, (c.name_en as string | null) ?? null).displayName }] : [];
  });
}

/**
 * ★企業に「職種」の手がかりがあるか（/biz ホームの充実度の欄に出す一言のため。2026-10-10 / 柴さんの判断）。
 * 公開中の求人の職種 か、企業が登録した部門・職種のうち職種マスタに紐づいているもの。
 * ⚠️★条件は DB 関数 `company_in_approach_range()` の職種の部分（migration 20261010030000）と同じ。
 *    片方だけ変えないこと（変えると「登録したのに一言が消えない／消えたのに届かない」になる）。
 * 取得に失敗したら null（一言を出さない）。
 */
export async function companyHasApproachRoles(companyId: string): Promise<boolean | null> {
  const db = createAdminClient();
  const [{ data: jobs, error: jErr }, { count: roleCount, error: rErr }] = await Promise.all([
    db.from("ow_jobs").select("id").eq("company_id", companyId).eq("status", "published").eq("is_test", false),
    db.from("ow_company_job_roles").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).is("deleted_at", null).not("standard_role_id", "is", null),
  ]);
  if (jErr || rErr) {
    console.error("[approach-range] has roles:", jErr?.message ?? rErr?.message);
    return null;
  }
  if ((roleCount ?? 0) > 0) return true;
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  if (jobIds.length === 0) return false;
  const { count, error } = await db.from("ow_job_roles").select("job_id", { count: "exact", head: true }).in("job_id", jobIds);
  if (error) {
    console.error("[approach-range] has roles (jobs):", error.message);
    return null;
  }
  return (count ?? 0) > 0;
}

/** 設定画面が使う一式。⚠️ どれか1つでも取れなければ null */
export type ApproachRangeState = NonNullable<Awaited<ReturnType<typeof loadApproachRangeState>>>;

export async function loadApproachRangeState(owUserId: string) {
  const fields = await getApproachRangeFieldFlags();
  if (!fields) return null;
  const [range, blocks, count, options] = await Promise.all([
    getApproachRange(owUserId), listApproachBlockedCompanies(owUserId), countCompaniesInRange(owUserId),
    getApproachRangeOptions(owUserId, fields),
  ]);
  if (!range || !blocks || !options) return null;
  /* ⚠️ count は失敗しても null のまま返す（画面は「—」。0 と出さない） */
  return { range, blocks, count, options, fields };
}


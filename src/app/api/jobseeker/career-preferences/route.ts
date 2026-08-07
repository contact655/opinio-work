import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { JOB_TYPES } from "@/lib/constants/jobTypes";
import {
  VALID_DESIRED_WORK_STYLES,
  VALID_TRANSFER_TIMINGS,
  VALID_DESIRED_PHASES,
  VALID_WORRIES,
  SALARY_MAX_MAN,
} from "@/lib/constants/careerPreferences";

export const dynamic = "force-dynamic";

const VALID_JOB_TYPES = new Set<string>(JOB_TYPES);

/**
 * PUT /api/jobseeker/career-preferences — 求職者の希望条件を ow_profiles に保存
 *
 * ⚠️ ow_profiles.user_id は **auth.users.id**（ow_users.id ではない）。
 *    docs/user-id-spaces.md を参照。
 *
 * ── 2026-08-07 の変更 ──────────────────────────────────────────────────────
 * ① 許容値をホワイトリストで検証し、**不正値は 400 を返す**。
 *    以前は `slice(0, 200)` するだけで任意の文字列が通っていた。
 * ② experience_years への書き込みをやめた。
 *    parseNum() に通していたため "3〜5年" が **必ず null に落ちていた**
 *    （Number("3〜5年") = NaN）。入力欄は廃止し、職歴から自動計算する。
 *    列とデータは残す（後で判断）。
 * ③ transfer_timing が**実際に変わったときだけ** transfer_timing_updated_at を更新する。
 *    同じ値を選び直しても新しくしない。
 */
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    job_type?: string | null;
    desired_work_style?: string | null;
    desired_salary_min?: number | null;
    desired_salary_max?: number | null;
    transfer_timing?: string | null;
    transfer_timing_updated_at?: string | null;
    desired_phase?: string[] | null;
    worry?: string | null;
    updated_at?: string | null;
  } = {};

  /** null / "" は「未設定」。それ以外は許容値に無ければ 400。 */
  function readEnum(key: string, allowed: Set<string>): string | null | NextResponse {
    const v = body[key];
    if (v === null || v === undefined || v === "") return null;
    if (typeof v !== "string" || !allowed.has(v)) {
      return NextResponse.json(
        { error: `${key} に不正な値が指定されました` },
        { status: 400 }
      );
    }
    return v;
  }

  /** 万円単位の年収。範囲外・数値でないものは 400（黙って null にしない）。 */
  function readSalary(key: string): number | null | NextResponse {
    const v = body[key];
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0 || n > SALARY_MAX_MAN) {
      return NextResponse.json(
        { error: `${key} は 0〜${SALARY_MAX_MAN} の数値で指定してください` },
        { status: 400 }
      );
    }
    return Math.floor(n);
  }

  for (const [key, allowed] of [
    ["job_type", VALID_JOB_TYPES],
    ["desired_work_style", VALID_DESIRED_WORK_STYLES],
    ["transfer_timing", VALID_TRANSFER_TIMINGS],
    ["worry", VALID_WORRIES],
  ] as const) {
    if (!(key in body)) continue;
    const v = readEnum(key, allowed);
    if (v instanceof NextResponse) return v;
    patch[key] = v;
  }

  for (const key of ["desired_salary_min", "desired_salary_max"] as const) {
    if (!(key in body)) continue;
    const v = readSalary(key);
    if (v instanceof NextResponse) return v;
    patch[key] = v;
  }

  if ("desired_phase" in body) {
    const v = body.desired_phase;
    if (v === null || v === undefined) {
      patch.desired_phase = null;
    } else if (!Array.isArray(v)) {
      return NextResponse.json({ error: "desired_phase は配列で指定してください" }, { status: 400 });
    } else {
      const bad = v.filter((x) => typeof x !== "string" || !VALID_DESIRED_PHASES.has(x));
      if (bad.length > 0) {
        return NextResponse.json({ error: "desired_phase に不正な値が含まれています" }, { status: 400 });
      }
      const uniq = Array.from(new Set(v as string[]));
      patch.desired_phase = uniq.length > 0 ? uniq : null;
    }
  }

  // ⚠️ experience_years は受け付けない。職歴（ow_experiences.started_at）から
  //    自動計算する表示専用の値になった。列とデータは残っている。
  if ("experience_years" in body) {
    return NextResponse.json(
      { error: "experience_years は職歴から自動計算されるため保存できません" },
      { status: 400 }
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const now = new Date().toISOString();
  patch.updated_at = now;

  const { data: existing, error: selError } = await supabase
    .from("ow_profiles")
    .select("id, transfer_timing")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selError) {
    console.error("[PUT /api/jobseeker/career-preferences] select", selError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // 転職検討時期の鮮度。**値が実際に変わったときだけ**打ち直す。
  // 同じ値を選び直しただけで「今日更新した」ことにしない。
  if ("transfer_timing" in patch) {
    const before = existing?.transfer_timing ?? null;
    if (patch.transfer_timing !== before) patch.transfer_timing_updated_at = now;
  }

  if (existing) {
    const { error } = await supabase
      .from("ow_profiles")
      .update(patch)
      .eq("user_id", user.id);

    if (error) {
      console.error("[PUT /api/jobseeker/career-preferences] update", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("ow_profiles")
      .insert({ user_id: user.id, ...patch, onboarding_completed: false });

    if (error) {
      console.error("[PUT /api/jobseeker/career-preferences] insert", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

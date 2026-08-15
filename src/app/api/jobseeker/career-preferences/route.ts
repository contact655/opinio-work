import { createClient } from "@/lib/supabase/server";
import { PREFECTURES } from "@/lib/utils/location";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import {
  VALID_DESIRED_WORK_STYLES,
  VALID_TRANSFER_TIMINGS,
  VALID_DESIRED_PHASES,
  VALID_WORRIES,
  SALARY_MAX_MAN,
  MAX_DESIRED_ROLES,
} from "@/lib/constants/careerPreferences";

export const dynamic = "force-dynamic";

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
 * ④ 希望職種を ow_profile_desired_roles（複数可）に、
 *    希望勤務スタイルを desired_work_styles（text[]）に移した。
 *    旧列 job_type / desired_work_style は**受け付けない**（400）。
 *    列は残置しているが、読む側もすべて新しい形に移したので更新しない。
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
    desired_work_styles?: string[] | null;
    desired_prefectures?: string[] | null;
    desired_salary_min?: number | null;
    desired_salary_max?: number | null;
    transfer_timing?: string | null;
    transfer_timing_updated_at?: string | null;
    desired_phase?: string[] | null;
    worry?: string | null;
    updated_at?: string | null;
  } = {};

  // 旧・単数の項目は受け付けない。黙って無視すると
  //「保存したのに反映されない」になるので 400 で落とす。
  for (const gone of ["job_type", "desired_work_style", "experience_years"] as const) {
    if (gone in body) {
      return NextResponse.json(
        { error: `${gone} は廃止されました（希望職種は desired_role_ids、勤務スタイルは desired_work_styles、経験年数は職歴から自動計算）` },
        { status: 400 }
      );
    }
  }

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

  /** 文字列配列。許容値に無いものが1つでもあれば 400。空配列は null（未設定）。 */
  /* 希望勤務地の許容値。⚠️ 47件を直書きしない。所在地の選択肢と同じ定数を見る
        （`location.ts` の PREFECTURES）。DB に CHECK は張っていないので、
        ここが唯一の関門になる。 */
  const VALID_PREFECTURES = new Set<string>(PREFECTURES);

  function readEnumArray(key: string, allowed: Set<string>): string[] | null | NextResponse {
    const v = body[key];
    if (v === null || v === undefined) return null;
    if (!Array.isArray(v)) {
      return NextResponse.json({ error: `${key} は配列で指定してください` }, { status: 400 });
    }
    if (v.some((x) => typeof x !== "string" || !allowed.has(x))) {
      return NextResponse.json({ error: `${key} に不正な値が含まれています` }, { status: 400 });
    }
    const uniq = Array.from(new Set(v as string[]));
    return uniq.length > 0 ? uniq : null;
  }

  for (const [key, allowed] of [
    ["transfer_timing", VALID_TRANSFER_TIMINGS],
    ["worry", VALID_WORRIES],
  ] as const) {
    if (!(key in body)) continue;
    const v = readEnum(key, allowed);
    if (v instanceof NextResponse) return v;
    patch[key] = v;
  }

  /* ⚠️ 全部外したときは **null** に寄せる（空配列にしない）。
        `desired_work_styles` など既存の配列列が `uniq.length > 0 ? uniq : null` で
        null に倒しており、片方だけ空配列だと「未設定」の判定が列ごとに割れる。 */
  if ("desired_prefectures" in body) {
    const v = readEnumArray("desired_prefectures", VALID_PREFECTURES);
    if (v instanceof NextResponse) return v;
    patch.desired_prefectures = v;
  }

  if ("desired_work_styles" in body) {
    const v = readEnumArray("desired_work_styles", VALID_DESIRED_WORK_STYLES);
    if (v instanceof NextResponse) return v;
    patch.desired_work_styles = v;
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

  // ── 希望職種（ow_profile_desired_roles）─────────────────────────────────
  // ⚠️ role_id が ow_roles に実在するかまで確かめる。存在しない UUID を投げられると
  //    FK 違反で 500 になり、原因が分かりにくい。ここで 400 にして理由を返す。
  let desiredRoleIds: string[] | null = null;
  if ("desired_role_ids" in body) {
    const v = body.desired_role_ids;
    if (v === null || v === undefined) {
      desiredRoleIds = [];
    } else if (!Array.isArray(v)) {
      return NextResponse.json({ error: "desired_role_ids は配列で指定してください" }, { status: 400 });
    } else if (v.some((x) => typeof x !== "string")) {
      return NextResponse.json({ error: "desired_role_ids に不正な値が含まれています" }, { status: 400 });
    } else {
      const uniq = Array.from(new Set(v as string[]));
      if (uniq.length > MAX_DESIRED_ROLES) {
        return NextResponse.json(
          { error: `希望職種は ${MAX_DESIRED_ROLES} 件までです` },
          { status: 400 }
        );
      }
      if (uniq.length > 0) {
        const admin = createAdminClient();
        const { data: found, error: roleError } = await admin
          .from("ow_roles").select("id").in("id", uniq);
        if (roleError) {
          console.error("[PUT /api/jobseeker/career-preferences] ow_roles", roleError.message);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
        if ((found ?? []).length !== uniq.length) {
          return NextResponse.json(
            { error: "desired_role_ids に存在しない職種が含まれています" },
            { status: 400 }
          );
        }
      }
      desiredRoleIds = uniq;
    }
  }

  if (Object.keys(patch).length === 0 && desiredRoleIds === null) {
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

  // ── 希望職種は**差分だけ**書く（2026-08-15。以前は「全消し → 入れ直し」）──────
  // ⚠️ session クライアントで書く。RLS の own ポリシーが auth.uid() で効くので、
  //    他人の行には触れない。admin に寄せると RLS を素通りしてしまう。
  //
  // ★変わっていない行は触らない。カード単位のボタン保存にしたことで、
  //   **変更が無くても desired_role_ids が毎回送られてくる**ようになった。
  //   全消し→入れ直しのままだと、そのたびに行の id と created_at が作り直され、
  //   「いつ選んだか」が保存を押すたびに新しくなってしまう。
  //   ⚠️ 呼び出し側で「変わったときだけ送る」という約束にはしない。約束は破られる。
  //      どこから送られても無駄な作り直しが起きない状態にする。
  if (desiredRoleIds !== null) {
    const { data: currentRows, error: curError } = await supabase
      .from("ow_profile_desired_roles")
      .select("role_id")
      .eq("user_id", user.id);
    if (curError) {
      console.error("[PUT /api/jobseeker/career-preferences] desired_roles select", curError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const currentIds = (currentRows ?? []).map((r) => r.role_id as string);
    const current = new Set(currentIds);
    const next = new Set(desiredRoleIds);
    const toDelete = currentIds.filter((id) => !next.has(id));
    const toInsert = desiredRoleIds.filter((id) => !current.has(id));

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from("ow_profile_desired_roles")
        .delete()
        .eq("user_id", user.id)
        .in("role_id", toDelete);
      if (delError) {
        console.error("[PUT /api/jobseeker/career-preferences] desired_roles delete", delError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    if (toInsert.length > 0) {
      const { error: insError } = await supabase
        .from("ow_profile_desired_roles")
        .insert(toInsert.map((role_id) => ({ user_id: user.id, role_id })));
      if (insError) {
        console.error("[PUT /api/jobseeker/career-preferences] desired_roles insert", insError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true });
}

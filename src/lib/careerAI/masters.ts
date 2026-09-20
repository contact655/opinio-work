/**
 * ① キャリアAI — 解決に使うマスタを DB と定数から組み立てる。
 *
 * ⚠️★**判定は [resolve.ts](./resolve.ts) の仕事。ここは取ってくるだけ。**
 *    `evidence/` の `fetch.ts` / `engine.ts` と同じ分け方で、
 *    **resolve.ts に import を足さないため**にこの層がある。
 *
 * ⚠️★**条件を書き写さないこと。**
 *    希望職種の候補は [`buildDesiredRoleOptions`](../roles/desiredRoleOptions.ts) を通す
 *    （`is_it_saas` をここで直接見ない）。語彙は `constants/careerPreferences.ts` と
 *    `utils/location.ts` の1箇所から取る。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PREFECTURES } from "@/lib/utils/location";
import {
  DESIRED_PHASES,
  DESIRED_WORK_STYLES,
  DESIRED_WORK_STYLE_LABELS,
  MAX_DESIRED_ROLES,
  SALARY_MAX_MAN,
} from "@/lib/constants/careerPreferences";
import { buildDesiredRoleOptions, type RoleMasterRow } from "@/lib/roles/desiredRoleOptions";
import type { ResolveMasters } from "./resolve";

/**
 * 解決に使うマスタを組み立てる。
 *
 * @param selectedRoleIds その人がいま持っている希望職種（`ow_profile_desired_roles`）。
 *   ⚠️★**足し戻しに要る。** これを渡さないと、対象外の職種を既に持っている人が
 *   その職種を言い直したときに「マスタに無い」と返ってしまう
 *   （`desiredRoleOptions.ts` の「絞り込みだけを足すと選択が消える」と同じ形）。
 */
export async function fetchResolveMasters(
  selectedRoleIds: readonly string[] = [],
): Promise<ResolveMasters> {
  const db = createAdminClient();

  /* ⚠️ `is_active` / `is_it_saas` を必ず select する（`RoleMasterRow` の要求）。
        ⚠️ 既存の `getRoleRows` は `is_it_saas` を返さないので、ここで引く。 */
  const { data: roleRows, error: roleErr } = await db
    .from("ow_roles")
    .select("id, name, parent_id, is_active, is_it_saas")
    .eq("is_active", true);
  /* ⚠️ 握り潰さない。失敗を「0件」に見せない（CLAUDE.md） */
  if (roleErr) {
    console.error("[careerAI/masters] ow_roles:", roleErr.message);
    throw new Error(`職種マスタの取得に失敗しました: ${roleErr.message}`);
  }

  const all = (roleRows ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "",
    parent_id: (r.parent_id as string | null) ?? null,
    is_active: r.is_active as boolean | null,
    is_it_saas: r.is_it_saas as boolean | null,
  }));
  const byId = new Map<string, RoleMasterRow>(all.map((r) => [r.id, r]));

  /* ★条件はここに書かない。`buildDesiredRoleOptions` の1箇所 */
  const candidates = buildDesiredRoleOptions(all, byId, selectedRoleIds);

  /* 別名。⚠️ `ow_role_aliases` は職種そのものを指す（祖先も子孫も入らない） */
  const { data: aliasRows, error: aliasErr } = await db
    .from("ow_role_aliases")
    .select("alias, role_id");
  if (aliasErr) console.error("[careerAI/masters] ow_role_aliases:", aliasErr.message);

  const aliasesByRole = new Map<string, string[]>();
  for (const a of aliasRows ?? []) {
    const id = a.role_id as string;
    const list = aliasesByRole.get(id);
    if (list) list.push(a.alias as string);
    else aliasesByRole.set(id, [a.alias as string]);
  }

  return {
    roles: candidates.map((r) => ({
      id: r.id,
      name: r.name,
      aliases: aliasesByRole.get(r.id) ?? [],
    })),
    /* ⚠️ `RESIDENCE_EXTRA_OPTIONS`（海外・非公開）は**入れない。**
          あれは住まいの選択肢で、希望勤務地ではない。 */
    prefectures: PREFECTURES,
    /* ⚠️★`ow_profiles.desired_phase` は**日本語ラベル**。`PHASE_OPTIONS` の slug ではない */
    phases: DESIRED_PHASES,
    /* ⚠️ legacy（`flexible`）も受ける。既に持っている人が言い直したときに落とさないため。
          ラベルは `DESIRED_WORK_STYLE_LABELS` から引く（1箇所） */
    workStyles: [
      ...DESIRED_WORK_STYLES.map((o) => ({ value: o.value as string, label: o.label as string })),
      { value: "flexible", label: DESIRED_WORK_STYLE_LABELS.flexible },
    ],
    salaryMaxMan: SALARY_MAX_MAN,
    maxRoles: MAX_DESIRED_ROLES,
  };
}

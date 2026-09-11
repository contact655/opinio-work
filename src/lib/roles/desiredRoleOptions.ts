/**
 * ★「希望職種 / 関心のある職種」の候補を作る（2026-09-12）。
 *
 * ── なぜ1箇所にまとめたか ──────────────────────────────────────────────────
 * ⚠️★**同じ設定を2つの画面が触る**（オンボーディングの「関心のある職種」と
 *    `/mypage` の「希望職種」）。保存先は `ow_profile_desired_roles` の1つ。
 *    2026-09-12 まで `/mypage` だけが IT/SaaS に絞っており、
 *    **オンボーディングは18分類・`/mypage` は10分類**と食い違っていた。
 *    ⚠️ **条件を画面側に書き写さないこと。** 割れると
 *       「片方では選べるのにもう片方に出ない」が戻る。
 *
 * ── なぜ IT/SaaS に絞るのか（2026-09-12 / 柴さんの判断）────────────────────
 * 関心のある職種は**おすすめの求人に使う項目**で、掲載される求人は IT/SaaS の企業だけ。
 * 対象外の職種を選べても**当たる求人が存在しない**。
 *
 * ⚠️★**職歴の職種には掛けない。** あちらは「これまでの経歴」なので全職種
 *    （非IT の18分類のまま）。`/mypage` の職歴エディタもオンボーディングの1画面目も同じ。
 *
 * ── ★足し戻し（この関数の本体）──────────────────────────────────────────
 * ⚠️★**絞り込みだけを足すと、対象外の職種を既に持っている人の選択が画面から消え、
 *    別の職種を足して保存した瞬間に失われる。** 保存は「送られた配列で置き換える」形なので、
 *    画面に出ていない＝送られない＝消える。
 *    2026-08-06 に求人フォームで同じ形を踏みかけて足し戻しを入れた
 *    （`docs/roles-selected-value-check.md`）。**同じ仕組みをここでも使う。**
 * ⚠️ **親も足す。** 子だけ足しても、大分類の行が無ければ開けず結局選べない。
 */

/** 候補の判定に要る職種マスタの列。⚠️ 取得側で `is_active` / `is_it_saas` を必ず select すること */
export type RoleMasterRow = {
  id: string;
  parent_id: string | null;
  is_active?: boolean | null;
  is_it_saas?: boolean | null;
};

/**
 * 希望職種の候補に出してよい職種か。
 * ⚠️ ここが唯一の条件。画面側で `is_it_saas` を直接見ないこと。
 */
export function isDesiredRoleCandidate(r: Pick<RoleMasterRow, "is_active" | "is_it_saas">): boolean {
  return r.is_active === true && r.is_it_saas === true;
}

/**
 * 候補の配列を作る。
 *
 * @param all     画面に渡す候補の母集団（並び順はそのまま保たれる）
 * @param master  `id` → マスタの行（`is_active` / `is_it_saas` / `parent_id`）
 * @param selectedIds 本人が**既に選んでいる**職種。候補から外れていても必ず残す
 */
export function buildDesiredRoleOptions<T extends { id: string }>(
  all: readonly T[],
  master: ReadonlyMap<string, RoleMasterRow>,
  selectedIds: readonly string[],
): T[] {
  /* 選択済みとその親。⚠️ 親を落とすと大分類の行が出ず、子が選べない */
  const keep = new Set<string>(selectedIds);
  for (const id of selectedIds) {
    const parent = master.get(id)?.parent_id;
    if (parent) keep.add(parent);
  }
  return all.filter((r) => {
    if (keep.has(r.id)) return true;
    const m = master.get(r.id);
    return !!m && isDesiredRoleCandidate(m);
  });
}

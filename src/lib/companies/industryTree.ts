/**
 * 業種（`ow_industries`）の2階層と、祖先展開。
 *
 * ── ⚠️★なぜ `lib/roles/jobRoles.ts` の `expandWithAncestors` を流用しないのか ──
 * 検討した案は2つ。**別関数として持つ**を採った（2026-09-05）。
 *
 *   案1 共通化: `{ byId: Map<string, {id, parentId}> }` を受ける汎用関数にして、
 *        職種と業種で共有する。**関数の中身はほぼ同じなので技術的には可能。**
 *   案2 別関数（採用）: 業種用に持つ。
 *
 * 案2にした理由は**型ではなく規則**。両者は「どちら側を展開するか」が逆で、
 * **共有すると片方の規則をもう片方に当ててしまう。**
 *
 *   職種（`ow_roles`）… **求人側**を祖先展開する。本人側は自分と親までしか見ない
 *                        （CLAUDE.md「両方を展開すると同じ親を共有する兄弟が一致してしまう」）
 *   業種（ここ）    … ★**本人側**を祖先展開する。企業の対象業界は展開しない
 *
 * 同じ関数を import できる状態にしておくと、次に触る人が
 * 「職種と同じだから求人側も展開しよう」と書ける。**別に持てば書けない。**
 *
 * ⚠️ 中身が似ていること自体は問題ではない。**似ているのに規則が逆**であることを
 *    ファイルの境界で示している。
 */

export type IndustryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  displayOrder: number;
  /** 選択肢に添える短い説明。⚠️ 迷いやすい組にだけ入っている（多くは null） */
  description: string | null;
};

export type IndustryTree = {
  byId: Map<string, IndustryNode>;
  /** トップレベル。`displayOrder` 順 */
  roots: IndustryNode[];
  /** 親 id → 子。`displayOrder` 順。⚠️ 子を持たない親はキーごと無い */
  childrenOf: Map<string, IndustryNode[]>;
};

/** ⚠️ 並びは `display_order`。**親ごとの相対順**なので、木を組んでから使うこと */
export function buildIndustryTree(rows: IndustryNode[]): IndustryTree {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenOf = new Map<string, IndustryNode[]>();
  const roots: IndustryNode[] = [];
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId)) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r);
      childrenOf.set(r.parentId, arr);
    } else {
      /* ⚠️ 親 id が手元の行に無いときはトップレベル扱い。
            （`is_active = false` の親を持つ子が混ざったときに消えないため） */
      roots.push(r);
    }
  }
  const byOrder = (a: IndustryNode, b: IndustryNode) => a.displayOrder - b.displayOrder;
  roots.sort(byOrder);
  for (const arr of Array.from(childrenOf.values())) arr.sort(byOrder);
  return { byId, roots, childrenOf };
}

/**
 * ★**自分＋すべての祖先**を返す。子や兄弟には広げない。
 *
 * ⚠️★**本人の業種にだけ使う。** 企業の対象業界には使わない。
 *    使うと「電子機器・半導体向け」の企業に **電機・機械** 出身の人が当たる
 *    ——つまり**兄弟に広がる**。
 *
 * ⚠️ 循環していても止まる（`seen`）。孫は作らない方針だが、深さは仮定していない。
 */
export function expandIndustryWithAncestors(
  tree: IndustryTree,
  industryIds: string[] | null | undefined,
): string[] {
  const out = new Set<string>();
  for (const id of industryIds ?? []) {
    if (!tree.byId.has(id)) continue;
    out.add(id);
    let node: IndustryNode | null = tree.byId.get(id) ?? null;
    const seen = new Set<string>();
    while (node?.parentId && !seen.has(node.id)) {
      seen.add(node.id);
      out.add(node.parentId);
      node = tree.byId.get(node.parentId) ?? null;
    }
  }
  return Array.from(out);
}

/**
 * `id` から見て `ancestorId` は何代上か。自分自身なら 0、親なら 1。
 * 祖先でなければ `null`。
 *
 * ⚠️ 一致した理由を出すときに「**より近いほう**」を選ぶために使う。
 *    「電機・機械向け」と「製造業向け」の両方に当たったら、前者を理由にする。
 */
export function industryAncestorDistance(
  tree: IndustryTree,
  id: string,
  ancestorId: string,
): number | null {
  if (id === ancestorId) return 0;
  let node: IndustryNode | null = tree.byId.get(id) ?? null;
  const seen = new Set<string>();
  let d = 0;
  while (node?.parentId && !seen.has(node.id)) {
    seen.add(node.id);
    d += 1;
    if (node.parentId === ancestorId) return d;
    node = tree.byId.get(node.parentId) ?? null;
  }
  return null;
}

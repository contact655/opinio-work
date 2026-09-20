/**
 * 組織体制（部門・自社職種）の木の決まりごと。
 *
 * ── なぜ1箇所に置くか ─────────────────────────────────────────────────────
 * **部門と職種が同じ規則で動く必要がある**（2026-09-19 / 柴さんの指示）。
 * 人事担当者は「部門から作る人」と「職種から作る人」の両方がいるので、
 * 片方だけ深さが違う・片方だけ循環を防いでいる、という状態を作らない。
 *
 * ⚠️★**深さは DB では縛っていない。ここ（API）と画面の2層で担保する。**
 *    CLAUDE.md「3層に揃えるのは『値の集合』の制約。件数・深さのような濃度は2層」。
 *    ⚠️ **2層しかないので、定数が1つであることが唯一の担保。**
 *       画面側にローカル定数を書かないこと（`MAX_DESIRED_ROLES` で実際に踏んだ形）。
 */

/**
 * 階層の上限。**最上位を1階層目と数える。**
 *
 * ⚠️ 5 は「まずは」の値（柴さんの指示）。深くするときは**この1箇所だけ**を変える。
 * ⚠️★画面の字下げ幅もこの値に合わせて決めること。深いほど右に寄るので、
 *    上限を上げるなら狭い幅での見え方を測り直す。
 */
export const MAX_ORG_DEPTH = 5;

/** 木を組むのに最低限必要な形。部門・職種のどちらの行もこれを満たす */
export type OrgNodeLike = { id: string; parent_id: string | null };

/**
 * `id` の階層（最上位＝1）を返す。**親を辿れなくなったらそこで止める。**
 *
 * ⚠️ 壊れたデータ（親が消えている・循環している）でも**返らなくならない**ように、
 *    辿る回数に上限を置いてある。循環は `hasCycle` で別に弾く。
 */
export function depthOf(id: string | null, byId: Map<string, OrgNodeLike>): number {
  let depth = 1;
  let cur = id;
  /* ⚠️ 上限は MAX_ORG_DEPTH ではなく、**行数**で切る。
        「深すぎる木」を測りたいので、上限で打ち切ると判定に使えない。 */
  for (let guard = 0; guard < byId.size + 1; guard++) {
    if (!cur) return depth;
    const node = byId.get(cur);
    if (!node || !node.parent_id) return depth;
    cur = node.parent_id;
    depth += 1;
  }
  return depth;
}

/**
 * `parentId` の下に1つ足したとき、上限を超えるか。
 *
 * ⚠️ `parentId` が null（最上位に足す）なら必ず通る。
 */
export function wouldExceedDepth(
  parentId: string | null,
  byId: Map<string, OrgNodeLike>,
): boolean {
  if (!parentId) return false;
  return depthOf(parentId, byId) + 1 > MAX_ORG_DEPTH;
}

/**
 * `nodeId` を `newParentId` の下へ移すと循環するか。
 *
 * ⚠️★**付け替えを作るときは必ず通すこと。** 循環すると木を描く処理が返らなくなり、
 *    **画面が固まる**（DB の FK では防げない）。
 */
export function wouldCycle(
  nodeId: string,
  newParentId: string | null,
  byId: Map<string, OrgNodeLike>,
): boolean {
  let cur = newParentId;
  for (let guard = 0; guard < byId.size + 1; guard++) {
    if (!cur) return false;
    if (cur === nodeId) return true;
    cur = byId.get(cur)?.parent_id ?? null;
  }
  /* ⚠️ 辿り切れなかった＝既に循環している。**安全側に倒して拒否する。** */
  return true;
}

/**
 * 木をそのまま縦に並べた順（親 → その子 → 次の親…）にする。
 *
 * ⚠️★**`<select>` に出すときは `<optgroup>` を使わないこと。** optgroup は
 *    入れ子にできないので、3階層目から出せなくなる（2026-09-19 まで求人フォームが
 *    その形で、5階層にすると孫以下が**選べないのに保存はできる**状態になっていた）。
 *    この関数が返す `depth` で字下げした `<option>` を並べる。
 */
export function flattenTree<T extends OrgNodeLike>(nodes: T[]): { node: T; depth: number }[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    const arr = byParent.get(key);
    if (arr) arr.push(n); else byParent.set(key, [n]);
  }
  const out: { node: T; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const n of byParent.get(parentId) ?? []) {
      /* ⚠️ 壊れたデータで無限に潜らないため。**黙って落とす**のではなく、
            1度だけ出して打ち切る（行が画面から消えるほうが分かりにくい）。 */
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 1);
  /* ⚠️ 親が消えている行（孤児）も出す。出さないと**画面から消えて直せなくなる。** */
  for (const n of nodes) {
    if (!seen.has(n.id)) { seen.add(n.id); out.push({ node: n, depth: 1 }); }
  }
  return out;
}

/**
 * `nodeId` を根とする部分木の高さ（自分だけなら 1）。
 *
 * ⚠️★**移動のときはこれが要る。** 動かすのは1行ではなく**その下にぶら下がる全部**で、
 *    「自分が上限内か」ではなく「**いちばん深い子孫が上限内か**」で判定しないと、
 *    孫が 6階層目に落ちる。
 */
export function subtreeHeight(nodeId: string, byId: Map<string, OrgNodeLike>): number {
  const childrenOf = new Map<string | null, string[]>();
  byId.forEach((n) => {
    const key = n.parent_id ?? null;
    const arr = childrenOf.get(key);
    if (arr) arr.push(n.id); else childrenOf.set(key, [n.id]);
  });
  let height = 1;
  /* ⚠️ 壊れたデータ（循環）で返らなくならないように、見た id は辿らない。 */
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (depth > height) height = depth;
    for (const child of childrenOf.get(id) ?? []) walk(child, depth + 1);
  };
  walk(nodeId, 1);
  return height;
}

/**
 * `nodeId`（とその子孫）を `newParentId` の下へ移したとき、上限を超えるか。
 *
 * ⚠️★**`wouldExceedDepth` と混同しないこと。** あちらは「1件足す」用で、
 *    移動に使うと**子孫のぶんを数え落とす。**
 */
export function wouldExceedDepthOnMove(
  nodeId: string,
  newParentId: string | null,
  byId: Map<string, OrgNodeLike>,
): boolean {
  const base = newParentId ? depthOf(newParentId, byId) : 0;
  return base + subtreeHeight(nodeId, byId) > MAX_ORG_DEPTH;
}

/**
 * 「この行を、この親の下へ動かしてよいか」。**理由の文字列**を返す（null なら通す）。
 *
 * ⚠️★**部門と職種の両方の API がこれを呼ぶ。** 片方に条件を書き足さないこと。
 *    循環（`wouldCycle`）と深さ（`wouldExceedDepthOnMove`）は**どちらも要る**
 *    ——循環だけ見ると孫が上限を超え、深さだけ見ると自分の子の下へ入れてしまう。
 *
 * @param unit 画面に出す語（「部門」「職種」）
 */
export function validateMove(
  nodeId: string,
  newParentId: string | null,
  rows: OrgNodeLike[],
  unit: string,
): string | null {
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (!byId.has(nodeId)) return `${unit}が見つかりません`;
  if (newParentId !== null && !byId.has(newParentId)) return `移動先の${unit}が見つかりません`;
  if (newParentId === nodeId) return `自分自身の下には移動できません`;
  if (newParentId !== null && wouldCycle(nodeId, newParentId, byId)) {
    return `自分の下の${unit}へは移動できません`;
  }
  if (wouldExceedDepthOnMove(nodeId, newParentId, byId)) {
    return `${unit}は${MAX_ORG_DEPTH}階層までです`;
  }
  return null;
}

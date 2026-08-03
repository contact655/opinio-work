/**
 * 求人の職種を ow_roles に一本化して解決するための共通ヘルパー。
 *
 * 2026-08-03 の移行で、求人の職種は **ow_job_roles だけ** を正とした。
 * 判断基準は「biz UI が更新するほう」。
 *   - ow_job_roles       … biz の職種ピッカーが読み書きする。これが正
 *   - ow_jobs.role_category_id … migration の一括投入のまま。UI は更新しない → 廃止予定
 *   - ow_jobs.job_category     … フリーテキスト。廃止予定（現在は表示用の派生値）
 *
 * ow_job_roles には「具体職種」が入る（例: セールスエンジニア）。
 * 9大分類への集約は参照側でここの resolveTopRole() を通して行う。
 * 大分類を直接保存しないのは、「営業なのは分かるがプリセールスであることが消える」
 * のを避けるため。
 */

export type RoleNode = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string | null;
  displayOrder: number;
};

export type RoleTree = {
  /** 全ロール（id 引き） */
  byId: Map<string, RoleNode>;
  /** parent_id IS NULL の9件を display_order 順で */
  topLevel: RoleNode[];
  /** slug → トップレベルロード（トップレベルのみ。子階層の slug は未設定のため引かない） */
  topBySlug: Map<string, RoleNode>;
};

export function buildRoleTree(rows: RoleNode[]): RoleTree {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const topLevel = rows
    .filter((r) => r.parentId === null)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const topBySlug = new Map(
    topLevel.filter((r) => r.slug).map((r) => [r.slug as string, r])
  );
  return { byId, topLevel, topBySlug };
}

/**
 * 任意の深さのロール ID から、所属する9大分類（parent_id IS NULL）を返す。
 *
 * ow_roles は最大3階層ある。例:
 *   営業 → ソリューションエンジニア・プリセールス → セールスエンジニア
 * したがって親を1回辿るだけでは足りず、ルートまで遡る必要がある。
 *
 * 循環があっても無限ループしないよう訪問済みを持つ（DB 側の migration でも
 * 事前チェックしているが、コード側でも落ちないようにしておく）。
 */
export function resolveTopRole(tree: RoleTree, roleId: string | null | undefined): RoleNode | null {
  if (!roleId) return null;
  const seen = new Set<string>();
  let node = tree.byId.get(roleId) ?? null;
  while (node && node.parentId) {
    if (seen.has(node.id)) return null; // 循環。呼び出し側では「分類なし」扱い
    seen.add(node.id);
    node = tree.byId.get(node.parentId) ?? null;
  }
  return node;
}

/** 求人が持つ全ロール ID → 所属する9大分類の集合（重複排除） */
export function resolveTopRoleIds(tree: RoleTree, roleIds: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const id of roleIds ?? []) {
    const top = resolveTopRole(tree, id);
    if (top) out.add(top.id);
  }
  return out;
}

/**
 * 求人の表示用職種ラベル。primary ロールの名前を返す。
 * ow_job_roles が空の場合のみ null（その場合は項目ごと非表示にすること。
 * 「値が無い」ことを「ある値」に置き換えない — CLAUDE.md のデータ表示の原則）。
 */
export function jobRoleLabel(tree: RoleTree, roleIds: string[] | null | undefined): string | null {
  const first = (roleIds ?? [])[0];
  if (!first) return null;
  return tree.byId.get(first)?.name ?? null;
}

/**
 * ビジネス職（OTE・担当セグメントの表示対象）かどうか。
 *
 * 旧実装は job_category のフリーテキストを Set で持っていたため、
 * 「エンタープライズ営業」は該当するが「営業」は該当しない、といった穴があった。
 * 9大分類で判定すれば表記ゆれの影響を受けない。
 *
 * ソリューションエンジニア・プリセールス系は ow_roles 上では営業配下なので、
 * ここでも自動的にビジネス職として扱われる（2026-08-03 の方針確定どおり）。
 */
const BUSINESS_TOP_SLUGS = new Set(["sales", "cs", "marketing", "bizdev", "exec"]);

export function isBusinessRole(tree: RoleTree, roleIds: string[] | null | undefined): boolean {
  // Array.from を挟むのは tsconfig の target が Set の直接イテレーションを許さないため
  return Array.from(resolveTopRoleIds(tree, roleIds)).some((topId) => {
    const slug = tree.byId.get(topId)?.slug;
    return !!slug && BUSINESS_TOP_SLUGS.has(slug);
  });
}

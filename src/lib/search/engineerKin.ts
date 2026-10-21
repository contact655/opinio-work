import type { RoleTree } from "@/lib/roles/jobRoles";

/**
 * ★「エンジニア」（大分類）で探したときは、「データ・AI」の下の〜エンジニアも含める（2026-10-21 / 柴さんの判断）。
 *   AI・機械学習エンジニア・データエンジニアなどは「データ・AI」の下にあり、そのままでは「エンジニア」で出てこなかった。
 * ⚠️ 「営業」の下の「ソリューションエンジニア・プリセールス」は含めない（営業職。技術職を探す人に営業の人が出る）。
 * ⚠️ 名前に「エンジニア」が付くかで選ぶ。データアナリストなどエンジニアでない職種は含めない。
 */
const ENGINEER_TOP_SLUG = "engineer";
const ENGINEER_KIN_PARENT_SLUGS = ["data-ai"];

export function withEngineerKin(roleIds: string[], tree: RoleTree): string[] {
  const top = tree.topBySlug.get(ENGINEER_TOP_SLUG);
  if (!top || !roleIds.includes(top.id)) return roleIds;
  const parents = new Set(ENGINEER_KIN_PARENT_SLUGS.map((s) => tree.topBySlug.get(s)?.id).filter((x): x is string => !!x));
  const kin = Array.from(tree.byId.values())
    .filter((n) => n.parentId && parents.has(n.parentId) && n.name.includes("エンジニア"))
    .map((n) => n.id);
  return Array.from(new Set([...roleIds, ...kin]));
}

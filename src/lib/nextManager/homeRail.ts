/* ★サーバー専用 */
import "server-only";
import { getDirectoryPeople } from "@/lib/people/directory";
import { getHiringBadges } from "./server";
import { HOME_HIRING_MANAGERS_LIMIT } from "./constants";

/**
 * ★ホームの右の列「採用中のマネージャー」（2026-11-25 / 柴さんの指示。「相談にのれる人」の箱の置き換え）。
 *
 * ⚠️★出す人は /people の「採用中のマネージャー」タブと同じ（条件を書き写さない）:
 *    getHiringBadges（採用中にした会社の担当者・本人の申告。見ている人と is_test が同じ会社だけ）
 *    × getDirectoryPeople（/people の母集団。本人が登録していて検証用・システムでない人）
 * ⚠️ 見ている本人は外す。並びは /people の既定（新着順）と同じ。
 * ⚠️ 失敗したら空配列（ホームを落とさない。ログは出す）。0人なら呼び出し側が箱ごと出さない。
 */
export type HomeHiringManager = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** 採用中の会社（表示名） */
  companyName: string;
  /** 職種（ow_roles。無ければ null） */
  roleName: string | null;
};

export async function getHomeHiringManagers(viewer: { owUserId: string; isTest: boolean }): Promise<HomeHiringManager[]> {
  try {
    const [badges, people] = await Promise.all([getHiringBadges(viewer.isTest), getDirectoryPeople(true)]);
    if (!badges) return [];
    return people
      .filter((p) => p.userId !== viewer.owUserId && !!badges[p.userId])
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, HOME_HIRING_MANAGERS_LIMIT)
      .map((p) => ({ userId: p.userId, name: p.name, avatarUrl: p.avatarUrl, companyName: badges[p.userId].companyName, roleName: p.roleName }));
  } catch (e) {
    console.error("[nextManager] home rail:", (e as Error).message);
    return [];
  }
}

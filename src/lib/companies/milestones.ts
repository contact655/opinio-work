/**
 * ★資本金・代表メッセージ・これまでの歩み（2026-11-27 / 柴さんの指示。企業詳細の作り直しのフェーズ3）。
 *   /biz/company・/admin/companies/[id]・企業ページが同じ規則を使う。**書き写さないこと。**
 *
 * ⚠️ 何も import しない（クライアントからも読む）。
 * ⚠️ 上限は migration（20261127090000）の CHECK と同じ。片方だけ変えない。
 */

export const CEO_MESSAGE_MAX = 2000;
export const MILESTONE_EVENT_MAX = 200;
export const MILESTONES_MAX = 50;
export const MILESTONE_YEAR_MIN = 1800;
export const MILESTONE_YEAR_MAX = 2100;

export type Milestone = { year: number; month: number | null; event: string };

/** 入力欄の形（文字列のまま持つ） */
export type MilestoneInput = { year: string; month: string; event: string };

/** 下書き（draft_data）に入れるキー */
export const DRAFT_MILESTONES_KEY = "milestones";

/**
 * 受け取った値を整える。空の行（年も出来事も空）は落とす。
 * 不正な行があれば { ok: false, error } を返す（黙って捨てない）。
 */
export function parseMilestones(raw: unknown): { ok: true; items: Milestone[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "これまでの歩みの形が正しくありません" };
  const items: Milestone[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return { ok: false, error: "これまでの歩みの形が正しくありません" };
    const o = r as Record<string, unknown>;
    const yearStr = String(o.year ?? "").trim();
    const monthStr = String(o.month ?? "").trim();
    const event = String(o.event ?? "").trim();
    if (!yearStr && !event && !monthStr) continue;
    const year = Number(yearStr);
    if (!Number.isInteger(year) || year < MILESTONE_YEAR_MIN || year > MILESTONE_YEAR_MAX) {
      return { ok: false, error: "これまでの歩みの年は4桁の数字で入れてください" };
    }
    let month: number | null = null;
    if (monthStr) {
      const m = Number(monthStr);
      if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false, error: "これまでの歩みの月は1〜12で入れてください" };
      month = m;
    }
    if (!event) return { ok: false, error: "これまでの歩みの出来事を入れてください" };
    if (event.length > MILESTONE_EVENT_MAX) return { ok: false, error: `これまでの歩みの出来事は${MILESTONE_EVENT_MAX}字までです` };
    items.push({ year, month, event });
  }
  if (items.length > MILESTONES_MAX) return { ok: false, error: `これまでの歩みは${MILESTONES_MAX}件までです` };
  return { ok: true, items };
}

/** 年月の古い順（月が無いものはその年の先頭）。入力の順は同じ年月の中でだけ使う */
export function sortMilestones<T extends { year: number; month: number | null }>(items: T[]): T[] {
  return items.map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.year - b.m.year || (a.m.month ?? 0) - (b.m.month ?? 0) || a.i - b.i)
    .map((x) => x.m);
}

export function milestoneDateLabel(m: { year: number; month: number | null }): string {
  return m.month ? `${m.year}年${m.month}月` : `${m.year}年`;
}

/** 資本金（円）を「1億2,000万円」の形にする。⚠️ 0 は「0円」。null は null（出さない） */
export function formatCapitalYen(yen: number | null | undefined): string | null {
  if (yen === null || yen === undefined || !Number.isFinite(yen) || yen < 0) return null;
  if (yen < 10000) return `${yen.toLocaleString("ja-JP")}円`;
  const oku = Math.floor(yen / 100000000);
  const man = Math.floor((yen % 100000000) / 10000);
  const rest = yen % 10000;
  const parts = [oku > 0 ? `${oku.toLocaleString("ja-JP")}億` : "", man > 0 ? `${man.toLocaleString("ja-JP")}万` : ""].join("");
  return rest > 0 ? `${parts}${rest.toLocaleString("ja-JP")}円` : `${parts}円`;
}

/**
 * 入力欄の資本金（万円・カンマ可）を円にする。空は null。
 * 不正なら undefined（呼び出し側でエラーにする）。
 */
export function capitalManToYen(input: string): number | null | undefined {
  const t = input.replace(/[,，\s]/g, "");
  if (!t) return null;
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return undefined;
  const yen = Math.round(Number(t) * 10000);
  return Number.isSafeInteger(yen) ? yen : undefined;
}

/** 円を入力欄の値（万円）にする */
export function capitalYenToMan(yen: number | null | undefined): string {
  if (yen === null || yen === undefined) return "";
  const man = yen / 10000;
  return Number.isInteger(man) ? String(man) : String(Number(man.toFixed(4)));
}

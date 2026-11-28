/**
 * ★受賞・認定（ow_company_awards）の規則（2026-11-28 / 柴さんの指示）。
 *   /biz/company の入力・「変更を公開する」の保存・企業ページの表示が同じ規則を使う。**書き写さないこと。**
 *
 * ⚠️ 企業が自分で入れる。運営が代わりに作らない。評価の言葉を足さない。
 * ⚠️ 上限は migration（20261128110000）の CHECK と同じ。片方だけ変えない。
 * ⚠️ 何も import しない（クライアントからも読む。npm test が直接読む）。
 */

export const AWARD_TEXT_MAX = 100;
export const AWARDS_MAX = 30;
export const AWARD_YEAR_MIN = 1900;
export const AWARD_YEAR_MAX = 2100;

export type Award = { name: string; issuer: string; year: number; url: string | null };

/** 入力欄の形（文字列のまま持つ） */
export type AwardInput = { name: string; issuer: string; year: string; url: string };

/** 下書き（draft_data）に入れるキー */
export const DRAFT_AWARDS_KEY = "awards";

/** https の URL だけ通す。空は null。不正は undefined */
export function parseHttpsUrl(raw: string): string | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" && t.length <= 2000 ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 受け取った値を整える。空の行（すべて空）は落とす。
 * 不正な行があれば { ok: false, error } を返す（黙って捨てない）。
 */
export function parseAwards(raw: unknown): { ok: true; items: Award[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "受賞・認定の形が正しくありません" };
  const items: Award[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return { ok: false, error: "受賞・認定の形が正しくありません" };
    const o = r as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const issuer = String(o.issuer ?? "").trim();
    const yearStr = String(o.year ?? "").trim();
    const urlStr = String(o.url ?? "").trim();
    if (!name && !issuer && !yearStr && !urlStr) continue;
    if (!name) return { ok: false, error: "受賞・認定の正式名称を入れてください" };
    if (!issuer) return { ok: false, error: "受賞・認定の主催・認定した団体を入れてください" };
    if (name.length > AWARD_TEXT_MAX || issuer.length > AWARD_TEXT_MAX) return { ok: false, error: `受賞・認定の名称と団体は${AWARD_TEXT_MAX}字までです` };
    const year = Number(yearStr);
    if (!yearStr || !Number.isInteger(year) || year < AWARD_YEAR_MIN || year > AWARD_YEAR_MAX) {
      return { ok: false, error: "受賞・認定の年は4桁の数字で入れてください" };
    }
    const url = parseHttpsUrl(urlStr);
    if (url === undefined) return { ok: false, error: "受賞・認定の根拠のページは https:// で始まる URL を入れてください" };
    items.push({ name, issuer, year, url });
  }
  if (items.length > AWARDS_MAX) return { ok: false, error: `受賞・認定は${AWARDS_MAX}件までです` };
  return { ok: true, items };
}

/** 新しい年から順に（同じ年は入力の順） */
export function sortAwards<T extends { year: number }>(items: T[]): T[] {
  return items.map((a, i) => ({ a, i })).sort((x, y) => y.a.year - x.a.year || x.i - y.i).map((x) => x.a);
}

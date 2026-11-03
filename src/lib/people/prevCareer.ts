import type { PathsStartView } from "@/lib/paths/server";

/**
 * ★/people の「前の経歴」（2026-11-03。旧 /paths をまとめた）。URL のキーと組み立て。
 *
 * ⚠️★キーは `prev_role` / `prev_industry` / `prev_company`（slug）。`?role=` は /people の「いまの職種」で使っているので使わない。
 * ⚠️ 旧 /paths?role=&industry=&company= は middleware がこのキーに付け替えて /people へ転送する。片方だけ変えないこと。
 * ⚠️ 会社と業界は同時に持たない（会社を選ぶと業界はその会社の業界になる）。
 */
export const PREV_PARAM = { role: "prev_role", industry: "prev_industry", company: "prev_company" } as const;

export type PrevSelection = { role: string | null; industry: string | null; company: string | null };

export function prevCareerText(s: PathsStartView): string {
  return [s.role?.name, s.industry?.name, s.company?.name].filter(Boolean).join(" × ");
}

export function prevSelectionOf(s: PathsStartView): PrevSelection {
  return { role: s.role?.slug ?? null, industry: s.industry?.slug ?? null, company: s.company?.slug ?? null };
}

/** URL のパラメータ（空のキーは空文字。setParam が消す） */
export function prevParams(sel: PrevSelection): Record<string, string> {
  return {
    [PREV_PARAM.role]: sel.role ?? "",
    [PREV_PARAM.company]: sel.company ?? "",
    [PREV_PARAM.industry]: sel.company ? "" : sel.industry ?? "",
  };
}

export function prevCareerHref(s: PathsStartView): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(prevParams(prevSelectionOf(s)))) if (v) q.set(k, v);
  const qs = q.toString();
  return qs ? `/people?${qs}` : "/people";
}

/**
 * ★旧 /paths の URL（?role= / ?industry= / ?company=）を /people の検索文字列（prev_*）に付け替える（2026-11-03）。
 *   middleware（ログイン中の /paths）と /paths のページ（保険）が同じ関数を使う。
 * ⚠️ 会社があれば業界は捨てる（会社が業界を決める）。値の無いキーは付けない。
 * @returns 先頭の「?」込み。何も無ければ空文字
 */
export function peopleSearchFromPaths(src: { get(key: string): string | null }): string {
  const next = new URLSearchParams();
  const role = src.get("role");
  const company = src.get("company");
  const industry = src.get("industry");
  if (role) next.set(PREV_PARAM.role, role);
  if (company) next.set(PREV_PARAM.company, company);
  else if (industry) next.set(PREV_PARAM.industry, industry);
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/** ★未ログイン向けの /paths の URL（2026-11-03）。⚠️ キーは旧 /paths のまま（role / industry / company） */
export function pathsHref(s: PathsStartView): string {
  const sel = prevSelectionOf(s);
  const q = new URLSearchParams();
  if (sel.role) q.set("role", sel.role);
  if (sel.company) q.set("company", sel.company);
  else if (sel.industry) q.set("industry", sel.industry);
  const qs = q.toString();
  return qs ? `/paths?${qs}` : "/paths";
}

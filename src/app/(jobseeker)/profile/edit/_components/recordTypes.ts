/**
 * `/profile/edit` の記録系エディタ（学歴・実績・受賞・メディア掲載）が使う型と小道具。
 *
 * ⚠️ **ProfileEditClient.tsx から切り出しただけ**（2026-08-15・挙動は変えていない）。
 *    親と `_components/RecordEditors.tsx` の両方が使うので、どちらにも置けない。
 *    親に置くと RecordEditors → 親 の循環 import になる。
 */

export type EducationSchoolMaster = {
  id: string;
  name: string;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
};

export type Education = {
  id: string;
  school: string;
  school_id: string | null;             // Phase 3: FK to ow_schools (nullable)
  school_master: EducationSchoolMaster | null; // Phase 3: JOIN result
  faculty: string | null;
  degree: string | null;
  enrolled_at: string | null;
  graduated_at: string | null;
  is_current: boolean;
  sort_order: number;
};

export type School = {
  id: string;
  name: string;
  name_kana: string | null;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
  type: string;
};

export type Achievement = {
  id: string;
  title: string;
  value: number | null;
  unit: string | null;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  sort_order: number;
};

export type Award = {
  id: string;
  title: string;
  issuer: string | null;
  awarded_at: string | null;
  description: string | null;
  sort_order: number;
};

export type MediaAppearance = {
  id: string;
  title: string;
  media_name: string | null;
  url: string | null;
  thumbnail_url: string | null;
  appeared_at: string | null;
  description: string | null;
  sort_order: number;
};

export const EDU_YEAR_OPTS  = Array.from({ length: 61 }, (_, i) => new Date().getFullYear() + 4 - i);

export function parseDateToYM(s: string | null): { year: string; month: string } {
  if (!s) return { year: "", month: "" };
  const [y, m] = s.split("-");
  return { year: y ?? "", month: m ? String(parseInt(m, 10)) : "" };
}

export function formatYMToDate(year: string, month: string): string | null {
  if (!year || !month) return null;
  return `${year}-${month.padStart(2, "0")}-01`;
}

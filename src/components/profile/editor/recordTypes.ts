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
  /** どの職歴の話か。null は「その他の実績・受賞」（4-2 で追加） */
  experience_id: string | null;
};

export type Award = {
  id: string;
  title: string;
  issuer: string | null;
  awarded_at: string | null;
  description: string | null;
  sort_order: number;
  /** どの職歴の話か。null は「その他の実績・受賞」（4-2 で追加） */
  experience_id: string | null;
};

/**
 * 資格（2026-08-24）。LinkedIn の「資格」に合わせた5項目。
 * ⚠️ 形は `ProfileSections.tsx` の `CertificationRow` と揃えること。
 * ⚠️ **`experience_id` は持たない。** 資格は職歴に紐づかない。
 */
export type Certification = {
  id: string;
  name: string;
  issuer: string | null;
  /** 発行日。DB は date だが**画面は年月まで**（API が YYYY-MM-01 に正規化する） */
  issued_at: string | null;
  credential_id: string | null;
  credential_url: string | null;
  sort_order: number;
};

/**
 * 言語（2026-08-24）。LinkedIn の「言語」に合わせた2項目。
 * ⚠️ 形は `ProfileSections.tsx` の `LanguageRow` と揃えること。
 * ⚠️ **話せる言語**であって、プログラミング言語（`lib/techStack.ts`）ではない。
 */
export type Language = {
  id: string;
  /**
   * 言語マスタ（`ow_languages`）。**正はこちら**（2026-08-27 にマスタ化）。
   * ⚠️ nullable なのは DB が nullable なため。**入力経路は API が必須にしている。**
   */
  language_id: string | null;
  /**
   * ⚠️ **マスタの `label` の複製。** 正は `language_id`。
   *    読み手の `u/[id]/page.tsx` と `mypage/page.tsx` がまだこれを直接読むので残してある。
   *    API が「マスタの label と一致すること」を検証している（自由入力の復活を防ぐ唯一の防御）。
   *    → docs/todo.md「name が language_id と二重管理になっている」
   */
  name: string;
  /** 習熟度。値は `lib/constants/languageProficiency.ts` の5値。未選択は null */
  proficiency: string | null;
  sort_order: number;
};

/**
 * 標準スキル（2026-08-27）。`ow_user_skills` 1行 ＋ 参照先の `ow_skills`。
 *
 * ⚠️ **自由入力は無い。** 表示名も区分も `ow_skills`（運営が管理するマスタ）が持つ。
 *    ここに `name: string` を足して自由入力を受けられる形にしないこと。
 *    語彙が閉じていることが `/search` の前提になっている。
 * ⚠️ **年数・習熟度は持たない。** 自己申告は保存した瞬間から古くなる
 *    （`ow_profiles.experience_years` を都度計算に変えたのと同じ理由）。
 * ⚠️ 形は `ProfileSections.tsx` の `UserSkillRow` と揃えること。
 */
export type UserSkill = {
  /** ⚠️ `ow_user_skills.id`。`skill_id`（マスタ側）と混同しない */
  id: string;
  skill_id: string;
  skill: { id: string; label: string; category: string } | null;
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

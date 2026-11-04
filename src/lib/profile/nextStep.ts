/**
 * ★プロフィールの「次の1件」（2026-11-04 に lib/people/sidebarData.ts から切り出した）。
 *   **純粋な値と関数。何も import しない**（node のテストから読むため）。
 *
 * 出る場所は2つ:
 *   /people の左サイドバーの箱（ProfileCard）… 長い文言（SIDEBAR_LABEL）。行き先は /mypage（従来どおり）
 *   ホームと /search の左のカードの1行（HomeProfileCard）… 短い文言（SHORT_LABEL）。行き先は /mypage の該当の欄（?focus=）
 *
 * ⚠️★割合（%）も件数（あと N 項目）も出さないこと。次の1件だけ（docs/profile-progress-20260910.md）。
 * ⚠️★生年月日・希望条件を入れないこと。ここが勧めるのは「埋めると他のユーザーに伝わる項目」だけ。
 * ⚠️ 全部埋まっていたら null。「完了！」を出さない（達成の演出は情報を増やさない）。
 */

export type ProfileNextStepKey = "career" | "photo" | "education" | "school" | "headline" | "about";

export type ProfileNextStepInput = {
  experienceCount: number;
  hasAvatar: boolean;
  hasAboutMe: boolean;
  hasHeadline: boolean;
  educationCount: number;
  /** 学校名を手で打った（学校の一覧につながっていない）学歴の件数 */
  freeTextEducationCount: number;
};

/** 判定の順番: 職歴 → 写真 → 学歴 → 学歴の学校を一覧から選ぶ → 肩書き → 自己紹介 */
export function pickProfileNextStep(d: ProfileNextStepInput): ProfileNextStepKey | null {
  if (d.experienceCount === 0) return "career";
  if (!d.hasAvatar) return "photo";
  /* ★学歴は写真の次（2026-10-21。それまでは最後）。同じ学校の人が見つかるようになったため */
  if (d.educationCount === 0) return "education";
  /* ★学校名を手で打った学歴は、学校のページにも「同じ学校の人」にもつながらない（2026-10-21）。
     ⚠️ 運営がつなぎ直さない。本人に一覧から選び直してもらう（本人の学歴を書き換えないため / 柴さんの判断） */
  if (d.freeTextEducationCount > 0) return "school";
  if (!d.hasHeadline) return "headline";
  if (!d.hasAboutMe) return "about";
  return null;
}

/** /people の左サイドバーの箱の文言（従来の文言のまま。2026-11-04 時点で変えていない） */
export const PROFILE_NEXT_STEP_SIDEBAR_LABEL: Record<ProfileNextStepKey, string> = {
  career: "職歴を追加する",
  photo: "プロフィール写真を追加する",
  education: "学歴を追加して、同じ学校の人を見つける",
  school: "学歴の学校を一覧から選んで、同じ学校の人を見つける",
  headline: "肩書きを1行で書く",
  about: "自己紹介を書く",
};

/**
 * ★ホームの左のカードの1行（2026-11-04 / 柴さんの指示）。225px のカードで1行に収まる長さ。
 * ⚠️ career は無い。職歴0件のときは肩書きの欄に「職歴を入れる」が出ているので、この行は出さない（homeProfileNextStep）
 */
export const PROFILE_NEXT_STEP_SHORT_LABEL: Record<ProfileFocusKey, string> = {
  photo: "写真を追加する",
  education: "学歴を入れる",
  school: "学歴の学校を一覧から選ぶ",
  headline: "肩書きを入れる",
  about: "自己紹介を書く",
};

/** /mypage を開いたときに寄せる欄（?focus=）。読むのは ProfileTab */
export type ProfileFocusKey = Exclude<ProfileNextStepKey, "career">;

export const PROFILE_FOCUS_PARAM = "focus";

export function profileNextStepHref(key: ProfileFocusKey): string {
  return `/mypage?${PROFILE_FOCUS_PARAM}=${key}`;
}

/** ?focus= の値を読む。知らない値は null（何もしない） */
export function parseProfileFocus(v: string | null | undefined): ProfileFocusKey | null {
  return v === "photo" || v === "education" || v === "school" || v === "headline" || v === "about" ? v : null;
}

/** ホームの左のカードに出す1行。職歴0件（肩書きの欄に「職歴を入れる」）と全部埋まっているときは null */
export function homeProfileNextStep(key: ProfileNextStepKey | null): { label: string; href: string } | null {
  if (!key || key === "career") return null;
  return { label: PROFILE_NEXT_STEP_SHORT_LABEL[key], href: profileNextStepHref(key) };
}

/**
 * プロフィール完成度の計算。
 *
 * ── なぜ切り出したか（2026-08-04）────────────────────────────────────────────
 * 元は ProfileCompletionBar.tsx（"use client"）の中にあり、
 * /mypage と /profile/edit だけが使っていた。
 * /people の並び順にも同じ基準を使いたいが、あちらはサーバー側で計算するため
 * クライアントモジュールからは呼べない。純関数だけをここに移した。
 * ProfileCompletionBar は再エクスポートしているので既存の import は変わらない。
 *
 * ── 2つのスコアがある ──────────────────────────────────────────────────────
 *   calcCompletion()  100点満点。本人に「次に何を埋めるか」を示すためのもの
 *   calcPublicScore()  81点満点。公開一覧（/people）の並び順に使うもの
 *
 * 分けている理由は下の PUBLIC_KEYS のコメントを参照。
 *
 * ── 配点の変更（2026-08-04）────────────────────────────────────────────────
 * スキルタグ機能の廃止で空いた15点を職歴に寄せた。
 *   職歴 20 → 30 / 自己紹介 8 → 12 / プロフィール画像 10 → 11
 * 「職歴が最も重い」形は維持している。合計は 100 のまま。
 *
 * ⚠️ 資格の廃止では点は空かない。「資格・実績」項目は
 *    実績・受賞・メディア掲載（ow_user_achievements / ow_user_awards /
 *    ow_user_media_appearances）が残るため存続する。3点はそのまま。
 *    ラベルだけ「実績・受賞」に変えた。
 */

export type CompletionInput = {
  hasName: boolean;
  hasAboutMe: boolean;
  hasLocation: boolean;
  hasBirthDate: boolean;
  hasAvatar: boolean;
  experienceCount: number;
  educationCount: number;
  /** 希望条件が1つでも入っているか。**必ず hasCareerPreferences() で作ること** */
  hasPreferences: boolean;
  /** 実績・受賞・メディア掲載の合計。資格は 2026-08-04 に廃止 */
  certOrAchievementCount: number;
  socialOrContentCount: number;
};

/**
 * 希望条件が1つでも入っているか。**判定はここ1本に寄せる。**
 *
 * ── なぜ関数にしたか（2026-08-07）────────────────────────────────────────────
 * 同じ「希望条件」15点の判定が2箇所にあり、条件が食い違っていた。
 *   ProfileEditClient : job_type || work_style || timing
 *   mypage/page.tsx   : job_type || work_style || **salary_min** || timing
 * 希望年収だけを入れた人は /mypage で 15点、/profile/edit で 0点になり、
 * 同じユーザーの完成度が画面によって 15点ずれていた。
 *
 * ⚠️ 採った形は「**希望条件のうち1つでも入っていれば達成**」。
 *    列を1つずつ書き並べる形だと、項目が増減するたび2箇所を直す必要が戻る。
 *    experience_years は 2026-08-07 に希望条件から外れた（職歴から自動計算）ので
 *    含めない。
 *
 * ⚠️ 希望職種は ow_profile_desired_roles（別テーブル）に移ったので、
 *    件数を desiredRoleCount で渡す。旧 job_type 列は見ない。
 */
export function hasCareerPreferences(p: {
  desiredRoleCount?: number;
  desired_work_styles?: string[] | null;
  desired_salary_min?: number | null;
  desired_salary_max?: number | null;
  transfer_timing?: string | null;
  desired_phase?: string[] | null;
  worry?: string | null;
}): boolean {
  return Boolean(
    (p.desiredRoleCount ?? 0) > 0 ||
    (p.desired_work_styles && p.desired_work_styles.length > 0) ||
    p.desired_salary_min != null ||
    p.desired_salary_max != null ||
    p.transfer_timing ||
    (p.desired_phase && p.desired_phase.length > 0) ||
    p.worry
  );
}

export type ScoreItem = {
  key: keyof CompletionInput | string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
  /** `/profile/edit` のタブキー（素の値）。
   *  ⚠️ 先頭に `#` を付けないこと。2026-08-10 まで "#career" のようなハッシュで
   *     持っており、`/profile/edit#career` へ飛ばしていた。ページは `?tab=` しか
   *     見ないため、**どの項目を押しても「基本情報」に着地していた**。
   *  ⚠️ 値は ProfileEditClient の VALID_TABS に実在するキーだけ。 */
  tab: string;
};

function buildItems(d: CompletionInput): ScoreItem[] {
  return [
    { key: "avatar",   label: "プロフィール画像",       done: d.hasAvatar,                      weight: 11, hint: "写真を追加する",              tab: "basic" },
    { key: "name",     label: "名前",                  done: d.hasName,                        weight: 8,  hint: "名前を入力する",              tab: "basic" },
    { key: "aboutMe",  label: "自己紹介",              done: d.hasAboutMe,                     weight: 12, hint: "自己紹介を書く",              tab: "basic" },
    { key: "location", label: "所在地",                done: d.hasLocation,                    weight: 4,  hint: "所在地を設定する",            tab: "basic" },
    { key: "birth",    label: "生年月日",              done: d.hasBirthDate,                   weight: 4,  hint: "生年月日を入力する",          tab: "basic" },
    { key: "career",   label: "職歴",                  done: d.experienceCount >= 1,            weight: 30, hint: "職歴を追加する",              tab: "career" },
    { key: "edu",      label: "学歴",                  done: d.educationCount >= 1,             weight: 10, hint: "学歴を追加する",              tab: "career" },
    { key: "prefs",    label: "希望条件",              done: d.hasPreferences,                  weight: 15, hint: "希望職種・勤務スタイルを入力する", tab: "preferences" },
    { key: "certs",    label: "実績・受賞",            done: d.certOrAchievementCount >= 1,    weight: 3,  hint: "実績や受賞歴を追加する",      tab: "certs_achievements" },
    { key: "social",   label: "SNS・発信",             done: d.socialOrContentCount >= 1,      weight: 3,  hint: "SNSリンクや発信コンテンツを追加する", tab: "socials_content" },
  ];
}

export function calcCompletion(d: CompletionInput): { score: number; items: ScoreItem[] } {
  const items = buildItems(d);
  const score = items.reduce((acc, it) => acc + (it.done ? it.weight : 0), 0);
  return { score, items };
}

/**
 * 公開一覧の並び順に使う項目。
 *
 * 100点満点から「希望条件」(15) と「生年月日」(4) を外した 81点満点。
 *
 * ⚠️ 外している理由は重要度ではなく、**公開されない情報だから**。
 *    希望条件（希望職種・勤務スタイル・希望年収・転職時期）はスカウト用の非公開情報で、
 *    公開プロフィールにもカードにも出ない。これを並び順に入れると
 *    「非公開情報を埋めた人が公開一覧で上に来る」ことになり、
 *    見ている側からは理由の分からない順序になる。
 *    生年月日も同じ。年代フィルタに使うだけで、値そのものは出さない。
 *
 * ⚠️ ここに prefs / birth を足さないこと。足すと上の問題が戻る。
 *    型でも防いでいる（PublicCompletionInput が2つを受け取らない）。
 */
const PUBLIC_KEYS = ["avatar", "name", "aboutMe", "location", "career", "edu", "certs", "social"] as const;

export type PublicCompletionInput = Omit<CompletionInput, "hasPreferences" | "hasBirthDate">;

export function calcPublicScore(d: PublicCompletionInput): number {
  // 除外する2項目には固定値を渡す。PUBLIC_KEYS に含まれないので結果に影響しない。
  const items = buildItems({ ...d, hasPreferences: false, hasBirthDate: false });
  const allow = new Set<string>(PUBLIC_KEYS);
  return items.reduce((acc, it) => acc + (allow.has(String(it.key)) && it.done ? it.weight : 0), 0);
}

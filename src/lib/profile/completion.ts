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
 */

export type CompletionInput = {
  hasName: boolean;
  hasAboutMe: boolean;
  hasLocation: boolean;
  hasBirthDate: boolean;
  hasAvatar: boolean;
  experienceCount: number;
  educationCount: number;
  skillCount: number;
  hasPreferences: boolean; // job_type OR work_style OR timing
  certOrAchievementCount: number;
  socialOrContentCount: number;
};

export type ScoreItem = {
  key: keyof CompletionInput | string;
  label: string;
  done: boolean;
  weight: number;
  hint: string;
  tab: string; // profile/edit tab or mypage anchor
};

function buildItems(d: CompletionInput): ScoreItem[] {
  return [
    { key: "avatar",   label: "プロフィール画像",       done: d.hasAvatar,                      weight: 10, hint: "写真を追加する",              tab: "#basic" },
    { key: "name",     label: "名前",                  done: d.hasName,                        weight: 8,  hint: "名前を入力する",              tab: "#basic" },
    { key: "aboutMe",  label: "自己紹介",              done: d.hasAboutMe,                     weight: 8,  hint: "自己紹介を書く",              tab: "#basic" },
    { key: "location", label: "所在地",                done: d.hasLocation,                    weight: 4,  hint: "所在地を設定する",            tab: "#basic" },
    { key: "birth",    label: "生年月日",              done: d.hasBirthDate,                   weight: 4,  hint: "生年月日を入力する",          tab: "#basic" },
    { key: "career",   label: "職歴",                  done: d.experienceCount >= 1,            weight: 20, hint: "職歴を追加する",              tab: "#career" },
    { key: "edu",      label: "学歴",                  done: d.educationCount >= 1,             weight: 10, hint: "学歴を追加する",              tab: "#career" },
    { key: "skills",   label: `スキル（3件以上）`,     done: d.skillCount >= 3,                weight: 15, hint: `スキルをあと${Math.max(0, 3 - d.skillCount)}件追加する`, tab: "#skills" },
    { key: "prefs",    label: "希望条件",              done: d.hasPreferences,                  weight: 15, hint: "希望職種・勤務スタイルを入力する", tab: "#preferences" },
    { key: "certs",    label: "資格・実績",            done: d.certOrAchievementCount >= 1,    weight: 3,  hint: "資格や実績を追加する",        tab: "#certs_achievements" },
    { key: "social",   label: "SNS・発信",             done: d.socialOrContentCount >= 1,      weight: 3,  hint: "SNSリンクや発信コンテンツを追加する", tab: "#socials_content" },
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
const PUBLIC_KEYS = ["avatar", "name", "aboutMe", "location", "career", "edu", "skills", "certs", "social"] as const;

/** 公開項目だけの満点。81。 */
export const PUBLIC_SCORE_MAX = 81;

/** 非公開項目（希望条件・生年月日）を受け取らない入力型。 */
export type PublicCompletionInput = Omit<CompletionInput, "hasPreferences" | "hasBirthDate">;

export function calcPublicScore(d: PublicCompletionInput): number {
  // 除外する2項目には固定値を渡す。PUBLIC_KEYS に含まれないので結果に影響しない。
  const items = buildItems({ ...d, hasPreferences: false, hasBirthDate: false });
  const allow = new Set<string>(PUBLIC_KEYS);
  return items.reduce((acc, it) => acc + (allow.has(String(it.key)) && it.done ? it.weight : 0), 0);
}

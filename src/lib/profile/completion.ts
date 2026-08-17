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

type CompletionInput = {
  hasName: boolean;
  hasAboutMe: boolean;
  /** 肩書き1行（40字）。⚠️ 名前の直下に出るので、自己紹介より先に読まれる */
  hasHeadline: boolean;
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
  /** 希望勤務地（2026-08-15 追加）。⚠️ 「1つでも入っていれば達成」の既存の形に足すだけ */
  desired_prefectures?: string[] | null;
  desired_salary_min?: number | null;
  desired_salary_max?: number | null;
  transfer_timing?: string | null;
  desired_phase?: string[] | null;
}): boolean {
  return Boolean(
    (p.desiredRoleCount ?? 0) > 0 ||
    (p.desired_work_styles && p.desired_work_styles.length > 0) ||
    (p.desired_prefectures && p.desired_prefectures.length > 0) ||
    p.desired_salary_min != null ||
    p.desired_salary_max != null ||
    p.transfer_timing ||
    (p.desired_phase && p.desired_phase.length > 0)
  );
  /* ⚠️ `worry` は 2026-08-17 に判定から外した。入力欄も API の受け口も無くなったので、
        これを見続けると「もう入力できない値」で達成扱いになる人が残る。
        実測: 49件中3件がこれだけで達成扱いだった（達成 6件 → 3件）。 */
}

/* ⚠️ **完成度バー（100点満点）は 2026-08-16 に廃止した。**
      `ScoreItem` / `buildItems` / `calcCompletion` と `ProfileCompletionBar.tsx` を削除。
      プロフィール本体が `/mypage` に出るようになり、タブの「未設定」バッジが
      同じ役割を果たすため。

   ⚠️ **配点表は `docs/todo.md` に書き写してある**（職歴30 / 希望条件15 / 画像11 /
      学歴10 / 名前8 / 自己紹介8 / 肩書き4 / 所在地4 / 生年月日4 / 実績3 / SNS3 = 100）。
      議論して決めた配分なので、戻すときは数字を作り直さずそこから拾うこと。

   ⚠️ **下の `calcPublicScore` は現役**（`/people` の並び順）。消さないこと。
      そのため**配点そのものは残っている**（`ITEM_WEIGHTS`）。消えたのは
      「100点満点の合計を出して画面に並べる」ほうだけ。 */

/** 項目 → 配点。⚠️ `calcPublicScore` が使う。合計は100（廃止した完成度バーと同じ表） */
const ITEM_WEIGHTS: { key: string; weight: number; done: (d: CompletionInput) => boolean }[] = [
  { key: "avatar",   weight: 11, done: (d) => d.hasAvatar },
  { key: "name",     weight: 8,  done: (d) => d.hasName },
  /* ⚠️ 自己紹介は元は 12。一覧やスカウトで先に読まれるのは名前の直下の1行なので、
        8 に下げて**肩書きへ 4 を回した**。合計100は変えない。 */
  { key: "headline", weight: 4,  done: (d) => d.hasHeadline },
  { key: "aboutMe",  weight: 8,  done: (d) => d.hasAboutMe },
  { key: "location", weight: 4,  done: (d) => d.hasLocation },
  { key: "birth",    weight: 4,  done: (d) => d.hasBirthDate },
  { key: "career",   weight: 30, done: (d) => d.experienceCount >= 1 },
  { key: "edu",      weight: 10, done: (d) => d.educationCount >= 1 },
  { key: "prefs",    weight: 15, done: (d) => d.hasPreferences },
  { key: "certs",    weight: 3,  done: (d) => d.certOrAchievementCount >= 1 },
  { key: "social",   weight: 3,  done: (d) => d.socialOrContentCount >= 1 },
];

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
/* ⚠️ `headline` は**公開される**（/u/[id] の名前の下に出る）ので、公開スコアにも入れる。
      入れないと「公開プロフィールに出る項目なのに一覧の並びに効かない」ことになる。 */
const PUBLIC_KEYS = ["avatar", "name", "headline", "aboutMe", "location", "career", "edu", "certs", "social"] as const;

export type PublicCompletionInput = Omit<CompletionInput, "hasPreferences" | "hasBirthDate">;

export function calcPublicScore(d: PublicCompletionInput): number {
  // 除外する2項目には固定値を渡す。PUBLIC_KEYS に含まれないので結果に影響しない。
  const full: CompletionInput = { ...d, hasPreferences: false, hasBirthDate: false };
  const allow = new Set<string>(PUBLIC_KEYS);
  return ITEM_WEIGHTS.reduce((acc, it) => acc + (allow.has(it.key) && it.done(full) ? it.weight : 0), 0);
}

/**
 * 希望条件（ow_profiles）の選択肢。**クライアントと API の両方がここを見る。**
 *
 * ── なぜ共通化したか（2026-08-07）────────────────────────────────────────────
 * 選択肢が ProfileEditClient.tsx の JSX に直書きされ、
 * API（career-preferences）は `slice(0, 200)` するだけで**検証していなかった**。
 * 任意の文字列がそのまま保存できる状態で、
 * 表示側（/biz/candidates のラベル辞書など）と食い違っても気づけない。
 * careerOptions.ts と同じ形に寄せる。
 *
 * ⚠️ 選択肢を増やすときはこの1箇所を直す。API 側にだけ Set を書かないこと。
 * ⚠️ 値を**変える**ときは既存データの移行を伴う。
 *    ここは「今後受け付ける値」の定義であり、DB にある過去の値を消しはしない。
 */

/**
 * 希望勤務スタイル。
 *
 * ⚠️ "flexible"（柔軟に対応できる）は 2026-08-07 に選択肢から外した。
 *    ow_jobs.work_style 側に対応する値が無く、scoreJob の normWorkStyle() にも
 *    分岐が無いため、選んだ人は勤務スタイル18点が**永久に0点**だった。
 *    既存データ（2026-08-07 時点で1件）は消さない。下の LEGACY を参照。
 */
export const DESIRED_WORK_STYLES = [
  { value: "full_remote", label: "フルリモート希望" },
  { value: "hybrid",      label: "ハイブリッド（週1〜3出社）" },
  { value: "on_site",     label: "出社中心" },
] as const;

/**
 * 選択肢からは外したが、DB に残っている値。
 * **検証では通す**（本人が他の項目を保存したときに 400 で弾かれないように）。
 * 選択肢としては出さないので、選び直すと新しい値に置き換わる。
 */
export const DESIRED_WORK_STYLES_LEGACY = ["flexible"] as const;

export const TRANSFER_TIMINGS = [
  { value: "即時",         label: "すぐにでも（即時）" },
  { value: "1〜3ヶ月以内",  label: "1〜3ヶ月以内" },
  { value: "半年以内",      label: "半年以内" },
  { value: "1年以内",       label: "1年以内" },
  { value: "情報収集中",    label: "まだ情報収集段階" },
] as const;

/** 興味のある企業フェーズ（複数選択）。値＝表示ラベル */
export const DESIRED_PHASES = ["シリーズA", "シリーズB", "シリーズC", "上場"] as const;

/** 今一番の悩み・相談テーマ。値＝表示ラベル */
export const WORRIES = [
  "転職すべきか迷っている",
  "年収を大幅に上げたい",
  "外資・グローバル企業に行きたい",
  "キャリアチェンジを考えている",
  "スタートアップに興味がある",
  "まず話を聞いてみたい",
] as const;

// ─── 検証用の Set（API から使う）─────────────────────────────────────────────

export const VALID_DESIRED_WORK_STYLES = new Set<string>([
  ...DESIRED_WORK_STYLES.map((o) => o.value),
  ...DESIRED_WORK_STYLES_LEGACY,
]);

export const VALID_TRANSFER_TIMINGS = new Set<string>(TRANSFER_TIMINGS.map((o) => o.value));

export const VALID_DESIRED_PHASES = new Set<string>(DESIRED_PHASES);

export const VALID_WORRIES = new Set<string>(WORRIES);

/** 希望年収（万円）の上限。UI の max と API の検証が共有する */
export const SALARY_MAX_MAN = 9999;

/**
 * 勤務形態（`full_remote` / `hybrid` / `on_site`）の日本語表記。
 * **画面に出す文言はここだけで決める。各画面に直書きしない。**
 *
 * ── なぜ集めたか（2026-08-08）────────────────────────────────────────────────
 * DB の値は3つしかないのに、表示ラベルが**6通り**に割れていた。
 *
 *   /jobs のカード（queries.ts）      フルリモート可 / ハイブリッド / 原則出社
 *   /admin/jobs（2ファイル）          同上
 *   /companies の検索バー             🏡 フルリモート / 🔀 ハイブリッド / 🏢 出社のみ
 *   求人フォーム（careerOptions）     フルリモート可 / ハイブリッド（週2-3日出社）/ 原則出社
 *   /jobs の勤務形態フィルタ          フルリモート / ハイブリッド / 出社（**部分一致の検索語**）
 *
 * 同じ求人が画面によって「原則出社」だったり「出社のみ」だったりする状態だった。
 *
 * ⚠️ `/jobs` のフィルタは JobsClient の `WORK_STYLE_FILTERS` に別途ある。
 *    あちらは**表示ラベルへの部分一致で使う検索語**で、用途が違うので分けてある。
 *    「出社」は「フル出社」に部分一致するので、ここを変えても当たり続ける。
 *
 * ⚠️ 求職者の**希望**勤務スタイル（`ow_profiles.desired_work_styles`）は別物。
 *    そちらは careerPreferences.ts の `DESIRED_WORK_STYLES`（「出社中心」など）。
 *    「企業/求人がどうであるか」と「本人がどうしたいか」を同じ言葉にしない。
 */

/** 一覧・詳細・管理画面に出す短いラベル */
export const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート",
  hybrid: "ハイブリッド",
  on_site: "フル出社",
};

/** 絞り込みの選択肢。順番はそのまま画面に出る */
export const WORK_STYLE_OPTIONS = [
  { value: "full_remote", label: WORK_STYLE_LABELS.full_remote },
  { value: "hybrid", label: WORK_STYLE_LABELS.hybrid },
  { value: "on_site", label: WORK_STYLE_LABELS.on_site },
] as const;

/**
 * 求人フォームの勤務形態セレクト。**value は DB に入れる英語、label は画面に出す日本語。**
 *
 * ⚠️ ラベルに補足（週2-3日出社）が付いている点だけ上と違う。
 *    入力時は「ハイブリッドとは何日出社か」が分かったほうがよいので残している。
 *    ⚠️ 分けてよいが、離して置かない。value の集合は上と必ず同じにすること
 *    （DB の CHECK は ow_jobs_remote_work_status_check）。
 *
 * ⚠️ 2026-08-07 以前は JobEditForm が日本語ラベルをそのまま送っており、
 *    **勤務形態を選ぶと保存が 23514 で落ちていた**。ラベルを送らない。value を送る。
 */
export const REMOTE_WORK_STATUSES = [
  { value: "full_remote", label: "フルリモート" },
  { value: "hybrid", label: "ハイブリッド（週2-3日出社）" },
  { value: "on_site", label: "フル出社" },
] as const;

export const VALID_REMOTE_WORK_STATUSES = new Set<string>(
  REMOTE_WORK_STATUSES.map((o) => o.value),
);

/** 値 → 表示ラベル。未知の値はそのまま返す（黙って消さない） */
export function workStyleLabel(value: string | null | undefined): string {
  if (!value) return "";
  return WORK_STYLE_LABELS[value] ?? value;
}

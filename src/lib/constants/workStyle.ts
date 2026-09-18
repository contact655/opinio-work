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
  /* ⚠️★`other` は **`ow_companies` にしかない**（求人・職歴の CHECK は3値）。
        ここに無いと `WORK_STYLE_LABELS[raw] ?? raw` が**生の "other" を画面に出す**
        （`queries.ts` のカードのタグ・`/admin/jobs` の一覧がこの形）。
        2026-09-18 に追加。**消さないこと。** */
  other: "その他",
};

/**
 * 絞り込みの選択肢。順番はそのまま画面に出る。
 *
 * ⚠️★**`other` を足さないこと**（2026-09-18）。理由は2つ:
 *    ① 実測（2026-09-18 / 全104社）で **`other` は0社**。このリポジトリの
 *       「0件の選択肢を出さない」に反する（例外は 都道府県 / フェーズ /
 *       事業領域チップ / `/people` の年代 の4つだけ）。
 *    ② 「その他」で絞りたい求職者はいない。表示（上の LABELS）と
 *       絞り込み（ここ）は**別の用途**なので、集合が違ってよい。
 */
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


/**
 * ★企業フォーム（`/biz/company`）の勤務形態セレクト。**value は英字・label は日本語。**
 *
 * ⚠️★**2026-09-18 まで、ここが `lib/business/mockCompany.ts` の `REMOTE_OPTIONS`
 *    （日本語を value にした4件）だった。** DB の CHECK は英字なので、
 *    **企業が勤務形態を選ぶと `ow_companies` の UPDATE が 23514 で丸ごと失敗していた**
 *    （列単位 GRANT なので1列でも弾かれると PATCH 全体が落ちる）。
 *    実測（2026-09-18）: 4つの日本語ラベルすべてが 23514。`hybrid` だけ通る。
 *    **`phase` で 2026-09-06 に直したのと同じ形が、この列で残っていた。**
 *
 * ⚠️★**求人の `REMOTE_WORK_STATUSES`（3値）と value の集合が違う。統合しないこと。**
 *    DB がそうなっている ——`ow_companies` だけ4値で、`ow_jobs` と
 *    `ow_experiences` は3値（`other` が無い）。
 *    `EMPLOYMENT_TYPES` と `JOB_EMPLOYMENT_TYPES` を分けてあるのと同じ形。
 *    ⚠️ **分けてよいが、離して置かない。** 値を足す日は DB の CHECK も同時に広げる。
 *
 * ⚠️ ラベルの文言は 2026-09-18 以前の `REMOTE_OPTIONS` から**変えていない**
 *    （「フルリモート可」「原則出社」は上の LABELS と少し違うが、
 *    入力時は「可」「原則」が付いたほうが選びやすいので維持）。
 */
export const COMPANY_REMOTE_WORK_STATUSES: { value: string; label: string }[] = [
  { value: "full_remote", label: "フルリモート可" },
  { value: "hybrid", label: "ハイブリッド（週2-3日出社）" },
  { value: "on_site", label: "原則出社" },
  { value: "other", label: "その他" },
];

/** `/biz/company` と `/admin/companies/[id]` のセレクトに渡す（未選択を含む） */
export const COMPANY_REMOTE_WORK_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "未選択" },
  ...COMPANY_REMOTE_WORK_STATUSES,
];

/**
 * API の許容値（`ow_companies.remote_work_status`）。
 * ⚠️★**呼び出し側に配列を書き写さないこと。** `/admin` は 2026-09-18 まで
 *    `new Set([...])` を手書きしており、**5つ目の語彙**になっていた。
 */
export const VALID_COMPANY_REMOTE_WORK_STATUSES = new Set<string>(
  COMPANY_REMOTE_WORK_STATUSES.map((o) => o.value),
);

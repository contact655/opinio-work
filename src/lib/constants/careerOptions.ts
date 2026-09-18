/**
 * 職歴・学歴の入力で使う許容値。**クライアントと API の両方がここを見る。**
 *
 * ── なぜ共通化したか（2026-08-07）────────────────────────────────────────────
 * 2026-07-01 の一括バリデーション追加（0735cfe7）で、API 側だけに許容値の
 * Set が書かれ、**クライアントの選択肢と食い違った**。
 *   API: 正社員 / 契約社員 / 業務委託 / アルバイト / インターン / その他
 *   UI : 正社員 / 契約社員 / **派遣社員** / 業務委託 / **アルバイト・パート** / その他
 * 「派遣社員」「アルバイト・パート」を選ぶと、API が**黙って null に落としていた**。
 * 同じコミットで学歴の日付形式も食い違い、1ヶ月以上 null に落ち続けた。
 *
 * ⚠️ 許容値を増やすときは、この1箇所を直せば両側に効く。
 *    API 側にだけ Set を書かないこと。
 */

/** 雇用形態。UI のセレクトと API の検証が共有する */
export const EMPLOYMENT_TYPES = [
  "正社員",
  "契約社員",
  "派遣社員",
  "業務委託",
  "アルバイト・パート",
  "その他",
] as const;

/**
 * ★雇用形態のセレクトの DOM id（2026-08-26 / フェーズ1-2）。
 *
 * `MergedTimeline` の「＋ 雇用形態を追加」は、編集モーダルを開いたあと
 * **この id を頼りに該当の項目までスクロールする。**
 * モーダルは縦に長く、開いた直後は**会社名から順に上から表示される**ので、
 * 雇用形態は画面に出ない（実測）。開くだけでは「押したのに何も起きていない」ように見える。
 *
 * ⚠️ **`CareerHistoryEditor` の `<select>` と `MergedTimeline` の2箇所が同じ値を見る。**
 *    どちらかに文字列を直書きしない。見つからなければスクロールしないだけで、
 *    モーダル自体は開いているので壊れない。
 */
export const EMPLOYMENT_TYPE_FIELD_ID = "career-employment-type";

export const JOB_EMPLOYMENT_TYPES = [
  "正社員",
  "業務委託",
  "契約社員",
  "インターン",
  "アルバイト・パート",
] as const;


export const VALID_JOB_EMPLOYMENT_TYPES = new Set<string>(JOB_EMPLOYMENT_TYPES);

/**
 * 役職ランク（`ow_experiences.rank`）。
 *
 * ⚠️ 2026-08-15 にここへ移した。それまで `CareerHistoryEditor.tsx` に
 *    直書きされており、同ファイルのコメント自身が
 *    「選択肢は careerOptions.ts と共有すること」と書いていた。
 *    公開プロフィール（/u/[id]）が役職を表示するようになり、
 *    **入力側と表示側の2箇所が同じ語彙を持つ**ことになったので実際に共通化した。
 *
 * ⚠️ **DB に入っている生値は英語**（"none" / "leader" / "manager" …）。
 *    画面に出すときは必ず `RANK_LABELS` を通すこと。生値を描画しない
 *    （`ow_companies.phase` の生値が公開ページに出ていた前例がある）。
 *
 * ⚠️ **"none"（役職なし）は表示しない。** 「役職が無い」という入力であって、
 *    出すべき値ではない。`rankLabel()` が null を返す。
 *
 * ⚠️ 実データ（2026-08-15）は none / leader / manager / NULL の4種のみ。
 *    general_manager と executive は選べるが未使用。
 *
 * ⚠️★**3層は 2026-09-18 に揃った。** それまで API だけが検証しておらず、
 *    **POST は 50字 / PUT は 100字で切るだけ**（しかも長さが食い違っていた）。
 *
 *    ⚠️ ただし症状は `phase` / `remote_work_status` とは**違った**。
 *       **DB の CHECK は baseline からある**（`ow_experiences_rank_check`）ので、
 *       「選べるのに保存できない」ではなく **23514 で職歴の保存が丸ごと 500 になる**
 *       形だった（`degree` の小中学校卒で 2026-05-30〜08-07 に踏んだのと同じ）。
 *       UI が英字の value を送るので**実害は出ていなかった**。
 *
 *    ⚠️★**許容リストを route に書き写さないこと。** 下の `isRankValue()` を使う。
 *       書き写した瞬間に UI と割れる（CLAUDE.md「許容値は1箇所に置く」）。
 */
export const RANKS = [
  { value: "none",            label: "役職なし" },
  { value: "leader",          label: "係長・リーダークラス" },
  { value: "manager",         label: "課長・マネージャークラス" },
  { value: "general_manager", label: "部長・ゼネラルマネージャークラス" },
  { value: "executive",       label: "役員クラス" },
] as const;

export const RANK_LABELS: Record<string, string> = Object.fromEntries(
  RANKS.map((r) => [r.value, r.label])
);

/**
 * `ow_experiences.rank` に入れてよい値か（2026-09-18 追加）。
 *
 * ⚠️★**API（POST / PUT）の許容値はここから導出する。** `phase.ts` の
 *    `isPhaseValue()` と同じ形。
 * ⚠️★**DB の `ow_experiences_rank_check` と同じ集合であること。**
 *    値を足す日は**ここ（UI/API）と CHECK の両方**を同じコミットで広げる。
 * ⚠️ 空・null は「未入力」なので**ここでは false**。呼び出し側が先に分けること
 *    （空文字と不正値を区別する ——CLAUDE.md「弾き方」）。
 */
export function isRankValue(value: unknown): value is string {
  return typeof value === "string" && RANK_LABELS[value] !== undefined;
}

/**
 * 表示用の役職ラベル。出すものが無ければ null。
 *
 * - NULL / 空文字      → null（未入力）
 * - "none"             → null（役職なしと明示的に選んだ）
 * - 未知の値           → null（生値を画面に出さない）
 */
export function rankLabel(rank: string | null | undefined): string | null {
  if (!rank || rank === "none") return null;
  return RANK_LABELS[rank] ?? null;
}

/** 学位。UI のセレクトと API の検証が共有する */
export const DEGREES = [
  "小学校卒",
  "中学校卒",
  "高校卒",
  "専門卒",
  "短大卒",
  "学士",
  "修士",
  "博士",
  "その他",
] as const;

/**
 * 学校区分の表示ラベル。**DB に入るのは `DEGREES` の値**（キー側）。
 *
 * ⚠️ 画面に出す言葉と保存する値を分ける（CLAUDE.md「画面に出す値と DB に入れる値が
 *    違うなら {value, label} で持つ」）。「学士」「修士」は学位の名前で、
 *    入力する人が探すのは「大学」「大学院」なので、そのまま出すと選べない。
 * ⚠️ **キーを増やすときは `DEGREES` にも足すこと。** ここだけ足すと API が 400 を返す。
 */
export const DEGREE_LABELS: Record<(typeof DEGREES)[number], string> = {
  "小学校卒": "小学校",
  "中学校卒": "中学校",
  "高校卒": "高等学校",
  "専門卒": "専門学校",
  "短大卒": "短期大学",
  "学士": "大学",
  "修士": "大学院（修士）",
  "博士": "大学院（博士）",
  "その他": "その他",
};


/**
 * 従業員数（`ow_companies.employee_count`）の表示整形。**表示のときだけ使う。**
 *
 * ── なぜ整形が要るか（2026-08-08）────────────────────────────────────────────
 * この列は `text` の**自由記述**で、非NULL 83件のうち純粋な数字は**0件**。
 * 「約100名」「1000名以上」「100〜300名」「1-10名」「約10000名」
 * 「259名（2026年1月現在）」「単体6,425名 / グループ12,862名（2026年4月現在）」
 * のように、単位・接頭辞・レンジ・注記が混ざっている。
 *
 * ⚠️ **DB の値は書き換えない。** 数値列への正規化（employee_count_min/max）は
 *    「従業員数で絞る・並べる」が必要になったときに本筋としてやること。
 *    表記のためだけに83件を移行するのは順序が逆。
 *
 * ── カンマを入れる条件（すべて満たすものだけ）──────────────────────────────
 *   ① 4桁以上の連続数字        3桁以下は不要（259名 / 100〜300名）
 *   ② 括弧の外               `（2026年1月現在）` の**年号を守る**。ここが決定的
 *   ③ 前後にカンマが無い       「9,902名」「6,425名」への二重挿入を防ぐ
 *   ④ 前後が数字でない        部分マッチで途中に入れない
 *
 * ⚠️ **迷ったら何もしない。** 想定外の値は元の文字列をそのまま返す。
 *    壊れた表示を出すくらいなら、カンマが無いほうがましという判断。
 */

/** 括弧の中か外かで分割する。全角・半角の両方を括弧として扱う */
const PAREN = /[（(][^）)]*[）)]/g;

/** 括弧の外にある4桁以上の数字にだけカンマを入れる */
function addCommasOutsideParens(text: string): string {
  /* ⚠️ matchAll のイテレータは tsconfig の target 都合で回せないので exec で回す。
        PAREN は g フラグ付きなので lastIndex を必ずリセットしてから使う。 */
  PAREN.lastIndex = 0;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = PAREN.exec(text)) !== null) {
    out += commify(text.slice(last, m.index));
    out += m[0]; // 括弧の中はそのまま（年号を守る）
    last = m.index + m[0].length;
  }
  out += commify(text.slice(last));
  return out;
}

function commify(segment: string): string {
  // ⚠️ 前後を先読み・後読みで見る。数字とカンマが隣接していたら触らない
  return segment.replace(/(?<![\d,])\d{4,}(?![\d,])/g, (n) =>
    Number(n).toLocaleString("ja-JP"),
  );
}

/**
 * 表示用の従業員数。カンマを補い、末尾に「名」が無ければ足す。
 *
 * ⚠️ 「名」の付与もここでやる。呼び出し側で `${v}名` と書かないこと。
 *    2026-08-08 まで4箇所が無条件に付けており、「約100名」が
 *    **「約100名名」**になっていた。
 *
 * @returns 値が無ければ null（呼び出し側は項目ごと消すこと。「—」を出さない）
 */
export function formatEmployeeCount(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const withCommas = addCommasOutsideParens(s);
  return /名|人/.test(withCommas) ? withCommas : `${withCommas}名`;
}

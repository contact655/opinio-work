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

// ─── 一覧カード用のレンジ表記 ────────────────────────────────────────────────

/**
 * 従業員数の帯（LinkedIn 準拠）。**下限の昇順で持つ。**
 * ⚠️ 帯を増減するときは `employeeCountBand()` のテストではなく、
 *    **実データ79件を通した分布**で確かめること（2026-08-28 の実測は下記）。
 */
const BANDS: readonly (readonly [number, number, string])[] = [
  [1, 10, "1-10名"],
  [11, 50, "11-50名"],
  [51, 200, "51-200名"],
  [201, 500, "201-500名"],
  [501, 1000, "501-1,000名"],
  [1001, 5000, "1,001-5,000名"],
  [5001, 10000, "5,001-10,000名"],
  [10001, Number.POSITIVE_INFINITY, "10,001名以上"],
];

/** 括弧（全角・半角）。**中身は範囲も時点も含めて捨てる。** */
const PARENS = /[（(][^）)]*[）)]/g;

/**
 * 自由記述の従業員数から**最初の数字**を取り出す。取れなければ null。
 *
 * ⚠️ **括弧の中は捨てる。** 「1,497名（2026年4月末時点）」の年号を数字として
 *    拾ってしまうため。`formatEmployeeCount` が括弧の外にだけカンマを入れて
 *    いるのと同じ理由（あちらは年号を守るため、こちらは年号を拾わないため）。
 *
 * ⚠️ **数字が複数あるときは最初のものを採る。** 実データで該当するのは1社だけ
 *    （伊藤忠テクノソリューションズ「単体6,425名 / グループ12,862名（2026年4月現在）」）で、
 *    **単体を採る**という判断。連結を採ると帯が 5,001-10,000名 → 10,001名以上 に変わる。
 *    ⚠️ 変えるなら、この社が一覧でどう見えるかまで確認してから変えること。
 *
 * ⚠️ 「〜10名」「1600名以上」も同じ規則。それぞれ 10 / 1600 を採る。
 */
export function parseEmployeeCount(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  const s = String(raw).replace(PARENS, "");
  const m = s.match(/[0-9][0-9,]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 一覧カード用の従業員数。**帯に落として返す。**
 *
 * ⚠️ **一覧だけで使う。** `/companies/[id]` のサイドバーと meta description は
 *    `formatEmployeeCount`（原文＋カンマ）のまま。詳細では時点や単体/連結の
 *    区別に意味があるので、帯に潰すと情報が減る。
 *    ⚠️ 詳細側をこれに差し替えないこと。差し替えるなら、括弧が持っている
 *       「日本 / グローバル / 単体」の区別（2026-08-28 実測で5社）が消えることを
 *       承知のうえで判断すること。
 *
 * ⚠️ **パースできない値は原文をそのまま返す。**
 *    2026-08-28 の実測では公開79社すべてが帯に落ちたが、入力は自由記述なので
 *    将来の値で落ちないようにしてある。**「不明」等に潰さないこと**
 *    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 *    ⚠️ ここで `formatEmployeeCount` を通さないこと。あちらは「名」が無ければ
 *       足すので、**数字を含まない値が「非公開名」になる**（2026-08-28 に実測）。
 *
 * 実測（2026-08-28 / 公開79社）:
 *   1-10名 1 / 11-50名 11 / 51-200名 28 / 201-500名 15 /
 *   501-1,000名 6 / 1,001-5,000名 15 / 5,001-10,000名 3 / 10,001名以上 0
 *
 * @returns 値が無ければ null（呼び出し側は項目ごと消すこと。「—」を出さない）
 */
export function formatEmployeeCountBand(raw: string | number | null | undefined): string | null {
  const n = parseEmployeeCount(raw);
  if (n == null) {
    if (raw == null) return null;
    const s = String(raw).trim();
    return s === "" ? null : s;
  }
  /* n >= 1 なので必ずどれかの帯に入る（最後の帯は上限が Infinity）。
     ⚠️ それでも見つからなかったときは原文に倒す。潰さない。 */
  const band = BANDS.find(([lo, hi]) => n >= lo && n <= hi);
  return band ? band[2] : String(raw).trim();
}

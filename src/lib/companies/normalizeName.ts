/**
 * 企業名の正規化（**DB の `normalize_company_name()` の写し**）。
 *
 * ── 何のためにあるか ────────────────────────────────────────────────────────
 * 企業検索は `ow_companies.search_key`（正規化済み）に対して `ilike` する。
 * **打った文字も同じ規則で正規化しないと突き合わない**ので、TS 側にも要る。
 *
 * ⚠️★★**これは SQL の写しである。規則をここで変えないこと。**
 *    正規化の実体は `public.normalize_company_name()`（migration
 *    `20260905*` 系 ＋ `20261001020000`）。片方だけ直すと、
 *    **検索が静かに当たらなくなる**（エラーにはならない）。
 *
 * ⚠️★**割れていないことは機械で確かめられる。**
 *      node scripts/check-name-normalize.mjs --self-test
 *      node scripts/check-name-normalize.mjs
 *    実企業の全社名・別名＋入力の揺れの見本を、TS と SQL の両方に通して比べる。
 *    **正規化に手を入れたら必ず走らせること。**
 *
 * ── なぜ TS に写したのか（RPC で呼ばない理由）──────────────────────────────
 * 検索は入力のたびに走るので、正規化のためだけに往復を1つ増やしたくない
 * （実測で1クエリ 60〜110ms。倍になると打鍵に追いつかない）。
 * ⚠️ 代わりに上の照合スクリプトで担保している。**スクリプトを消さないこと。**
 */

/** ① 半角の濁点・半濁点は2文字（ｶ + ﾞ）なので、単独カナより**先に**1文字へ畳む */
const HALFWIDTH_VOICED: ReadonlyArray<readonly [string, string]> = [
  ["ｶﾞ", "ガ"], ["ｷﾞ", "ギ"], ["ｸﾞ", "グ"], ["ｹﾞ", "ゲ"], ["ｺﾞ", "ゴ"],
  ["ｻﾞ", "ザ"], ["ｼﾞ", "ジ"], ["ｽﾞ", "ズ"], ["ｾﾞ", "ゼ"], ["ｿﾞ", "ゾ"],
  ["ﾀﾞ", "ダ"], ["ﾁﾞ", "ヂ"], ["ﾂﾞ", "ヅ"], ["ﾃﾞ", "デ"], ["ﾄﾞ", "ド"],
  ["ﾊﾞ", "バ"], ["ﾋﾞ", "ビ"], ["ﾌﾞ", "ブ"], ["ﾍﾞ", "ベ"], ["ﾎﾞ", "ボ"],
  ["ﾊﾟ", "パ"], ["ﾋﾟ", "ピ"], ["ﾌﾟ", "プ"], ["ﾍﾟ", "ペ"], ["ﾎﾟ", "ポ"],
  ["ｳﾞ", "ヴ"],
];

/** ② 半角カナ（単独）→ 全角カナ */
const HALFWIDTH_KANA_FROM = "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
const HALFWIDTH_KANA_TO   = "ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン";

/** ③ ひらがな → カタカナ。⚠️ 打ち間違いではなく**変換し忘れ**なので過剰一致は起きない */
const HIRAGANA = "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ";
const KATAKANA = "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ";

/** ④ 全角ラテン・数字 → 半角 */
const FULLWIDTH_ALNUM_FROM = "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ０１２３４５６７８９";
const FULLWIDTH_ALNUM_TO   = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** ⑥⑦ 日本語の法人格（前置・後置）。⚠️ SQL と同じ並び */
const LEGAL_PREFIX = /^(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)/;
const LEGAL_SUFFIX = /(株式会社|有限会社|合同会社|合資会社|合名会社|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)$/;
/** ⑧ 英語の法人格。⚠️ `.` は⑤で落ちているので `\.?` は実際には効かない（SQL も同じ） */
const LEGAL_SUFFIX_EN = /(incorporated|corporation|company|coltd|inc|corp|ltd|llc)\.?$/;

/** 1文字を対応表で置き換える（対応が無ければそのまま） */
function translateChar(ch: string, from: string, to: string): string {
  const i = from.indexOf(ch);
  return i >= 0 ? to[i] : ch;
}

/**
 * ⑤ 落とす記号（1文字ずつ判定するので `g` は付けない。付けると `test` に状態が残る）。
 * ⚠️★**長音「ー」(U+30FC) を足さないこと。** ここにあるのはハイフン・ダッシュ類だけ。
 *    「コーヒー」と「コヒ」を同じにしてしまう。
 * ⚠️ `scripts/check-name-normalize.mjs --self-test` は**この行をわざと壊す**。
 *    字面を変えたら、あちらの置換元も直すこと（直さなければ自己テストが教えてくれる）。
 */
const SINGLE_STRIP = /[\s\u3000・･.,．，‐‑‒–—―−－-]/;

/** ①の対応表（2文字 → 1文字） */
const VOICED = new Map(HALFWIDTH_VOICED);

/**
 * 正規化した文字列と、**各文字が元の何文字目から来たか**の対応を返す。
 *
 * ⚠️★対応表（`map`）は**候補の強調**（打った文字を太字にする）だけに使う。
 *    値そのものは `normalizeCompanyName()` と**同じもの**で、
 *    `scripts/check-name-normalize.mjs` が SQL と一致することを確かめている。
 */
export function normalizeWithMap(input: string): { value: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];

  // ① 半角の濁点・半濁点（2文字）を先に1文字へ畳む
  for (let i = 0; i < input.length; ) {
    const two = input.slice(i, i + 2);
    const v = VOICED.get(two);
    if (v !== undefined) { chars.push(v); map.push(i); i += 2; continue; }
    chars.push(input[i]); map.push(i); i += 1;
  }

  // ②③④ ここはすべて1文字→1文字。⚠️ 小文字化は Postgres の lower() に合わせる
  for (let i = 0; i < chars.length; i++) {
    let c = translateChar(chars[i], HALFWIDTH_KANA_FROM, HALFWIDTH_KANA_TO);
    c = translateChar(c, HIRAGANA, KATAKANA);
    c = translateChar(c, FULLWIDTH_ALNUM_FROM, FULLWIDTH_ALNUM_TO);
    chars[i] = c.toLowerCase();
  }

  // ⑤ 記号を落とす（対応表も一緒に詰める）
  const keptChars: string[] = [];
  const keptMap: number[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (SINGLE_STRIP.test(chars[i])) continue;
    keptChars.push(chars[i]);
    keptMap.push(map[i]);
  }

  // ⑥⑦⑧ 法人格を剥がす。⚠️ 剥がした分だけ対応表も切る
  let value = keptChars.join("");
  let head = 0;
  const pre = value.match(LEGAL_PREFIX);
  if (pre) { head = pre[0].length; value = value.slice(head); }
  const suf = value.match(LEGAL_SUFFIX);
  if (suf) value = value.slice(0, value.length - suf[0].length);
  const sufEn = value.match(LEGAL_SUFFIX_EN);
  if (sufEn) value = value.slice(0, value.length - sufEn[0].length);

  return { value, map: keptMap.slice(head, head + value.length) };
}


/**
 * 企業名・検索語を正規化する。空になったら `null`（SQL の `nullif(..., '')` と同じ）。
 *
 * ⚠️ 実体は `normalizeWithMap`。**規則を2つ持たない。**
 */
export function normalizeCompanyName(input: string | null | undefined): string | null {
  if (!input) return null;
  return normalizeWithMap(input).value || null;
}

/**
 * `text` の中で、`query` が一致した範囲を**元の文字列の位置**で返す。
 * 一致しなければ `null`。
 *
 * ⚠️★**正規化どうしで突き合わせてから元へ戻す。** そうしないと、
 *    「せーるすふぉーす」と打った人に「セールスフォース」を強調できない
 *    ——まさにそれが目的（2026-10-01 / 柴さんの指示）。
 *
 * ⚠️ 強調は**見た目だけ**。一致判定そのものは DB 側（`search_key`）が持つので、
 *    ここが `null` を返しても候補は出る。**出す／出さないの判断に使わないこと。**
 */
export function findQueryRange(text: string, query: string): [number, number] | null {
  if (!text || !query) return null;
  const t = normalizeWithMap(text);
  const q = normalizeWithMap(query);
  if (!t.value || !q.value) return null;
  const at = t.value.indexOf(q.value);
  if (at < 0) return null;
  const start = t.map[at];
  /* ⚠️ 終わりは「最後に一致した文字の元の位置 + 1」。
        元で2文字だったもの（半角濁点）に当たると1文字ぶん足りないが、
        **強調が1文字短くなるだけ**なので許容する（判定には使わない）。 */
  const lastIdx = t.map[at + q.value.length - 1];
  if (start === undefined || lastIdx === undefined) return null;
  return [start, Math.min(lastIdx + 1, text.length)];
}

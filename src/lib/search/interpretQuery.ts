// src/lib/search/interpretQuery.ts
/**
 * 自然文のクエリを「マスタの ID に解決済みの条件」へ翻訳する層。**サーバー専用。**
 *
 * ── ★この層の約束（ここを崩さないこと）─────────────────────────────────────
 *
 * ① **語彙は閉じている。** 条件になれるのは、マスタの行に解決できた語だけ。
 *    解決できなかった語は条件にせず `unresolved` に落として画面に出す。
 *
 * ② **利用者の入力文字列を、そのまま DB のパターン照合に渡さない。**
 *    条件が持つのは ID（role_id / domain_id）と真偽値と数値だけ。
 *    チップに出す `label` も**マスタ側の名前**から作る（入力文字列を出さない）。
 *
 *    ⚠️ 理由は実測済みの事故。**`'東京都' LIKE '%京都%'` は true。**
 *       「関西」を「京都」に展開して `ilike` に流すと、
 *       **東京の74社が全部「京都の企業」として返る**（掲載79社の全件がマッチした）。
 *       エラーは出ず、件数が多いだけなので**正常に見える**。
 *       → docs/phase0-search-20260826.md「3-C」
 *
 * ③ **解決先は6つだけ。増やさないこと。**
 *      職種       → ow_roles + ow_role_aliases（getRoleAliases() の414語）
 *      事業領域   → ow_business_domains（12件）
 *      外資/日系  → ow_companies.is_foreign
 *      年収       → ow_jobs.salary_min
 *      社名       → ow_companies.id（掲載79社。2026-08-27 追加）
 *      スキル     → ow_skills.id（標準スキル。2026-08-27 追加）
 *
 *    ⚠️★**社名と同名のスキルは、常に社名として解決する。**（実測11件:
 *       AWS / Braze / Cloudflare / Datadog / HubSpot / Marketo / New Relic /
 *       Okta / Salesforce / Snowflake / Zendesk）
 *       同じ語が2つの条件になると AND で自分自身を絞り、ほぼ0件になる。
 *       「そのスキルを持つ人」は `/search` の帯（主結果の下）で別に出す。
 *
 *    ⚠️ 社名の照合は**メモリ上の完全一致**で行う。`ilike '%q%'` は使わない。
 *       部分一致にすると「Dropbox」の中の「Box」に当たる（実データに両社ある）。
 *       前方一致も採らない。2文字以下の社名は解決しない（`hp` という slug が実在する）。
 *
 *    ⚠️ **`ow_industries` は条件に使わない。** 掲載79社のうち **70社が
 *       「IT・ソフトウェア」**で、絞り込みとして機能しない（実測）。
 *    ⚠️ **勤務地と従業員数レンジは解決しない。** 受け皿が無い ——
 *       `location` はフリーテキスト1本（74社が "東京都"）、
 *       `employee_count` は79社すべてフリーテキストで数値一致は**0件**。
 *       解決したふりをせず `unresolved` に落とす。
 *
 * ④ **LLM はまだ入れていない。** ここはルールベースだが、
 *    **戻り値の形（InterpretResult）を変えなければ中身だけ差し替えられる。**
 *    差し替えるときも ①②③ は同じ。LLM の出力もマスタに解決してから条件にする。
 */

import { cache } from "react";
import { getRoleAliases, getRoleTree, type SearchAlias } from "@/lib/supabase/queries";
import { getBusinessDomainOptions } from "@/lib/companies/businessDomainsCached";
import { createPublicClient } from "@/lib/supabase/public";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { companyDisplayName } from "@/lib/companies/displayName";

// ── 結果の型 ─────────────────────────────────────────────────────────────────

/** 検索の主対象。見出しを付けて出すのはこの1つだけ */
export type SearchKind = "company" | "job" | "person";

/**
 * 解決済みの条件。**必ずマスタの ID か、真偽値か、数値を持つ。**
 * `label` はチップに出す文字列で、**マスタ側の名前から作る**（入力文字列ではない）。
 *
 * `appliesTo` は「この条件をどの対象に当てられるか」。
 * 年収は求人にしか無いので、人や企業の検索では当てられない。
 * ⚠️ **当てられない条件を黙って捨てないこと。** チップには出したうえで
 *    「求人にのみ効く」と分かる形にする（画面側が `appliesTo` を見る）。
 */
/**
 * ★人検索のとき、この条件を**どこに当てるか**。
 *
 *   `experience` … 職歴1行に当てる（在籍した会社 / その時の職種 / その会社の属性）
 *   `person`     … その人自身に当てる（職歴とは無関係。スキルなど）
 *
 * ⚠️ **人検索の AND の意味がこれで2つに分かれる。**
 *    詳細は `runSearch.ts` の `searchPersonHits`。片方だけ変えると意味が壊れる。
 * ⚠️ 企業検索・求人検索では使わない（あちらは職歴を見ない）。
 */
export type ConditionScope = "experience" | "person";

export type Condition =
  | { kind: "company"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; companyId: string }
  | { kind: "role"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; roleIds: string[] }
  | { kind: "domain"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; domainId: string; slug: string }
  | { kind: "foreign"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; isForeign: boolean }
  | { kind: "salaryMin"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; man: number }
  /* ★スキル。**人にしか当てられない**（求人の required_skills は自由記述で、
        標準スキルの ID と突き合わせられない。企業にスキルの表はそもそも無い）。 */
  | { kind: "skill"; label: string; appliesTo: SearchKind[]; matchOn: ConditionScope; skillId: string };

export type InterpretResult = {
  primaryKind: SearchKind;
  conditions: Condition[];
  /** 解決できなかった語。**画面に必ず出す**（黙って落とさない） */
  unresolved: string[];
  /** 正規化後のクエリ。ログ用 */
  normalized: string;
};

// ── 正規化 ───────────────────────────────────────────────────────────────────

/**
 * 全角英数を半角に、連続空白を1つに、小文字化する。
 * ⚠️ **記号は落とさない。** 「800万以上」の「以上」は判定に使う。
 */
export function normalizeQuery(raw: string): string {
  return normalizeForDisplay(raw).toLowerCase();
}

/**
 * 照合用（`normalizeQuery`）と**同じ長さ**の、大文字を残した文字列。
 *
 * ⚠️ 未解決語を画面に出すときはこちらから切り出す。照合用から切り出すと
 *    「IT」が「it」になって出る（2026-08-27 に実際にそう出た）。
 * ⚠️ **文字数を変える正規化をここに足さないこと。** 照合側で求めた位置を
 *    そのまま使うので、長さがずれると別の語を切り出す。
 */
export function normalizeForDisplay(raw: string): string {
  return raw
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, " ");
}

// ── ① primaryKind の判定（ここ1箇所にまとめる）─────────────────────────────

/**
 * 主対象を決める合図。**日本語は主要部が末尾に来る**ので、
 * 「最後に現れた合図」を採る。
 *
 *   「関西で商社出身の人がいるIT企業」→ 出身(person) 人(person) 企業(company)
 *                                     → 最後は「企業」なので **company**
 *   「未経験でIT営業やった人」        → 最後は「人」なので **person**
 *   「年収800万以上のSaaS営業」       → 合図は「年収」だけ → **job**
 *
 * ⚠️ **どちらとも決まらないときは company。** 置き換え前の `/search`
 *    （リダイレクタ）が既定を企業一覧にしていたのと揃える。
 *    企業一覧は絞り込みが揃っており、空振りしたときに次の一手を出しやすい。
 */
const KIND_MARKERS: { word: string; kind: SearchKind }[] = [
  // person
  { word: "人", kind: "person" },
  { word: "出身", kind: "person" },
  { word: "経験者", kind: "person" },
  { word: "メンバー", kind: "person" },
  { word: "ob", kind: "person" },
  { word: "og", kind: "person" },
  // job
  { word: "求人", kind: "job" },
  { word: "募集", kind: "job" },
  { word: "年収", kind: "job" },
  { word: "採用", kind: "job" },
  { word: "ポジション", kind: "job" },
  // company
  { word: "企業", kind: "company" },
  { word: "会社", kind: "company" },
  { word: "スタートアップ", kind: "company" },
];

/**
 * 「人」の誤検出よけ。
 *
 * ⚠️ **「法人営業」「求人」「個人」の中の『人』を人検索の合図にしない。**
 *    「法人営業の求人」が person に倒れる（設計時に実際に踏んだ）。
 *    `求人` は job 側の合図として別に拾うので、ここで潰してよい。
 */
const HITO_BLOCK_BEFORE = ["法", "個", "求", "本", "邦", "成", "新", "友", "他"];
const HITO_BLOCK_AFTER = ["材", "事", "気", "口", "件"];

function findKindMarkers(q: string): { end: number; len: number; kind: SearchKind }[] {
  const out: { end: number; len: number; kind: SearchKind }[] = [];
  for (const m of KIND_MARKERS) {
    let from = 0;
    for (;;) {
      const i = q.indexOf(m.word, from);
      if (i < 0) break;
      from = i + 1;
      if (m.word === "人") {
        const prev = i > 0 ? q[i - 1] : "";
        const next = q[i + 1] ?? "";
        if (HITO_BLOCK_BEFORE.includes(prev)) continue;
        if (HITO_BLOCK_AFTER.includes(next)) continue;
      }
      /* ★英字の合図（`ob` / `og`）は語の途中で拾わない。
         ⚠️ 直さないと `google cloud` の中の `og`（g-o-**og**-le）が OB/OG と読まれ、
            主対象が person に化ける（2026-08-27 に実測）。`dropbox` の `ob` も同じ。
         ⚠️ 判定は職種・スキルと同じ `isLatinTerm` + 前後の英数字チェックに揃える。
            ここだけ別の規則にしない。 */
      if (isLatinTerm(m.word)) {
        const prev = i > 0 ? q[i - 1] : "";
        const next = q[i + m.word.length] ?? "";
        if (/[a-z0-9]/i.test(prev) || /[a-z0-9]/i.test(next)) continue;
      }
      out.push({ end: i + m.word.length, len: m.word.length, kind: m.kind });
    }
  }
  return out;
}

export function decidePrimaryKind(normalized: string): SearchKind {
  const hits = findKindMarkers(normalized);
  if (hits.length === 0) return "company";
  /* 末尾に近いものを採る。終端が同じなら**長いほう**（「求人」と「人」が
     同じ位置で終わるので、長い「求人」を優先しないと person に倒れる）。 */
  hits.sort((a, b) => b.end - a.end || b.len - a.len);
  return hits[0].kind;
}

// ── ② 語彙（マスタ）────────────────────────────────────────────────────────

type Vocabulary = {
  roleAliases: SearchAlias[];
  domains: { id: string; slug: string; name: string; terms: string[] }[];
  /** 正規化した社名 → 企業。**同じ綴りが2社以上なら解決しない**ので配列で持つ */
  companyIndex: Map<string, { id: string; label: string }[]>;
  /** 索引にある最長キーの長さ。走査の上限に使う */
  companyMaxLen: number;
  /** 標準スキル。★社名と同名のものは**除いてある**（上の③） */
  skills: { id: string; label: string; terms: string[] }[];
};

/**
 * ★社名の照合キーを作る正規化。
 *
 * 小文字化・全角→半角（`normalizeForDisplay` で済んでいる）に加えて、
 * **文字でも数字でも長音符でもないもの（記号・空白・中黒）を落とす。**
 *   「日本ヒューレット・パッカード合同会社」→「日本ヒューレットパッカード合同会社」
 *   「hp-jp」→「hpjp」
 *
 * ⚠️ クエリ側にも**同じ関数**を通すこと。片方だけ記号を落とすと一生一致しない。
 */
export function companyKey(s: string): string {
  return s.toLowerCase().replace(/[^A-Za-z0-9ぁ-んァ-ヴ一-龠々〆ヵヶー]/g, "");
}

/**
 * 社名として解決してよい最短の長さ。
 *
 * ⚠️ **2文字以下は解決しない。** 実データに `hp` という slug があり、
 *    2文字だと無関係な文に当たりすぎる（「hpに強い人」以外でも当たる）。
 */
const COMPANY_KEY_MIN_LEN = 3;

/**
 * 事業領域の名前を照合語に割る。
 *
 * ⚠️ マスタの名前は「AI・データ」「CRM・営業支援」のように `・` で連結されている。
 *    フルネームがそのまま打たれることはまず無いので分割して照合する。
 * ⚠️ **短い断片は使わない**（`AI` `HR` `経理` `財務` など）。
 *    2〜3文字の断片は無関係な文にも当たる。短い語は `slug` 側で
 *    「独立した英字トークン」としてだけ拾う。
 */
const DOMAIN_PART_MIN_LEN = 4;

const loadVocabulary = cache(async function loadVocabulary(): Promise<Vocabulary> {
  const [roleAliases, domainRows, companyRows, skillRows] = await Promise.all([
    getRoleAliases(),
    getBusinessDomainOptions(),
    loadCompanyNames(),
    loadSkills(),
  ]);
  const domains = domainRows.map((d) => {
    const parts = d.name.split(/[・/]/).map((s) => s.trim()).filter(Boolean);
    const terms = [d.name, ...parts.filter((p) => p.length >= DOMAIN_PART_MIN_LEN)];
    return { id: d.id, slug: d.slug, name: d.name, terms: Array.from(new Set(terms)) };
  });

  /* ★社名は**全件メモリに載せて完全一致**で突き合わせる（SQL の部分一致は使わない）。
     掲載79社しかないので、1回引いてキャッシュすれば十分。 */
  const companyIndex = new Map<string, { id: string; label: string }[]>();
  let companyMaxLen = 0;
  for (const c of companyRows) {
    const label = companyDisplayName(c.name, c.name_en).displayName;
    /* ⚠️ 対象は name / brand_name / slug の3つ。
          `name_en` は入れていない（短い綴りが多く、誤爆の余地が大きい）。
          実データでは `slug` が短い呼称（salesforce / smarthr）を持っているので、
          「Salesforce」「SmartHR」はここで引ける。 */
    for (const raw of [c.name, c.brand_name, c.slug]) {
      if (!raw) continue;
      const key = companyKey(raw);
      if (key.length < COMPANY_KEY_MIN_LEN) continue;
      const prev = companyIndex.get(key) ?? [];
      if (!prev.some((x) => x.id === c.id)) prev.push({ id: c.id, label });
      companyIndex.set(key, prev);
      if (key.length > companyMaxLen) companyMaxLen = key.length;
    }
  }
  /* ★社名と同名のスキルは索引に入れない（常に社名として解決させるため）。
        ⚠️ ラベル単位で丸ごと落とす。別名だけ残すと
           「AWS は会社／Amazon Web Services はスキル」という食い違いが出る。 */
  const skills = skillRows
    .filter((r) => !companyIndex.has(companyKey(r.label)))
    .map((r) => ({
      id: r.id,
      label: r.label,
      terms: Array.from(new Set([r.label, ...(r.aliases ?? [])])).filter((t) => t.length >= 2),
    }));

  return { roleAliases, domains, companyIndex, companyMaxLen, skills };
});

type SkillRow = { id: string; label: string; aliases: string[] | null };

/** 標準スキル。⚠️ `is_active` のものだけ */
async function loadSkills(): Promise<SkillRow[]> {
  const { data, error } = await createPublicClient()
    .from("ow_skills")
    .select("id, label, aliases")
    .eq("is_active", true);
  /* ⚠️ error を握りつぶさない。空で返すと「スキルで引けない」が静かに起きる */
  if (error) console.error("[interpretQuery] 標準スキルの取得に失敗:", error.message);
  return (data ?? []) as SkillRow[];
}

type CompanyNameRow = { id: string; name: string; name_en: string | null; brand_name: string | null; slug: string | null };

/** 掲載中の企業の社名。⚠️ ディレクトリの軸なので `filterListedCompanies` を通す */
async function loadCompanyNames(): Promise<CompanyNameRow[]> {
  const { data, error } = await filterListedCompanies(
    createPublicClient().from("ow_companies").select("id, name, name_en, brand_name, slug"),
  );
  /* ⚠️ error を握りつぶさない。空で返すと「社名で引けない」が静かに起きる */
  if (error) console.error("[interpretQuery] 社名の取得に失敗:", error.message);
  return (data ?? []) as CompanyNameRow[];
}

// ── 社名の照合 ───────────────────────────────────────────────────────────────

type CharClass = "latin" | "katakana" | "kanji" | "other";

/**
 * ★英数字だけで書かれた語か。**境界チェックを効かせてよいかの判定。**
 *
 * ⚠️ **日本語には語の境界が無い。** 「営業」は「法人営業」の一部として当たる必要があり、
 *    ここに日本語を含めると `/search` の職種検索が丸ごと壊れる。
 *    境界チェックは**英数字の並びにだけ**効かせること。
 */
function isLatinTerm(s: string): boolean {
  return /^[a-z0-9&./+#-]+$/i.test(s);
}

/**
 * ★辞書語が文中に現れる位置。**英字の略語は語の途中で拾わない。**
 *
 * ⚠️ 直さないと、辞書にある2〜4文字の英字略語（`AE` `AM` `EM` `IR` `CRO` `TAM` `M&A` など
 *    実測25件）が**プロダクト名の途中に当たる**。2026-08-27 に本番で実測した誤爆:
 *      Miro            → IR                          （m|ir|o）
 *      Microsoft Teams → CRO ＋ アカウントマネージャー （mi|cro|soft と te|am|s）
 *      Airtable / Jira → IR ／ Amplitude / Dynamics 365 → AM
 *    実在プロダクト30件で測って **7件（23%）** が誤爆していた。
 *
 * ⚠️ **日本語の語には効かせない**（`isLatinTerm` を見る）。
 *    「法人営業」の中の「営業」は今までどおり当たる。
 *
 * ⚠️ 社名の照合（`compactWithMap` + `charClass`）とは別実装。あちらは記号を落とした
 *    文字列の上で字種の隣接を見るが、こちらは**正規化済みの原文**をそのまま見る
 *    （職種の照合は記号を落としていないので位置を共有できない）。
 */
function findAliasIndex(hay: string, alias: string): number {
  if (!isLatinTerm(alias)) return hay.indexOf(alias);
  let from = 0;
  for (;;) {
    const i = hay.indexOf(alias, from);
    if (i < 0) return -1;
    from = i + 1;
    const before = hay[i - 1];
    const after = hay[i + alias.length];
    const touching =
      (before !== undefined && /[a-z0-9]/i.test(before)) ||
      (after !== undefined && /[a-z0-9]/i.test(after));
    if (!touching) return i;
  }
}

function charClass(ch: string | undefined): CharClass {
  if (!ch) return "other";
  if (/[a-z0-9]/i.test(ch)) return "latin";
  if (/[ァ-ヴー]/.test(ch)) return "katakana";
  if (/[一-龠々〆ヵヶ]/.test(ch)) return "kanji";
  return "other";
}

/**
 * 記号を落とした文字列と、その各文字が元の何文字目だったかの対応。
 *
 * ⚠️ 社名の照合は記号を落とした側で行うが、**未解決語の切り出しは元の文字列**で行う。
 *    位置がずれると別の語を「解決済み」として伏せてしまうので、対応表で戻す。
 */
function compactWithMap(s: string): { compact: string; map: number[] } {
  let compact = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/[A-Za-z0-9ぁ-んァ-ヴ一-龠々〆ヵヶー]/.test(ch)) {
      compact += ch.toLowerCase();
      map.push(i);
    }
  }
  return { compact, map };
}

// ── ③ 解決 ───────────────────────────────────────────────────────────────────

type Span = { start: number; end: number };

/** 年収。「800万」「800万円以上」「年収800万」を拾う（単位は万円） */
const SALARY_RE = /(?:年収\s*)?(\d{3,5})\s*万円?(?:\s*以上)?/g;

const FOREIGN_TERMS: { term: string; isForeign: boolean; label: string }[] = [
  { term: "外資系", isForeign: true, label: "外資系" },
  { term: "外資", isForeign: true, label: "外資系" },
  { term: "日系", isForeign: false, label: "日系" },
  { term: "内資", isForeign: false, label: "日系" },
];

export async function interpretQuery(rawText: string): Promise<InterpretResult> {
  const normalized = normalizeQuery(rawText).slice(0, 200);
  if (!normalized) {
    return { primaryKind: "company", conditions: [], unresolved: [], normalized: "" };
  }

  const [{ roleAliases, domains, companyIndex, companyMaxLen, skills }, roleTree] = await Promise.all([
    loadVocabulary(),
    getRoleTree(),
  ]);

  const conditions: Condition[] = [];
  const consumed: Span[] = [];
  /* 社名として当たったが**2社以上に一致して決められなかった**語。
     ⚠️ 黙って1社に決めない。未解決として画面に出す。 */
  const ambiguousCompanyWords: string[] = [];

  // ── 社名 → ow_companies.id ───────────────────────────────────────────────
  {
    const { compact, map } = compactWithMap(normalized);
    /* 長いキーから順に見て、既に埋まった範囲は飛ばす。
       ⚠️ 「dropbox」と「box」が両方索引にあるので、短いほうを先に採ると
          Dropbox の求人が Box として解決される。 */
    const taken: boolean[] = new Array(compact.length).fill(false);
    const maxLen = Math.min(companyMaxLen, compact.length);
    for (let len = maxLen; len >= COMPANY_KEY_MIN_LEN; len--) {
      for (let i = 0; i + len <= compact.length; i++) {
        const key = compact.slice(i, i + len);
        const hit = companyIndex.get(key);
        if (!hit) continue;
        if (taken.slice(i, i + len).some(Boolean)) continue;
        /* ★境界チェック。**同じ字種が隣接していたら部分一致なので採らない。**
           「dropboxの営業」の中の「box」は直前が `p`（英字）なので弾く。
           助詞（ひらがな）や文頭・文末に接している場合だけ通す。 */
        const beforeSame = charClass(compact[i - 1]) === charClass(compact[i]) &&
          charClass(compact[i]) !== "other";
        const afterSame = charClass(compact[i + len]) === charClass(compact[i + len - 1]) &&
          charClass(compact[i + len - 1]) !== "other";
        if (beforeSame || afterSame) continue;

        for (let k = i; k < i + len; k++) taken[k] = true;
        const origStart = map[i];
        const origEnd = map[i + len - 1] + 1;
        consumed.push({ start: origStart, end: origEnd });

        if (hit.length > 1) {
          /* ⚠️ 同じ綴りが2社以上に当たった。**どちらかに決めない。** */
          ambiguousCompanyWords.push(normalized.slice(origStart, origEnd));
          continue;
        }
        conditions.push({
          kind: "company",
          /* 既存の条件はすべて職歴に当てる（`matchOn` の注記を参照） */
          matchOn: "experience",
          label: hit[0].label, // ★マスタの表示名。入力文字列ではない
          appliesTo: ["company", "job", "person"],
          companyId: hit[0].id,
        });
      }
    }
  }

  // ── 年収 → ow_jobs.salary_min ────────────────────────────────────────────
  let salaryMan: number | null = null;
  for (const sm of Array.from(normalized.matchAll(SALARY_RE))) {
    const man = Number(sm[1]);
    if (!Number.isFinite(man) || man <= 0) continue;
    /* 複数書かれていたら**最初の1つ**を下限として採る。
       ⚠️ 「600万〜800万」を 800 で読むと、本来入るはずの求人が落ちる。 */
    if (salaryMan === null) salaryMan = man;
    consumed.push({ start: sm.index ?? 0, end: (sm.index ?? 0) + sm[0].length });
  }
  if (salaryMan !== null) {
    conditions.push({
      kind: "salaryMin",
      /* 既存の条件はすべて職歴に当てる（`matchOn` の注記を参照） */
      matchOn: "experience",
      label: `年収 ${salaryMan}万以上`,
      /* ⚠️ 年収の列があるのは求人だけ。企業にも人にも当てられない
            （企業の年収は 79社中1社しか持たず、2026-08-25 に一覧から外している）。 */
      appliesTo: ["job"],
      man: salaryMan,
    });
  }

  // ── 外資 / 日系 → ow_companies.is_foreign ────────────────────────────────
  for (const f of FOREIGN_TERMS) {
    const i = normalized.indexOf(f.term);
    if (i < 0) continue;
    conditions.push({
      kind: "foreign",
      /* 既存の条件はすべて職歴に当てる（`matchOn` の注記を参照） */
      matchOn: "experience",
      label: f.label,
      /* 人にも当てられる（その人の職歴に外資の在籍があるか）。
         実測: `is_foreign` は掲載79社で **true 65 / false 14 / null 0**＝
         100%埋まっていて分散もある。使える数少ない条件。 */
      appliesTo: ["company", "job", "person"],
      isForeign: f.isForeign,
    });
    consumed.push({ start: i, end: i + f.term.length });
    break; // 外資と日系を同時に立てない
  }

  // ── 事業領域 → ow_business_domains ───────────────────────────────────────
  for (const d of domains) {
    let hitAt = -1;
    let hitLen = 0;
    for (const term of d.terms) {
      const i = normalized.indexOf(term.toLowerCase());
      if (i >= 0 && term.length > hitLen) { hitAt = i; hitLen = term.length; }
    }
    if (hitAt < 0) {
      /* slug は**独立した英字トークン**のときだけ拾う。
         ⚠️ 部分一致にすると "ai" が無関係な英単語の中にも当たる。 */
      const m = normalized.match(new RegExp(`(^|[^a-z0-9])(${d.slug})([^a-z0-9]|$)`, "i"));
      if (m && m.index !== undefined) {
        hitAt = m.index + (m[1]?.length ?? 0);
        hitLen = d.slug.length;
      }
    }
    if (hitAt < 0) continue;
    conditions.push({
      kind: "domain",
      /* 既存の条件はすべて職歴に当てる（`matchOn` の注記を参照） */
      matchOn: "experience",
      label: d.name, // ★マスタの名前。入力文字列ではない
      appliesTo: ["company", "job", "person"],
      domainId: d.id,
      slug: d.slug,
    });
    consumed.push({ start: hitAt, end: hitAt + hitLen });
  }

  // ── スキル → ow_skills ───────────────────────────────────────────────────
  /* ⚠️ 職種と同じ `findAliasIndex` を使う（英字の略語は語の途中で拾わない）。
        `Go` が `Google Cloud` / `gong` の中で拾われないのはこの境界チェック。
     ⚠️ **最長一致だけ残す。** `GitHub` ⊂ `GitHub Copilot` のような組で、
        短いほうが二重に立たないようにする。 */
  {
    const skillHits: { term: string; at: number; id: string; label: string }[] = [];
    for (const sk of skills) {
      for (const term of sk.terms) {
        const t = term.toLowerCase();
        const i = findAliasIndex(normalized, t);
        if (i < 0) continue;
        skillHits.push({ term: t, at: i, id: sk.id, label: sk.label });
      }
    }
    skillHits.sort((x, y) => y.term.length - x.term.length);
    const kept: typeof skillHits = [];
    for (const h of skillHits) {
      if (kept.some((k) => k.term.includes(h.term))) continue; // 長い語に含まれる
      if (kept.some((k) => k.id === h.id)) continue;           // 同じスキルを2回立てない
      kept.push(h);
    }
    for (const h of kept.sort((x, y) => x.at - y.at)) {
      conditions.push({
        kind: "skill",
        label: h.label, // ★マスタの表示名。入力文字列ではない
        /* ⚠️ 人にしか当てられない。求人の required_skills は自由記述で
              標準スキルの ID と突き合わせられず、企業にスキルの表は無い。 */
        appliesTo: ["person"],
        matchOn: "person",
        skillId: h.id,
      });
      consumed.push({ start: h.at, end: h.at + h.term.length });
    }
  }

  // ── 職種 → ow_roles + ow_role_aliases ────────────────────────────────────
  /* 辞書の語がクエリに現れるかを見る（`/jobs` とは向きが逆：あちらは
     「入力語が別名に含まれるか」、こちらは「別名が文に現れるか」）。
     ⚠️ **最長一致だけを残す。** 「法人営業」が当たったら「営業」は捨てる。
        両方残すと同じ職種で条件が2つ立ち、AND で自分自身を絞ることになる。 */
  const roleHits: { alias: string; at: number; roleIds: string[] }[] = [];
  for (const a of roleAliases) {
    const alias = a.alias.toLowerCase();
    if (alias.length < 2) continue;
    /* ★英字の略語は語の途中で拾わない（`findAliasIndex` の注記を参照）。
          日本語の語は今までどおり部分一致で当てる。 */
    const i = findAliasIndex(normalized, alias);
    if (i < 0) continue;
    roleHits.push({ alias, at: i, roleIds: a.roleIds });
  }
  roleHits.sort((x, y) => y.alias.length - x.alias.length);
  const keptRoles: typeof roleHits = [];
  for (const h of roleHits) {
    // 既に採った、より長い語の中に含まれるならスキップ（営業 ⊂ 法人営業）
    if (keptRoles.some((k) => k.alias.includes(h.alias))) continue;
    keptRoles.push(h);
  }
  /* 同じ職種を指す別名が複数残ることがある（職種名と別名が同じ綴りの場合など）。
     roleIds の集合で重複を潰す。 */
  const seenRoleKey = new Set<string>();
  for (const h of keptRoles.sort((x, y) => x.at - y.at)) {
    const key = Array.from(h.roleIds).sort().join(",");
    if (seenRoleKey.has(key)) continue;
    seenRoleKey.add(key);
    const label = roleTree.byId.get(h.roleIds[0])?.name ?? h.alias;
    conditions.push({
      kind: "role",
      /* 既存の条件はすべて職歴に当てる（`matchOn` の注記を参照） */
      matchOn: "experience",
      label, // ★マスタの職種名。入力文字列ではない
      appliesTo: ["company", "job", "person"],
      roleIds: h.roleIds,
    });
    consumed.push({ start: h.at, end: h.at + h.alias.length });
  }

  const unresolved = collectUnresolved(
    normalized,
    normalizeForDisplay(rawText).slice(0, 200),
    consumed,
  );
  for (const w of ambiguousCompanyWords) if (!unresolved.includes(w)) unresolved.push(w);

  return {
    primaryKind: resolvePrimaryKind(normalized, conditions),
    conditions,
    unresolved,
    normalized,
  };
}

/**
 * 主対象を決める。**合図が無いときは条件に従う。**
 *
 * `decidePrimaryKind` は合図（「人」「求人」など）が無ければ `company` に倒す。
 * これは既定として妥当だが、**解決した条件がどれも企業に効かないとき**は
 * 絞り込みが1つも無い企業一覧になる ——つまり**掲載中の全社**が出る。
 *
 * ⚠️ **2026-08-27 にスキルを足した日に実際に起きた。** `Go` は
 *    スキル（`matchOn: "person"` / `appliesTo: ["person"]`）としてだけ解決するので、
 *    主対象が企業のまま**79社すべてが「検索結果」として出ていた。**
 *    スキルを足す前は「解決できる条件が無い」扱いで、その旨を出していた。
 *
 * したがって、**合図が無く、かつ既定の対象に効く条件が1つも無い**ときは、
 * 実際に効く対象へ寄せる。合図があるときは**利用者が明示した対象を尊重して動かさない**
 * （「Go の企業」と書いた人には、効かない旨のチップを見せるほうが正しい）。
 */
function resolvePrimaryKind(normalized: string, conditions: Condition[]): SearchKind {
  const explicit = findKindMarkers(normalized).length > 0;
  const decided = decidePrimaryKind(normalized);
  if (explicit || conditions.length === 0) return decided;
  if (conditions.some((c) => c.appliesTo.includes(decided))) return decided;

  /* ★順序は固定（company → job → person）。条件の並び順で対象が変わると、
     同じ意味のクエリで結果が変わって再現しなくなる。 */
  for (const k of ["company", "job", "person"] as const) {
    if (conditions.some((c) => c.appliesTo.includes(k))) return k;
  }
  return decided;
}

// ── ④ 解決できなかった語を拾う ───────────────────────────────────────────────

/**
 * 主対象の合図（「人」「企業」「求人」など）。**条件ではないが未解決でもない**ので
 * `unresolved` からは外す。出すと「『人』では絞り込めません」という無意味な表示になる。
 */
const KIND_MARKER_WORDS = KIND_MARKERS.map((m) => m.word);

/**
 * ⚠️ **ひらがなだけの語は落とす。**
 * 「から」「なった」「やった」「がいる」は条件になりえない。
 * 漢字・カタカナ・英数を含む語だけを未解決として出す。
 */
function isMeaningfulToken(t: string): boolean {
  if (t.length < 2) return false;
  if (/^[ぁ-ん ー]+$/.test(t)) return false; // ひらがなだけ＝繋ぎ
  if (/^\d+$/.test(t)) return false;
  return true;
}

/** 表示用の重複判定は大文字小文字を無視する（「IT」と「it」を2つ出さない） */
function seenKey(t: string): string {
  return t.toLowerCase();
}

function collectUnresolved(normalized: string, display: string, consumed: Span[]): string[] {
  /* 解決に使った範囲と、主対象の合図を伏せ字にしてから残りを切り出す。
     ⚠️ 伏せる位置は照合用（小文字）で求め、**切り出すのは display 側**。
        長さが同じなので位置はそのまま使える。 */
  const chars = display.split("");
  for (const s of consumed) {
    for (let i = s.start; i < s.end && i < chars.length; i++) chars[i] = " ";
  }
  for (const w of KIND_MARKER_WORDS) {
    let from = 0;
    for (;;) {
      const i = normalized.indexOf(w, from);
      if (i < 0) break;
      from = i + 1;
      for (let j = i; j < i + w.length && j < chars.length; j++) chars[j] = " ";
    }
  }
  const rest = chars.join("");
  /* 残りを「漢字・カタカナ・英数のかたまり」に割る。
     ⚠️ ひらがなは区切りとして扱う（「関西で商社」→「関西」「商社」）。 */
  const tokens = rest.match(/[一-龠々〆ヵヶ]+|[ァ-ヴー]+|[A-Za-z0-9]+/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (!isMeaningfulToken(t)) continue;
    if (seen.has(seenKey(t))) continue;
    seen.add(seenKey(t));
    out.push(t);
  }
  return out;
}

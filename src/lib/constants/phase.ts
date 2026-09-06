/**
 * 企業フェーズ（`ow_companies.phase`）の選択肢。
 * **`/companies` の絞り込み・`/jobs` の絞り込み・`/biz/company` の入力欄が同じここを見る。**
 *
 * ── 2段階にした（2026-09-06）─────────────────────────────────────────────────
 * それまでは**粒度の違うものが1つのリストに並んでいた。** 「成長ステージ
 * （シード〜シリーズC）」というバケットが「シリーズB」の隣にあり、実データでは
 * **どちらも同じ1社を指していた**（`series_b` が1社しか無かったため）。
 *
 * → 親（スタートアップ / 上場企業 / 非上場）と子（各ラウンド・各市場）に分けた。
 *   **親を選ぶと子も含む。** バケットと個別の段が同列に並ばなくなる。
 *
 * ⚠️★**値は DB（`ow_companies_phase_check`）と1対1。日本語を値にしないこと。**
 *    2026-09-06 まで、この定数の `value` が日本語（"シリーズB" など）なのに
 *    DB の CHECK は英語8値だったため、**`/biz/company` の「事業ステージ」は
 *    12個すべてが CHECK 違反で保存できなかった**（`ow_companies` は UPDATE が
 *    列単位 GRANT なので、企業情報の保存が丸ごと失敗していた）。
 *    → CLAUDE.md「UI / API / DB の CHECK を3つ揃える」。値を足すときは3つとも足す。
 *
 * ⚠️ **「プレシード」「ブートストラップ」「IPO準備中」は消した。**
 *    CHECK に無いので**元から保存できず**、`availablePhaseOptions()` が
 *    0件として隠していたため、誰にも見えないまま残っていた。
 *    復活させるなら CHECK も同時に広げること。
 *
 * ⚠️ **0件の選択肢を出さない。** 画面に出す前に必ず `availablePhaseOptions()` を通す。
 *
 * ⚠️ 「外資系」はフェーズではない（`capital_type`）。ここに混ぜないこと。
 *
 * ⚠️ CLAUDE.md のとおり phase は「**企業グループとしてのステージ**」で、
 *    最終親会社の状態で判定する。外資系日本法人でも親が上場していれば `listed`。
 */

export type PhaseOption = {
  /** UI とフィルタで使うキー。**`ow_companies.phase` に入る値そのもの** */
  value: string;
  label: string;
  desc: string;
  /** 親のキー。親自身は undefined */
  parent?: string;
  color: string;
  bg: string;
  dot: string;
};

/* ⚠️ 色で段階を出し分けない（.claude/skills/ui-conventions「色の役割」）。
      凡例が無い色分けは意味が伝わらないうえ、緑が「金銭的にプラスの条件」と衝突する。
      ここで色が担うのは**階層だけ** —— 親は royal、子はニュートラル。 */
const PARENT_STYLE = { color: "#1e3a8a", bg: "var(--royal-50)", dot: "var(--royal)" };
const CHILD_STYLE = { color: "#334155", bg: "#f1f5f9", dot: "#94a3b8" };

export const PHASE_OPTIONS: PhaseOption[] = [
  // ── スタートアップ（未上場）────────────────────────────────────────────
  { value: "startup", label: "スタートアップ", desc: "未上場・資金調達で成長中", ...PARENT_STYLE },
  { value: "seed", parent: "startup", label: "シード", desc: "PMF検証・プロダクト開発期", ...CHILD_STYLE },
  { value: "series_a", parent: "startup", label: "シリーズA", desc: "グロース開始・急成長期", ...CHILD_STYLE },
  { value: "series_b", parent: "startup", label: "シリーズB", desc: "事業拡大・組織化", ...CHILD_STYLE },
  { value: "series_c", parent: "startup", label: "シリーズC", desc: "スケール・上場準備", ...CHILD_STYLE },
  { value: "series_d", parent: "startup", label: "シリーズD以降", desc: "レイトステージ・大規模化", ...CHILD_STYLE },
  /* ⚠️ ユニコーンは「評価額10億ドル超の**未上場**企業」なので、上場とは排他。
        だからスタートアップの子に置いている。ラウンド（シリーズ〇）とは別の切り口だが、
        `phase` は1社1値なので、両方分かっている企業には**情報量の多いほう**を入れる。 */
  { value: "unicorn", parent: "startup", label: "ユニコーン", desc: "評価額10億ドル超の未上場企業", ...CHILD_STYLE },

  // ── 上場企業 ──────────────────────────────────────────────────────────
  { value: "listed", label: "上場企業", desc: "株式を公開している", ...PARENT_STYLE },
  { value: "listed_prime", parent: "listed", label: "東証プライム", desc: "国内最上位市場", ...CHILD_STYLE },
  { value: "listed_standard", parent: "listed", label: "東証スタンダード", desc: "国内中核市場", ...CHILD_STYLE },
  { value: "listed_growth", parent: "listed", label: "東証グロース", desc: "国内新興市場", ...CHILD_STYLE },
  /* ⚠️ 外資系日本法人の多くはここに入る（親会社が NYSE・NASDAQ 等に上場）。
        ただし **`capital_type = foreign_subsidiary` から自動で決めないこと。**
        外国企業が東証に上場している例もある。企業ごとに確かめて入れる。 */
  { value: "listed_overseas", parent: "listed", label: "海外市場", desc: "NYSE・NASDAQ など", ...CHILD_STYLE },

  // ── 非上場 ────────────────────────────────────────────────────────────
  { value: "non_listed", label: "非上場", desc: "親会社が非公開（PE買収等）", ...PARENT_STYLE },
];

const BY_VALUE = new Map(PHASE_OPTIONS.map((o) => [o.value, o]));

/** その選択肢が親（子を持ちうる側）か */
export function isParentPhase(value: string): boolean {
  return PHASE_OPTIONS.some((o) => o.parent === value);
}

/** 親を選んだときに含める値（自分 + 子）。子なら自分だけ */
export function expandPhase(value: string): string[] {
  const children = PHASE_OPTIONS.filter((o) => o.parent === value).map((o) => o.value);
  return [value, ...children];
}

/**
 * 選択肢のキー → `ow_companies.phase` に入りうる値。
 * ⚠️ **祖先展開は「選んだ側」に掛ける。** 企業は1つの値しか持たないので、
 *    「上場企業」を選んだら `listed` と各市場を全部拾う、という向きになる。
 *    （職種は求人側、業種は本人側に展開する。**向きが揃っていないので混同しないこと。**）
 */
export const PHASE_FILTER_MAP: Record<string, string[]> = Object.fromEntries(
  PHASE_OPTIONS.map((o) => [o.value, expandPhase(o.value)]),
);

/** DB の phase 値が、その選択肢に当たるか */
export function phaseMatches(dbPhase: string | null | undefined, optionValue: string): boolean {
  if (!dbPhase) return false;
  return (PHASE_FILTER_MAP[optionValue] ?? [optionValue]).includes(dbPhase);
}

/* ⚠️★**`availablePhaseOptions()` は削除した**（2026-09-06 / 柴さんの判断）。
      実データにある段だけを出していたため、選択肢が
      「スタートアップ / シリーズB / シリーズD以降 / ユニコーン / 上場企業 / 東証グロース / 非上場」
      となり、**シード・シリーズA・シリーズC が抜けて梯子が歯抜けに見えていた。**
      → 絞り込みは `PHASE_OPTIONS` を**そのまま全件**出す。該当0社の段も出す。

   ⚠️ リポジトリの「0件の選択肢を出さない」とは逆向きの**例外**。
      いまこの例外は **都道府県（PREFECTURE_FILTER_GROUPS）とフェーズの2つだけ。**
      どちらも「段階の梯子」「47都道府県」のように**全体が決まっていて、
      歯抜けだと不自然に見える**もの。
      ⚠️ 事業領域・職種には広げないこと（あちらは全体像を見せる意味が薄く、
         `getBusinessDomainFacets()` が0社のものを外している）。 */

/**
 * `/biz/company` の `<select>` 用。
 *
 * ⚠️ **先頭の「未選択」を消さないこと。** 空欄の企業に選択肢の1つ目
 *    （＝「スタートアップ」）が表示され、**選んでいないのに選んだように見える**。
 * ⚠️ 子は全角スペースで字下げする。`<option>` は CSS でインデントできない。
 * ⚠️ `value` は DB に入る値そのもの。ここを日本語に戻さないこと（CHECK に弾かれる）。
 */
export const PHASE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "未選択" },
  ...PHASE_OPTIONS.map((o) => ({ value: o.value, label: o.parent ? `　${o.label}` : o.label })),
];

/** 表示用のラベル。未知の値（自由記述の残骸など）は null */
export function phaseLabel(dbPhase: string | null | undefined): string | null {
  if (!dbPhase) return null;
  return BY_VALUE.get(dbPhase)?.label ?? null;
}

/**
 * 業種フィルタのグループ定義。
 *
 * ⚠️ **これがフィルタ選択肢の唯一の出どころ。** DB の distinct は引いていない。
 *    `ow_companies.industry` の値を変えたら**必ずここも同時に直すこと。**
 *    片方だけ変えるとフィルタから消える（値は存在するのに選択肢に無い状態になる）。
 *
 * ── 3階層の意味 ──────────────────────────────────────────────────────────
 *   key    … URL の `?industry=` に入る。**変えると既存URLが壊れる**（下の LEGACY_KEYS 参照）
 *   label  … フィルタUIに出る表示名
 *   values … DB の `industry` の値。**複数書ける**
 *
 * ⚠️ `values` が複数なのは `vertical` だけ。カードには DB の値（「ヘルスケア」「金融」）が
 *    そのまま出るので読み手に具体的に伝わり、フィルタでは「業種特化」1つに束ねられる。
 *    カードのラベルとフィルタの粒度は**別物でよい**（2026-08-11 の設計判断）。
 *
 * ⚠️ 分類軸は1本に統一していない。業務領域（CRM・経理・HR…）と技術領域
 *    （AI・データ／セキュリティ／クラウドインフラ）が混在するが、求職者向けの
 *    分類としては実用上これでよい。単一軸を追うと現実の企業が置けなくなる。
 *    目指しているのは「軸の統一」ではなく「**名前が実態と合っていて、相互に重ならないこと**」。
 */
export const INDUSTRY_GROUPS = [
  { key: "ai",          label: "AI・データ",           category: "product",  values: ["AI・データ"] },
  { key: "infra",       label: "クラウドインフラ",       category: "product",  values: ["クラウドインフラ", "通信・ネットワーク"] },
  { key: "devtools",    label: "開発者ツール",           category: "product",  values: ["開発者ツール"] },
  { key: "security",    label: "セキュリティ",           category: "product",  values: ["セキュリティ"] },
  { key: "crm",         label: "CRM・営業支援",         category: "product",  values: ["CRM・営業支援", "カスタマーサポート"] },
  { key: "collab",      label: "コラボレーション",       category: "product",  values: ["コラボレーション"] },
  { key: "finance",     label: "経理・財務",             category: "product",  values: ["経理・財務"] },
  { key: "hr",          label: "HR・人材",              category: "product",  values: ["HR・人材"] },
  { key: "marketing",   label: "マーケティング",         category: "product",  values: ["マーケティング", "広告・アドテク"] },
  { key: "hardware",    label: "ハードウェア・半導体",   category: "other",    values: ["ハードウェア・半導体"] },
  /* ⚠️ 「コマース・EC」は旧い表記だが DB に1社ある。**消さずにここへ入れる**
        （選択肢からは外したので新規には入らないが、既存の1社はフィルタに出る）。 */
  { key: "marketplace", label: "マーケットプレイス",     category: "product",  values: ["マーケットプレイス", "EC・コマース", "コマース・EC"] },
  /* ⚠️ ここだけ values が多い。カードには DB の値（「ヘルスケア」「金融」など）が
        そのまま出るので読み手に具体的に伝わり、フィルタでは「業種特化」1つに束ねられる。 */
  { key: "vertical",    label: "業種特化",               category: "vertical", values: ["ヘルスケア", "金融", "教育", "不動産・建設", "物流・サプライチェーン", "製造・産業", "リーガル", "公共・自治体", "飲食・小売"] },
  /* 2026-08-14 追加。SaaS を作っていない IT 企業（受託・SI・コンサル）の置き場が
     どこにも無く、登録した企業が業種フィルタから丸ごと消えていた。 */
  { key: "services",    label: "ITサービス・受託",       category: "other",    values: ["受託開発・SI", "ITコンサルティング"] },
] as const;

/**
 * 旧 key → 新 key。**消さないこと。**
 *
 * 2026-08-11 に3つの key を変えた。サイト内のリンクは全て `g.key` を使うので
 * 内部からは壊れないが、外部ブックマークや被リンクが 0 件になるのを防ぐ。
 *   fintech    → finance     （FinTech → 経理・財務。8社中 金融機関向けは nCino のみだった）
 *   ec         → marketplace （コマース・EC → マーケットプレイス。ウーバーが EC ではなかった）
 *   healthcare → vertical    （ヘルスケア1社を「業種特化」グループに束ねた）
 */
const LEGACY_KEYS: Record<string, string> = {
  fintech: "finance",
  ec: "marketplace",
  healthcare: "vertical",
};

/**
 * `?industry=` の値 → DB の `industry` に一致させる値の配列。
 * 知らない key なら null を返し、呼び出し側は生の値として扱う（ilike 等）。
 */
export function resolveIndustryFilter(industryParam: string): string[] | null {
  const key = LEGACY_KEYS[industryParam] ?? industryParam;
  const group = INDUSTRY_GROUPS.find((g) => g.key === key);
  return group ? [...group.values] : null;
}

/* ─── 企業側（/biz）の選択肢 ────────────────────────────────────────────────
 *
 * ⚠️ **選択肢は上の `values` から導出する。別のリストを書かないこと。**
 *    2026-08-14 まで `/biz/auth` `/biz/companies/add/new` `lib/business/mockCompany.ts` の
 *    3箇所に「IT / SaaS・コンサルティング・金融 / FinTech…」という**別の8値**が
 *    直書きされており、企業が自分で登録すると求職者側の業種フィルタに
 *    一切引っかからない値が入っていた（実測: `IT / SaaS` 3社・`コマース・EC` 1社・
 *    `電設資材・卸売業` 1社）。導出にすれば、選べる値は必ずどれかのフィルタに乗る。
 */

/**
 * 既存データにあるが、新規には選ばせない値。
 * ⚠️ **消さないこと。** API の検証で弾くと、この値を持つ企業が
 *    業種と無関係な項目を保存しただけで 400 になる。
 */
export const LEGACY_INDUSTRY_VALUES: string[] = [
  "コマース・EC",      // → マーケットプレイス（1社）
  "IT / SaaS",         // 旧 /biz/auth の選択肢（3社。粒度が粗すぎるので廃止）
  "電設資材・卸売業",   // 経歴から作られた1社
];


/** `<optgroup>` の見出し。`category` の表示名。 */
const CATEGORY_LABELS: Record<string, string> = {
  product: "プロダクト領域",
  vertical: "業種特化（バーティカル）",
  other: "その他",
};

/** 企業登録フォームの `<select>` 用。カテゴリごとの optgroup。 */
export const INDUSTRY_SELECT_GROUPS: { label: string; options: string[] }[] =
  (["product", "vertical", "other"] as const).map((c) => ({
    label: CATEGORY_LABELS[c],
    options: INDUSTRY_GROUPS
      .filter((g) => g.category === c)
      .flatMap((g) => g.values as readonly string[])
      /* ⚠️ 旧表記は選択肢に出さない。既存データを拾うために values には残してある。 */
      .filter((v) => !LEGACY_INDUSTRY_VALUES.includes(v)),
  }));

/** 選択肢の平坦なリスト（optgroup を扱えない UI 用）。 */
export const INDUSTRY_OPTIONS: string[] = INDUSTRY_SELECT_GROUPS.flatMap((g) => g.options);


/** 保存してよい業種か。⚠️ 空文字と null は「未設定」なので呼び出し側で先に弾く。 */
export function isValidIndustry(value: string): boolean {
  return INDUSTRY_OPTIONS.includes(value) || LEGACY_INDUSTRY_VALUES.includes(value);
}

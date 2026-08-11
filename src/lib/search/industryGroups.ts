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
  { key: "ai",          label: "AI・データ",           values: ["AI・データ"] },
  { key: "infra",       label: "クラウドインフラ",       values: ["クラウドインフラ"] },
  { key: "devtools",    label: "開発者ツール",           values: ["開発者ツール"] },
  { key: "security",    label: "セキュリティ",           values: ["セキュリティ"] },
  { key: "crm",         label: "CRM・営業支援",         values: ["CRM・営業支援"] },
  { key: "collab",      label: "コラボレーション",       values: ["コラボレーション"] },
  { key: "finance",     label: "経理・財務",             values: ["経理・財務"] },
  { key: "hr",          label: "HR・人材",              values: ["HR・人材"] },
  { key: "marketing",   label: "マーケティング",         values: ["マーケティング"] },
  { key: "hardware",    label: "ハードウェア・半導体",   values: ["ハードウェア・半導体"] },
  { key: "marketplace", label: "マーケットプレイス",     values: ["マーケットプレイス"] },
  // ⚠️ 唯一の複数 values。カードには「ヘルスケア」「金融」が個別に出る
  { key: "vertical",    label: "業種特化",               values: ["ヘルスケア", "金融"] },
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

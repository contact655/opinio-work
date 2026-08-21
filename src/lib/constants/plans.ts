/**
 * 企業の契約プランと、プランごとに使える機能の対応表。
 *
 * ⚠️ **プランの正は `ow_company_plans`（status='active' の行）。**
 *    `ow_companies.plan` は**廃止予定で、読まない。**
 *    87社すべて 'free' のまま誰も読んでいない列で、DROP は
 *    `supabase/migrations/_pending/` に保留してある。
 *    2箇所に持つと必ず食い違うので、**新しく参照を足さないこと。**
 *
 * ⚠️ **許容値は UI / API / DB の CHECK の3つを揃える**（CLAUDE.md）。
 *    DB 側は `ow_company_plans_plan_type_check`。
 *    値を足すときは migration も同時に直す。片方だけ足すと
 *    「選べるのに保存できない」か「保存できるのに判定されない」になる。
 *
 * ⚠️ **金額はここに書かない。** 有料プランは未実装で、LPにも金額を出していない。
 *    料金は `ow_company_plans.monthly_fee` に運営が入れる運用。
 */

export const PLAN_TYPES = ["free", "starter", "growth", "scale"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const BILLING_CYCLES = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "フリー",
  starter: "スターター",
  growth: "グロース",
  scale: "スケール",
};

/**
 * ゲートを掛ける機能のキー。
 *
 * ⚠️ **最小限に保つ。** 機能キーを増やすほど、画面と API の両方に
 *    差し忘れが生まれる。増やすときは差し込み先を両方作ってから足すこと。
 */
export const PLAN_FEATURES = [
  /** 候補者検索（/biz/candidates）で個人を特定できるデータを見る */
  "candidateSearch",
  /** 応募者の連絡先（メールアドレス・電話番号）を見る */
  "applicantContact",
  /** スカウトを送る。⚠️ 環境変数 SCOUT_SENDING_ENABLED との AND で判定する */
  "scoutSend",
  /** 「話せる人」（アンバサダー）を招待する */
  "ambassadorInvite",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/**
 * プラン × 機能の対応表。**ここが唯一の定義。**
 *
 * ⚠️ 無料でできることは規約 /terms/listing 第4条1項に定めがある
 *    （企業ページ・求人掲載・応募の受付）。**それらはここに載せない。**
 *    この表は「有料で開く機能」だけを扱う。
 */
const MATRIX: Record<PlanType, Record<PlanFeature, boolean>> = {
  free:    { candidateSearch: false, applicantContact: false, scoutSend: false, ambassadorInvite: false },
  starter: { candidateSearch: true,  applicantContact: true,  scoutSend: false, ambassadorInvite: true  },
  growth:  { candidateSearch: true,  applicantContact: true,  scoutSend: true,  ambassadorInvite: true  },
  scale:   { candidateSearch: true,  applicantContact: true,  scoutSend: true,  ambassadorInvite: true  },
};

/**
 * そのプランでこの機能を使えるか。
 *
 * ⚠️ **プランが取れなかったとき（null）は false に倒す。**
 *    取得に失敗したときに機能が開くと、失敗に気づけないまま
 *    有料機能を配ることになる（fail-open にしない）。
 *
 * ⚠️ **画面と API の両方から呼ぶこと。** 画面だけ塞いでも API を直接叩ける。
 *    API の多くは `getCompanyContext` を直接呼ぶので、そちら経由でも
 *    同じ判定ができるようにしてある（`lib/business/company.ts` の `planType`）。
 */
export function canUse(planType: PlanType | null | undefined, feature: PlanFeature): boolean {
  if (!planType) return false;
  const row = MATRIX[planType];
  if (!row) return false;
  return row[feature] === true;
}

/** 不明な文字列を PlanType に寄せる。知らない値は null（＝何も開かない）。 */
export function toPlanType(v: string | null | undefined): PlanType | null {
  if (!v) return null;
  return (PLAN_TYPES as readonly string[]).includes(v) ? (v as PlanType) : null;
}

/**
 * 企業の契約プランと、プランごとに使える機能の対応表。
 *
 * ⚠️ **プランの正は `ow_company_plans`（status='active' の行）。**
 *    `ow_companies.plan` は 2026-08-22 に DROP 済み。**もう存在しない。**
 *
 * ⚠️ **許容値は UI / API / DB の CHECK の3つを揃える**（CLAUDE.md）。
 *    DB 側は `ow_company_plans_plan_type_check`。
 *    値を足すときは migration も同時に直す。片方だけ足すと
 *    「選べるのに保存できない」か「保存できるのに判定されない」になる。
 *
 * ⚠️ **2026-08-23 に starter/growth/scale の3段をやめ、Free / 有料 の2段にした。**
 *    段を分ける根拠（機能差）が無いまま値だけ増やしていたため。
 */

export const PLAN_TYPES = ["free", "paid"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const BILLING_CYCLES = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "フリー",
  paid: "有料プラン",
};

/**
 * 有料プランの月額（税別・円）。
 *
 * ⚠️ **金額はここが唯一の定義。** LP（`/business` の料金セクションと FAQ）も
 *    運営画面もこの定数を読む。**別の場所に数字を書かないこと。**
 *    二重に持つと、片方だけ直したときに表示と請求が食い違う。
 *
 * ⚠️ 規約 /terms/listing 第4条2項が「費用は有料プランの利用料金のみ」と
 *    定めているので、**成果報酬は発生しない**と書いてよい（2026-08-21 改定）。
 *
 * ⚠️ 年払いは未対応。`billing_cycle` 列は残してあるが、UIも料金表も月額のみ。
 */
export const PAID_PLAN_MONTHLY_FEE = 80000;

/** プランごとの月額。運営画面はここから入れる（画面で直接入力させない）。 */
export const PLAN_MONTHLY_FEE: Record<PlanType, number> = {
  free: 0,
  paid: PAID_PLAN_MONTHLY_FEE,
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
  /** 「話せる人」（アンバサダー）を招待する */
  "ambassadorInvite",
] as const;

/* ⚠️ **`scoutSend` は 2026-08-23 に外した。**
      スカウト送信は `SCOUT_SENDING_ENABLED` で停止中で、再開の判断もしていない。
      売れないものを機能表に載せない。停止は環境変数だけで行う。
      再開してプランに含めるなら、ここに戻したうえで
      `POST /api/biz/scouts` の判定も同時に戻すこと。 */
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/**
 * プラン × 機能の対応表。**ここが唯一の定義。**
 *
 * ⚠️ 無料でできることは規約 /terms/listing 第4条1項に定めがある
 *    （企業ページ・求人掲載・応募の受付）。**それらはここに載せない。**
 *    この表は「有料で開く機能」だけを扱う。
 */
const MATRIX: Record<PlanType, Record<PlanFeature, boolean>> = {
  free: { candidateSearch: false, applicantContact: false, ambassadorInvite: false },
  paid: { candidateSearch: true,  applicantContact: true,  ambassadorInvite: true  },
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

/**
 * 対象業界（軸2 = 誰に売っているか）の状態と上限。
 *
 * ── 軸1・業種との違い ───────────────────────────────────────────────────────
 *   業種（`ow_companies.industry_id`）… **自社がどの業界の会社か**。単一。全社が持つ
 *   事業領域（軸1 / `ow_business_domains`）… **何を作っているか**。複数
 *   **対象業界（軸2 / ここ）** … **誰に売っているか**。複数。⚠ 業種と同じマスタを共有する
 *
 * ⚠️★**語彙は `ow_industries` を業種と共有している。** 出身業界と対象業界が
 *    同じ id で繋がることが突合の前提で、**粒度が割れると永久にマッチしない。**
 *    例: 対象業界にだけ「製造業（一般）」を作ると、出身企業が持つ
 *    `machinery`（電機・機械）と別 id になる。粗い区分が要るなら
 *    2階層＋祖先展開（`expandWithAncestors` と同じ）にすること。**別タスク。**
 *
 * ⚠️ 入力は **`/admin` のみ**。`/biz` には置いていない。
 *    開く日は「`authenticated` への EXECUTE」と「`target_industry_scope` の列 GRANT」の
 *    **両方**が要る（片方だけでは 42501 で落ちる）。
 */

/**
 * 3値。⚠️ **`horizontal` と未確認（null）は別物。**
 *   `horizontal` … 調べて「業界を問わない」と分かった（＝運営が判断した結果）
 *   `null`       … まだ誰も見ていない
 * 混ぜると、運営の作業一覧から「見るべきもの」が消える。
 *
 * ⚠️ **DB の CHECK（`ow_companies_target_industry_scope_check`）と同じ2値 + NULL。**
 *    値を足すときは migration の CHECK と UI の3択も同時に直すこと
 *    （CLAUDE.md「UI / API / DB の CHECK を3つ揃える」）。
 */
export const TARGET_INDUSTRY_SCOPES = ["vertical", "horizontal"] as const;
export type TargetIndustryScope = (typeof TARGET_INDUSTRY_SCOPES)[number];

export function isTargetIndustryScope(v: unknown): v is TargetIndustryScope {
  return typeof v === "string" && (TARGET_INDUSTRY_SCOPES as readonly string[]).includes(v);
}

/** 画面に出す文言。⚠️ ここ1箇所から出す（運営画面と一覧で言い方を割らない） */
export const TARGET_INDUSTRY_SCOPE_LABELS: Record<TargetIndustryScope | "unknown", string> = {
  vertical: "特定の業界に張っている",
  horizontal: "業界を問わない",
  unknown: "未確認",
};

/**
 * 1社あたりの上限。
 *
 * ⚠️ **DB では縛っていない**（行をまたぐ個数は CHECK で書けない。
 *    トリガーにすると、テーブル定義を読んでも気づけない隠れた挙動が増える）。
 *    **API 側で検証する。** DB が保証するのは
 *    「主がちょうど1件（部分UNIQUE）」「マスタに実在すること（FK）」
 *    「明細を持てるのは vertical だけ（複合FK）」の3つ。
 *
 * ⚠️ 同じ理由で「**vertical なのに明細0件**」も DB では止められない。
 *    RPC が 22023 で弾き、破れたものは `/admin/companies` の一覧で見つける。
 */
export const MAX_TARGET_INDUSTRIES_PER_COMPANY = 3;

/** 企業1社の対象業界（表示用にまとめた形） */
export type CompanyTargetIndustries = {
  scope: TargetIndustryScope | null;
  /** ⚠️ `scope !== "vertical"` のときは必ず空配列（複合FKで DB が保証している） */
  items: { industryId: string; name: string; isPrimary: boolean }[];
};

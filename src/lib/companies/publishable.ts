/**
 * 公開ゲート — 分類の欠けた企業を掲載させない。
 *
 * ⚠️ **条件を各経路に書き写さないこと。** 公開に触れる経路は4つあり、
 *    それぞれに条件を書くと必ず漏れる。判定はこのファイルの1関数だけに置く。
 *
 * ⚠️ **軸2（対象業界）を入れる日は、この関数に1行足す。** 別の場所に足さない。
 *
 * ── なぜ作成時ではなく公開時に見るか ────────────────────────────────────────
 *   企業が自分で登録する入口で業種を必須にすると、登録の摩擦が増える。
 *   新規企業は `is_published = false` / `listing_status = 'draft'` で生まれるので、
 *   **誰にも見えない。塞ぐべきは「見えるようにする一手」だけ。**
 *
 * ── 誰が公開するかで条件が違う ──────────────────────────────────────────────
 *   分類（業種・事業領域）… actor に関わらず必須。運営が例外的に通せる形にしない。
 *                          欠けたまま掲載されると、業種フィルタ・LPファセット・
 *                          `/jobs` から静かに消える
 *   掲載規約の同意        … **企業のときだけ必須。** 運営が代理で掲載する場面まで
 *                          止めると運用が回らない
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";

/** 誰が公開しようとしているか。⚠️ ロールではなく**経路**で決める */
export type PublishActor =
  /** `/admin` 配下（運営）。掲載規約の同意は求めない */
  | { kind: "admin" }
  /** `/biz` 配下（企業）。掲載規約の同意が要る。`authUserId` は auth.users.id */
  | { kind: "company"; authUserId: string };

export type PublishableResult =
  | { ok: true }
  /** ⚠️ `missing` は**利用者にそのまま見せる文**。何が足りないかを具体的に書く */
  | { ok: false; missing: string[] };

/**
 * 掲載してよい状態か。
 *
 * ⚠️ **`is_published` を true にする / `listing_status` を `'listed'` にする
 *    どちらの操作でも呼ぶこと。** 片方だけだと、もう片方から掲載できてしまう。
 *
 * ⚠️ 取得に失敗したら**通さない**（fail closed）。`?? []` で0件に倒して
 *    「条件を満たしている」と読ませない。
 */
export async function assertPublishable(
  companyId: string,
  actor: PublishActor,
): Promise<PublishableResult> {
  const admin = createAdminClient();
  const missing: string[] = [];

  const { data: company, error } = await admin
    .from("ow_companies")
    .select("industry_id, ow_industries(name, requires_business_domain)")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[assertPublishable] 企業の取得に失敗:", error.message);
    return { ok: false, missing: ["企業情報を確認できませんでした。時間をおいて再度お試しください。"] };
  }
  if (!company) {
    return { ok: false, missing: ["企業が見つかりませんでした。"] };
  }

  // ── ① 業種（単一）──────────────────────────────────────────────────────
  if (!company.industry_id) {
    missing.push("業種が設定されていません。");
  }

  // ── ② 事業領域（複数・主が1件）────────────────────────────────────────
  /* ⚠️ 必須かどうかは業種マスタの `requires_business_domain` で決まる。
        slug をここに書かない（マスタと別のリストが増える）。 */
  const industry = company.ow_industries as unknown as
    | { name: string; requires_business_domain: boolean }
    | null;

  if (industry?.requires_business_domain) {
    const { count, error: domainErr } = await admin
      .from("ow_company_business_domains")
      .select("company_id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_primary", true);

    if (domainErr) {
      console.error("[assertPublishable] 事業領域の取得に失敗:", domainErr.message);
      return { ok: false, missing: ["事業領域を確認できませんでした。時間をおいて再度お試しください。"] };
    }
    if ((count ?? 0) === 0) {
      missing.push(`事業領域が設定されていません（「${industry.name}」では必須です）。`);
    }
  }

  // ── ③ 掲載規約の同意（企業のときだけ）──────────────────────────────────
  if (actor.kind === "company") {
    if (!(await hasAgreedTerms(actor.authUserId, "listing"))) {
      missing.push("掲載利用規約に同意していません。");
    }
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/** 画面に出す1行の文言に畳む。 */
export function publishBlockedMessage(missing: string[]): string {
  return `掲載できません。${missing.join(" ")}`;
}

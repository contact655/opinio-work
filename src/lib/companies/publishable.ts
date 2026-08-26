/**
 * 公開ゲート — 分類の欠けた企業を掲載させない。
 *
 * ⚠️ **条件を各経路に書き写さないこと。** 公開に触れる経路は4つあり、
 *    それぞれに条件を書くと必ず漏れる。条件の本体は
 *    このファイルの `classificationBlockers()` 1箇所だけに置く。
 *
 * ⚠️ **軸2（対象業界）を入れる日は、`classificationBlockers()` に1行足す。**
 *    別の場所に足さない。ゲートと一覧の警告が自動で揃う。
 *
 * ── この2つは同じ条件を見る ────────────────────────────────────────────────
 *   `checkPublishable()`     … 1社ぶん。**公開に切り替える瞬間**に4経路から呼ぶ
 *   `findPublishBlockers()`  … 複数社ぶん。**既に公開されている違反**を一覧に出す
 *
 * ⚠️ **どちらも例外を投げない。** 「満たしているか＋足りないものの一覧」を返す
 *    純粋な判定で、HTTP のステータスや画面表示は呼び出し側が決める。
 *    表示のために例外を握りつぶす作りにしないため。
 *    （名前が `assertPublishable` だった頃は「投げる」と誤読されたので改名した）
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

/** 判定に要る企業1社ぶんの材料。⚠️ ここに足したら SELECT 側も揃えること */
type ClassificationRow = {
  industry_id: string | null;
  industryName: string | null;
  requiresBusinessDomain: boolean;
  hasPrimaryDomain: boolean;
};

/**
 * ★分類の条件はここだけ。`checkPublishable` も `findPublishBlockers` もこれを呼ぶ。
 *
 * ⚠️ **actor に依らない条件だけを置く。** 掲載規約のような
 *    「誰が操作しているか」で変わるものは呼び出し側で足す。
 */
function classificationBlockers(row: ClassificationRow): string[] {
  const missing: string[] = [];

  if (!row.industry_id) {
    missing.push("業種が設定されていません。");
  }

  /* ⚠️ 事業領域が必須かどうかは業種マスタの `requires_business_domain` で決まる。
        slug をここに書かない（マスタと別のリストが増える）。 */
  if (row.requiresBusinessDomain && !row.hasPrimaryDomain) {
    missing.push(`事業領域が設定されていません（「${row.industryName ?? "この業種"}」では必須です）。`);
  }

  return missing;
}

/** SELECT の形。⚠️ `classificationBlockers` が見る材料と1対1にすること */
const CLASSIFICATION_COLS = "id, industry_id, ow_industries(name, requires_business_domain)" as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClassificationRow(row: any, hasPrimaryDomain: boolean): ClassificationRow {
  const industry = row.ow_industries as { name: string; requires_business_domain: boolean } | null;
  return {
    industry_id: (row.industry_id as string | null) ?? null,
    industryName: industry?.name ?? null,
    requiresBusinessDomain: industry?.requires_business_domain ?? false,
    hasPrimaryDomain,
  };
}

/**
 * 1社が掲載してよい状態か。**公開に切り替える瞬間**に呼ぶ。
 *
 * ⚠️ **`is_published` を true にする / `listing_status` を `'listed'` にする
 *    どちらの操作でも呼ぶこと。** 片方だけだと、もう片方から掲載できてしまう。
 *
 * ⚠️ 取得に失敗したら**通さない**（fail closed）。`?? []` で0件に倒して
 *    「条件を満たしている」と読ませない。
 */
export async function checkPublishable(
  companyId: string,
  actor: PublishActor,
): Promise<PublishableResult> {
  const admin = createAdminClient();

  const { data: company, error } = await admin
    .from("ow_companies")
    .select(CLASSIFICATION_COLS)
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    console.error("[checkPublishable] 企業の取得に失敗:", error.message);
    return { ok: false, missing: ["企業情報を確認できませんでした。時間をおいて再度お試しください。"] };
  }
  if (!company) {
    return { ok: false, missing: ["企業が見つかりませんでした。"] };
  }

  const { count, error: domainErr } = await admin
    .from("ow_company_business_domains")
    .select("company_id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (domainErr) {
    console.error("[checkPublishable] 事業領域の取得に失敗:", domainErr.message);
    return { ok: false, missing: ["事業領域を確認できませんでした。時間をおいて再度お試しください。"] };
  }

  const missing = classificationBlockers(toClassificationRow(company, (count ?? 0) > 0));

  // ── 掲載規約の同意（企業のときだけ）────────────────────────────────────
  if (actor.kind === "company") {
    if (!(await hasAgreedTerms(actor.authUserId, "listing"))) {
      missing.push("掲載利用規約に同意していません。");
    }
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/**
 * **既に公開されている企業のうち、いま掲載の条件を満たしていないもの**を洗い出す。
 *
 * ⚠️ **なぜ要るか。** `checkPublishable` は切り替え操作しか見ないので、
 *    ゲートを入れる前から公開されている企業の違反は誰も検知できない
 *    （2026-08-25 時点の実例: 株式会社データプール — 公開中・事業領域なし）。
 *    運営の一覧に出して気づけるようにする。
 *
 * ⚠️ **掲載規約の同意は見ない。** あれは「誰が操作するか」で変わる条件で、
 *    企業そのものの状態ではない（同じ企業でも、同意済みの担当者なら公開できる）。
 *    一覧に出すのは**運営が直せるもの**＝分類だけにする。
 *
 * ⚠️ N+1 にしないこと。企業と事業領域をそれぞれ1クエリで引く。
 *
 * @returns 違反している企業だけの Map（company_id → 足りないものの一覧）。
 *          取得に失敗したら **null**（空の Map と区別する。0件を装わない）
 */
export async function findPublishBlockers(
  companyIds: string[],
): Promise<Map<string, string[]> | null> {
  if (companyIds.length === 0) return new Map();

  const admin = createAdminClient();

  const [{ data: rows, error }, { data: domainRows, error: domainErr }] = await Promise.all([
    /* ⚠️ **検証用の企業（`is_test`）は運営タスクに出さない（2026-08-26）。**
          この一覧の意味は「運営が直すべき**公開中**の企業」。`is_test` の行は
          `lib/companies/visibility.ts` が求職者側から丸ごと除外しているので、
          分類が欠けていても誰にも見えない＝直す対象ではない。
          外さないと、テスト企業を作るたびに消えない警告が積み上がる。
       ⚠️ **`checkPublishable`（ゲート）側には同じ条件を入れないこと。**
          あちらは「公開に切り替える一手」を塞ぐもので、テスト企業でも
          分類が欠けたまま切り替えられる状態は作らない。
          **目的が違うので条件が違ってよい**（結果が食い違うわけではない）。 */
    admin.from("ow_companies").select(CLASSIFICATION_COLS).eq("is_test", false).in("id", companyIds),
    admin
      .from("ow_company_business_domains")
      .select("company_id")
      .eq("is_primary", true)
      .in("company_id", companyIds),
  ]);

  /* ⚠️ error を握りつぶさない。空で返すと「違反0件」に見え、
        取得できていないことに気づけない。 */
  if (error || domainErr) {
    console.error("[findPublishBlockers]", (error ?? domainErr)!.message);
    return null;
  }

  const withPrimary = new Set((domainRows ?? []).map((d) => d.company_id as string));

  const result = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const missing = classificationBlockers(
      toClassificationRow(row, withPrimary.has(row.id as string)),
    );
    if (missing.length > 0) result.set(row.id as string, missing);
  }
  return result;
}

/** 画面に出す1行の文言に畳む。 */
export function publishBlockedMessage(missing: string[]): string {
  return `掲載できません。${missing.join(" ")}`;
}

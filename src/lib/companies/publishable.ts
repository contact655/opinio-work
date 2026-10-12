/**
 * 公開ゲート — 必要な項目が欠けた企業を公開・掲載させない。
 *
 * ★項目の判定は `companyRequirements.ts`（純粋関数）の1か所（2026-10-12）。
 *   **ここは材料（DB と下書き）を集めて、あの関数に渡すだけ。条件を書かないこと。**
 *   画面の「公開まであと〇つ」も同じ関数を呼ぶので、画面とサーバーで判定が割れない。
 *
 * ── この2つは同じ関数を呼ぶ ────────────────────────────────────────────────
 *   `checkPublishable()`     … 1社ぶん。**公開・掲載に切り替える瞬間**に各経路から呼ぶ
 *   `findPublishBlockers()`  … 複数社ぶん。**既に公開・掲載されている違反**を運営の一覧に出す
 *
 * ── 呼ぶ経路（2026-10-12）──────────────────────────────────────────────────
 *   企業「変更を公開する」  PATCH /api/biz/company            useDraft・always・規約同意
 *   企業「掲載を依頼する」  POST /api/biz/company/listing-request  useDraft・forListing（規約同意は route が別に見る）
 *   運営「掲載」            admin/companies/actions.ts updateListingStatus  useDraft（下書きもまとめて反映する）
 *   運営「ページ公開」      admin/companies/actions.ts updateIsPublished
 *   運営 API                PUT /api/admin/companies/[id]（is_published だけ。listing_status は受け付けない）
 *
 * ⚠️ **どちらも例外を投げない。** 「満たしているか＋足りないものの一覧」を返す。
 *
 * ── 誰が公開するかで条件が違う ──────────────────────────────────────────────
 *   企業名・業種・事業領域 … actor に関わらず必須（scope: always）
 *   従業員数・本社所在地   … 「掲載を依頼する」のときだけ（scope: listing）。掲載中は止めない
 *   掲載規約の同意         … **企業のときだけ必須。** 運営が代理で掲載する場面まで止めると運用が回らない
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import {
  missingCompanyRequirements,
  readDraftBusinessDomains,
  requirementMessage,
  type CompanyRequirement,
  type CompanyRequirementInput,
} from "./companyRequirements";

/** 誰が公開しようとしているか。⚠️ ロールではなく**経路**で決める */
export type PublishActor =
  /** `/admin` 配下（運営）。掲載規約の同意は求めない */
  | { kind: "admin" }
  /** `/biz` 配下（企業）。掲載規約の同意が要る。`authUserId` は auth.users.id */
  | { kind: "company"; authUserId: string };

export type PublishableResult =
  | { ok: true }
  /** ⚠️ `missing` は**利用者にそのまま見せる文**。何が足りないかを具体的に書く */
  | { ok: false; missing: string[]; requirements?: CompanyRequirement[] };

export type PublishCheckOptions = {
  /** ★下書き（`draft_data`）の値を本番の値の上に重ねて判定する。企業の公開・掲載依頼と、運営の掲載で使う */
  useDraft?: boolean;
  /** ★掲載の依頼。従業員数・本社所在地まで見る */
  forListing?: boolean;
};

/** 判定に要る列。⚠️ `toRequirementInput` が読む列と1対1にすること */
const COLS = "id, name, industry_id, employee_count_band, location, headquarters_address, listing_status, draft_data, capital_type, hq_country, company_stage" as const;

type Row = {
  id: string;
  name: string | null;
  industry_id: string | null;
  employee_count_band: string | null;
  location: string | null;
  headquarters_address: string | null;
  listing_status: string | null;
  draft_data: unknown;
  /* ★分類（2026-10-12）。checkPublishable だけが判定に使う */
  capital_type: string | null;
  hq_country: string | null;
  company_stage: string | null;
};

/** 下書きのうち判定に使うキーだけを重ねる。⚠️ キーがあれば null も上書き（利用者が消した） */
function withDraft(row: Row): Row {
  const d = row.draft_data;
  if (!d || typeof d !== "object") return row;
  const draft = d as Record<string, unknown>;
  const pick = (k: keyof Row) => (k in draft ? ((draft[k] as string | null) ?? null) : (row[k] as string | null));
  return {
    ...row,
    name: pick("name"),
    industry_id: pick("industry_id"),
    employee_count_band: pick("employee_count_band"),
    location: pick("location"),
    capital_type: pick("capital_type"),
    hq_country: pick("hq_country"),
    company_stage: pick("company_stage"),
  };
}

function toRequirementInput(row: Row, requiresBusinessDomain: boolean, hasPrimaryDomain: boolean): CompanyRequirementInput {
  return {
    name: row.name,
    industryId: row.industry_id,
    requiresBusinessDomain,
    hasPrimaryDomain,
    employeeCountBand: row.employee_count_band,
    location: row.location,
    headquartersAddress: row.headquarters_address,
  };
}

/**
 * 1社が公開・掲載してよい状態か。**切り替える瞬間・下書きを反映する直前**に呼ぶ。
 * ⚠️ 取得に失敗したら**通さない**（fail closed）。
 */
export async function checkPublishable(
  companyId: string,
  actor: PublishActor,
  opts: PublishCheckOptions = {},
): Promise<PublishableResult> {
  const admin = createAdminClient();

  const { data: raw, error } = await admin.from("ow_companies").select(COLS).eq("id", companyId).maybeSingle();
  if (error) {
    console.error("[checkPublishable] 企業の取得に失敗:", error.message);
    return { ok: false, missing: ["企業情報を確認できませんでした。時間をおいて再度お試しください。"] };
  }
  if (!raw) return { ok: false, missing: ["企業が見つかりませんでした。"] };

  const row = opts.useDraft ? withDraft(raw as Row) : (raw as Row);

  /* 業種マスタ（小分類まで選ぶ必要があるか）。⚠️ 下書きで業種を変えていれば**下書きの業種**で引く
     ★2026-10-12 から事業は全業種で必須（requires_business_domain は見ない。判断どおり） */
  let industryNeedsSub = false;
  if (row.industry_id) {
    const { data: ind, error: indErr } = await admin
      .from("ow_industries").select("id, parent_id").eq("id", row.industry_id).maybeSingle();
    const { count: kids, error: kidErr } = ind && !ind.parent_id
      ? await admin.from("ow_industries").select("id", { count: "exact", head: true }).eq("parent_id", row.industry_id).is("retired_at", null)
      : { count: 0, error: null };
    if (indErr || kidErr) {
      console.error("[checkPublishable] 業種の取得に失敗:", (indErr ?? kidErr)!.message);
      return { ok: false, missing: ["業種を確認できませんでした。時間をおいて再度お試しください。"] };
    }
    industryNeedsSub = (kids ?? 0) > 0;
  }

  /* 主の事業領域。⚠️ 下書きに事業領域があれば下書きで判定する（反映の前に判定するため） */
  let hasPrimaryDomain: boolean;
  const draftDomains = opts.useDraft ? readDraftBusinessDomains((raw as Row).draft_data) : null;
  if (draftDomains) {
    hasPrimaryDomain = draftDomains.primary_domain_id !== null && draftDomains.domain_ids.includes(draftDomains.primary_domain_id);
  } else {
    const { count, error: domainErr } = await admin
      .from("ow_company_business_domains")
      .select("company_id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("is_primary", true);
    if (domainErr) {
      console.error("[checkPublishable] 事業領域の取得に失敗:", domainErr.message);
      return { ok: false, missing: ["事業領域を確認できませんでした。時間をおいて再度お試しください。"] };
    }
    hasPrimaryDomain = (count ?? 0) > 0;
  }

  const requirements = missingCompanyRequirements(
    {
      ...toRequirementInput(row, false, hasPrimaryDomain),
      /* ★新しい条件は、公開・掲載に切り替える一手と「変更を公開する」でだけ効かせる（提案B） */
      classification: { industryNeedsSub, capitalType: row.capital_type, hqCountry: row.hq_country, companyStage: row.company_stage },
    },
    { forListing: opts.forListing === true },
  );
  const missing = requirements.map(requirementMessage);

  // ── 掲載規約の同意（企業のときだけ）────────────────────────────────────
  if (actor.kind === "company") {
    if (!(await hasAgreedTerms(actor.authUserId, "listing"))) {
      missing.push("掲載利用規約に同意していません。");
    }
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing, requirements };
}

/**
 * **既に公開されている企業のうち、いま条件を満たしていないもの**を洗い出す（運営の「要対応」）。
 *
 * ⚠️ 掲載中（listed）の企業は従業員数・本社所在地まで見る。**止めはしない**（要対応として出すだけ）。
 * ⚠️ **掲載規約の同意は見ない。** 企業そのものの状態ではない。
 * ⚠️ **検証用の企業（`is_test`）は出さない**（求職者側から丸ごと除外されているので直す対象ではない）。
 * ⚠️ 下書きは見ない。いま求職者に見えている値の話。
 * ⚠️ N+1 にしないこと。
 *
 * @returns 違反している企業だけの Map。取得に失敗したら **null**（0件を装わない）
 */
export async function findPublishBlockers(
  companyIds: string[],
): Promise<Map<string, string[]> | null> {
  if (companyIds.length === 0) return new Map();

  const admin = createAdminClient();

  const [{ data: rows, error }, { data: domainRows, error: domainErr }, { data: industries, error: indErr }] = await Promise.all([
    admin.from("ow_companies").select(COLS).eq("is_test", false).in("id", companyIds),
    admin.from("ow_company_business_domains").select("company_id").eq("is_primary", true).in("company_id", companyIds),
    admin.from("ow_industries").select("id, requires_business_domain"),
  ]);

  if (error || domainErr || indErr) {
    console.error("[findPublishBlockers]", (error ?? domainErr ?? indErr)!.message);
    return null;
  }

  const withPrimary = new Set((domainRows ?? []).map((d) => d.company_id as string));
  const requires = new Map((industries ?? []).map((i) => [i.id as string, i.requires_business_domain === true]));

  const result = new Map<string, string[]>();
  for (const raw of (rows ?? []) as Row[]) {
    const reqs = missingCompanyRequirements(
      toRequirementInput(raw, raw.industry_id ? requires.get(raw.industry_id) ?? false : false, withPrimary.has(raw.id)),
      { forListing: raw.listing_status === "listed" },
    );
    if (reqs.length > 0) result.set(raw.id, reqs.map(requirementMessage));
  }
  return result;
}

/** 画面に出す1行の文言に畳む。 */
export function publishBlockedMessage(missing: string[]): string {
  return `掲載できません。${missing.join(" ")}`;
}

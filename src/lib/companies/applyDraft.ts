import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne, mutateAllowNone } from "@/lib/supabase/mutate";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { isValidIndustry } from "@/lib/search/industryGroups";
import { isPhaseValue } from "@/lib/constants/phase";
import { VALID_COMPANY_REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import { normalizeBenefits, serializeBenefits, type Benefit } from "@/lib/companies/benefits";
import { isEmployeeBand } from "@/lib/constants/employeeBand";
import { setCompanyBusinessDomains } from "@/lib/companies/setBusinessDomains";
import { readDraftBusinessDomains } from "@/lib/companies/companyRequirements";
import { cleanupCompanyLogoFiles } from "@/lib/companies/logoFiles";

/**
 * ★企業ページの下書き（`draft_data`）と未公開の写真を、求職者に見える状態へ反映する（2026-10-12）。
 *   **反映の処理はここの1か所。** 次の2つが呼ぶ:
 *     ・企業の「変更を公開する」（PATCH /api/biz/company）… 企業のセッションのクライアント
 *     ・運営の「掲載」（admin/companies/actions.ts と PUT /api/admin/companies/[id]）… admin クライアント
 *   それまで反映は企業の PATCH の中にしか無く、**運営が掲載にしても企業の下書きは反映されなかった。**
 *
 * ⚠️★**呼ぶ前に `checkPublishable(…, { useDraft: true })` を通すこと。** ここは判定しない。
 *    判定を下書きの値で先に済ませてから書くので、途中で弾かれて半端に書かれることが無い。
 *
 * 書く順:
 *   ① 事業領域（下書きにあれば）… ★**本体より先に書く。** 事業領域だけ別の表なので、ここで落ちたら本体を書かずに止める
 *   ② 本体の列（`ow_companies`）と `draft_data = null`
 *   ③ ジャンル（best-effort。従来どおり）
 *   ④ 未公開の写真を公開（`is_draft = false`）… **admin クライアント**（企業は is_draft を戻せない。トリガーで止めてある）
 *
 * ⚠️★`is_published` / `listing_status` / `published_at` は**ここで書かない**（掲載の管理は運営の操作）。
 * ⚠️★`notification_emails` は**ここで書かない**（2026-10-12 に「メンバーと権限」の即時保存へ移した）。
 *    古い下書きに残っていても無視する。書くと移した先で設定した宛先を古い値で上書きする。
 * ⚠️★入力欄を外した項目（平均年齢・男女比・平均年収・累計調達額・企業の特徴）も**書かない**。
 *    列とデータは残す（2026-10-12 / 柴さんの指示）。古い下書きの値で本番の値を潰さないため。
 */

export type ApplyDraftResult =
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string };

/* ★draft_data に無いキーは触らない（undefined を返す）。キーがあって空は null（利用者が消した）。
   ⚠️ 2026-08-26 まで、書いていないキーを null で上書きしていた（説明文と設立年が消える形）。 */
const s = (v: unknown): string | null | undefined =>
  v === undefined ? undefined : typeof v === "string" ? v : null;
const n = (v: unknown): number | null | undefined =>
  v === undefined ? undefined : typeof v === "number" ? v : null;
const sa = (v: unknown): string[] | null | undefined =>
  v === undefined ? undefined : Array.isArray(v) ? v as string[] : null;
/* ⚠️ 福利厚生は jsonb。`sa()` を使わない（オブジェクトの配列が文字列の配列として通る） */
const bene = (v: unknown): Benefit[] | null | undefined => {
  if (v === undefined) return undefined;
  const norm = normalizeBenefits(v);
  return norm ? serializeBenefits(norm) : null;
};

export async function applyCompanyDraft(
  companyId: string,
  opts: {
    client: SupabaseClient;
    label: string;
    /** ★企業名も反映するか（2026-10-12）。**運営の掲載（掲載前の企業）だけ true。**
     *  掲載後の社名の変更は企業からは受け付けない（運営へ連絡。運営画面からは変えられる） */
    writeName?: boolean;
  },
): Promise<ApplyDraftResult> {
  const { client, label } = opts;
  const now = new Date().toISOString();

  const { data: current, error: fetchError } = await client
    .from("ow_companies")
    .select("draft_data")
    .eq("id", companyId)
    .maybeSingle();
  if (fetchError) {
    console.error(`[applyCompanyDraft:${label}] 取得に失敗:`, fetchError.message);
    return { ok: false, status: 500, error: "Internal server error" };
  }
  if (!current) return { ok: false, status: 404, error: "Company not found" };

  const d = ((current.draft_data ?? {}) as Record<string, unknown>);
  const genreSlugs: string[] | null = Array.isArray(d.genres) ? (d.genres as string[]) : null;

  /* ── 値の検証（不正値は 400。DB の CHECK に落ちると本体の UPDATE が丸ごと失敗する）── */
  if (typeof d.industry === "string" && d.industry.trim() && !isValidIndustry(d.industry.trim())) {
    return { ok: false, status: 400, error: "INVALID_INDUSTRY", message: "業種の値が不正です。" };
  }
  if (typeof d.phase === "string" && d.phase.trim() && !isPhaseValue(d.phase.trim())) {
    return { ok: false, status: 400, error: "INVALID_PHASE", message: "事業ステージの値が不正です。" };
  }
  if (
    typeof d.remote_work_status === "string" && d.remote_work_status.trim() &&
    !VALID_COMPANY_REMOTE_WORK_STATUSES.has(d.remote_work_status.trim())
  ) {
    return { ok: false, status: 400, error: "INVALID_REMOTE_WORK_STATUS", message: "リモートワーク状況の値が不正です。" };
  }
  const bandIn = s(d.employee_count_band);
  if (bandIn != null && bandIn !== "" && !isEmployeeBand(bandIn)) {
    return { ok: false, status: 400, error: "従業員数の帯に不正な値が指定されました" };
  }
  const asOfIn = s(d.employee_count_as_of);
  if (asOfIn != null && asOfIn !== "" && !/^\d{4}-\d{2}-01$/.test(asOfIn)) {
    return { ok: false, status: 400, error: "従業員数の時点は年月で指定してください" };
  }

  /* ── ① 事業領域（本体より先）── */
  const draftDomains = readDraftBusinessDomains(d);
  if (draftDomains) {
    const r = await setCompanyBusinessDomains(companyId, draftDomains, `${label} 事業領域`);
    if (!r.ok) return { ok: false, status: r.status, error: r.error, message: r.error };
  }

  /* ── ② 本体 ── */
  const mainRes = await mutateOne(
    client
      .from("ow_companies")
      .update({
        /* ★企業名は運営の掲載のときだけ書く（writeName）。掲載後は企業から変えられない。
              ⚠️ 空にはしない（NOT NULL）。変えると normalized_name はトリガーが作り直す */
        name:                     opts.writeName ? ((s(d.name) ?? "").trim() || undefined) : undefined,
        tagline:                  s(d.tagline),
        description:              s(d.description),
        mission:                  s(d.mission),
        benefits:                 bene(d.benefits),
        fit_positives:            sa(d.fit_positives),
        fit_negatives:            sa(d.fit_negatives),
        why_join:                 s(d.why_join),
        remote_work_status:       s(d.remote_work_status),
        flex_time:                typeof d.flex_time === "boolean" ? d.flex_time : undefined,
        side_job_ok:              typeof d.side_job_ok === "boolean" ? d.side_job_ok : undefined,
        accepting_casual_meetings: typeof d.accepting_casual_meetings === "boolean" ? d.accepting_casual_meetings : undefined,
        location:                 s(d.location),
        url:                      s(d.url),
        founded_year:             n(d.founded_year),
        employee_count:           s(d.employee_count),
        employee_count_band:      bandIn === "" ? null : bandIn,
        employee_count_as_of:     asOfIn === "" ? null : asOfIn,
        industry:                 s(d.industry),
        industry_id:              s(d.industry_id),
        saas_category_id:         s(d.saas_category_id),
        phase:                    s(d.phase),
        logo_url:                 s(d.logo_url),
        logo_gradient:            s(d.logo_gradient),
        logo_letter:              s(d.logo_letter),
        nearest_station:          s(d.nearest_station),
        careers_url:              s(d.careers_url),
        work_time_system:         s(d.work_time_system),
        updated_at:               now,
        draft_data:               null,
      })
      .eq("id", companyId),
    `${label} 本体`,
  );
  if (!mainRes.ok) return { ok: false, status: mainRes.status, error: mainRes.error };

  /* ── ③ ジャンル（全置換・best-effort）── */
  if (genreSlugs) {
    try {
      const { data: genreRecords, error: genreQueryErr } = await client
        .from("ow_genres")
        .select("id, slug")
        .eq("is_active", true)
        .in("slug", genreSlugs.length > 0 ? genreSlugs : ["__no_match__"]);
      if (genreQueryErr) throw genreQueryErr;
      const resolved = new Set((genreRecords ?? []).map((r) => r.slug));
      const missingSlugs = genreSlugs.filter((x) => !resolved.has(x));
      if (missingSlugs.length > 0) console.warn(`[applyCompanyDraft:${label}] 不正なジャンルを無視: ${missingSlugs.join(", ")}`);
      const genreIds = (genreRecords ?? []).map((r) => r.id);
      const del = await mutateAllowNone(
        client.from("ow_company_genres").delete().eq("company_id", companyId),
        `${label}: genres 入替（掃除）`,
        { returning: "company_id" },
      );
      if (!del.ok) throw new Error(del.error);
      if (genreIds.length > 0) {
        const { error: insertErr } = await client.from("ow_company_genres").insert(
          genreIds.map((genre_id) => ({ company_id: companyId, genre_id, is_human_approved: true, is_ai_suggested: false })),
        );
        if (insertErr) throw insertErr;
      }
    } catch (genreErr) {
      console.error(`[applyCompanyDraft:${label}] ow_company_genres sync failed:`, genreErr);
    }
  }

  /* ── ④ 未公開の写真を公開 ──
     ⚠️ admin クライアント。企業のセッションでは is_draft を false にできない（トリガー）。
     ⚠️ 0行は正常（未公開の写真が無い）。 */
  const photoRes = await mutateAllowNone(
    createAdminClient().from("ow_company_office_photos").update({ is_draft: false })
      .eq("company_id", companyId).eq("is_draft", true),
    `${label}: 写真の公開`,
  );
  if (!photoRes.ok) {
    /* ⚠️ 本体は反映済み。写真だけ未公開のまま残るので、利用者にそう伝える */
    return { ok: false, status: photoRes.status, error: "写真を公開できませんでした。もう一度「公開する」を押してください。" };
  }

  /* ── ⑤ 使われなくなったロゴのファイルを消す（公開した後の古いロゴ・公開しないまま差し替えたロゴ）。best-effort ── */
  await cleanupCompanyLogoFiles(companyId, label);

  await revalidateCompanyPages(companyId);
  return { ok: true };
}

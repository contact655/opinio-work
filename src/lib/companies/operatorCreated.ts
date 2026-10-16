import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBenefits } from "@/lib/companies/benefits";
import { AI_FILL_FIELD_KEYS, type AiFillFieldKey } from "@/lib/admin/aiFill/fields";

/**
 * ★「運営がAIで作成・企業未確認」の項目を返す（2026-10-15 / 柴さんの指示）。
 *
 * 判定: その項目の**最新の変更履歴**（ow_company_field_changes）が運営の「AIで埋める」（via='ai_paste'）で、
 *       **いまの値がそのとき入れた値と同じ**なら「運営が作成・企業未確認」。
 *       企業が値を変えれば一致しなくなり、印は自動で外れる。
 *
 * ⚠️ 列を足していない（出典の表の CHECK を広げる migration は pending のまま）。履歴から導くので、
 *    運営が入れた値を企業が「そのまま公開」した場合も印は残る（＝企業が中身を変えていない、という意味で正しい）。
 * ⚠️ 履歴の表は運営専用。ここは admin クライアントで読み、**項目名だけ**を返す（履歴の中身・URL・誰が、は外に出さない）。
 * ⚠️ 取得に失敗したら空（印を出さない）。印を出し損ねても、値そのものの表示は壊れない。
 */
export async function loadOperatorCreatedFields(companyId: string): Promise<AiFillFieldKey[]> {
  const db = createAdminClient();
  const [hist, co, doms] = await Promise.all([
    db.from("ow_company_field_changes").select("field, new_value, via, changed_at").eq("company_id", companyId).order("changed_at", { ascending: false }).limit(50),
    db.from("ow_companies").select("remote_work_status, benefits").eq("id", companyId).maybeSingle(),
    db.from("ow_company_business_domains").select("domain_id, is_primary").eq("company_id", companyId),
  ]);
  for (const [k, r] of Object.entries({ hist, co, doms })) {
    if (r.error) { console.error(`[loadOperatorCreatedFields] ${k}:`, r.error.message); return []; }
  }
  if (!co.data || !hist.data?.length) return [];

  const latest = new Map<string, { new_value: unknown; via: string }>();
  for (const h of hist.data) if (!latest.has(h.field as string)) latest.set(h.field as string, { new_value: h.new_value, via: h.via as string });

  const secondary = (doms.data ?? []).filter((d) => !d.is_primary).map((d) => d.domain_id as string).sort();
  const current: Record<AiFillFieldKey, unknown> = {
    remote_work_status: co.data.remote_work_status ?? null,
    benefits: normalizeBenefits(co.data.benefits),
    business_domains_secondary: secondary,
  };

  const out: AiFillFieldKey[] = [];
  for (const f of AI_FILL_FIELD_KEYS) {
    const l = latest.get(f);
    if (!l || l.via !== "ai_paste") continue;
    if (sameValue(f, l.new_value, current[f])) out.push(f);
  }
  return out;
}

function sameValue(f: AiFillFieldKey, written: unknown, now: unknown): boolean {
  if (now === null || now === undefined) return false;
  if (f === "benefits") return JSON.stringify(normalizeBenefits(written)) === JSON.stringify(now);
  if (f === "business_domains_secondary") {
    const w = Array.isArray(written) ? [...(written as string[])].sort() : [];
    return w.length > 0 && JSON.stringify(w) === JSON.stringify(now);
  }
  return written === now;
}

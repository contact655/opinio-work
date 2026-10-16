import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import type { AiFillFieldKey } from "./fields";
import { loadOperatorCreatedFields } from "@/lib/companies/operatorCreated";

/**
 * 運営の「AIで埋める」タブに渡すものを集める（2026-10-15）。**運営画面専用（admin クライアント）。**
 */

/** 質問文に出す事業領域の選択肢の数（★約20。掲載企業が使っている領域を先に並べる） */
export const AI_FILL_DOMAIN_CHOICES = 20;

export type AiFillDomain = { id: string; name: string };
export type AiFillLastChange = { changedAt: string; sourceUrl: string | null; changedByName: string | null };
export type AiFillData = {
  companyName: string;
  url: string | null;
  current: {
    remote_work_status: string | null;
    benefits: unknown;
    primaryDomain: AiFillDomain | null;
    secondaryDomains: AiFillDomain[];
  };
  /** 質問文に出す選択肢（約20） */
  domainChoices: AiFillDomain[];
  /** 名前の完全一致と「要選択」の選び直しに使う全件（有効なものだけ） */
  allDomains: AiFillDomain[];
  lastChanges: Partial<Record<AiFillFieldKey, AiFillLastChange>>;
  /** 運営がAIで作成し、企業がまだ変えていない項目（判定は lib/companies/operatorCreated.ts） */
  operatorCreated: AiFillFieldKey[];
};

export async function loadAiFillData(companyId: string): Promise<AiFillData | null> {
  const db = createAdminClient();
  const [co, mine, master, uses, hist] = await Promise.all([
    db.from("ow_companies").select("name, name_en, url, remote_work_status, benefits").eq("id", companyId).maybeSingle(),
    db.from("ow_company_business_domains").select("domain_id, is_primary").eq("company_id", companyId),
    db.from("ow_business_domains").select("id, name, display_kind, display_order").eq("status", "active").eq("is_active", true).order("display_order"),
    /* 掲載中の実企業が使っている領域（質問文の並び順に使う） */
    db.from("ow_company_business_domains").select("domain_id, ow_companies!inner(is_test, listing_status)")
      .eq("ow_companies.is_test", false).eq("ow_companies.listing_status", "listed"),
    db.from("ow_company_field_changes").select("field, changed_at, source_url, changed_by").eq("company_id", companyId).order("changed_at", { ascending: false }).limit(200),
  ]);
  for (const [k, r] of Object.entries({ co, mine, master, uses, hist })) {
    if (r.error) { console.error(`[loadAiFillData] ${k}:`, r.error.message); return null; }
  }
  if (!co.data) return null;

  const all = (master.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, kind: d.display_kind as string }));
  const byId = new Map(all.map((d) => [d.id, d]));
  const count = new Map<string, number>();
  for (const u of uses.data ?? []) count.set(u.domain_id as string, (count.get(u.domain_id as string) ?? 0) + 1);

  /* 使われている順 → 次に main の表示順。⚠️ 同数のときは master の並び（display_order）を保つ（sort は安定） */
  const ranked = [...all].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || Number(b.kind === "main") - Number(a.kind === "main"));
  const domainChoices = ranked.slice(0, AI_FILL_DOMAIN_CHOICES).map(({ id, name }) => ({ id, name }));

  const primaryId = (mine.data ?? []).find((r) => r.is_primary)?.domain_id as string | undefined;
  const pick = (id: string) => { const d = byId.get(id); return d ? { id: d.id, name: d.name } : null; };

  const lastChanges: AiFillData["lastChanges"] = {};
  const changerIds = new Set<string>();
  for (const h of hist.data ?? []) {
    const f = h.field as AiFillFieldKey;
    if (lastChanges[f]) continue;
    lastChanges[f] = { changedAt: h.changed_at as string, sourceUrl: (h.source_url as string | null) ?? null, changedByName: (h.changed_by as string | null) };
    if (h.changed_by) changerIds.add(h.changed_by as string);
  }
  if (changerIds.size > 0) {
    const { data: users, error } = await db.from("ow_users").select("id, name").in("id", Array.from(changerIds));
    if (error) console.error("[loadAiFillData] users:", error.message);
    const names = new Map((users ?? []).map((u) => [u.id as string, u.name as string]));
    for (const v of Object.values(lastChanges)) if (v) v.changedByName = v.changedByName ? names.get(v.changedByName) ?? null : null;
  }

  const operatorCreated = await loadOperatorCreatedFields(companyId);

  return {
    /* ⚠️ 質問文には正式名（登記の商号）を出す。表示名（「Salesforce」）だと別法人を調べられることがある */
    companyName: (() => {
      const formal = co.data.name as string;
      const disp = companyDisplayName(formal, (co.data.name_en as string | null) ?? null).displayName;
      return disp === formal ? formal : `${formal}（${disp}）`;
    })(),
    url: (co.data.url as string | null) ?? null,
    current: {
      remote_work_status: (co.data.remote_work_status as string | null) ?? null,
      benefits: co.data.benefits,
      primaryDomain: primaryId ? pick(primaryId) : null,
      secondaryDomains: (mine.data ?? []).filter((r) => !r.is_primary).map((r) => pick(r.domain_id as string)).filter((d): d is AiFillDomain => !!d),
    },
    domainChoices,
    allDomains: all.map(({ id, name }) => ({ id, name })),
    lastChanges,
    operatorCreated,
  };
}

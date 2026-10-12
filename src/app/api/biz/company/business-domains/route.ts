import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_NEW_DOMAIN_NAME, normalizeForSearch, type ClassDomain } from "@/lib/companies/classification";

export const dynamic = "force-dynamic";

/**
 * ★企業がその場で事業を追加する（POST /api/biz/company/business-domains。2026-10-12 / 柴さんの判断）。
 *   「見つからないときはそのまま追加できます。運営が確認して、近い分類にまとめます。」
 *
 * - 同じ名前（別名を含む）の事業が既にあれば、**新しく作らずそれを返す**（重複を作らない）
 *   ・運営が認めたもの（active）… そのまま返す
 *   ・確認待ち（pending）… この会社の申請記録も足して返す（RPC は「この会社が追加したもの」だけ受け付けるため）
 * - 無ければ status='pending'・is_active=false で作り、申請記録（ow_business_domain_proposals）を残す。
 *   ⚠️ is_active=false なので**求職者側には出ない**（運営が採用するまで）。
 * - 選んだかどうか（会社の事業の紐付け）はここでは書かない。下書きに入り「公開する」で反映される。
 * ⚠️ 書くのは admin クライアント（マスタと申請記録は運営専用）。役割は company.basic（基本情報を編集できる人）。
 */
export async function POST(req: Request) {
  const gate = await requireBizAction("company.basic");
  if (!gate.ok) return gate.response;
  const { companyId, owUserId } = gate.actor;

  let body: { name?: unknown; industryId?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
  if (!name) return NextResponse.json({ error: "事業の名前を入れてください。" }, { status: 400 });
  if (name.length > MAX_NEW_DOMAIN_NAME) {
    return NextResponse.json({ error: `事業の名前は${MAX_NEW_DOMAIN_NAME}文字までです。` }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: all, error } = await db.from("ow_business_domains")
    .select("id, name, slug, industry_id, display_kind, aliases, status, display_order").in("status", ["active", "pending"]);
  if (error) {
    console.error("[biz business-domains POST] 取得に失敗:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  const q = normalizeForSearch(name);
  const hit = (all ?? []).find((d) => normalizeForSearch(d.name as string) === q
    || ((d.aliases as string[] | null) ?? []).some((a) => normalizeForSearch(a) === q));

  const toOption = (d: Record<string, unknown>): ClassDomain => ({
    id: d.id as string, name: d.name as string, slug: d.slug as string,
    industry_id: (d.industry_id as string | null) ?? null,
    display_kind: d.display_kind === "search" ? "search" : "main",
    aliases: (d.aliases as string[] | null) ?? [],
    status: d.status === "pending" ? "pending" : "active",
    display_order: (d.display_order as number) ?? 0,
  });

  if (hit && hit.status === "active") return NextResponse.json({ domain: toOption(hit), existed: true });

  /* 業種（大分類）。⚠️ 送られた業種が小分類なら親にする。わからなければ空（運営が確認するときに決める） */
  let industryId: string | null = null;
  if (typeof body.industryId === "string" && /^[0-9a-f-]{36}$/i.test(body.industryId)) {
    const { data: ind } = await db.from("ow_industries").select("id, parent_id").eq("id", body.industryId).is("retired_at", null).maybeSingle();
    if (ind) industryId = (ind.parent_id as string | null) ?? (ind.id as string);
  }

  let domain = hit ?? null;
  if (!domain) {
    const { data: created, error: insErr } = await db.from("ow_business_domains").insert({
      name, slug: `custom-${randomBytes(4).toString("hex")}`,
      industry_id: industryId, display_kind: "search", status: "pending", is_active: false, display_order: 900,
    }).select("id, name, slug, industry_id, display_kind, aliases, status, display_order").single();
    if (insErr || !created) {
      console.error("[biz business-domains POST] 追加に失敗:", insErr?.message);
      return NextResponse.json({ error: "事業を追加できませんでした。" }, { status: 500 });
    }
    domain = created;
  }

  const { error: pErr } = await db.from("ow_business_domain_proposals").insert({ domain_id: domain.id, company_id: companyId, proposed_by: owUserId });
  if (pErr) {
    console.error("[biz business-domains POST] 申請記録に失敗:", pErr.message);
    return NextResponse.json({ error: "事業を追加できませんでした。" }, { status: 500 });
  }
  return NextResponse.json({ domain: toOption(domain), existed: !!hit });
}

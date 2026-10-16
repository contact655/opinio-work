import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { setCompanyBusinessDomains } from "@/lib/companies/setBusinessDomains";
import { normalizeBenefits, type Benefit } from "@/lib/companies/benefits";
import { VALID_COMPANY_REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";
import { COMPANY_SOURCE_FIELDS } from "@/lib/constants/companySources";
import { MAX_BUSINESS_DOMAINS_PER_COMPANY } from "@/lib/companies/businessDomains";
import { isAiFillFieldKey, BENEFITS_MAX, type AiFillFieldKey } from "@/lib/admin/aiFill/fields";

/**
 * POST /api/admin/companies/[id]/ai-fill — 運営の「AIで埋める」の反映（2026-10-15）
 *   body: { items: [{ field, value, source_url }] }
 *     remote_work_status          … DB の値（full_remote など）
 *     benefits                    … [{ name, detail? }]
 *     business_domains_secondary  … 事業領域の id の配列（主は今のまま残す）
 *
 * ⚠️★受け取るのは運営が確認画面でチェックした値と出典 URL だけ。貼り付けた AI の文章は受けない・ログに出さない。
 * ⚠️ 書き込みは既存の経路と同じ（ow_companies の UPDATE は admin クライアント＋mutateOne、
 *    事業領域は setCompanyBusinessDomains）。トリガーは素通りしない。
 * ⚠️ 履歴は ow_company_field_changes（運営だけが読める）に1項目1行。
 * ⚠️ 最新の出典は ow_company_data_sources に書く。ただし field の CHECK が広がるまで
 *    （supabase/pending/20261015150000）は COMPANY_SOURCE_FIELDS に無い項目を書かない。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s) || s.length > 2048) return null;
  return s;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || items.length === 0) return NextResponse.json({ error: "反映する項目がありません。" }, { status: 400 });

  const label = `POST /api/admin/companies/${params.id}/ai-fill`;
  const admin = createAdminClient();

  /* 誰が変えたか（ow_users 空間） */
  const { data: { user } } = await createClient().auth.getUser();
  let changedBy: string | null = null;
  if (user) {
    const { data: me, error } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
    if (error) console.error(`[${label}] ow_users:`, error.message);
    changedBy = (me?.id as string | undefined) ?? null;
  }

  const { data: before, error: beforeErr } = await admin
    .from("ow_companies").select("id, remote_work_status, benefits").eq("id", params.id).maybeSingle();
  if (beforeErr) { console.error(`[${label}] before:`, beforeErr.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
  if (!before) return NextResponse.json({ error: "企業が見つかりません。" }, { status: 404 });

  const { data: domRows, error: domErr } = await admin
    .from("ow_company_business_domains").select("domain_id, is_primary").eq("company_id", params.id);
  if (domErr) { console.error(`[${label}] domains:`, domErr.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
  const primaryId = (domRows ?? []).find((r) => r.is_primary)?.domain_id as string | undefined;
  const currentSecondary = (domRows ?? []).filter((r) => !r.is_primary).map((r) => r.domain_id as string);

  /* ── 検証（1つでも不正なら何も書かない） ── */
  const seen = new Set<string>();
  const updates: Record<string, unknown> = {};
  const changes: { field: AiFillFieldKey; old_value: unknown; new_value: unknown; source_url: string | null }[] = [];
  let newSecondary: string[] | null = null;

  for (const raw of items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const field = it.field;
    if (!isAiFillFieldKey(field)) return NextResponse.json({ error: "項目の名前が不正です。" }, { status: 400 });
    if (seen.has(field)) return NextResponse.json({ error: "同じ項目が2回送られました。" }, { status: 400 });
    seen.add(field);
    const url = cleanUrl(it.source_url);
    const v = it.value;

    if (field === "remote_work_status") {
      if (typeof v !== "string" || !VALID_COMPANY_REMOTE_WORK_STATUSES.has(v)) return NextResponse.json({ error: "勤務形態の値が不正です。" }, { status: 400 });
      updates.remote_work_status = v;
      changes.push({ field, old_value: before.remote_work_status ?? null, new_value: v, source_url: url });
    } else if (field === "benefits") {
      const list = normalizeBenefits(v);
      if (!list || list.length > BENEFITS_MAX || list.some((b) => b.name.length > 100 || (b.detail?.length ?? 0) > 200)) {
        return NextResponse.json({ error: `福利厚生の形式が不正です（1〜${BENEFITS_MAX}件）。` }, { status: 400 });
      }
      updates.benefits = list as Benefit[];
      changes.push({ field, old_value: normalizeBenefits(before.benefits), new_value: list, source_url: url });
    } else {
      if (!primaryId) return NextResponse.json({ error: "主の事業領域が無いので、従を足せません。先に主を設定してください。" }, { status: 400 });
      const ids = Array.isArray(v) ? Array.from(new Set(v)) : null;
      if (!ids || ids.length === 0 || !ids.every((x): x is string => typeof x === "string" && UUID_RE.test(x)) || ids.includes(primaryId)) {
        return NextResponse.json({ error: "事業領域（従）の形式が不正です。" }, { status: 400 });
      }
      if (ids.length + 1 > MAX_BUSINESS_DOMAINS_PER_COMPANY) return NextResponse.json({ error: `事業領域は主を含めて ${MAX_BUSINESS_DOMAINS_PER_COMPANY} 件までです。` }, { status: 400 });
      newSecondary = ids;
      changes.push({ field, old_value: currentSecondary, new_value: ids, source_url: url });
    }
  }

  /* ── 書き込み ── */
  if (Object.keys(updates).length > 0) {
    const up = await mutateOne(admin.from("ow_companies").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", params.id), label);
    if (!up.ok) return NextResponse.json({ error: up.error }, { status: up.status });
  }
  if (newSecondary && primaryId) {
    const r = await setCompanyBusinessDomains(params.id, { domain_ids: [primaryId, ...newSecondary], primary_domain_id: primaryId }, label);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }

  /* 履歴。⚠️ 本体は書けている。履歴が落ちたら 500 にして運営に知らせる（黙って成功にしない） */
  const { error: histErr } = await admin.from("ow_company_field_changes").insert(
    changes.map((c) => ({ company_id: params.id, field: c.field, old_value: c.old_value as never, new_value: c.new_value as never, source_url: c.source_url, via: "ai_paste", changed_by: changedBy })),
  );
  if (histErr) {
    console.error(`[${label}] field_changes:`, histErr.message);
    await revalidateCompanyPages(params.id);
    return NextResponse.json({ error: "値は反映しましたが、履歴の記録に失敗しました。" }, { status: 500 });
  }

  /* 最新の出典。⚠️ CHECK が許す項目だけ（pending の migration を当てたら COMPANY_SOURCE_FIELDS を広げる） */
  const allowed = new Set<string>(COMPANY_SOURCE_FIELDS);
  const sources = changes.filter((c) => allowed.has(c.field) && c.source_url).map((c) => ({
    company_id: params.id, field: c.field, source_kind: "official_site", source_url: c.source_url, verified_at: new Date().toISOString(),
  }));
  if (sources.length > 0) {
    const { error } = await admin.from("ow_company_data_sources").upsert(sources as never, { onConflict: "company_id,field" });
    if (error) console.error(`[${label}] data_sources:`, error.message);
  }

  await revalidateCompanyPages(params.id);
  return NextResponse.json({ success: true, applied: changes.map((c) => c.field) });
}

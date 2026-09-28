import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { setCompanyBusinessDomains } from "@/lib/companies/setBusinessDomains";

export const dynamic = "force-dynamic";

/*
 * ═══ 事業領域の入れ替え（企業）════════════════════════════════════════════
 *
 * PUT /api/biz/company/business-domains
 * body: { domain_ids: string[], primary_domain_id: string | null }
 *
 * ── なぜ作ったか（2026-09-29 / 柴さんの判断）─────────────────────────────
 * **`/biz` には事業領域の入力欄が1つも無かった**（触れるのは `/admin` だけ）。
 * ところが事業領域は、求職者側の絞り込み（`/companies` `/jobs`）・企業ページの
 * サイドバー・カードのタグ・LPファセット・フッター・sitemap を動かし、
 * **公開ゲート（`checkPublishable`）が「主を1件」要求する軸**でもある。
 *   ⇒ **企業は自分で満たせない条件で掲載を止められていた**（実測 2026-09-29:
 *     主の事業領域が無い企業が14社）。「掲載を依頼する」で分類の欠けを
 *     止められないのも同じ理由。
 *
 * ⚠️★**検証・RPC・キャッシュ破棄は `setCompanyBusinessDomains` の中。**
 *    運営側（`PUT /api/admin/companies/[id]/business-domains`）と**同じ関数**を通る。
 *    **ここに条件を書き写さないこと。** 違うのは認可だけ。
 *
 * ⚠️★**企業は自社しか触れない。** `company_id` を body で受けず、
 *    セッションから解決した `ctx.companyId` だけを使う。
 *    ⚠️ 受け取る形にすると、任意の企業の分類を書き換えられる。
 *
 * ⚠️★**この保存は即時で、下書き（`draft_data`）を経由しない。**
 *    junction テーブルなので `draft_data` に載せると
 *    **公開ゲートが「主が1件」を見る時点ではまだ書かれておらず、
 *      初回の公開が必ず失敗する**（ゲートは更新を当てる前に走る）。
 *    画面にも「すぐに反映されます」と出してある。**下書きに移さないこと。**
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function PUT(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { domain_ids?: unknown; primary_domain_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  /* ⚠️ 分類は掲載の条件なので、閲覧権限の担当者には触らせない（規約同意と同じ扱い） */
  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  const res = await setCompanyBusinessDomains(
    ctx.companyId, body, "PUT /api/biz/company/business-domains",
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({ success: true, count: res.count });
}

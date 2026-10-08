/**
 * 企業資料の API が**必ず通す**権限確認（依頼② フェーズ1a / 2026-10-09）。
 *
 * ★柴さんの決定:
 *   閲覧  … その企業の有効な担当者（閲覧権限 `member` も可）
 *   編集  … 管理者権限（`permission = 'admin'`）だけ
 *           （登録・項目の追加と編集・区分の確定・印・削除）
 *
 * ⚠️ 所属の解決は `getCompanyContext`。`ow_company_admins` を **`user_id = 自分の ow_users.id`
 *    かつ `is_active`** で引くので、招待中の行（`user_id` が NULL）は**構造上当たらない**。
 * ⚠️ 表は RLS ポリシー0本・GRANT なしなので、セッションのクライアントでは読めない。
 *    ここで所属を確かめたあと、`lib/companyMaterials/server.ts`（admin クライアント）を呼ぶ。
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import type { PlanType } from "@/lib/constants/plans";

export type MaterialsActor = {
  companyId: string;
  owUserId: string;
  planType: PlanType | null;
  isAdmin: boolean;
};

export async function resolveMaterialsActor(
  mode: "view" | "edit",
): Promise<{ ok: true; actor: MaterialsActor } | { ok: false; response: NextResponse }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 }) };
  }
  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: "所属する企業が見つかりません。" }, { status: 403 }) };
  }
  const isAdmin = ctx.allMemberships.find((m) => m.companyId === ctx.companyId)?.permission === "admin";
  if (mode === "edit") {
    try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return { ok: false, response: permissionDeniedResponse() }; }
  }
  return { ok: true, actor: { companyId: ctx.companyId, owUserId: ctx.owUserId, planType: ctx.planType, isAdmin } };
}

/**
 * 企業資料の API が**必ず通す**権限確認（依頼② フェーズ1a / 2026-10-09）。
 *
 * ★柴さんの決定（2026-10-12 に役割を4つにした。判定は lib/auth/roles.ts の can()）:
 *   閲覧  … 管理者・採用担当（materials.view）
 *   編集  … 管理者・採用担当（materials.edit。登録・項目の追加と編集・区分の確定・印・削除）
 *   Google ドライブから選ぶ … 管理者だけ（連携。integrations.manage）
 *
 * ⚠️ 所属の解決は `getCompanyContext`。`ow_company_admins` を **`user_id = 自分の ow_users.id`
 *    かつ `is_active`** で引くので、招待中の行（`user_id` が NULL）は**構造上当たらない**。
 * ⚠️ 表は RLS ポリシー0本・GRANT なしなので、セッションのクライアントでは読めない。
 *    ここで所属を確かめたあと、`lib/companyMaterials/server.ts`（admin クライアント）を呼ぶ。
 */
/* ★サーバー専用（2026-10-09）。クライアントコンポーネントから（間接的にでも）読まれると
      **ビルドが落ちる**。`server-only` は Next に同梱されている（追加のインストールは不要）。
   ⚠️ 外さないこと。外すと、2026-10-09 に /mypage で起きた「admin クライアントの
      コードがブラウザ向けファイルに入る」が、気づけないまま戻る。 */
import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/business/company";
import { requireCompanyAction, permissionDeniedResponse } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/roles";
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
  /* ★役割で判定（2026-10-12）。見る … 採用担当以上／編集 … 採用担当以上（lib/auth/roles.ts） */
  try { requireCompanyAction(ctx.allMemberships, ctx.companyId, mode === "edit" ? "materials.edit" : "materials.view"); }
  catch { return { ok: false, response: permissionDeniedResponse() }; }
  const role = ctx.allMemberships.find((m) => m.companyId === ctx.companyId)?.permission ?? null;
  /** ★Google ドライブ（連携）は管理者だけ */
  const isAdmin = can(role, "integrations.manage");
  return { ok: true, actor: { companyId: ctx.companyId, owUserId: ctx.owUserId, planType: ctx.planType, isAdmin } };
}

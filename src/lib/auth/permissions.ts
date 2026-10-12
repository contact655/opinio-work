/**
 * src/lib/auth/permissions.ts
 *
 * API ルート共通の権限チェック。getCompanyContext() の allMemberships を受け取り、
 * **lib/auth/roles.ts の can(role, action) に渡すだけ**（2026-10-12 に役割を4つにした）。
 * ⚠️ ここに条件を書き足さないこと。判定は can() の1か所。
 * ⚠️ 新しく書くなら lib/auth/companyAccess.ts の requireBizAction のほうが短い。
 */

import { NextResponse } from "next/server";
import { can, type CompanyAction, type CompanyRole } from "@/lib/auth/roles";

export class PermissionDeniedError extends Error {
  readonly code = "permission_denied";
  constructor(message = "この操作の権限がありません。") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

type Membership = { companyId: string; permission: CompanyRole };

/** その会社での役割。所属が無ければ null */
export function roleIn(allMemberships: Membership[], companyId: string): CompanyRole | null {
  return allMemberships.find((m) => m.companyId === companyId)?.permission ?? null;
}

/**
 * Throws PermissionDeniedError if the actor cannot do `action` in companyId.
 *   try { requireCompanyAction(ctx.allMemberships, ctx.companyId, "jobs.edit"); }
 *   catch { return permissionDeniedResponse(); }
 */
export function requireCompanyAction(allMemberships: Membership[], companyId: string, action: CompanyAction): void {
  if (!can(roleIn(allMemberships, companyId), action)) throw new PermissionDeniedError();
}

export function permissionDeniedResponse(): NextResponse {
  return NextResponse.json(
    { error: "この操作の権限がありません。", code: "permission_denied" },
    { status: 403 },
  );
}

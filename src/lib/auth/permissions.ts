/**
 * src/lib/auth/permissions.ts
 *
 * API ルート共通の権限チェックヘルパー。
 * getCompanyContext() で取得した allMemberships を受け取り、
 * admin/member の権限境界を一元管理する。
 */

import { NextResponse } from "next/server";

export class PermissionDeniedError extends Error {
  readonly code = "permission_denied";
  constructor(message = "この操作には管理者権限が必要です") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

type Membership = { companyId: string; permission: "admin" | "member" };

/**
 * Throws PermissionDeniedError if the actor is not an admin of companyId.
 * 使い方:
 *   try { requireAdmin(ctx.allMemberships, ctx.companyId); }
 *   catch { return permissionDeniedResponse(); }
 */
export function requireAdmin(allMemberships: Membership[], companyId: string): void {
  const m = allMemberships.find((m) => m.companyId === companyId);
  if (m?.permission !== "admin") throw new PermissionDeniedError();
}

export function permissionDeniedResponse(): NextResponse {
  return NextResponse.json(
    { error: "この操作には管理者権限が必要です", code: "permission_denied" },
    { status: 403 },
  );
}

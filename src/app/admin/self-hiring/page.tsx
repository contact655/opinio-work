import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { listAllSelfHiring } from "@/lib/nextManager/server";
import { SelfHiringAdminClient } from "./SelfHiringAdminClient";

export const dynamic = "force-dynamic";

/**
 * ★申告の採用中（2026-11-19）。会社の担当者でない人が、職歴で在籍中の会社で「採用中」にしたもの。
 *   なりすましへの備えの1つ（ほかは一覧の「本人の申告」と、会社の管理者が外せること）。
 * ⚠️★ページの先頭で運営かを確かめる（レイアウトのガードだけだと、ページの props が HTML に載る）。
 */
export default async function AdminSelfHiringPage() {
  if (!(await viewerIsAdmin())) return null;
  const rows = await listAllSelfHiring();
  return <SelfHiringAdminClient rows={rows} />;
}

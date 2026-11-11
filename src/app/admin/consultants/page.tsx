import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { getAdminConsultants } from "@/lib/featuredConsultants/server";
import { ConsultantsAdminClient } from "./ConsultantsAdminClient";

export const dynamic = "force-dynamic";

/**
 * ★相談できる人の運営画面（2026-11-12）。登録・同意の記録・承認。/people の左サイドバーに出る。
 * ⚠️★ページの先頭で運営かを確かめる（レイアウトのガードだけだと、ページの props が HTML に載る）。
 * ⚠️ 判定（なぜ出ていないか）は lib/constants/careerRoutes.ts の consultantBlockers。ここに条件を書かない。
 */
export default async function AdminConsultantsPage() {
  if (!(await viewerIsAdmin())) return null;
  const items = await getAdminConsultants();
  return <ConsultantsAdminClient items={items} />;
}

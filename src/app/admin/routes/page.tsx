import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { getAdminRoutes } from "@/lib/careerRoutes/server";
import { RoutesAdminClient } from "./RoutesAdminClient";

export const dynamic = "force-dynamic";

/**
 * ★転職ルートの運営画面（2026-11-11）。ルートの追加・編集・公開と、経験者の登録・承認。
 *
 * ⚠️★ページの先頭で運営かを確かめる（レイアウトのガードだけだと、ページの props が HTML に載る。/admin/proposals の注記）。
 * ⚠️ 経験者と職歴は自動で照合しない。承認する前に、その人の職歴を時系列で並べて目で確かめる。
 * ⚠️ 判定（なぜ出ていないか）は lib/constants/careerRoutes.ts の hostBlockers。ここに条件を書かない。
 */
export default async function AdminRoutesPage() {
  if (!(await viewerIsAdmin())) return null;
  const routes = await getAdminRoutes();
  return <RoutesAdminClient routes={routes} />;
}

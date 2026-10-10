/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★「ほかの担当者を選ぶ」ときに選べる人（2026-10-10 / 柴さんの指示）。
 *   その企業の有効な担当者のうち、**操作している人（`operatorOwUserId`）と is_test が同じ人だけ**。
 *
 * 使うところ（画面の選択肢とサーバーの判定の両方がこの関数を通す。⚠️ 条件を書き写さないこと）:
 *   - 声かけの「送る担当者」（`lib/approaches/server.ts` の `listApproachSenders` → 画面と `POST /api/biz/approaches`）
 *   - 日程調整の候補日の「同席する人」（`/biz/conversations/[id]` の選択肢と `lib/meetings/server.ts`）
 *
 * ⚠️★なぜ: 相手との is_test の一致は**送り手（または会話）で**見ている。選べる人を自由にすると、
 *    検証用のアカウントで操作しながら実在の担当者を送り手・同席者にして、実在の求職者に届けられる。
 * ⚠️ 操作している人を引けなければ null（fail-closed）。
 */
export async function listSameTestStaff(companyId: string, operatorOwUserId: string): Promise<{ id: string; name: string }[] | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_company_admins").select("user_id")
    .eq("company_id", companyId).eq("is_active", true).not("user_id", "is", null);
  if (error) { console.error("[sameTestStaff] admins:", error.message); return null; }
  const adminIds = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
  const { data: users, error: uErr } = await db.from("ow_users").select("id, name, is_test")
    .in("id", Array.from(new Set([...adminIds, operatorOwUserId])));
  if (uErr) { console.error("[sameTestStaff] users:", uErr.message); return null; }
  const operator = (users ?? []).find((u) => u.id === operatorOwUserId);
  if (!operator) { console.error("[sameTestStaff] 操作している人を引けない"); return null; }
  const sameTest = (u: { is_test: boolean | null }) => (u.is_test === true) === (operator.is_test === true);
  return adminIds.flatMap((id) => {
    const u = (users ?? []).find((x) => x.id === id);
    if (!u || !sameTest(u)) return [];
    const n = ((u.name as string | null) ?? "").trim();
    return [{ id, name: n && n !== "ユーザー" ? n : "担当者" }];
  });
}

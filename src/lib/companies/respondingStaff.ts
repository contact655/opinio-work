/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★「答えられる担当者がいる企業」（2026-10-10 / 柴さんの指示）。
 *   その企業の有効な担当者（`ow_company_admins.is_active` かつ `user_id` あり）のうち、
 *   **企業と is_test が同じ担当者が1人以上いる**企業の id を返す。
 *   実在の企業 → 検証用でない担当者が要る ／ 検証用の企業 → 検証用の担当者で足りる。
 *
 * 使うところ（⚠️ 条件を書き写さないこと）:
 *   - 提案の相手（`lib/evidence/generate.ts`。相手は掲載中＝実在の企業だけなので「検証用でない担当者がいる」と同じ）
 *   - 応募を受けるか（`lib/jobs/application.ts`）
 *   - カジュアル面談の申込を受けるか（`lib/company/casualMeeting.ts`）
 *
 * ⚠️★なぜ: 検証用の担当者しかいない実在の企業（2026-10-10 時点でセールスフォース・株式会社エージェント）に
 *    実在の求職者から応募や申込が届くと、**返事できるのが検証用アカウントだけ**になる。
 * ⚠️ 取得に失敗したら null（呼び出し側は「いない」＝受けない側に倒す）。
 */
export async function filterCompaniesWithRespondingStaff(companyIds: string[]): Promise<Set<string> | null> {
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  const out = new Set<string>();
  if (ids.length === 0) return out;
  const db = createAdminClient();
  const [{ data: companies, error: cErr }, { data: admins, error: aErr }] = await Promise.all([
    db.from("ow_companies").select("id, is_test").in("id", ids),
    db.from("ow_company_admins").select("company_id, user_id").in("company_id", ids).eq("is_active", true).not("user_id", "is", null),
  ]);
  if (cErr || aErr) {
    console.error("[respondingStaff]", cErr?.message ?? aErr?.message);
    return null;
  }
  const userIds = Array.from(new Set((admins ?? []).map((a) => a.user_id as string)));
  const { data: users, error: uErr } = userIds.length
    ? await db.from("ow_users").select("id, is_test").in("id", userIds)
    : { data: [], error: null };
  if (uErr) {
    console.error("[respondingStaff] ow_users:", uErr.message);
    return null;
  }
  const userTest = new Map((users ?? []).map((u) => [u.id as string, u.is_test === true]));
  const companyTest = new Map((companies ?? []).map((c) => [c.id as string, c.is_test === true]));
  for (const a of admins ?? []) {
    const ct = companyTest.get(a.company_id as string);
    const ut = userTest.get(a.user_id as string);
    if (ct !== undefined && ut !== undefined && ct === ut) out.add(a.company_id as string);
  }
  return out;
}

/** 1社ぶん。⚠️ 失敗したら false（受けない側） */
export async function hasRespondingStaff(companyId: string): Promise<boolean> {
  return (await filterCompaniesWithRespondingStaff([companyId]))?.has(companyId) === true;
}

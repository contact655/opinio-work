/**
 * ★「採用担当」として話せる会社の id（2026-11-04）。純粋な関数（`npm test` が直接読む。⚠️ 何も import しない）。
 *   いま有効な担当者（is_active）で、その会社の役割が talk.asRecruiter を許されている会社だけ。
 *   保存（saveTalkSettings）・設定画面の選択肢・表示のたびの確かめ直し（talkProfiles）が同じ規則を見る。
 *   canRecruit には lib/auth/roles.ts の `(p) => can(toCompanyRole(p), "talk.asRecruiter")` を渡す。
 * ⚠️ 根拠は企業の管理者が付けた行（ow_company_admins）だけ。本人の申告で採用担当にはなれない。
 */
export function recruiterCompanyIds(
  rows: readonly { company_id: string; permission: string | null; is_active: boolean | null }[],
  canRecruit: (permission: string | null) => boolean,
): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (r.is_active !== true) continue;
    if (!canRecruit(r.permission)) continue;
    if (!out.includes(r.company_id)) out.push(r.company_id);
  }
  return out;
}

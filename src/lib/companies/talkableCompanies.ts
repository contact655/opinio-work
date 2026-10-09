import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { talkableCompanyIds } from "@/lib/companyMembers/talkable";
import { isRegisteredUser } from "@/lib/users/registered";

/**
 * 「話を聞ける人」がいる企業の id（2026-10-09 / /companies の絞り込み `?talk=1`）。
 *
 * ⚠️★条件は企業ページの「この会社の話を聞ける人」（`getPublicAmbassadorsCached`）と同じにしてある。
 *    ・`ow_company_members` が公開中（`display_consent && is_public`）
 *    ・その企業に在籍中の経歴がある（判定は `talkableCompanyIds`。ここに書き直さない）
 *    ・運営が企業ページから外した経歴は在籍に数えない（`ow_company_hidden_experiences`）
 *    ・検証用・非公開・本人が登録していない人は除く
 *    割れると「絞り込みでは出るのに、企業ページに話を聞ける人がいない」になる。
 * ⚠️★取得に失敗したら投げる。空にすると「該当0社」と出て、絞り込みの選択肢ごと消える。
 * ⚠️ 掲載中かどうかはここでは見ない（呼び出し側の `filterListedCompanies` が見る）。
 */
export async function fetchTalkableCompanyIds(): Promise<string[]> {
  const db = createAdminClient();
  const { data: members, error } = await db
    .from("ow_company_members")
    .select("company_id, user_id, ow_users!user_id(auth_id, is_test, visibility)")
    .eq("display_consent", true)
    .eq("is_public", true);
  if (error) throw error;

  type Row = { company_id: string; user_id: string; ow_users: { auth_id: string | null; is_test: boolean | null; visibility: string | null } | null };
  const rows = ((members ?? []) as unknown as Row[]).filter((r) => {
    const u = r.ow_users;
    return !!u && u.is_test !== true && u.visibility !== "private" && isRegisteredUser(u);
  });
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const [{ data: exps, error: expErr }, { data: hidden, error: hiddenErr }] = await Promise.all([
    db.from("ow_experiences").select("id, user_id, company_id").eq("is_current", true).in("user_id", userIds),
    db.from("ow_company_hidden_experiences").select("experience_id"),
  ]);
  if (expErr) throw expErr;
  if (hiddenErr) throw hiddenErr;
  const hiddenIds = new Set((hidden ?? []).map((h) => h.experience_id as string));

  const currentByUser = new Map<string, string[]>();
  for (const e of exps ?? []) {
    if (hiddenIds.has(e.id as string) || !e.company_id) continue;
    const list = currentByUser.get(e.user_id as string) ?? [];
    list.push(e.company_id as string);
    currentByUser.set(e.user_id as string, list);
  }
  const memberByUser = new Map<string, string[]>();
  for (const r of rows) {
    const list = memberByUser.get(r.user_id) ?? [];
    list.push(r.company_id);
    memberByUser.set(r.user_id, list);
  }

  const out = new Set<string>();
  memberByUser.forEach((companies, uid) => {
    for (const id of talkableCompanyIds(companies, currentByUser.get(uid) ?? [])) out.add(id);
  });
  return Array.from(out);
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 週次メールの宛先を1箇所で決める。
 *
 * ⚠️ **weekly-jobs と weekly-match で別々に書かないこと。**
 *    2026-08-10 まで各ルートが独自に `ow_profiles` を全件取っており、
 *    片方だけ直すと必ず食い違う。実際、以下がどちらにも無かった:
 *      ・配信停止の尊重（そもそも DB に列が無かった）
 *      ・`is_test` / システムユーザーの除外
 *      ・`ow_users` に対応が無い行の除外
 *
 * 2026-08-10 実測: `ow_profiles` 39件の内訳は
 *   ow_users に対応なし 20 / is_test 16 / 実ユーザー 3。
 *   対応なしの20件は **必ずハードバウンスする** ので必ず落とす。
 *
 * ⚠️ `ow_profiles.user_id` は **auth 空間**、`ow_users.id` は ow_users 空間。
 *    突き合わせは `ow_users.auth_id` で行う（CLAUDE.md「user_id は2つの空間がある」）。
 */
export type WeeklyRecipient = {
  /** auth.users.id（= ow_profiles.user_id） */
  authId: string;
  email: string;
  name: string | null;
};

export type WeeklyRecipientsResult = {
  recipients: WeeklyRecipient[];
  /** 誰をなぜ落としたか。⚠️ 黙って減らさず、必ず呼び出し側でログに出す */
  excluded: {
    optedOut: number;
    noOwUser: number;
    testOrSystem: number;
    noEmail: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWeeklyRecipients(supabase: SupabaseClient<any, any, any>): Promise<WeeklyRecipientsResult> {
  const excluded = { optedOut: 0, noOwUser: 0, testOrSystem: 0, noEmail: 0 };

  const { data: profiles, error: pErr } = await supabase
    .from("ow_profiles")
    .select("user_id, name, email_weekly_enabled");
  if (pErr) throw new Error(`ow_profiles の取得に失敗: ${pErr.message}`);

  const all = (profiles ?? []) as { user_id: string; name: string | null; email_weekly_enabled: boolean | null }[];

  /* ⚠️ `!== false` ではなく `=== true` で見る。
        値が読めなかったときに送ってしまう向き（fail-open）にしない。 */
  const optedIn = all.filter((p) => p.email_weekly_enabled === true);
  excluded.optedOut = all.length - optedIn.length;
  if (optedIn.length === 0) return { recipients: [], excluded };

  const { data: users, error: uErr } = await supabase
    .from("ow_users")
    .select("auth_id, email, is_test, is_system")
    .in("auth_id", optedIn.map((p) => p.user_id));
  if (uErr) throw new Error(`ow_users の取得に失敗: ${uErr.message}`);

  const byAuthId = new Map(
    ((users ?? []) as { auth_id: string | null; email: string | null; is_test: boolean | null; is_system: boolean | null }[])
      .filter((u) => u.auth_id)
      .map((u) => [u.auth_id as string, u]),
  );

  const recipients: WeeklyRecipient[] = [];
  for (const p of optedIn) {
    const u = byAuthId.get(p.user_id);
    // ow_users に対応が無い＝アプリ上は存在しない人。宛先も生きていない
    if (!u) { excluded.noOwUser++; continue; }
    if (u.is_test === true || u.is_system === true) { excluded.testOrSystem++; continue; }
    if (!u.email) { excluded.noEmail++; continue; }
    recipients.push({ authId: p.user_id, email: u.email, name: p.name ?? null });
  }

  return { recipients, excluded };
}

/**
 * メール末尾の配信停止リンク。
 *
 * ⚠️ 2026-08-10 まで `/mypage` を指していたが、そこに設定 UI は無い。
 *    実際の場所は `/mypage` の「設定」タブ（2026-08-16 に /profile/edit から移設）。
 *    **リンク先を変えるときは、そのタブが実在するか確かめること。**
 */
export function unsubscribeUrl(baseUrl: string): string {
  return `${baseUrl}/mypage?tab=settings`;
}

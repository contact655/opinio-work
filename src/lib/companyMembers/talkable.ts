/**
 * 「この会社の話を聞ける人」として画面に出してよいかの判定（2026-08-23 / B-1）。
 *
 * ── 定義 ────────────────────────────────────────────────────────────────────
 *   ① `ow_company_members` で公開中（`display_consent && is_public`）
 *   ② かつ **その企業に `is_current = true` の経歴がある**
 *
 * ── なぜ ② が要るか ────────────────────────────────────────────────────────
 * `ow_company_members` は経歴と連動していない。退職して `is_current` を false にしても
 * 行は残るため、**辞めた会社の「話を聞ける人」として出続ける**。
 * 申請時の RLS は `is_current = true` を要求するが、それは申請の瞬間だけで、
 * 承認後に退職しても誰も降ろさない。②を判定に入れると自動で降りる。
 *
 * ── 見ないもの ──────────────────────────────────────────────────────────────
 * ⚠️ **企業の受付状態（`accepting_casual_meetings`）は見ない**（2026-08-23 / 方針D）。
 *    人が出るかどうかは**本人の同意**で決まり、申込導線が出るかどうかは**企業の受付**で決まる。
 *    ここに受付を混ぜると、企業が受付を止めた瞬間に「本人が同意した事実」まで消える。
 *    申込CTAの出し分けは `lib/company/casualMeeting.ts` の担当。**混ぜないこと。**
 *
 * ⚠️ `ow_users.can_casual_meeting` は**見ない**。運営が個別に立てるフラグで、
 *    2026-08-23 に本人の申請＋企業（運営代理）の承認へ一本化した。
 */

/** ①と②の両方を満たす企業の id。**画面に出す会社はこの集合から選ぶ。** */
export function talkableCompanyIds(
  /** その人が公開中の面談対応者になっている企業の id */
  publicMemberCompanyIds: readonly (string | null | undefined)[],
  /** その人が `is_current = true` の経歴を持つ企業の id */
  currentCompanyIds: readonly (string | null | undefined)[],
): string[] {
  /* ⚠️ 引数は配列で受ける。`Iterable` にすると tsconfig の target では
        `--downlevelIteration` が要り、設定を触ることになる（別セッションの
        未コミットファイルなので触らない）。 */
  const current = new Set(currentCompanyIds.filter(Boolean) as string[]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of publicMemberCompanyIds) {
    if (!id || seen.has(id) || !current.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 1社でも該当すれば true。一覧のバッジはこれで出す。 */
export function isTalkable(
  publicMemberCompanyIds: readonly (string | null | undefined)[],
  currentCompanyIds: readonly (string | null | undefined)[],
): boolean {
  return talkableCompanyIds(publicMemberCompanyIds, currentCompanyIds).length > 0;
}

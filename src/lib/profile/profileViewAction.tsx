"use server";

import { UserProfileContent, resolveUserId } from "@/components/profile/view/UserProfileContent";

/**
 * ★候補者のプロフィールを右欄（候補者を探す・メッセージのドロワー）に出す（2026-10-11 / 柴さんの指示）。
 * ⚠️★/u/[id] と**同じ関数**（`UserProfileContent`）を、同じ見る人のセッションで描くだけ。
 *    見せてよいかの判定・データの取り方を、ここに書き足さないこと（右欄のために別の経路を作らない）。
 * ⚠️ 見せられない人は「この方は表示できません。」（embed のとき notFound にしない）。
 */
export async function renderCandidateProfile(userIdOrSlug: string, opts?: { tabs?: boolean }) {
  const resolved = /^[0-9a-zA-Z_-]{1,64}$/.test(userIdOrSlug) ? await resolveUserId(userIdOrSlug) : null;
  if (!resolved) {
    return <div data-state="profile-unavailable" style={{ padding: 20, fontSize: 13, color: "var(--ink-soft)" }}>この方は表示できません。</div>;
  }
  /* ★tabs … 候補者を探すの右欄だけ（2026-10-12）。並べ方だけで、中身と判定は同じ */
  return <UserProfileContent resolvedId={resolved.resolvedId} profileUsername={resolved.username} embed panelTabs={opts?.tabs === true} />;
}

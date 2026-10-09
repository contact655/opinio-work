/**
 * ★閲覧を数えるかどうかの判定（2026-10-09 / 段階D）。**判定はここの1か所。**
 *
 * 純粋な関数にしてある（DB もクッキーも読まない）。`POST /api/views` が材料を集めて渡す。
 * ⚠️ 純粋にしてあるのは、**検証用でない閲覧として数えられること**を、検証用アカウントの
 *    `is_test` を外さずに確かめるため（`viewer` に作り物の値を渡して呼べる）。
 *
 * 除くもの（柴さんの指示）:
 *   ・検証用（is_test）・システム（is_system）のアカウント
 *   ・運営（auth_is_admin）
 *   ・その企業の有効な担当者（ow_company_admins.is_active）
 *   ・ロボット（User-Agent で判定）
 *   ・公開されていないページ（企業ページは is_published かつ検証用でない／求人は公開中かつ検証用でない）
 *   ・同じブラウザで今日すでに数えたページ（cookie）
 */
export type ViewerInfo =
  | { loggedIn: false }
  | { loggedIn: true; isTest: boolean; isSystem: boolean; isAdmin: boolean; isCompanyStaff: boolean };

export type ViewDecision =
  | { count: true }
  | { count: false; reason: "bot" | "not_public" | "seen_today" | "test_account" | "system_account" | "admin" | "company_staff" };

export function decideView(input: {
  isBot: boolean;
  targetPublic: boolean;
  seenToday: boolean;
  viewer: ViewerInfo;
}): ViewDecision {
  if (input.isBot) return { count: false, reason: "bot" };
  if (!input.targetPublic) return { count: false, reason: "not_public" };
  const v = input.viewer;
  if (v.loggedIn) {
    if (v.isTest) return { count: false, reason: "test_account" };
    if (v.isSystem) return { count: false, reason: "system_account" };
    if (v.isAdmin) return { count: false, reason: "admin" };
    if (v.isCompanyStaff) return { count: false, reason: "company_staff" };
  }
  /* ⚠️ 既読の判定は最後。除く人のぶんで cookie を進めない（後で除外が外れたときに数え漏れないように） */
  if (input.seenToday) return { count: false, reason: "seen_today" };
  return { count: true };
}

/** ロボットらしい User-Agent。⚠️ 無い・空も除く */
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python-requests|axios|node-fetch|go-http-client/i;
export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}

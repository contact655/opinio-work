/**
 * ★企業の担当者の役割と、役割ごとにできること（2026-10-12 / 柴さんの指示）。
 *
 * ⚠️★**権限の判定はこの `can()` の1か所。** サーバー（API・Server Action・ページ）も画面（サイドバー・ボタン）も
 *    ここを見る。`permission === "admin"` を新しく書かないこと。
 * ⚠️ DB 側の判定は `auth_company_can(company_id, level)` の1つ（migration 20261012200000）。
 *    操作ごとの DB の段は `DB_LEVEL` に書いてある（考え方を揃えるため。DB は4段に畳んでいる）。
 * ⚠️ ブラウザからも読む（サイドバー）。サーバー専用のものをここに置かないこと。
 *
 * 表にない操作は、ひとまず「管理者だけ」にしてある（柴さんの指示。勝手に広げない）。
 */

export type CompanyRole = "admin" | "recruiter" | "interviewer" | "viewer";

export const COMPANY_ROLES: readonly CompanyRole[] = ["admin", "recruiter", "interviewer", "viewer"];

export const ROLE_LABELS: Record<CompanyRole, string> = {
  admin: "管理者",
  recruiter: "採用担当",
  interviewer: "面接官",
  viewer: "閲覧のみ",
};

/** 役割を選ぶときに出す1行の説明 */
export const ROLE_DESCRIPTIONS: Record<CompanyRole, string> = {
  admin: "すべての操作。メンバーの招待と権限、会社の基本情報、連携、プランは管理者だけです。",
  recruiter: "候補者を探す・メッセージ・紹介・選考・求人・企業ページの本文・ストーリー・社員・資料・分析。",
  interviewer: "担当になった応募だけ。その候補者のプロフィールと選考の流れを見て、メモを書けます。",
  viewer: "候補者・選考・求人・分析を見るだけ。書き込みとメッセージはできません。",
};

/** DB の値を役割に読む。⚠️ 旧値 member は採用担当（2026-10-12 に移した）。知らない値は null（何もできない） */
export function toCompanyRole(v: unknown): CompanyRole | null {
  if (v === "member") return "recruiter";
  return typeof v === "string" && (COMPANY_ROLES as readonly string[]).includes(v) ? (v as CompanyRole) : null;
}

export function isCompanyRole(v: unknown): v is CompanyRole {
  return typeof v === "string" && (COMPANY_ROLES as readonly string[]).includes(v);
}

const A: CompanyRole[] = ["admin"];
const AR: CompanyRole[] = ["admin", "recruiter"];
const ARV: CompanyRole[] = ["admin", "recruiter", "viewer"];
const ALL: CompanyRole[] = ["admin", "recruiter", "interviewer", "viewer"];

/**
 * 操作 → できる役割。
 * ⚠️ 面接官の「担当の応募だけ」は役割では決まらない（応募ごとの担当で決まる）。
 *    `selection.viewAssigned` / `candidate.noteAssigned` を持つ役割は、担当の応募について
 *    `lib/auth/companyAccess.ts` の `canSeeApplication` で確かめる。
 */
export const PERMISSIONS = {
  // 全員
  "dashboard.view": ALL,
  // 管理者だけ（表で管理者だけと決まっているもの）
  "members.manage": A,
  "company.basic": A,
  "integrations.manage": A,
  "plan.view": A,
  // 管理者だけ（表にないので、ひとまず管理者だけ）
  "organization.manage": A,
  "notifications.manage": A,
  "company.listingRequest": A,
  "savedSearches.manageAll": A,
  // 採用担当以上
  "candidates.search": AR,
  "messages.use": AR,
  "proposals.use": AR,
  "selection.edit": AR,
  "selection.assignInterviewers": AR,
  "candidates.notes": AR,
  "meetings.manage": AR,
  "jobs.edit": AR,
  "company.page": AR,
  "stories.edit": AR,
  "employees.manage": AR,
  "materials.view": AR,
  "materials.edit": AR,
  // 閲覧のみ以上（見るだけ）
  "selection.view": ARV,
  "candidates.viewProfile": ARV,
  "jobs.view": ARV,
  "analytics.view": ARV,
  // 面接官（担当の応募だけ。上の注記）
  "selection.viewAssigned": ["interviewer"] as CompanyRole[],
  "candidate.noteAssigned": ["interviewer"] as CompanyRole[],
} satisfies Record<string, CompanyRole[]>;

export type CompanyAction = keyof typeof PERMISSIONS;

export function can(role: CompanyRole | null | undefined, action: CompanyAction): boolean {
  if (!role) return false;
  return (PERMISSIONS[action] as CompanyRole[]).includes(role);
}

/**
 * DB の段（auth_company_can の第2引数）。⚠️ 役割の集合が PERMISSIONS と一致していることをテストで確かめる。
 *   member … 全員 ／ view … 管理者・採用担当・閲覧のみ ／ work … 管理者・採用担当 ／ admin … 管理者
 */
export const DB_LEVEL_ROLES = {
  member: ALL,
  view: ARV,
  work: AR,
  admin: A,
} as const;

/** 「ひとまず管理者だけ」にした操作（報告用・メンバーの画面の注記用） */
export const PROVISIONAL_ADMIN_ONLY: CompanyAction[] = [
  "organization.manage", "notifications.manage", "company.listingRequest", "savedSearches.manageAll",
];

/**
 * ★/biz のこの画面を開けるか（2026-10-12）。ホームのリンクなど、行き先から出し分けるとき用。
 * ⚠️ 画面側の入口（guardBizPage）と同じ操作を返すこと。新しい画面を足したらここにも足す（無い画面は「開けない」）。
 */
const PATH_ACTIONS: [RegExp, CompanyAction[]][] = [
  [/^\/biz\/dashboard/, ["dashboard.view"]],
  [/^\/biz\/candidates/, ["candidates.viewProfile"]],
  [/^\/biz\/messages/, ["messages.use"]],
  [/^\/biz\/meetings/, ["selection.view", "selection.viewAssigned"]],
  [/^\/biz\/jobs\/new/, ["jobs.edit"]],
  [/^\/biz\/jobs\/[^/]+\/edit/, ["jobs.edit"]],
  [/^\/biz\/jobs/, ["jobs.view"]],
  [/^\/biz\/organization/, ["organization.manage"]],
  [/^\/biz\/company/, ["company.page"]],
  [/^\/biz\/materials/, ["materials.view"]],
  [/^\/biz\/employees/, ["employees.manage"]],
  [/^\/biz\/posts/, ["stories.edit"]],
  [/^\/biz\/analytics/, ["analytics.view"]],
  [/^\/biz\/members/, ["members.manage"]],
];
export function canOpenBizPath(role: CompanyRole | null | undefined, href: string): boolean {
  const path = href.split(/[?#]/)[0];
  const hit = PATH_ACTIONS.find(([re]) => re.test(path));
  return !!hit && hit[1].some((a) => can(role, a));
}

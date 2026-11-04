/**
 * ★ホームの右の列「おすすめのユーザー」の選び方（2026-11-04 / 柴さんの指示）。純粋な関数。
 *   材料を集めるのは lib/people/suggestServer.ts。ここは選んで並べて理由の文を作るだけ。
 *
 * 基準（上から優先）:
 *   1. 自分の現職（無ければ直近の職歴）と同じ職種の人 ／ 自分と同じ経歴（職種×業界の大分類）から次に進んだ人
 *   2. 自分がフォローしている会社・保存した募集の会社で、いま働いている人（社名を出してよい職歴だけ）
 *   3. 「話を聞く」を受け付けている人（話せる量が「今は話せない」以外）
 * 除くもの: 自分・フォロー中の人・テストかどうかが自分と違う人・株式会社エージェントに在籍中の人・×で外した人（30日）
 *   （公開範囲が private の人・本人が登録していない人・システムの行は、材料を集める側で外してある）
 *
 * ⚠️ 他人のフォロー関係（「〇〇さんもフォローしています」）は使わない。誰が誰をフォローしているかは本人にしか見せない方針のため
 * ⚠️ 社名を伏せた職歴（社名を出さない職歴）は、2の判定にも理由の文にも使わない（出すと伏せた勤務先が分かる）
 * ⚠️ 何も import しない（`npm test` が直接読む）
 */

export const USER_SUGGEST_LIMIT = 3;
/** ×で外した人を出さない日数 */
export const USER_SUGGEST_DISMISS_DAYS = 30;

export type SuggestReasonKind = "same_role" | "same_path" | "followed_company" | "saved_job_company" | "talk_open";

export type SuggestPerson = {
  id: string;
  isTest: boolean;
  /** 現職（無ければ直近の職歴）の職種 */
  roleId: string | null;
  /** いま在籍している会社。nameIfShown は社名を出してよい職歴（visibility_company = real）だけ入る */
  currentCompanies: { companyId: string; nameIfShown: string | null }[];
  /** 次の会社へ移った職歴（職種と業界の大分類）。社名を出してよい職歴だけ */
  pastSteps: { roleId: string | null; industryTopId: string | null }[];
  /** 株式会社エージェントなど、個人カードに出さない会社に在籍中 */
  atExcludedCompany: boolean;
  talkOpen: boolean;
  updatedAt: string | null;
};

export type SuggestInput = {
  viewerId: string;
  viewerIsTest: boolean;
  /** 自分の現職（無ければ直近の職歴）の職種。label は理由の文に出す名前 */
  myRole: { roleId: string; label: string } | null;
  /** 自分の経歴（職種と業界の大分類）。label は「インサイドセールス×IT・ソフトウェア」の形 */
  myStart: { roleTopId: string; industryTopId: string; label: string } | null;
  /** 職種の親（大分類は null） */
  roleParent: Record<string, string | null>;
  followedUserIds: readonly string[];
  followedCompanyIds: readonly string[];
  savedJobCompanyIds: readonly string[];
  dismissedUserIds: readonly string[];
  people: readonly SuggestPerson[];
  limit?: number;
};

/** ★理由の文は「何が同じか」を先に置く（右の列は文字の幅が約80pxしかなく、後ろが省略されるため。2026-11-04 に実測） */
export type UserSuggestion = { userId: string; kind: SuggestReasonKind; reason: string };

const TIER: Record<SuggestReasonKind, number> = {
  same_role: 1, same_path: 1, followed_company: 2, saved_job_company: 2, talk_open: 3,
};

export function roleTop(roleId: string, parent: Record<string, string | null>): string {
  let cur = roleId;
  for (let i = 0; i < 5; i++) {
    const p = parent[cur];
    if (!p) return cur;
    cur = p;
  }
  return cur;
}

/** 同じ職種か。同じもの、または親と子（兄弟は別の職種なので同じにしない） */
export function sameRole(a: string | null, b: string | null, parent: Record<string, string | null>): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return parent[a] === b || parent[b] === a;
}

function reasonOf(p: SuggestPerson, input: SuggestInput, followedCompanies: Set<string>, savedCompanies: Set<string>): UserSuggestion | null {
  if (input.myRole && sameRole(p.roleId, input.myRole.roleId, input.roleParent)) {
    return { userId: p.id, kind: "same_role", reason: `同じ職種・${input.myRole.label}` };
  }
  const start = input.myStart;
  if (start && p.pastSteps.some((s) => s.roleId && s.industryTopId === start.industryTopId && roleTop(s.roleId, input.roleParent) === start.roleTopId)) {
    return { userId: p.id, kind: "same_path", reason: `同じ経歴から転職・${start.label}` };
  }
  const followed = p.currentCompanies.find((c) => c.nameIfShown && followedCompanies.has(c.companyId));
  if (followed) return { userId: p.id, kind: "followed_company", reason: `フォロー中の会社・${followed.nameIfShown}` };
  const saved = p.currentCompanies.find((c) => c.nameIfShown && savedCompanies.has(c.companyId));
  if (saved) return { userId: p.id, kind: "saved_job_company", reason: `保存した募集の会社・${saved.nameIfShown}` };
  if (p.talkOpen) return { userId: p.id, kind: "talk_open", reason: "「話を聞く」を受付中" };
  return null;
}

export function pickUserSuggestions(input: SuggestInput): UserSuggestion[] {
  const limit = input.limit ?? USER_SUGGEST_LIMIT;
  const followedUsers = new Set(input.followedUserIds);
  const dismissed = new Set(input.dismissedUserIds);
  const followedCompanies = new Set(input.followedCompanyIds);
  const savedCompanies = new Set(input.savedJobCompanyIds);
  const scored: { s: UserSuggestion; updatedAt: string }[] = [];
  for (const p of input.people) {
    if (p.id === input.viewerId || followedUsers.has(p.id) || dismissed.has(p.id)) continue;
    if (p.isTest !== input.viewerIsTest) continue;
    if (p.atExcludedCompany) continue;
    const s = reasonOf(p, input, followedCompanies, savedCompanies);
    if (s) scored.push({ s, updatedAt: p.updatedAt ?? "" });
  }
  scored.sort((a, b) =>
    TIER[a.s.kind] - TIER[b.s.kind]
    || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)
    || (a.s.userId < b.s.userId ? -1 : 1));
  return scored.slice(0, limit).map((x) => x.s);
}

/** ×で外した日時が、いまも出さない期間の中か */
export function isSuggestDismissActive(dismissedAt: string, now: Date): boolean {
  const t = new Date(dismissedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < USER_SUGGEST_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

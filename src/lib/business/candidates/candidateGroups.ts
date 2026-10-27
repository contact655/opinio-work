/**
 * ★候補者を探す（/biz/candidates）の並べ方の決めごと（2026-10-28 / 柴さんの指示）。
 *   ・経歴の少ない人を一覧の下にまとめる（判定の条件はこのファイルの THIN_PROFILE_RULE だけ）
 *   ・並び替えは「意向が強い順」（初期）と「最近更新した順」の2つ
 *   ・「自社との接点」の人の流れは、下限（5人）に届いたときだけ出す
 *
 * ⚠️ 純粋な関数だけ（DB に触らない・`@/` を import しない）。`npm test` が直接読む（candidateGroups.test.mjs）。
 */

/** 判定に要る候補者の形（Candidate の一部） */
export type ThinProfileInput = {
  /** 職歴の件数（全件。社名を伏せた職歴も数える） */
  experienceCount: number;
  /** 現職の職種（本人が書いた呼び方） */
  currentRole: string | null;
  /** 現職の職種（職種マスタの名前） */
  roleName: string | null;
  /** 現職の会社名 */
  currentCompany: string | null;
};

/**
 * ★「経歴がまだ少ない人」の条件。**ここ1か所**（画面に書き写さない）。
 *   noExperience … 職歴が0件
 *   noCurrentJob … 現職の職種と会社名がどちらも無い（現職の行が無い人を含む）
 * ⚠️ どちらか1つに当てはまれば「少ない」。職種だけ・会社名だけが空の人は少ないに入れない（もう一方で分かるため）。
 */
export const THIN_PROFILE_RULE = {
  noExperience: true,
  noCurrentJob: true,
} as const;

const blank = (v: string | null | undefined) => !v || !v.trim();

export function isThinProfile(c: ThinProfileInput): boolean {
  if (THIN_PROFILE_RULE.noExperience && c.experienceCount <= 0) return true;
  if (THIN_PROFILE_RULE.noCurrentJob && blank(c.currentRole) && blank(c.roleName) && blank(c.currentCompany)) return true;
  return false;
}

/** 並んだ順を保ったまま、経歴のある人と少ない人に分ける */
export function splitThinProfiles<T extends ThinProfileInput>(list: readonly T[]): { main: T[]; thin: T[] } {
  const main: T[] = [], thin: T[] = [];
  for (const c of list) (isThinProfile(c) ? thin : main).push(c);
  return { main, thin };
}

/** ★転職への意向の強さ（大きいほど強い）。未設定・知らない値は 0（末尾） */
export const STANCE_STRENGTH: Record<string, number> = { active: 3, open: 2, researching: 1 };

export type SortableCandidate = {
  careerStance: string | null;
  createdAt: string;
  profileEditedAt?: string | null;
  careerStanceUpdatedAt: string | null;
};

/** ★「最近更新した」の日時。本人がプロフィールを編集した日・意向を変えた日・登録日のうち一番新しいもの */
export function lastUpdatedAt(c: SortableCandidate): string {
  return [c.profileEditedAt ?? "", c.careerStanceUpdatedAt ?? "", c.createdAt].reduce((a, b) => (b > a ? b : a), "");
}

/** 意向が強い順。同じ強さなら最近更新した順 */
export function compareByStance(a: SortableCandidate, b: SortableCandidate): number {
  return (STANCE_STRENGTH[b.careerStance ?? ""] ?? 0) - (STANCE_STRENGTH[a.careerStance ?? ""] ?? 0)
    || lastUpdatedAt(b).localeCompare(lastUpdatedAt(a));
}

/** 最近更新した順 */
export function compareByUpdated(a: SortableCandidate, b: SortableCandidate): number {
  return lastUpdatedAt(b).localeCompare(lastUpdatedAt(a));
}

/**
 * ★人の流れ（「〇〇から御社に入社した人 N人」）を出すか。
 * @param count 母数から外す人を除いたあとの人数（isAggregatableUser を通した人だけ）
 * @param min 下限（MIN_AGGREGATE_COUNT = 5 を渡す）
 * ⚠️ 下限未満は出さない（「少ないので出しません」も出さない）
 */
export function flowLine(fromCompanyName: string | null, count: number, min: number): string | null {
  if (!fromCompanyName || count < min) return null;
  return `${fromCompanyName}から御社に入社した人 ${count}人`;
}

/** ★自社との接点の1件（画面に出す文） */
export type CompanyContactItem = { kind: "alumni" | "interest" | "flow"; text: string };

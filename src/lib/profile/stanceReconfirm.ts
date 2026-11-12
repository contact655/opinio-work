/**
 * ★転職意欲の「変わりありませんか？」（2026-11-12 / 柴さんの決定）。**純粋な値と関数。何も import しない**（node のテストから読むため）。
 *
 * ★`ow_profiles.career_stance_updated_at` の意味は「**本人が最後に確かめた日時**」（2026-11-12 に変えた）。
 *   値を変えたとき（PUT /api/jobseeker/career-preferences）に加えて、
 *   このダイアログで「変わりない」と答えたとき（POST /api/jobseeker/career-stance/confirm）も打つ。
 *   企業の候補者検索の「更新時期」（7日／30日／90日）・右の欄の「意向の更新」・並び順はこの列を読む。
 * ⚠️ `stance_updated_at`（転職・面談の状況カード）は今までどおり、値が変わったときだけ打つ。
 *
 * 出す条件（shouldAskStanceReconfirm）:
 *   オンボーディングが終わっている ／ 検証用でない ／ career_stance が入っている ／
 *   日時が null か、STANCE_RECONFIRM_AFTER_DAYS より前
 * 閉じたら STANCE_RECONFIRM_SNOOZE_DAYS は出さない（端末の localStorage。確かめた記録ではないので DB に持たない）。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 最後に確かめてから、この日数たったらたずねる */
export const STANCE_RECONFIRM_AFTER_DAYS = 90;
/** 「閉じる」を押したら、この日数は出さない */
export const STANCE_RECONFIRM_SNOOZE_DAYS = 30;
/** localStorage のキー（利用者ごとに分ける。共用の端末で別の人の「閉じる」が効かないように） */
export const STANCE_RECONFIRM_STORAGE_PREFIX = "opinio:stance-reconfirm-hidden-until:";

export const STANCE_RECONFIRM_TITLE = "転職への気持ちは、変わりありませんか？";
export const STANCE_RECONFIRM_LEAD = "企業は、この答えと最後に確かめた時期を見て連絡します。";
/** ★ダイアログに1行ずつ添える2つ（柴さんの指示）。⚠️ can_send_scout() の条件（在籍企業・手動ブロック・no_contact）と合わせてある */
export const STANCE_RECONFIRM_NOTES = [
  "在籍中の会社と、ブロックした企業には表示されません。",
  "「今は考えていない」を選ぶと、企業の候補者検索に出なくなります。",
] as const;

export type StanceReconfirmInput = {
  onboardingCompleted: boolean;
  isTest: boolean;
  careerStance: string | null;
  careerStanceUpdatedAt: string | null;
  nowMs: number;
};

/** サーバーで判定する（閉じた記録は見ない。そちらは端末で isStanceReconfirmHidden） */
export function shouldAskStanceReconfirm(i: StanceReconfirmInput): boolean {
  if (!i.onboardingCompleted || i.isTest) return false;
  /* ⚠️ 未回答（null）はここでは聞かない。/onboarding/stance が拾う */
  if (!i.careerStance) return false;
  if (!i.careerStanceUpdatedAt) return true;
  const t = new Date(i.careerStanceUpdatedAt).getTime();
  /* ⚠️ 読めない値は「古い」に倒す（たずねる）。企業側の絞り込みでも落ちる値なので */
  if (!Number.isFinite(t)) return true;
  return i.nowMs - t >= STANCE_RECONFIRM_AFTER_DAYS * DAY_MS;
}

/** 閉じた時刻から、出さない期限（ミリ秒） */
export function stanceReconfirmHiddenUntil(nowMs: number): number {
  return nowMs + STANCE_RECONFIRM_SNOOZE_DAYS * DAY_MS;
}

/** 覚えた期限（文字列）で、いま隠すか。⚠️ 読めない・壊れた値は「出す」に倒す */
export function isStanceReconfirmHidden(stored: string | null, nowMs: number): boolean {
  if (!stored) return false;
  const until = Number(stored);
  if (!Number.isFinite(until)) return false;
  return nowMs < until;
}

/** 「更新する」を押したとき、どちらの口に送るか。同じ値なら確かめただけ（confirm）、違えば値の変更（PUT） */
export function stanceReconfirmAction(current: string, selected: string): "confirm" | "change" {
  return current === selected ? "confirm" : "change";
}

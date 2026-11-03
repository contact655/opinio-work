/**
 * ★現職の会社名を変えたときに「転職しましたか？／会社名の修正ですか？」を聞く（2026-11-04 / 柴さんの判断）。
 * ⚠️ 何も import しない（`npm test` が直接読む）。会社が変わったかは呼び出し側が
 *    `isSameCompany`（companyKey.ts）で決めて、boolean で渡す（規則を書き写さないため）。
 *
 *   転職しました … 元の職歴は終了月を入れて残し、新しい会社は新しい職歴として足す（決め手は新しい会社について聞く）
 *   会社名の修正 … そのまま上書きし、決め手の回答は消さない（更新の要求に company_change: "correction" を付ける）
 *
 * ⚠️ 過去の職歴の会社名を変えたときは聞かない（修正として扱い、回答も残す）。
 */

/** 更新の要求に付ける「会社名の修正です」の印。⚠️ 値を変えるときは2つの更新の処理も一緒に変える */
export const COMPANY_CORRECTION = "correction" as const;

/** 聞くか。保存されている職歴が現職で、保存後も現職のままで、会社が変わったときだけ */
export function shouldAskJobChange(p: { savedIsCurrent: boolean; draftIsCurrent: boolean; companyChanged: boolean }): boolean {
  return p.savedIsCurrent && p.draftIsCurrent && p.companyChanged;
}

/** "YYYY-MM" の翌月。読めなければ "" */
export function nextMonthOf(ym: string | null): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "";
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** 今月の "YYYY-MM"（日本時間） */
export function currentYm(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 前の会社を辞めた月を確かめる。問題なければ null、あれば画面に出す文。
 * ⚠️ 前の会社の入社月（現職の役割が複数あれば、いちばん新しい入社月）より前・今月より後は受けない
 */
export function jobChangeEndError(endYm: string, latestStartedAt: string, nowYm: string = currentYm()): string | null {
  if (!/^\d{4}-\d{2}$/.test(endYm)) return "辞めた年と月を選んでください。";
  if (latestStartedAt && endYm < latestStartedAt.slice(0, 7)) return "入社した月より前は選べません。";
  if (endYm > nowYm) return "今月より後は選べません。";
  return null;
}

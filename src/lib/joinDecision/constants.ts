/**
 * ★入社の決め手（1問）。2026-11-02 / 柴さんの指示で「転機ごとの3問」から置き換えた。
 *   置き場所は ow_join_decisions（migration 20261102090000）。選択肢・文言・検証はこの1ファイル。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★選択肢は DB の CHECK（migration）と同じ。**片方だけ変えないこと。**
 * ⚠️★選択肢を変えるときは `JOIN_DECISION_VERSION` を上げる（同じ版の中で意味を変えない）。
 *    集計は版ごとに数える（違う版の回答を混ぜない）。
 * ⚠️ 順位・★（一番）は持たない。3つまで・等重み。
 *
 * キーの対応（docs/current-state-20261102.md の対応表）:
 *   既存のキーを使う … position（仕事内容）/ job_content / skills / autonomy / people（＋旧 culture）/
 *                      growth / stability / salary / work_style（リモートや勤務地。旧「働き方（場所・時間）」の場所側）
 *   新しく足した    … prior_experience / selection / referral / mission / work_hours
 *   ⚠️ work_hours は対応表の「1つを2つに分ける」の時間側。対応のない4つに加えてこの1つが新しい。
 */

export const JOIN_DECISION_VERSION = 1 as const;

export type JoinDecisionOption = { value: string; label: string };
export type JoinDecisionGroup = { key: string; label: string; options: readonly JoinDecisionOption[] };

/** 4つのまとまり。⚠️ まとまりの並び順は表示ごとにランダム（`shuffledGroups`）。まとまりの中の並びは固定 */
export const JOIN_DECISION_GROUPS: readonly JoinDecisionGroup[] = [
  {
    key: "work", label: "仕事", options: [
      { value: "position",         label: "仕事内容に惹かれた" },
      { value: "job_content",      label: "事業やプロダクトに惹かれた" },
      { value: "prior_experience", label: "前職の経験が活きる" },
      { value: "skills",           label: "新しい経験やスキルが得られる" },
      { value: "autonomy",         label: "任される範囲が広い" },
    ],
  },
  {
    key: "people", label: "人", options: [
      { value: "people",    label: "一緒に働く人や社風に惹かれた" },
      { value: "selection", label: "面接や選考の印象が良かった" },
      { value: "referral",  label: "知人や社員に誘われた" },
    ],
  },
  {
    key: "company", label: "会社", options: [
      { value: "growth",    label: "会社が伸びている" },
      { value: "mission",   label: "ミッションや事業の意義に共感した" },
      { value: "stability", label: "規模や安定性、知名度" },
    ],
  },
  {
    key: "terms", label: "条件", options: [
      { value: "salary",     label: "年収や待遇" },
      { value: "work_style", label: "リモートや勤務地" },
      { value: "work_hours", label: "働く時間や休みの取りやすさ" },
    ],
  },
] as const;

export const JOIN_DECISION_OPTIONS: readonly JoinDecisionOption[] = JOIN_DECISION_GROUPS.flatMap((g) => g.options);
export const JOIN_DECISION_LABELS: Record<string, string> = Object.fromEntries(JOIN_DECISION_OPTIONS.map((o) => [o.value, o.label]));
const VALID = new Set(JOIN_DECISION_OPTIONS.map((o) => o.value));

/** 選べる上限。⚠️ DB の CHECK も同じ値 */
export const JOIN_DECISION_MAX = 3;

export const JOIN_DECISION_QUESTION = "この会社に決めた理由は？";
/** ★回答画面に必ず出す一文（柴さんの指示の文言どおり） */
export const JOIN_DECISION_PRIVACY_NOTE = "この回答は会社には見えません";

/** ★スキップした人に、もう一度だけ出すまでの日数 */
export const JOIN_DECISION_RESHOW_DAYS = 30;
/** ★集計に数えるのは、入社日からこの月数以内に答えた回答だけ */
export const JOIN_DECISION_COUNTABLE_MONTHS = 3;

/** 企業ページの注記（柴さんの指示の文言どおり） */
export const JOIN_DECISION_RANKING_NOTE = "10人以上の回答が集まった会社だけ表示しています。一人ひとりの回答は、会社にも誰にも見えません。";

/** API で受けた回答を検証する。⚠️ 不正値は 400（黙って捨てない）。並びは選択肢の順に揃える */
export function parseJoinDecision(raw: unknown): { ok: true; value: string[] } | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string" || !VALID.has(x))) {
    return { ok: false, message: "回答が正しくありません。" };
  }
  const uniq = Array.from(new Set(raw as string[]));
  if (uniq.length === 0) return { ok: false, message: "1つ以上選んでください。" };
  if (uniq.length > JOIN_DECISION_MAX) return { ok: false, message: `${JOIN_DECISION_MAX}つまでです。` };
  return { ok: true, value: JOIN_DECISION_OPTIONS.map((o) => o.value).filter((v) => uniq.includes(v)) };
}

/**
 * ★集計に数えてよい回答か。入社日（その会社のいちばん古い職歴の開始日）から3か月以内に答えたものだけ。
 * ⚠️ answered_at が無い・入社日が読めない回答は数えない。
 */
export function isCountableAnswer(answeredAt: string | null | undefined, startedAt: string | null | undefined): boolean {
  if (!answeredAt || !startedAt) return false;
  const a = new Date(answeredAt);
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(startedAt);
  if (!m || Number.isNaN(a.getTime())) return false;
  const limit = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + JOIN_DECISION_COUNTABLE_MONTHS, Number(m[3] ?? "1")));
  return a.getTime() <= limit.getTime();
}

export type JoinDecisionStatus = "answered" | "skipped" | "none";

/**
 * ★いま聞いてよいか。
 *   none（未回答・未スキップ） … 聞く
 *   skipped … スキップから30日たっていて、まだ再表示していなければ1回だけ聞く（reshow）
 */
export function promptKind(
  s: { status: JoinDecisionStatus; skippedAt: string | null; reshownAt: string | null },
  now: Date = new Date(),
): "first" | "reshow" | null {
  if (s.status === "answered") return null;
  if (s.status === "none") return "first";
  if (s.reshownAt || !s.skippedAt) return null;
  const skipped = new Date(s.skippedAt).getTime();
  return now.getTime() - skipped >= JOIN_DECISION_RESHOW_DAYS * 24 * 60 * 60 * 1000 ? "reshow" : null;
}

/**
 * ★ホームのカードを出し続けるか（2026-11-03）。答えて保存した（answered）あとは、モーダルを閉じた時点で消す。
 *   ⚠️ 再読み込みを待たない（router.refresh だけでは閉じた直後にカードが残っていた）。
 *   ⚠️ モーダルを開いている間は消さない（カードの中にモーダルがあるので、消すと「保存しました」も一緒に消える）。
 */
export function homeDecisionCardVisible(s: { answered: boolean; modalOpen: boolean }): boolean {
  return s.modalOpen || !s.answered;
}

/** まとまりの並びを入れ替える（中の並びは固定）。⚠️ クライアントでマウント後に呼ぶ（サーバーと食い違わないように） */
export function shuffledGroups(random: () => number = Math.random): JoinDecisionGroup[] {
  const a = JOIN_DECISION_GROUPS.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ★会社ごとの上位3つ（月次の集計の中身）。人数は返さない。
 *   respondents = その会社について数えてよい回答をした人の決め手（1人1行）
 * ⚠️ 下限（minRespondents）に届かなければ null。同数は選択肢の並びで決める（毎回同じ結果にする）
 */
export function topReasons(respondents: readonly (readonly string[])[], minRespondents: number): string[] | null {
  if (respondents.length < minRespondents) return null;
  const order = new Map(JOIN_DECISION_OPTIONS.map((o, i) => [o.value, i]));
  const tally = new Map<string, number>();
  for (const rs of respondents) Array.from(new Set(rs)).forEach((r) => { if (order.has(r)) tally.set(r, (tally.get(r) ?? 0) + 1); });
  const top = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .slice(0, 3)
    .map(([r]) => r);
  return top.length > 0 ? top : null;
}

/**
 * ★入社後のふり返り（入社3か月・入社1年の時間差レビュー。2026-11-20 / 柴さんの指示）。
 *   置き場所は ow_join_checkins / ow_join_checkin_axes（supabase/pending/20261120090000_join_checkins.sql）。
 *   時点・選択肢・いつ聞くか・検証はこの1ファイル。
 *
 * なぜ作ったか（2026-11-20 の会話）:
 *   OPINIO にしかないデータとして「転職の結果」を持つ。定着は職歴の在籍期間から自動で取れるが、
 *   合っているか・どんな環境だったかは本人に聞くしかない。入社の決め手（入社直後）に続けて、
 *   時間をおいて2回だけ聞く。感想だけでなく「環境の事実」（立ち上がりの支援・上司の関わり方・
 *   進め方・評価・主に向き合う相手・入社前の話との差）を聞くのは、環境と志向の組み合わせで
 *   提案できるようにするため（活躍の原因は環境に左右されるので、人の評価だけでは特定できない）。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★時点・相手の選択肢は DB の CHECK と同じ。**片方だけ変えないこと**（テストが migration と突き合わせる）。
 * ⚠️★回答は公開しない。会社にも見せない。本人への「あなたが合う職場の傾向」と将来の集計にだけ使う。
 * ⚠️ 合っているか（0〜10）と入社前の話との差（4項目×3択）は入社後レビューと同じ物差し・同じ列名
 *    （lib/workplaceReview/constants.ts の FIT_SCORE_* / GAP_ITEMS / GAP_CHOICES。画面はそちらの文言を使う）。
 */

/** ★聞く時点。months＝この月数たったら聞く／untilMonths＝この月数を過ぎたらもう聞かない（古い職歴に出さない） */
export const JOIN_CHECKPOINTS = [
  { key: "3m", months: 3, untilMonths: 12, label: "入社3か月", lead: "入社して3か月がたちました" },
  { key: "1y", months: 12, untilMonths: 18, label: "入社1年", lead: "入社して1年がたちました" },
] as const;
export type CheckpointKey = (typeof JOIN_CHECKPOINTS)[number]["key"];
const CHECKPOINT_KEYS = new Set<string>(JOIN_CHECKPOINTS.map((c) => c.key));

export function isCheckpointKey(v: unknown): v is CheckpointKey {
  return typeof v === "string" && CHECKPOINT_KEYS.has(v);
}

export function checkpointOf(key: CheckpointKey) {
  return JOIN_CHECKPOINTS.find((c) => c.key === key)!;
}

/** 合っているか（入社後レビューと同じ 0〜10） */
export const CHECKIN_FIT_MIN = 0;
export const CHECKIN_FIT_MAX = 10;
/** 両端の言葉（入社後レビューは過去形。こちらは在籍中なので現在形） */
export const CHECKIN_FIT_ENDS = { low: "まったく合っていない", high: "とても合っている" } as const;

/** 入社前の話と比べて（列名は入社後レビューの gap_* と同じ。0=下回った 1=期待どおり 2=上回った） */
export const CHECKIN_GAP_KEYS = ["gap_job", "gap_pay", "gap_growth", "gap_culture"] as const;
export type CheckinGapKey = (typeof CHECKIN_GAP_KEYS)[number];
export const CHECKIN_GAP_MAX = 2;

/** 環境の軸の5段階（0〜4。入社後レビューと同じ） */
export const CHECKIN_AXIS_MAX = 4;

/** ★主に向き合っている相手（任意）。⚠️ DB の CHECK と同じ */
export const CHECKIN_CUSTOMERS = [
  { value: "enterprise", label: "大企業" },
  { value: "midmarket", label: "中堅企業" },
  { value: "smb", label: "中小企業・スタートアップ" },
  { value: "consumer", label: "個人のお客さま" },
  { value: "internal", label: "社内（お客さまと直接は関わらない）" },
] as const;
const CUSTOMER_VALUES = new Set<string>(CHECKIN_CUSTOMERS.map((c) => c.value));

/** ★回答画面に必ず出す一文（入社の決め手と同じ） */
export const CHECKIN_PRIVACY_NOTE = "この回答は会社には見えません";

export type CheckinAnswers = {
  fitScore: number;
  gaps: Record<CheckinGapKey, number>;
  /** 軸 key → 0〜4。答えていない軸はキーごと無い */
  axes: Record<string, number>;
  customer: string | null;
};

export type CheckinStatus = "answered" | "skipped" | "none";

/**
 * ★入社から何か月たったか。日付が読めなければ null。
 *   入社日が月だけ（YYYY-MM）なら1日とみなす。日付がまだ来ていない月は数えない（3/20 入社なら 6/19 はまだ2か月）。
 */
export function monthsSince(startedAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!startedAt) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(startedAt);
  if (!m) return null;
  const sy = Number(m[1]);
  const sm = Number(m[2]);
  const sd = Number(m[3] ?? "1");
  /* ⚠️ 日本時間で数える（サーバーは UTC で動く） */
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const ny = jst.getUTCFullYear();
  const nm = jst.getUTCMonth() + 1;
  const nd = jst.getUTCDate();
  const months = (ny - sy) * 12 + (nm - sm) - (nd < sd ? 1 : 0);
  return months;
}

/** ★その時点に答えてよいか（入社からその月数がたっている）。⚠️ 聞く期間（untilMonths）は見ない。開けば後からでも答えられる */
export function canAnswerCheckpoint(key: CheckpointKey, startedAt: string | null | undefined, now: Date = new Date()): boolean {
  const m = monthsSince(startedAt, now);
  return m !== null && m >= checkpointOf(key).months;
}

/**
 * ★いま聞くべき時点。無ければ null。
 *   ・在籍中の会社だけ（辞めた会社には聞かない）
 *   ・その時点の期間（months 以上 untilMonths 未満）に入っていて、まだ答えていない・「今回は答えない」を押していない
 *   ⚠️ 期間が重ならないので、返るのは多くても1つ
 */
export function dueCheckpoint(
  s: { startedAt: string | null | undefined; isCurrent: boolean; states: Partial<Record<CheckpointKey, CheckinStatus>> },
  now: Date = new Date(),
): CheckpointKey | null {
  if (!s.isCurrent) return null;
  const m = monthsSince(s.startedAt, now);
  if (m === null) return null;
  for (const cp of JOIN_CHECKPOINTS) {
    if (m >= cp.months && m < cp.untilMonths && (s.states[cp.key] ?? "none") === "none") return cp.key;
  }
  return null;
}

/** ★API で受けた回答を検証する。⚠️ 不正値は 400（黙って捨てない）。⚠️ 軸の key がマスタにあるかは呼び出し側が確かめる */
export function parseCheckinAnswers(body: unknown): { ok: true; value: CheckinAnswers } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

  const fit = int(b.fitScore, CHECKIN_FIT_MIN, CHECKIN_FIT_MAX);
  if (fit === undefined) return { ok: false, message: "「合っていますか」に答えてください。" };

  const g = (b.gaps ?? {}) as Record<string, unknown>;
  const gaps = {} as Record<CheckinGapKey, number>;
  for (const k of CHECKIN_GAP_KEYS) {
    const v = int(g[k], 0, CHECKIN_GAP_MAX);
    if (v === undefined) return { ok: false, message: "「入社前の話と比べて」の4項目すべてに答えてください。" };
    gaps[k] = v;
  }

  const ax = b.axes ?? {};
  if (typeof ax !== "object" || ax === null || Array.isArray(ax)) return { ok: false, message: "回答の形が正しくありません。" };
  const axes: Record<string, number> = {};
  for (const [k, v] of Object.entries(ax as Record<string, unknown>)) {
    const n = int(v, 0, CHECKIN_AXIS_MAX);
    if (n === undefined || !/^[a-z][a-z0-9_]*$/.test(k)) return { ok: false, message: "「どちら寄りか」の回答が正しくありません。" };
    axes[k] = n;
  }

  let customer: string | null = null;
  if (b.customer !== null && b.customer !== undefined && b.customer !== "") {
    if (typeof b.customer !== "string" || !CUSTOMER_VALUES.has(b.customer)) {
      return { ok: false, message: "「主に向き合っている相手」の回答が正しくありません。" };
    }
    customer = b.customer;
  }

  return { ok: true, value: { fitScore: fit, gaps, axes, customer } };
}

/**
 * ★傾向に使う時点を1社につき1つ選ぶ。新しい時点（1年）を優先し、無ければ3か月。
 *   答えていない（answered でない）ものは使わない。
 */
export function latestAnsweredCheckpoint(states: Partial<Record<CheckpointKey, CheckinStatus>>): CheckpointKey | null {
  for (const cp of JOIN_CHECKPOINTS.slice().reverse()) if (states[cp.key] === "answered") return cp.key;
  return null;
}

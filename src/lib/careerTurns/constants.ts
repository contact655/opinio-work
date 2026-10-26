/**
 * ★転機の3問（2026-10-27 / フェーズ1c）。選択肢・文言・検証はこの1ファイル。
 *   置き場所は ow_career_turns（migration 20261027090000）。決めたことは docs/phase1c-proposal-20261027.md。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。Q1 の選択肢は careerReasons.ts の EXPECTATIONS と**同じキー・同じ並び**。
 *    DB の CHECK（migration）と3か所で揃えている。**片方だけ変えないこと。**
 * ⚠️★並び順は変えない（上に置いたものほど選ばれやすいので、前後で比べられなくなる）。足すときは末尾に。
 */

/** Q1 その会社を選んだ決め手（3つまで・等重み）。キーは旧12個とも同じ（対応表は docs/phase1c-proposal-20261027.md） */
export const DECISIVE_REASONS: readonly { value: string; label: string }[] = [
  { value: "job_content", label: "事業・プロダクト" },
  { value: "customer",    label: "顧客・業界" },
  { value: "position",    label: "職種・役割" },
  { value: "autonomy",    label: "任される範囲" },
  { value: "skills",      label: "身につくスキル" },
  { value: "next_career", label: "次のキャリアにつながる" },
  { value: "management",  label: "上司・経営陣" },
  { value: "people",      label: "一緒に働く仲間" },
  { value: "culture",     label: "組織のカルチャー" },
  { value: "salary",      label: "年収・待遇" },
  { value: "evaluation",  label: "評価・昇進の仕組み" },
  { value: "work_style",  label: "働き方（場所・時間）" },
  { value: "growth",      label: "事業の成長性" },
  { value: "stability",   label: "知名度・安定性" },
  { value: "personal",    label: "タイミング・個人の事情" },
];
export const DECISIVE_REASON_MAX = 3;
export const DECISIVE_REASON_LABELS: Record<string, string> = Object.fromEntries(DECISIVE_REASONS.map((o) => [o.value, o.label]));

/**
 * Q2 いちばん求めていたこと（1つ）。⚠️ 列名は next_priority（★一番の決め手 join_reason_primary とは別物）。
 */
export const NEXT_PRIORITIES: readonly { value: string; label: string }[] = [
  { value: "larger_customers",   label: "もっと大きな顧客と向き合う" },
  { value: "deepen_expertise",   label: "専門性を深める" },
  { value: "wider_scope",        label: "裁量・任される範囲" },
  { value: "salary",             label: "年収" },
  { value: "flexibility",        label: "働き方の柔軟さ" },
  { value: "business_ownership", label: "事業の当事者になる" },
  { value: "management",         label: "マネジメントに挑戦" },
  { value: "other",              label: "その他" },
];
export const NEXT_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(NEXT_PRIORITIES.map((o) => [o.value, o.label]));

/** Q2 の問い。最初の会社は「社会に出るとき」（柴さんの決定） */
export function nextPriorityQuestion(isFirst: boolean): string {
  return isFirst ? "社会に出るときに、いちばん求めていたことは？" : "この会社に移るときに、いちばん求めていたことは？";
}

/** Q3 入って1年たったころ、合っていたか（1〜5） */
export const FIT_AFTER_YEAR_MIN = 1;
export const FIT_AFTER_YEAR_MAX = 5;
export const FIT_AFTER_YEAR_ENDS = { low: "合っていなかった", high: "合っていた" } as const;
/** 合う会社の並びで使う区切り（4〜5 = 合った・1〜2 = 合わなかった・3 = どちらでもない） */
export const FIT_GOOD_MIN = 4;
export const FIT_BAD_MAX = 2;

/** 3問の近くに出す一文（柴さんの指示の文言どおり） */
export const CAREER_TURN_PRIVACY_NOTE = "誰にも表示されません。あなたへの提案と、5人以上集まったときの集計にだけ使います。";

/**
 * ★Q3 を聞いてよいか = 入社月から12か月以上たっている（入社月を含めて13か月目に入ったら）。
 *   例: 2025-10 入社 → 2026-10 から聞く。⚠️ 入社年月が読めなければ聞かない
 */
export function canAskFitAfterYear(startedAt: string | null | undefined, now: Date = new Date()): boolean {
  const m = startedAt ? /^(\d{4})-(\d{1,2})/.exec(startedAt) : null;
  if (!m) return false;
  const start = Number(m[1]) * 12 + (Number(m[2]) - 1);
  const cur = now.getFullYear() * 12 + now.getMonth();
  return cur - start >= 12;
}

export type CareerTurnAnswers = {
  decisiveReasons: string[];
  nextPriority: string | null;
  fitAfterYear: number | null;
};

export const EMPTY_TURN_ANSWERS: CareerTurnAnswers = { decisiveReasons: [], nextPriority: null, fitAfterYear: null };

/** 何か1つでも答えているか（保存できるか） */
export function hasAnyAnswer(a: CareerTurnAnswers): boolean {
  return a.decisiveReasons.length > 0 || a.nextPriority !== null || a.fitAfterYear !== null;
}

const VALID_REASONS = new Set(DECISIVE_REASONS.map((o) => o.value));
const VALID_PRIORITIES = new Set(NEXT_PRIORITIES.map((o) => o.value));

/** API で受けた回答を検証する。⚠️ 不正値は 400（黙って捨てない） */
export function parseTurnAnswers(raw: unknown): { ok: true; value: CareerTurnAnswers } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "回答の形が正しくありません。" };
  const r = raw as Record<string, unknown>;
  const reasons = r.decisiveReasons ?? [];
  if (!Array.isArray(reasons) || reasons.some((x) => typeof x !== "string" || !VALID_REASONS.has(x))) {
    return { ok: false, message: "決め手の回答が正しくありません。" };
  }
  const uniq = Array.from(new Set(reasons as string[]));
  if (uniq.length > DECISIVE_REASON_MAX) return { ok: false, message: `決め手は${DECISIVE_REASON_MAX}つまでです。` };
  const np = r.nextPriority ?? null;
  if (np !== null && (typeof np !== "string" || !VALID_PRIORITIES.has(np))) return { ok: false, message: "いちばん求めていたことの回答が正しくありません。" };
  const fit = r.fitAfterYear ?? null;
  if (fit !== null && (typeof fit !== "number" || !Number.isInteger(fit) || fit < FIT_AFTER_YEAR_MIN || fit > FIT_AFTER_YEAR_MAX)) {
    return { ok: false, message: "合っていたかの回答が正しくありません。" };
  }
  /* 並びは選択肢の順に揃える（選んだ順で差分が出ないように） */
  const ordered = DECISIVE_REASONS.map((o) => o.value).filter((v) => uniq.includes(v));
  return { ok: true, value: { decisiveReasons: ordered, nextPriority: np as string | null, fitAfterYear: fit as number | null } };
}

/**
 * ★Next Manager（2026-11-13 / 柴さんの指示）。選択肢・文言・検証はこの1ファイル。
 *   「次の上司と、直接話そう。」——現場のマネージャーが自分で採用する会社のための機能。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★結果の値（MATCH_RESULTS の value）は migration 20261113090000 の CHECK と同じ。片方だけ変えない。
 * ⚠️★メッセージ本文は記録に写さない。ここに本文を扱う型を足さないこと。
 */

/** 一覧のバッジに渡すもの（採用中のマネージャー1人ぶん） */
export type HiringBadge = { companyName: string; note: string | null; jobTitle: string | null };

/** 「チームで募集中」の短いテキストの上限（DB の CHECK と同じ） */
export const HIRING_NOTE_MAX = 40;

/** 面談の記録のメモの上限（DB の CHECK と同じ） */
export const MATCH_MEMO_MAX = 1000;

/** 結果の選択肢。未入力（null）は「面談前」と表示する */
export const MATCH_RESULTS = [
  { value: "next_step", label: "次の選考へ進む" },
  { value: "continue", label: "継続して話す" },
  { value: "declined", label: "今回は見送り" },
  { value: "hired", label: "入社" },
] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number]["value"];

export const MATCH_RESULT_PENDING_LABEL = "面談前";

const RESULT_SET = new Set<string>(MATCH_RESULTS.map((r) => r.value));
export function isMatchResult(v: unknown): v is MatchResult {
  return typeof v === "string" && RESULT_SET.has(v);
}
export function matchResultLabel(v: string | null | undefined): string {
  return MATCH_RESULTS.find((r) => r.value === v)?.label ?? MATCH_RESULT_PENDING_LABEL;
}

/** 採用中のバッジ */
export const HIRING_BADGE_LABEL = "採用中";
/** ユーザー一覧の切り替え（?hiring=1） */
export const HIRING_PARAM = "hiring";
export const HIRING_FILTER_LABEL = "採用中のマネージャー";

/** 送る画面の下に出す一行（★相手と自分の名前が分かるとき） */
export function privateMessageNote(senderName: string | null, recipientName: string | null): string {
  if (senderName && recipientName) return `メッセージは${senderName}さんと${recipientName}さんの2人だけのものです。会社には共有されません。`;
  return PRIVATE_THREAD_NOTE;
}
/** メッセージ画面の上部に出す一行 */
export const PRIVATE_THREAD_NOTE = "メッセージは2人だけのものです。会社には共有されません。";

/** 会社に残らないもの（候補者管理の右に出す説明） */
export const COMPANY_RECORD_NOTE =
  "マネージャーと求職者のメッセージのやり取りは、会社には保存されません。ここに残るのは、マッチングした事実と、マネージャーが入力した面談の記録だけです。";

/** 面談日（YYYY-MM-DD）か */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type MatchPatch = {
  jobId?: string | null;
  metOn?: string | null;
  result?: MatchResult | null;
  memo?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/**
 * 面談の記録の入力を読む。⚠️ キーが無い項目は「変えない」（undefined のまま返す）。空は null（消す）。
 *   不正な値はエラーの文言を返す（黙って捨てない）。
 */
export function parseMatchPatch(raw: unknown): { ok: true; patch: MatchPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "入力が読み取れません" };
  const r = raw as Record<string, unknown>;
  const patch: MatchPatch = {};
  if ("jobId" in r) {
    if (r.jobId === null || r.jobId === "") patch.jobId = null;
    else if (isUuid(r.jobId)) patch.jobId = r.jobId;
    else return { ok: false, error: "募集が正しくありません" };
  }
  if ("metOn" in r) {
    if (r.metOn === null || r.metOn === "") patch.metOn = null;
    else if (isIsoDate(r.metOn)) patch.metOn = r.metOn;
    else return { ok: false, error: "面談日が正しくありません" };
  }
  if ("result" in r) {
    if (r.result === null || r.result === "") patch.result = null;
    else if (isMatchResult(r.result)) patch.result = r.result;
    else return { ok: false, error: "結果が正しくありません" };
  }
  if ("memo" in r) {
    if (r.memo === null) patch.memo = null;
    else if (typeof r.memo === "string") {
      const m = r.memo.trim();
      if (m.length > MATCH_MEMO_MAX) return { ok: false, error: `メモは${MATCH_MEMO_MAX}文字以内で入力してください` };
      patch.memo = m || null;
    } else return { ok: false, error: "メモが正しくありません" };
  }
  return { ok: true, patch };
}

/** 採用中の設定の入力を読む */
export function parseHiringInput(raw: unknown):
  | { ok: true; companyId: string; isHiring: boolean; note: string | null; jobId: string | null }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "入力が読み取れません" };
  const r = raw as Record<string, unknown>;
  if (!isUuid(r.companyId)) return { ok: false, error: "会社が正しくありません" };
  if (typeof r.isHiring !== "boolean") return { ok: false, error: "採用中かどうかが正しくありません" };
  let note: string | null = null;
  if (r.note != null) {
    if (typeof r.note !== "string") return { ok: false, error: "募集の内容が正しくありません" };
    const n = r.note.trim();
    if (n.length > HIRING_NOTE_MAX) return { ok: false, error: `募集の内容は${HIRING_NOTE_MAX}文字以内で入力してください` };
    note = n || null;
  }
  let jobId: string | null = null;
  if (r.jobId != null && r.jobId !== "") {
    if (!isUuid(r.jobId)) return { ok: false, error: "募集が正しくありません" };
    jobId = r.jobId;
  }
  return { ok: true, companyId: r.companyId, isHiring: r.isHiring, note, jobId };
}

/** 一覧のカードに出す「チームで募集中」の中身。募集の名前を先に、無ければテキスト */
export function hiringForText(h: { note: string | null; jobTitle: string | null }): string | null {
  if (h.jobTitle && h.note) return `${h.jobTitle}（${h.note}）`;
  return h.jobTitle ?? h.note ?? null;
}

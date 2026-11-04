/**
 * ★キャリア相談（2026-11-05 / 柴さんの指示）。選択肢・検証・表示の文言はこの1ファイル。
 *   保存先は ow_conversation_messages（kind = 'consult'・中身は payload。migration 20261105090000）。
 *   書き込みは lib/conversations/consult.ts（サーバー）。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★値（points・format）は削除も改名もしない。末尾に足すだけ（保存した相談が読めなくなるため）。
 * ⚠️★相談は本文に埋め込まない。body は一覧の冒頭1行・メールの件名に使う代わりの文だけ（consultSummary）。
 *    画面は payload から描く（ConsultCard）。
 * ⚠️ 話し方に「会って」は入れない（知らない人と1対1になるため。2026-10-18 の決めごとを 2026-11-05 に柴さんが確認）。
 */

/** 特に聞きたいこと（複数選択・任意） */
export const CONSULT_POINTS = [
  { value: "work_style", label: "働き方" },
  { value: "salary", label: "年収" },
  { value: "rewarding", label: "やりがい" },
  { value: "join_reason", label: "入社の決め手" },
  { value: "job_change", label: "転職の進め方" },
  { value: "industry", label: "業界のこと" },
] as const;
export type ConsultPoint = (typeof CONSULT_POINTS)[number]["value"];

/** 希望する話し方（1つ・任意） */
export const CONSULT_FORMATS = [
  { value: "message", label: "メッセージで" },
  { value: "online_30", label: "オンラインで30分" },
] as const;
export type ConsultFormat = (typeof CONSULT_FORMATS)[number]["value"];

/** ひとことの上限 */
export const CONSULT_NOTE_MAX = 500;

/** 受け取った人が押す、ワンタップの返信（理由は求めない） */
export const CONSULT_DECLINE_REPLY = "今回は難しいです";

/** 送る画面に出す、使い方の注意（採用・スカウトに使わない） */
export const CONSULT_PURPOSE_NOTE = "キャリアについて話を聞くためのメッセージです。採用やスカウトの目的には使わないでください。";

/** 「キャリア全般」の選択肢の key */
export const CAREER_GENERAL_KEY = "career";

/** 聞きたい話の選択肢（相手の公開職歴から作る。職歴が無い相手は「キャリア全般」だけ） */
export type ConsultAboutOption = {
  key: string;
  kind: "company" | "career";
  /** 会社マスタの会社なら id（自由入力の会社は null） */
  companyId: string | null;
  /** 画面に出す名前（会社名・「キャリア全般」） */
  label: string;
  /** 在籍の期間（「2018〜2022」「いま」）。分からなければ null */
  period: string | null;
  /** この選択肢にまとめた職歴の id（「この経験について聞く」から選択済みで開くため） */
  experienceIds: string[];
};

export const CAREER_GENERAL_OPTION: ConsultAboutOption = {
  key: CAREER_GENERAL_KEY, kind: "career", companyId: null, label: "キャリア全般", period: null, experienceIds: [],
};

/** 保存する中身（payload）。⚠️ 送ったときの値をそのまま残す（会社名が後で変わっても、この相談の表示は変えない） */
export type ConsultPayload = {
  v: 1;
  about: { kind: "company"; companyId: string | null; companyName: string; period: string | null } | { kind: "career" };
  points: ConsultPoint[];
  format: ConsultFormat | null;
  note: string | null;
};

const POINT_SET = new Set<string>(CONSULT_POINTS.map((p) => p.value));
const FORMAT_SET = new Set<string>(CONSULT_FORMATS.map((f) => f.value));

export function isConsultFormat(v: unknown): v is ConsultFormat {
  return typeof v === "string" && FORMAT_SET.has(v);
}

/**
 * 送られてきた相談を確かめて、保存する中身にする。⚠️ 不正値は 400（黙って捨てない）。
 *   about … 選択肢の key（options のどれか。必須）
 *   points … CONSULT_POINTS の値の配列（重複は1つに。任意）
 *   format … CONSULT_FORMATS の値（任意）
 *   note … ひとこと（任意・CONSULT_NOTE_MAX 字まで）
 */
export function parseConsultInput(raw: unknown, options: readonly ConsultAboutOption[]):
  | { ok: true; payload: ConsultPayload }
  | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const opt = typeof r.about === "string" ? options.find((o) => o.key === r.about) : undefined;
  if (!opt) return { ok: false, message: "聞きたい話を選んでください" };
  const rawPoints = r.points == null ? [] : r.points;
  if (!Array.isArray(rawPoints) || rawPoints.some((p) => typeof p !== "string" || !POINT_SET.has(p))) {
    return { ok: false, message: "特に聞きたいことを選び直してください" };
  }
  /* 並びは選択肢の順にそろえる（押した順で表示が変わらないように） */
  const picked = new Set(rawPoints as string[]);
  const points = CONSULT_POINTS.map((p) => p.value).filter((v) => picked.has(v)) as ConsultPoint[];
  const format = r.format == null || r.format === "" ? null : r.format;
  if (format !== null && !isConsultFormat(format)) return { ok: false, message: "希望する話し方を選び直してください" };
  const noteRaw = r.note == null ? "" : r.note;
  if (typeof noteRaw !== "string") return { ok: false, message: "ひとことを入力し直してください" };
  const note = noteRaw.trim();
  if (note.length > CONSULT_NOTE_MAX) return { ok: false, message: `ひとことは${CONSULT_NOTE_MAX}文字以内で入力してください` };
  const about: ConsultPayload["about"] = opt.kind === "career"
    ? { kind: "career" }
    : { kind: "company", companyId: opt.companyId, companyName: opt.label, period: opt.period };
  return { ok: true, payload: { v: 1, about, points, format, note: note || null } };
}

/** 保存された payload を読む（読めなければ null。古い形・壊れた行で画面を落とさない） */
export function readConsultPayload(v: unknown): ConsultPayload | null {
  const p = v as Partial<ConsultPayload> | null;
  if (!p || typeof p !== "object" || p.v !== 1 || !p.about || typeof p.about !== "object") return null;
  const about = p.about as ConsultPayload["about"];
  if (about.kind !== "career" && !(about.kind === "company" && typeof about.companyName === "string" && about.companyName)) return null;
  const points = Array.isArray(p.points) ? (p.points.filter((x) => POINT_SET.has(x as string)) as ConsultPoint[]) : [];
  return {
    v: 1, about, points,
    format: isConsultFormat(p.format) ? p.format : null,
    note: typeof p.note === "string" && p.note.trim() ? p.note : null,
  };
}

/** 聞きたい話の表示（「Salesforceでの経験」「キャリア全般」） */
export function consultAboutLabel(about: ConsultPayload["about"]): string {
  return about.kind === "career" ? "キャリア全般" : `${about.companyName}での経験`;
}

export function consultPointLabel(v: ConsultPoint): string {
  return CONSULT_POINTS.find((p) => p.value === v)?.label ?? "";
}

export function consultFormatLabel(v: ConsultFormat): string {
  return CONSULT_FORMATS.find((f) => f.value === v)?.label ?? "";
}

/**
 * ★body に入れる代わりの文（一覧の冒頭1行・メール・古い画面で使う）。⚠️ 画面の相談カードはこれを読まない。
 *   「キャリア相談：Salesforceでの経験」＋ひとことがあれば改行して添える。DB の body は1字以上なので必ず文字が入る
 */
export function consultSummary(p: ConsultPayload): string {
  const head = `キャリア相談：${consultAboutLabel(p.about)}`;
  return p.note ? `${head}\n${p.note}` : head;
}

/** 一覧の見出しに出すラベル */
export const CONSULT_LABEL = "キャリア相談";

/** ★「この経験について聞く」で選ばれている職歴から、選択肢の key を引く（無ければ null） */
export function optionKeyForExperience(options: readonly ConsultAboutOption[], experienceId: string | null | undefined): string | null {
  if (!experienceId) return null;
  return options.find((o) => o.experienceIds.includes(experienceId))?.key ?? null;
}

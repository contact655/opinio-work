/**
 * ★話す人の立場と、話せる量（2026-11-03 / 柴さんの指示）。選択肢・文言・判定はこの1ファイル。
 *   保存先は ow_talk_settings / ow_talk_requests（migration 20261103100000）。読み書きは lib/talk/server.ts。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★値は DB の CHECK と同じ。片方だけ変えないこと。
 * ⚠️★「話を聞く」ボタン＝つながっていない人への最初の1通（メッセージのお願い）。2026-11-03 に柴さんが決めた。
 *    相手が「今は話せない」なら、相互フォローでない人からは最初の1通を送れない（ボタンも出さない）。
 */

export type TalkStance = "recruiter" | "referral" | "personal";
export type TalkCapacity = "none" | "monthly_one" | "active";

/** 立場。⚠️ recruiter は所属企業で talk.asRecruiter が許された担当者だけが選べる（判定はサーバー） */
export const TALK_STANCES: readonly { value: TalkStance; label: string; hint: string }[] = [
  { value: "recruiter", label: "採用担当", hint: "所属企業の採用担当として話します（企業の管理画面で、管理者か採用担当になっている人だけが選べます）" },
  { value: "referral", label: "紹介制度のある社員", hint: "社員紹介の制度がある会社の社員として話します" },
  { value: "personal", label: "個人として", hint: "会社の立場ではなく、個人として話します" },
] as const;

/** 話せる量。⚠️ 初期値は none（行が無い人も none として扱う） */
export const TALK_CAPACITIES: readonly { value: TalkCapacity; label: string; hint: string }[] = [
  { value: "none", label: "今は話せない", hint: "話を聞くボタンを出しません" },
  { value: "monthly_one", label: "月1件まで", hint: "その月に1件依頼が届いたら、月末までボタンを出しません" },
  { value: "active", label: "積極的に", hint: "いつでも依頼を受け付けます" },
] as const;

export const DEFAULT_TALK_CAPACITY: TalkCapacity = "none";

/** ★依頼に返事が無いまま、この日数たったら自動で辞退扱い */
export const TALK_REQUEST_EXPIRE_DAYS = 14;
/** ★自動で辞退になったとき、送った側にだけ出す文（理由は伝えない） */
export const TALK_AUTO_DECLINED_TEXT = "今回はお話しできないようです";
/** 話せない相手に送ろうとしたときの文。⚠️ 理由（量・月の上限）は伝えない */
export const TALK_UNAVAILABLE_TEXT = "現在、この方には話を聞く依頼を送れません";

const STANCE_SET = new Set<string>(TALK_STANCES.map((s) => s.value));
const CAPACITY_SET = new Set<string>(TALK_CAPACITIES.map((c) => c.value));

export function isTalkStance(v: unknown): v is TalkStance {
  return typeof v === "string" && STANCE_SET.has(v);
}
export function isTalkCapacity(v: unknown): v is TalkCapacity {
  return typeof v === "string" && CAPACITY_SET.has(v);
}

/** 画面に出す立場の名前。採用担当は会社名を添える（「採用担当（◯◯）」） */
export function talkStanceLabel(stance: TalkStance | null | undefined, companyName?: string | null): string | null {
  if (!stance) return null;
  const base = TALK_STANCES.find((s) => s.value === stance)?.label ?? null;
  if (!base) return null;
  return stance === "recruiter" && companyName ? `${base}（${companyName}）` : base;
}

/**
 * 保存する値を検証する。⚠️ 不正値は 400（黙って捨てない）。
 *   ・話せる量が none 以外なら立場が要る
 *   ・採用担当なら会社が要る（会社が選べるかはサーバーが別に確かめる）
 */
export function parseTalkSettings(raw: unknown):
  | { ok: true; value: { stance: TalkStance | null; stanceCompanyId: string | null; capacity: TalkCapacity } }
  | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!isTalkCapacity(r.capacity)) return { ok: false, message: "話せる量を選んでください。" };
  const stance = r.stance == null || r.stance === "" ? null : r.stance;
  if (stance !== null && !isTalkStance(stance)) return { ok: false, message: "立場を選び直してください。" };
  if (r.capacity !== "none" && stance === null) return { ok: false, message: "立場を選んでください。" };
  const companyId = typeof r.stanceCompanyId === "string" && r.stanceCompanyId ? r.stanceCompanyId : null;
  if (stance === "recruiter" && !companyId) return { ok: false, message: "どの会社の採用担当かを選んでください。" };
  return { ok: true, value: { stance, stanceCompanyId: stance === "recruiter" ? companyId : null, capacity: r.capacity } };
}

/** その日時が属する月の初め（日本時間の1日0時）を UTC の Date で返す */
export function startOfMonthJst(now: Date): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000);
}

/**
 * ★いま「話を聞く」を受け付けるか（ボタンを出すか・最初の1通を通すか。同じ関数を見る）。
 *   receivedThisMonth = その人が今月（日本時間）に受けた依頼の数
 */
export function talkAcceptsRequest(s: { capacity: TalkCapacity; receivedThisMonth: number }): boolean {
  if (s.capacity === "active") return true;
  if (s.capacity === "monthly_one") return s.receivedThisMonth < 1;
  return false;
}

/** 返事の無い依頼が、自動で辞退になる時刻を過ぎているか */
export function isTalkRequestExpired(createdAt: string, now: Date): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t >= TALK_REQUEST_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
}

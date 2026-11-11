/**
 * ★転職ルート（/routes/[slug]）の選択肢・文言・判定（2026-11-11 / 柴さんの決定）。
 *   保存先は ow_career_routes / ow_route_hosts（migration 20261111120000）。読み書きは lib/careerRoutes/server.ts。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★話せること（ROUTE_TALK_TAGS）の値は DB の CHECK と同じ。片方だけ変えないこと。
 *    足すときは末尾に足し、同じ migration で CHECK を張り替える。値の削除・改名はしない（保存済みの行が読めなくなる）。
 */

/** 話せること（複数選択）。⚠️ メッセージのテーマ・キャリア相談の選択肢とはそろえない（柴さんの決定） */
export const ROUTE_TALK_TAGS = [
  { value: "newcomer_rampup", label: "未経験からの立ち上がり" },
  { value: "interview", label: "面接対策" },
  { value: "resume", label: "職務経歴書" },
  { value: "salary_negotiation", label: "年収交渉" },
  { value: "english", label: "英語の使い方" },
  { value: "foreign_eval_quota", label: "外資の評価とノルマ" },
  { value: "workstyle_remote", label: "働き方・リモート" },
  { value: "role_change", label: "職種を変えること" },
] as const;
export type RouteTalkTag = (typeof ROUTE_TALK_TAGS)[number]["value"];

const TAG_SET = new Set<string>(ROUTE_TALK_TAGS.map((t) => t.value));

export function isRouteTalkTag(v: unknown): v is RouteTalkTag {
  return typeof v === "string" && TAG_SET.has(v);
}

export function routeTalkTagLabel(v: RouteTalkTag): string {
  return ROUTE_TALK_TAGS.find((t) => t.value === v)?.label ?? "";
}

/** 選んだタグを選択肢の順にそろえる（押した順で表示が変わらないように）。知らない値は落とす */
export function sortRouteTalkTags(values: readonly unknown[]): RouteTalkTag[] {
  const picked = new Set(values.filter(isRouteTalkTag));
  return ROUTE_TALK_TAGS.map((t) => t.value).filter((v) => picked.has(v));
}

/** 本人のひとことの上限（DB の CHECK と同じ） */
export const ROUTE_HOST_MESSAGE_MAX = 200;
/** ルートの表示名の上限（DB の CHECK と同じ） */
export const ROUTE_LABEL_MAX = 60;
export const ROUTE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ROUTE_SLUG_MAX = 80;
export const MOVED_YEAR_MIN = 1970;
export const MOVED_YEAR_MAX = 2100;

/** ルートのページの下に1度だけ出す一文（個別の「確認済み」バッジはつけない） */
export const ROUTE_VERIFIED_NOTE = "掲載しているのは、経歴と転職の事実を確認した人だけです。";
/** 相談の入口の近くに出す一文 */
export const ROUTE_INSIDE_NOTE = "会社の内情に関わる話は、1対1の相談の中だけで扱います。";

/** ルートの表示（「人材の法人営業 → 外資SaaSの営業」） */
export function routeTitle(r: { fromLabel: string; toLabel: string }): string {
  return `${r.fromLabel} → ${r.toLabel}`;
}

/** 相談の「ひとこと」に入れる下書き。本人が書き換えられる */
export function routeConsultNote(r: { fromLabel: string; toLabel: string }): string {
  return `${r.fromLabel}→${r.toLabel}の転職について相談したいです`;
}

/**
 * ★ルートのページ・プロフィールに経験者として出してよいか。条件はこの関数だけ（書き写さないこと）。
 *   ① 公開範囲が「公開」 ② 相談を受け付ける ③ 運営が承認済み
 *   ＋ 本人が登録している・検証用でない・システムでない（公開面に出すほかの一覧と同じ）
 *   ＋ ルートが公開されている
 * ⚠️ どれか1つでも値が取れなければ出さない（undefined を「出す」に倒さない）。
 */
export type HostListableInput = {
  visibility: string | null | undefined;
  authId: string | null | undefined;
  isTest: boolean | null | undefined;
  isSystem: boolean | null | undefined;
  acceptingConsult: boolean | null | undefined;
  isListed: boolean | null | undefined;
  approvedAt: string | null | undefined;
  routePublished: boolean | null | undefined;
};

/** 出せない理由（運営画面で「なぜ出ていないか」を見せる）。空なら出せる */
export function hostBlockers(h: HostListableInput): string[] {
  const out: string[] = [];
  if (h.routePublished !== true) out.push("ルートが非公開");
  if (h.isListed !== true || !h.approvedAt) out.push("運営が未承認");
  if (h.acceptingConsult !== true) out.push("相談を受け付けていない");
  if (h.visibility !== "public") out.push("公開範囲が「公開」でない");
  if (!h.authId) out.push("本人が登録していない");
  if (h.isTest !== false) out.push(h.isTest === true ? "検証用アカウント" : "検証用かどうか不明");
  if (h.isSystem !== false) out.push(h.isSystem === true ? "システムアカウント" : "システムかどうか不明");
  return out;
}

export function isHostListable(h: HostListableInput): boolean {
  return hostBlockers(h).length === 0;
}

/** 運営画面の入力を確かめる（ルート） */
export function parseRouteInput(raw: unknown):
  | { ok: true; value: { slug: string; fromLabel: string; toLabel: string; displayOrder: number; isPublished: boolean } }
  | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const slug = typeof r.slug === "string" ? r.slug.trim() : "";
  if (!slug) return { ok: false, message: "URL の名前を入力してください（例: hr-sales-to-foreign-saas）" };
  if (slug.length > ROUTE_SLUG_MAX || !ROUTE_SLUG_RE.test(slug)) {
    return { ok: false, message: "URL の名前は半角の英小文字・数字・ハイフンで入力してください（例: hr-sales-to-foreign-saas）" };
  }
  const fromLabel = typeof r.fromLabel === "string" ? r.fromLabel.trim() : "";
  const toLabel = typeof r.toLabel === "string" ? r.toLabel.trim() : "";
  if (!fromLabel || fromLabel.length > ROUTE_LABEL_MAX) return { ok: false, message: `出発点は1〜${ROUTE_LABEL_MAX}字で入力してください` };
  if (!toLabel || toLabel.length > ROUTE_LABEL_MAX) return { ok: false, message: `行き先は1〜${ROUTE_LABEL_MAX}字で入力してください` };
  const order = r.displayOrder === "" || r.displayOrder == null ? 0 : Number(r.displayOrder);
  if (!Number.isInteger(order) || order < -9999 || order > 9999) return { ok: false, message: "表示順は整数で入力してください" };
  if (typeof r.isPublished !== "boolean") return { ok: false, message: "公開するかを選んでください" };
  return { ok: true, value: { slug, fromLabel, toLabel, displayOrder: order, isPublished: r.isPublished } };
}

/** 運営画面の入力を確かめる（経験者）。⚠️ 承認（is_listed）はここでは扱わない（別の操作） */
export function parseHostInput(raw: unknown):
  | { ok: true; value: { movedYear: number | null; talkTags: RouteTalkTag[]; message: string | null; acceptingConsult: boolean } }
  | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  let movedYear: number | null = null;
  if (r.movedYear !== "" && r.movedYear != null) {
    const y = Number(r.movedYear);
    if (!Number.isInteger(y) || y < MOVED_YEAR_MIN || y > MOVED_YEAR_MAX) return { ok: false, message: "転職した年は西暦4桁で入力してください" };
    movedYear = y;
  }
  const tagsRaw = r.talkTags == null ? [] : r.talkTags;
  if (!Array.isArray(tagsRaw) || tagsRaw.some((t) => !isRouteTalkTag(t))) return { ok: false, message: "話せることを選び直してください" };
  const msgRaw = r.message == null ? "" : r.message;
  if (typeof msgRaw !== "string") return { ok: false, message: "ひとことを入力し直してください" };
  const message = msgRaw.trim();
  if (message.length > ROUTE_HOST_MESSAGE_MAX) return { ok: false, message: `ひとことは${ROUTE_HOST_MESSAGE_MAX}字以内で入力してください` };
  if (typeof r.acceptingConsult !== "boolean") return { ok: false, message: "相談を受け付けるかを選んでください" };
  return { ok: true, value: { movedYear, talkTags: sortRouteTalkTags(tagsRaw), message: message || null, acceptingConsult: r.acceptingConsult } };
}

/**
 * ★転職ルート（/routes/[slug]）の選択肢・文言・判定（2026-11-11 / 柴さんの決定）。
 *   保存先は ow_career_routes / ow_route_hosts（migration 20261111120000）。読み書きは lib/careerRoutes/server.ts。
 *
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 * ⚠️★話せること（ROUTE_TALK_TAGS）の値は DB の CHECK と同じ。片方だけ変えないこと。
 *    足すときは末尾に足し、同じ migration で CHECK を張り替える。値の削除・改名はしない（保存済みの行が読めなくなる）。
 * ⚠️★同意を確認した方法（ROUTE_CONSENT_METHODS）も DB の CHECK と同じ（migration 20261111150000）。
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

/**
 * ★本人の同意を確認した方法（2026-11-11 / 柴さんの指示）。相談の受付と掲載の承認には、
 *   確認した日時とこの方法の2つが要る（DB の CHECK ow_route_hosts_consent_required でも止まる）。
 */
export const ROUTE_CONSENT_METHODS = [
  { value: "email", label: "メール" },
  { value: "line", label: "LINE" },
  { value: "meeting", label: "面談" },
  { value: "other", label: "その他" },
] as const;
export type RouteConsentMethod = (typeof ROUTE_CONSENT_METHODS)[number]["value"];

export function isRouteConsentMethod(v: unknown): v is RouteConsentMethod {
  return typeof v === "string" && ROUTE_CONSENT_METHODS.some((m) => m.value === v);
}

export function routeConsentMethodLabel(v: string | null | undefined): string {
  return ROUTE_CONSENT_METHODS.find((m) => m.value === v)?.label ?? "";
}

/** 同意の記録が無いまま相談の受付・承認をしようとしたときの文言（画面とサーバーで同じ） */
export const ROUTE_CONSENT_REQUIRED_MESSAGE = "本人の同意を確認した日時と方法を入れてから、相談の受付・承認をしてください";

const JST_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** 入力欄（datetime-local・日本時間）の値を ISO に。空は null、形が違えば undefined */
export function jstLocalToIso(v: string): string | null | undefined {
  const t = v.trim();
  if (!t) return null;
  if (!JST_LOCAL_RE.test(t)) return undefined;
  const d = new Date(`${t}:00+09:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** ISO を入力欄（datetime-local・日本時間）の値に。空や読めない値は "" */
export function isoToJstLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16);
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
  consentConfirmedAt: string | null | undefined;
  consentMethod: string | null | undefined;
};

/** 出せない理由（運営画面で「なぜ出ていないか」を見せる）。空なら出せる */
export function hostBlockers(h: HostListableInput): string[] {
  const out: string[] = [];
  if (h.routePublished !== true) out.push("ルートが非公開");
  if (h.isListed !== true || !h.approvedAt) out.push("運営が未承認");
  if (h.acceptingConsult !== true) out.push("相談を受け付けていない");
  if (!h.consentConfirmedAt || !isRouteConsentMethod(h.consentMethod)) out.push("本人の同意の記録が無い");
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

/**
 * 運営画面の入力を確かめる（経験者）。⚠️ 承認（is_listed）はここでは扱わない（別の操作）。
 * ctx.isListed: いま掲載中か（掲載中の人の同意の記録は消させない）。ctx.now: テスト用
 */
export function parseHostInput(raw: unknown, ctx: { isListed?: boolean; now?: Date } = {}):
  | { ok: true; value: { movedYear: number | null; talkTags: RouteTalkTag[]; message: string | null; acceptingConsult: boolean; consentConfirmedAt: string | null; consentMethod: RouteConsentMethod | null } }
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
  const atRaw = r.consentConfirmedAt == null ? "" : r.consentConfirmedAt;
  if (typeof atRaw !== "string") return { ok: false, message: "同意を確認した日時を入力し直してください" };
  const consentConfirmedAt = jstLocalToIso(atRaw);
  if (consentConfirmedAt === undefined) return { ok: false, message: "同意を確認した日時を入力し直してください" };
  if (consentConfirmedAt && new Date(consentConfirmedAt).getTime() > (ctx.now ?? new Date()).getTime() + 10 * 60_000) {
    return { ok: false, message: "同意を確認した日時に、未来の日時は入れられません" };
  }
  const methodRaw = r.consentMethod == null ? "" : r.consentMethod;
  if (methodRaw !== "" && !isRouteConsentMethod(methodRaw)) return { ok: false, message: "同意を確認した方法を選び直してください" };
  const consentMethod = methodRaw === "" ? null : (methodRaw as RouteConsentMethod);
  if ((consentConfirmedAt === null) !== (consentMethod === null)) return { ok: false, message: "同意を確認した日時と方法は、両方入れてください" };
  if ((r.acceptingConsult || ctx.isListed === true) && consentConfirmedAt === null) return { ok: false, message: ROUTE_CONSENT_REQUIRED_MESSAGE };
  return { ok: true, value: { movedYear, talkTags: sortRouteTalkTags(tagsRaw), message: message || null, acceptingConsult: r.acceptingConsult, consentConfirmedAt, consentMethod } };
}

/* ═══ 相談可能なユーザー（ホームの右の列・/people の左サイドバー）═══════════════════════════
 * 保存先は ow_featured_consultants（migration 20261112090000 / 20261112130000）。読み書きは lib/featuredConsultants/server.ts。
 * ★2026-11-12 に「本人がマイページでオンにする」形にした（柴さんの決定「誰でも」）。
 *   本人がオン … 同意の記録を consent_method = self で自動で入れる ／ 本人がオフ … is_listed = false
 *   運営 … 止める（stopped_at）だけ。止めている間は本人もオンにできない
 * ⚠️ 2026-10-16 に撤去した「面談OK」と同じく利用者が自分でオンにする形（承知のうえ）。「話を聞ける」「面談OK」の語は使わない。
 * ⚠️ 話せることは転職ルートの経験者と同じ選択肢。同意の方法は転職ルートの4つに 'self' を足したもの（DB の CHECK もそろえてある）。
 */

/** 見出しと説明（1か所） */
export const CONSULTANTS_TITLE = "相談可能なユーザー";
export const CONSULTANTS_NOTE = "本人が「相談にのれる」と設定した人です。";
/** ★/people のカードと一覧の行に付ける印（2026-11-12 / 柴さんの指示）。⚠️「面談OK」「話を聞ける」に戻さない */
export const CONSULTANT_BADGE_LABEL = "相談可能";
/** 箱に出す人数の上限（表示順 → オンにした日時が新しい順）。★2026-11-12 に5→3（柴さんの指示。残りは「すべて見る」の一覧で） */
export const CONSULTANTS_LIMIT = 3;
/** ★「すべて見る」の行き先（2026-11-12）。/people を相談可能なユーザーだけに絞った一覧。キーは CONSULTANTS_PARAM */
export const CONSULTANTS_PARAM = "consult";
export const CONSULTANTS_LIST_HREF = `/people?${CONSULTANTS_PARAM}=1`;
/** マイページの設定の場所（箱の下の「あなたも載る」） */
export const CONSULTANTS_SETTINGS_HREF = "/mypage/settings#consultant-setting";

/** 同意の方法（相談可能なユーザー）。転職ルートの4つ＋本人がマイページで設定 */
export const CONSULTANT_CONSENT_METHODS = [
  ...ROUTE_CONSENT_METHODS,
  { value: "self", label: "本人がマイページで設定" },
] as const;
export function isConsultantConsentMethod(v: unknown): boolean {
  return typeof v === "string" && CONSULTANT_CONSENT_METHODS.some((m) => m.value === v);
}

export type ConsultantListableInput = {
  visibility: string | null | undefined;
  authId: string | null | undefined;
  isTest: boolean | null | undefined;
  isSystem: boolean | null | undefined;
  isListed: boolean | null | undefined;
  stoppedAt: string | null | undefined;
  consentConfirmedAt: string | null | undefined;
  consentMethod: string | null | undefined;
};

/**
 * ★載せられない理由（空なら載せられる）。条件はこの関数だけ（書き写さないこと）。
 * ⚠️ 載る場所（ホーム・/people）はどちらもログインが要るので、公開範囲は「非公開」でなければよい。
 *    ログインしていない人に見せる場所へ広げるなら、そこでは「公開」に絞ること。
 * ⚠️ 値が取れなければ出さない側に倒す。
 */
export function consultantBlockers(c: ConsultantListableInput): string[] {
  const out: string[] = [];
  if (c.stoppedAt) out.push("運営が停止中");
  if (c.isListed !== true) out.push("本人がオフにしている");
  if (!c.consentConfirmedAt || !isConsultantConsentMethod(c.consentMethod)) out.push("本人の同意の記録が無い");
  if (c.visibility !== "public" && c.visibility !== "login_only") out.push("公開範囲が「非公開」");
  if (!c.authId) out.push("本人が登録していない");
  if (c.isTest !== false) out.push(c.isTest === true ? "検証用アカウント" : "検証用かどうか不明");
  if (c.isSystem !== false) out.push(c.isSystem === true ? "システムアカウント" : "システムかどうか不明");
  return out;
}

/** 本人の設定（マイページ）の入力を確かめる */
export function parseConsultantSelfInput(raw: unknown):
  | { ok: true; value: { listed: boolean; talkTags: RouteTalkTag[]; message: string | null } }
  | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.listed !== "boolean") return { ok: false, message: "載せるかどうかを選んでください" };
  const tagsRaw = r.talkTags == null ? [] : r.talkTags;
  if (!Array.isArray(tagsRaw) || tagsRaw.some((t) => !isRouteTalkTag(t))) return { ok: false, message: "話せることを選び直してください" };
  const msgRaw = r.message == null ? "" : r.message;
  if (typeof msgRaw !== "string") return { ok: false, message: "ひとことを入力し直してください" };
  const message = msgRaw.trim();
  if (message.length > ROUTE_HOST_MESSAGE_MAX) return { ok: false, message: `ひとことは${ROUTE_HOST_MESSAGE_MAX}字以内で入力してください` };
  return { ok: true, value: { listed: r.listed, talkTags: sortRouteTalkTags(tagsRaw), message: message || null } };
}

/** 運営が止めるときの理由の上限（DB の CHECK と同じ） */
export const CONSULTANT_STOP_REASON_MAX = 200;
/** 止められている人がオンにしようとしたときの文言 */
export const CONSULTANT_STOPPED_MESSAGE = "運営により掲載を止めています。お問い合わせください。";

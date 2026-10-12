/**
 * ★「今日このブラウザで数えたページ」の印（2026-10-09 / 段階D）。
 *
 * 形: `YYYYMMDD|c3834978fa3af|j9e8bb2c22a02…`（日付と、数えたページの短い鍵だけ）
 * ⚠️★**人を見分ける値（ランダムな ID など）を入れないこと。** 中身は「今日どのページを数えたか」だけで、
 *    DB にも送らない（判定にだけ使う）。
 * ⚠️ 日付が今日でなければ空として扱う（翌日にはまた数える）。
 * ⚠️ 上限 MAX_KEYS 件。超えたら古いものから落とす（cookie の大きさを抑える）。
 */
export const SEEN_COOKIE = "ov";
const MAX_KEYS = 100;

export type ViewPageType = "company" | "job" | "story";

/** ⚠️ 頭の1文字で種類を分ける（c: 企業ページ / j: 求人 / s: 企業ストーリー。s は 2026-10-12 追加） */
export function pageKey(type: ViewPageType, id: string): string {
  return (type === "company" ? "c" : type === "job" ? "j" : "s") + id.replace(/-/g, "").slice(0, 12);
}

export function parseSeen(raw: string | undefined, today: string): string[] {
  if (!raw) return [];
  const [date, ...keys] = raw.split("|");
  if (date !== today) return [];
  return keys.filter((k) => /^[cjs][0-9a-f]{12}$/.test(k));
}

export function serializeSeen(today: string, keys: string[]): string {
  return [today, ...keys.slice(-MAX_KEYS)].join("|");
}

/** 日本時間の日付。`YYYY-MM-DD`（DB に入れる値）と `YYYYMMDD`（cookie）を返す */
export function jstToday(now = Date.now()): { iso: string; compact: string } {
  const iso = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  return { iso, compact: iso.replace(/-/g, "") };
}

/** 次の日本時間の0時まで（秒）。cookie をその日のうちに切らす */
export function secondsUntilJstMidnight(now = Date.now()): number {
  const jst = now + 9 * 3_600_000;
  const next = (Math.floor(jst / 86_400_000) + 1) * 86_400_000;
  return Math.max(60, Math.ceil((next - jst) / 1000));
}

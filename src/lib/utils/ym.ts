/**
 * 年月の入力を DATE 列に入れられる形（YYYY-MM-01）に正規化する。
 *
 * ── なぜ必要か（2026-08-07）────────────────────────────────────────────────
 * 入力の形式が API ごとにバラバラで、事故が2つ起きていた。
 *
 *   ・`/api/jobseeker/educations` … 受け口は `YYYY-MM` だけを受理する正規表現。
 *      ところがクライアント（ProfileEditClient の formatYMToDate）が送るのは
 *      **`YYYY-MM-DD`**。正規表現を通らず **null に落とされ、入学年月・卒業年月が
 *      黙って保存されていなかった**。「入力させたのに保存しない」の典型。
 *   ・仮に `YYYY-MM` が来た場合は、そのまま date 列に INSERT され
 *      `invalid input syntax for type date` で **500** になっていた。
 *
 * ⚠️ 両方の形式を受け、DB に入れられる形に揃える。
 * ⚠️ 「空」と「不正」を区別すること。空は null（任意項目）、
 *    不正は 400 で返す。黙って null にすると上と同じ事故に戻る。
 */

/** 入力が空（未指定）か */
export function isBlankYm(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/**
 * `YYYY-MM` / `YYYY-MM-DD` を `YYYY-MM-01` に正規化する。
 * 空なら null、形式が不正なら undefined を返す（呼び出し側で 400 にする）。
 */
export function normalizeYm(v: unknown): string | null | undefined {
  if (isBlankYm(v)) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.exec(s);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-01`;
}

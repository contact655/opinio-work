/**
 * ★求人詳細の上部（スマホ）に出す短い事実（2026-10-29 / 柴さんの指示）。
 *
 * 何も import しない純粋な関数だけを置く（`npm test` が直接読む）。
 * ⚠️ どれも**書かれていることを短くするだけ**。読み取れないときは元の文をそのまま返すか null を返す。
 *    推測で埋めない（CLAUDE.md「値が無いことを、ある値に置き換えない」）。
 */

/**
 * 勤務地を「都道府県＋市区町村」までに縮める。
 * 例: 「大阪府大阪市北区堂島2-3-5 JPR堂島ウエスト2階」→「大阪府大阪市北区」
 * ⚠️ 都道府県で始まらない書き方（「東京・大阪」「フルリモート」など）は元の文をそのまま返す。
 * ⚠️ 番地とビル名は勤務条件の「勤務地」に全文が出るので、ここで捨ててよい。
 */
/**
 * ★一覧に出す勤務地（2026-11-12 / 柴さんの指示「住所の細かさは一覧でいらない。大阪府大阪市でいい」）。
 *   都道府県＋市区町村まで（政令市は区を落として市まで: 大阪府大阪市北区… → 大阪府大阪市）。東京23区は区まで（東京都港区）。
 *   複数の勤務地（「・」区切り）は先頭だけ、括弧書きは落とす（それまでの一覧の整形と同じ）。
 * ⚠️ 求人の詳細ページの勤務条件は全文のまま。上の帯は shortAddress（区まで）。一覧だけこちら。
 */
export function listAddress(location: string | null | undefined): string | null {
  if (!location) return null;
  const first = location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim();
  const short = shortAddress(first);
  if (!short) return null;
  /* 政令市の区（「◯◯市◯◯区」の区）を落とす。⚠️ 東京23区（市が無い）はそのまま */
  return short.replace(/(市)[^\s\d]{1,4}?区$/, "$1");
}

export function shortAddress(location: string | null | undefined): string | null {
  if (!location) return null;
  const s = location.normalize("NFKC").trim();
  if (!s) return null;
  const pref = s.match(/^(東京都|北海道|京都府|大阪府|[^\s都道府県]{2,3}県)/);
  if (!pref) return s;
  const rest = s.slice(pref[1].length);
  // 政令市の区まで（大阪市北区）／市（横浜市）／東京23区（港区）／郡と町村（〇〇郡〇〇町）
  const m =
    rest.match(/^([^\s\d]{1,6}?市)([^\s\d]{1,4}?区)?/) ??
    rest.match(/^([^\s\d]{1,4}?区)/) ??
    rest.match(/^([^\s\d]{1,5}?郡)?([^\s\d]{1,5}?[町村])/);
  if (!m) return pref[1];
  return pref[1] + m.slice(1).filter(Boolean).join("");
}

/**
 * 「休日・休暇」の文から年間休日の日数だけを読む。書かれていなければ null。
 * 例: 「完全週休2日制（土日祝） 、年間休⽇：125⽇」→ 125
 * ⚠️ 企業の入力に「⽇」（部首の文字。見た目は「日」）が混ざることがあるので NFKC で揃えてから読む。
 */
export function annualHolidays(holidays: string | null | undefined): number | null {
  if (!holidays) return null;
  const m = holidays.normalize("NFKC").match(/年間休日[^\d]{0,4}(\d{2,3})\s*日/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 50 && n <= 366 ? n : null;
}

/** 掲載日を「今日」「N日前」「Nか月前」で言う。日付が無ければ null */
export function postedAgo(publishedAt: string | null | undefined, now: Date = new Date()): string | null {
  if (!publishedAt) return null;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "今日";
  if (days < 31) return `${days}日前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}か月前`;
  return `${Math.floor(months / 12)}年前`;
}

/** 日時を日本時間の「2026年10月28日」にする。読めなければ null */
export function jpDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const d = new Date(t + 9 * 3_600_000); // 日本時間に寄せてから UTC の年月日を読む
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

/**
 * 募集サマリーに出す「掲載日」「更新日」（2026-11-19）。
 * ⚠️ 掲載日が無い求人には何も出さない（下書きから直接来た値を「掲載」と言わない）。
 * ⚠️ 更新日は、日本時間で掲載日より後の日付のときだけ出す（同じ日なら2行並べても情報が増えない）。
 * ⚠️ 更新日は ow_jobs.updated_at。中身を変えない保存でも新しくなる。
 */
export function jobDateRows(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): { key: "掲載日" | "更新日"; value: string }[] {
  const posted = jpDate(publishedAt);
  if (!posted) return [];
  const rows: { key: "掲載日" | "更新日"; value: string }[] = [{ key: "掲載日", value: posted }];
  const updated = jpDate(updatedAt);
  if (updated && updated !== posted && new Date(updatedAt as string) > new Date(publishedAt as string)) {
    rows.push({ key: "更新日", value: updated });
  }
  return rows;
}

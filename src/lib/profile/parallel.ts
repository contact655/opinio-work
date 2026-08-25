/**
 * 職歴の「並行在籍」の判定（2026-08-26 / フェーズ2-2）。
 *
 * ── なぜ作り直したか ────────────────────────────────────────────────────────
 * それまでの判定は `MergedTimeline` の中にあり、**開始「月」が一致するか**だけを見ていた。
 * 期間の重なりを一切見ていないので、
 *   ・開始月が違う並行（2016年入社と2018年入社が2020年まで重なる）→ **検出できない**
 *   ・開始月が同じだけで重なっていない経歴          → **並行にされる**
 * の両方が起きる。**期間そのものを見る。**
 *
 * ⚠️ **判定は日付演算で書く。「重なり日数 >= 30」では書かない。**
 *    実データに閾値の真下がある: 富士フイルム（〜2022-07-31）と Salesforce（2022-07-01〜）は
 *    **30日**重なる。7月は31日あるので `07-01 + 1ヶ月 = 08-01 > 07-31` で**並行ではない**が、
 *    「30日以上」で書くと**月をまたいだだけの転職が並行になる**（2月をまたぐと結果が変わる）。
 *
 * ⚠️ **同じ会社の複数役割どうしは数えない。** あれは並行ではなく連続（昇進・異動）。
 *    会社の同一判定は呼び出し側の規約（`getCompanyKey`）をそのまま渡してもらう。
 *    **ここに書き写すと `career-same-company` のグループ化と食い違う。**
 */

export type ParallelCareer = {
  id: string;
  company_name: string;
  /** "YYYY-MM-DD" */
  started_at: string;
  /** "YYYY-MM-DD" | null（現職） */
  ended_at: string | null;
};

/** "YYYY-MM-DD" に1ヶ月足す。月末は its 月の日数に丸める（1/31 → 2/28） */
function addOneMonth(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ny}-${p(nm)}-${p(nd)}`;
}

/** 今日（"YYYY-MM-DD"）。現職の終わりに使う */
function today(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

/**
 * 2件の期間が**1ヶ月以上**重なるか。
 *
 * ⚠️ 現職（`ended_at` が null）は**今日まで**として扱う。
 *    `lib/profile/tenure.ts` の `countMonths` が期間表示で使っているのと同じ考え方。
 */
export function overlapsAtLeastOneMonth(a: ParallelCareer, b: ParallelCareer): boolean {
  const now = today();
  const aEnd = a.ended_at ?? now;
  const bEnd = b.ended_at ?? now;
  // 重なりの区間 [start, end]
  const start = a.started_at > b.started_at ? a.started_at : b.started_at;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (end < start) return false;
  return addOneMonth(start) <= end;
}

/**
 * 職歴ごとに「1ヶ月以上重なる**他社**の会社名」を返す。
 *
 * - 戻り値は `id → 会社名の配列`。**重なりが無い職歴はキーごと入らない。**
 * - 同じ会社が複数の役割で重なっていても**1社として数える**
 *   （「他n社と並行」の n は**会社の数**であって職歴の件数ではない）。
 * - 並び順は「相手の開始日が古い順 → id」。**毎回同じ順**にするため。
 *
 * @param companyKeyOf 同じ会社かを決める規約。`MergedTimeline` の `getCompanyKey` を渡す
 */
export function buildOverlapMap<T extends ParallelCareer>(
  careers: T[],
  companyKeyOf: (c: T) => string,
): Map<string, string[]> {
  const sorted = [...careers].sort(
    (x, y) => x.started_at.localeCompare(y.started_at) || x.id.localeCompare(y.id),
  );
  const result = new Map<string, string[]>();

  for (const c of careers) {
    const key = companyKeyOf(c);
    const seen = new Set<string>();
    const names: string[] = [];
    for (const other of sorted) {
      if (other.id === c.id) continue;
      const otherKey = companyKeyOf(other);
      if (otherKey === key) continue;              // 同じ会社は並行ではない
      if (seen.has(otherKey)) continue;            // 同じ会社は1回だけ数える
      if (!overlapsAtLeastOneMonth(c, other)) continue;
      seen.add(otherKey);
      names.push(other.company_name);
    }
    if (names.length > 0) result.set(c.id, names);
  }
  return result;
}

/**
 * キャリア関連ユーティリティ
 *
 * ow_experiences の DATE 型（YYYY-MM-DD）を扱う。
 * CareerTimeline（Commit F）および将来の表示コンポーネントで使用。
 */

// ─── CareerEntry 型 ───────────────────────────────────────────────────────────

/**
 * ow_experiences + ow_companies(logo) を結合したキャリアエントリ。
 * /u/[id]/page.tsx の SELECT 結果を正規化したもの。
 * CareerTimeline の入力型として使用。
 */
export type CareerEntry = {
  id: string;
  /** 表示用会社名 */
  companyName: string;
  companyType: "master" | "custom" | "anon";
  /** ow_companies.logo_url (company_id がある場合のみ) */
  logoUrl: string | null;
  /** ow_companies.logo_letter (フォールバック用) */
  logoLetter: string | null;
  /** ow_companies.logo_gradient (フォールバック用) */
  logoGradient: string | null;
  roleSlug: string;
  roleTitle: string | null;
  /** "YYYY-MM-DD" */
  startedAt: string;
  /** "YYYY-MM-DD" | null（現職） */
  endedAt: string | null;
  isCurrent: boolean;
  description: string | null;
};

// ─── calculateTenure ──────────────────────────────────────────────────────────

/**
 * 在籍年数を計算する。
 *
 * @param startDate - 開始日（"YYYY-MM-DD"）
 * @param endDate   - 終了日（"YYYY-MM-DD"）。null のとき現職 → 今日基準で計算
 * @returns { years, months, label }
 *   - years / months: 両端含む月数を 12 で割った整数値
 *   - label: "3年6ヶ月" | "3年" | "6ヶ月"（"現在" は呼び出し側が付与）
 *
 * @example
 *   calculateTenure("2017-04-01", "2023-08-31") → { years: 6, months: 5, label: "6年5ヶ月" }
 *   calculateTenure("2020-04-01", "2021-03-31") → { years: 1, months: 0, label: "1年" }
 *   calculateTenure("2024-01-01", "2024-01-31") → { years: 0, months: 1, label: "1ヶ月" }
 *   calculateTenure("2023-09-01", null)          → 今日基準で計算
 */
export function calculateTenure(
  startDate: string,
  endDate: string | null
): { years: number; months: number; label: string } {
  // YYYY-MM に正規化（DATE型 "YYYY-MM-DD" または "YYYY-MM" どちらでも対応）
  const startYM = startDate.slice(0, 7); // "YYYY-MM"
  const endYM   = endDate
    ? endDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7); // 現職 → 今日の YYYY-MM

  const [startYear, startMonth] = startYM.split("-").map(Number);
  const [endYear,   endMonth  ] = endYM.split("-").map(Number);

  // 両端含む月数
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  // 負値ガード（ended_at < started_at の不正データ対策）
  const safeMonths = Math.max(totalMonths, 1);

  const years  = Math.floor(safeMonths / 12);
  const months = safeMonths % 12;

  let label: string;
  if (years > 0 && months > 0) {
    label = `${years}年${months}ヶ月`;
  } else if (years > 0) {
    label = `${years}年`;
  } else {
    label = `${months}ヶ月`;
  }

  return { years, months, label };
}

// ─── groupOverlappingCareers ──────────────────────────────────────────────────

/**
 * キャリアエントリを「期間が重なる者同士を同グループ」に分類する。
 *
 * 前提: 入力は事前ソート済み（is_current=true 先頭、その後 startedAt 降順）
 *
 * アルゴリズム:
 *   各エントリをグループリストに順番に追加する。
 *   「既存グループ内の誰かと期間が重なれば同グループ」方式。
 *   重なりなければ新グループを開始。
 *
 * 期間重なり判定（A と B）:
 *   A.start <= B.end  かつ  B.start <= A.end
 *   ※ end が null（現職）は今日基準で計算
 *
 * @example
 *   // 単独
 *   groupOverlappingCareers([A]) → [[A]]
 *   // 2社並行
 *   groupOverlappingCareers([A(2020-現在), B(2019-現在)]) → [[A, B]]
 *   // 3社連鎖: A と B は重なる, B と C は重なる → 全員同グループ
 *   groupOverlappingCareers([A, B, C]) → [[A, B, C]]
 *   // 連続だが重ならない
 *   groupOverlappingCareers([A(2022-現在), B(2018-2021)]) → [[A], [B]]
 */
export function groupOverlappingCareers(careers: CareerEntry[]): CareerEntry[][] {
  if (careers.length === 0) return [];

  const today = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  /** "YYYY-MM-DD" / "YYYY-MM" → "YYYY-MM" */
  const toYM = (d: string | null): string => d ? d.slice(0, 7) : today;

  /** A と B の期間が重なるか */
  function overlaps(a: CareerEntry, b: CareerEntry): boolean {
    const aStart = toYM(a.startedAt);
    const aEnd   = toYM(a.endedAt);
    const bStart = toYM(b.startedAt);
    const bEnd   = toYM(b.endedAt);
    // 期間重なり: aStart <= bEnd && bStart <= aEnd
    return aStart <= bEnd && bStart <= aEnd;
  }

  const groups: CareerEntry[][] = [];

  for (const entry of careers) {
    // 既存グループの中で、誰か1人でも重なれば同グループに追加
    const targetGroup = groups.find((group) =>
      group.some((member) => overlaps(entry, member))
    );
    if (targetGroup) {
      targetGroup.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  return groups;
}

// 開示充実度スコア（95pt満点）
//
// 第1区分「企業が入力できる項目」: 45pt
//   tagline(5) + description(15) + 写真(10) + 福利厚生(5) + 求人あり(5) + 企業ストーリー(5)
//
// 第2区分「取材で埋まる項目」: 50pt
//   culture_description(10) + customer_cases(10) + market_customer_size(10)
//   + capital_type(5) + branch_locations等(5) + org_teams(5) + ツール登録(5)
//
// ⚠️ 2026-08-06 に「給与データ3件以上(5pt)」を削除し、満点を 100 → 95 に下げた。
//    ユーザー投稿の給与レポート（ow_salary_reports）を畳んだため。
//    削除時点で 85社中 **0社** がこの5点を取っていた（投稿が全社合計1件で、
//    条件の3件に届いていなかった）ので、各社の点数は1点も動いていない。
//    B案（5点を他項目に振り替え）は1社しか動かず説明がつかないため、
//    満点を正直に下げるほうを選んだ。
//
// ⚠️ ラベルの閾値（scoreLabel の 80/50/20）は絶対値なので据え置き。
//    分母が 100 → 95 になるぶん、割合表示だけ上がる。

/** 満点。表示側でハードコードしないこと（2026-08-06 に 100 → 95 に下げたとき、
 *  ダッシュボードの「/ 55」と円グラフの角度計算が取り残された） */
export const DISCLOSURE_BIZ_MAX = 45;
export const DISCLOSURE_INTERVIEW_MAX = 50;
export const DISCLOSURE_MAX = DISCLOSURE_BIZ_MAX + DISCLOSURE_INTERVIEW_MAX;

export type ScoreInput = {
  // 第1区分: 企業が入力できる項目 (45pt)
  tagline?: string | null;
  description?: string | null;
  photoCount?: number;
  benefitsCount?: number;
  hasPublishedJob?: boolean;
  hasPublishedStory?: boolean;
  // 第2区分: 取材・投稿で埋まる項目 (55pt)
  cultureDescription?: string | null;
  customerCases?: unknown[] | null;
  marketCustomerSize?: string[] | null;
  capitalType?: string | null;
  branchLocations?: string[] | null;
  orgTeams?: unknown[] | null;
  toolCount?: number;
};

export type ScoreBreakdown = {
  total: number;
  biz: number;       // /45
  interview: number; // /50
};

export function calcDisclosureScore(input: ScoreInput): ScoreBreakdown {
  // 第1区分
  const biz =
    (input.tagline ? 5 : 0) +
    (input.description ? 15 : 0) +
    (input.photoCount && input.photoCount >= 1 ? 10 : 0) +
    (input.benefitsCount && input.benefitsCount >= 1 ? 5 : 0) +
    (input.hasPublishedJob ? 5 : 0) +
    (input.hasPublishedStory ? 5 : 0);

  // 第2区分
  const interview =
    (input.cultureDescription ? 10 : 0) +
    (input.customerCases && input.customerCases.length > 0 ? 10 : 0) +
    (input.marketCustomerSize && input.marketCustomerSize.length > 0 ? 10 : 0) +
    (input.capitalType ? 5 : 0) +
    (input.branchLocations && input.branchLocations.length > 0 ? 5 : 0) +
    (input.orgTeams && input.orgTeams.length > 0 ? 5 : 0) +
    (input.toolCount && input.toolCount >= 1 ? 5 : 0);

  return { total: biz + interview, biz, interview };
}

export function scoreLabel(total: number): string {
  if (total >= 80) return "充実";
  if (total >= 50) return "良好";
  if (total >= 20) return "基本";
  return "未入力";
}

/** ★リングなど**塗り**に使う色。文字には `scoreTextColor()` を使うこと */
export function scoreColor(total: number): string {
  if (total >= 80) return "var(--success)";
  if (total >= 50) return "var(--royal)";
  if (total >= 20) return "var(--warm)";
  return "var(--ink-mute)";
}

/**
 * ★文字色。`scoreColor()` をそのまま文字に使わないこと（2026-08-31 に分けた）。
 *
 * `/biz/dashboard` は同じ関数を **リングの塗り** と **18px の数字・11px のバッジ**の
 * 両方に使っていたが、塗りとして良い色が文字として読めるとは限らない。
 * 実測（`--bg-tint` #F8FAFC の上・必要 4.5）:
 *   `--success` #059669 → **3.77** ❌ ／ `--warm` #F59E0B → **2.05** ❌
 *   `--royal` → 14.01 ✅ ／ `--ink-mute` → 7.24 ✅
 * つまり **4段階のうち2段階が読めていなかった。**
 *
 * ⚠️ 塗り側（`scoreColor`）は変えていない。リングは色面積が大きく、
 *    文字と同じ基準は当てはまらない。**2つを1つに戻さないこと。**
 */
export function scoreTextColor(total: number): string {
  if (total >= 80) return "var(--success-ink)"; // 5.35（#047857 on #F8FAFC）
  if (total >= 50) return "var(--royal)";
  if (total >= 20) return "var(--warm-ink)";           // #92400E。6.78
  return "var(--ink-mute)";
}

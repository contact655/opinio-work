import type { Job } from "@/app/jobs/mockJobData";

// ─── ユーザープロフィール（ow_profiles）──────────────────────────────────
export type ScoringProfile = {
  job_type: string | null;           // 希望職種
  desired_salary_min: number | null; // 万円
  desired_salary_max: number | null;
  desired_phase: string[] | null;    // 希望企業フェーズ（例: ["シリーズA","上場"]）
  desired_work_style: string | null; // "full_remote" | "hybrid" | "on_site" | Japanese
};

// ─── 出力型 ──────────────────────────────────────────────────────────────
export type RecommendedJob = {
  job: Job;
  score: number;
  reasonText: string; // 日本語で1〜2行の根拠説明
};

// ─── 希望職種 → ow_jobs.job_category マッピング ──────────────────────────
// ow_profiles.job_type（オンボーディングで入力される細かい分類）と
// ow_jobs.job_category（求人側の粗い分類）の粒度差・揺れを吸収する。
// DB の実 job_category 値（SELECT job_category, COUNT(*) FROM ow_jobs GROUP BY job_category）
// を確認済みで網羅している。
export const JOB_TYPE_CATEGORY_MAP: Record<string, string[]> = {
  // ── セールス系 ──
  "フィールドセールス":    ["セールス", "営業", "エンタープライズ営業", "SMB営業", "フィールドセールス"],
  "インサイドセールス":    ["セールス", "営業", "インサイドセールス"],
  "SDR/BDR":              ["セールス", "営業", "インサイドセールス", "SDR", "BDR"],
  "SDR":                  ["セールス", "営業", "インサイドセールス"],
  "BDR":                  ["セールス", "営業"],
  // ── CS / サポート ──
  "カスタマーサクセス":    ["カスタマーサクセス", "CS", "テクニカルサポート", "ビジネスオペレーション"],
  "カスタマーサポート":    ["カスタマーサクセス", "テクニカルサポート"],
  // ── マーケティング ──
  "マーケティング":        ["マーケティング", "プロダクトマーケティング", "マーケ"],
  "プロダクトマーケティング": ["マーケティング", "プロダクトマーケティング"],
  // ── エンジニア系 ──
  "バックエンド":          ["エンジニアリング", "バックエンドエンジニア", "ソフトウェアエンジニア", "リサーチエンジニア"],
  "フロントエンド":        ["エンジニアリング", "ソフトウェアエンジニア"],
  "フルスタック":          ["エンジニアリング", "ソフトウェアエンジニア", "バックエンドエンジニア"],
  "SRE/インフラ":          ["エンジニアリング", "ソフトウェアエンジニア"],
  "iOS/Android":           ["エンジニアリング", "ソフトウェアエンジニア"],
  "エンジニア":            ["エンジニアリング", "バックエンドエンジニア", "ソフトウェアエンジニア"],
  "データサイエンティスト": ["データ・アナリスト", "リサーチエンジニア", "AI・Agentforce", "エンジニアリング"],
  // ── プロダクト ──
  "プロダクトマネージャー": ["プロダクトマネージャー", "プロダクト"],
  // ── デザイン ──
  "デザイナー":            ["プロダクトデザイナー", "デザイン", "デザイナー"],
  // ── コーポレート ──
  "コーポレート":          ["コーポレート", "人事・HR", "ビジネスオペレーション", "オペレーション"],
  "HR・人事":              ["人事・HR", "コーポレート"],
  "財務・経理":            ["コーポレート", "ビジネスオペレーション"],
  // ── 事業開発 / 経営 ──
  "事業開発・BizDev":      ["事業開発", "事業戦略・開発", "アライアンス・パートナー", "コンサルタント"],
  "事業開発":              ["事業開発", "事業戦略・開発", "アライアンス・パートナー"],
  "経営・CxO":             ["事業開発", "事業戦略・開発", "コンサルタント", "セールス戦略・オペレーション"],
};

// Fix 2: 希望職種がマッピング先の job_category に含まれるか判定
function matchesJobCategory(profileJobType: string, jobCategory: string): boolean {
  const mapped = JOB_TYPE_CATEGORY_MAP[profileJobType];
  if (mapped) return mapped.includes(jobCategory);
  // マップ未定義の場合は完全一致フォールバック
  return profileJobType === jobCategory;
}

// ─── 設定定数 ─────────────────────────────────────────────────────────────
/**
 * 配点。合計 120。
 *
 * ── 2026-08-04 の変更 ──────────────────────────────────────────────────────
 * スキルタグ機能の廃止に伴い SKILL（最大20点）を削除し、
 * 残った4軸に比例配分（×1.2）した。合計が 120 のままなので
 * RECOMMEND_CONFIG.MIN_SCORE = 30 のしきい値の意味も変わらない。
 *   JOB_TYPE 40→48 / SALARY 25→30 / PHASE 20→24 / WORK_STYLE 15→18
 *
 * ⚠️ ow_jobs.required_skills / preferred_skills は求人票の表示に使うため残っている。
 *    突き合わせる相手（ユーザー側のスキル）が無くなっただけで、求人側は無関係。
 */
const WEIGHTS = {
  JOB_TYPE:    48,
  SALARY:      30,
  PHASE:       24,
  WORK_STYLE:  18,
};

export const RECOMMEND_CONFIG = {
  MIN_SCORE:   30,
  MAX_RESULTS:  5,
};

// ─── 正規化ヘルパー ──────────────────────────────────────────────────────

function normWorkStyle(s: string): string {
  const v = s.toLowerCase().replace(/[_\-\s]/g, "");
  if (v.includes("fullremote") || v.includes("フルリモート") || v.includes("リモート可")) return "full_remote";
  if (v.includes("hybrid") || v.includes("ハイブリッド")) return "hybrid";
  if (v.includes("onsite") || v.includes("原則出社") || v.includes("オフィス")) return "on_site";
  return v;
}

function normPhase(s: string): string {
  const v = s.toLowerCase().replace(/[_\-\s・]/g, "");
  if (v.includes("seed") || v.includes("シード")) return "seed";
  if (v.includes("seriesa") || v.includes("シリーズa") || v.includes("シリーズａ")) return "series_a";
  if (v.includes("seriesb") || v.includes("シリーズb") || v.includes("シリーズｂ")) return "series_b";
  if (v.includes("seriesc") || v.includes("シリーズc") || v.includes("シリーズｃ")) return "series_c";
  if (v.includes("listed") || v.includes("上場") || v.includes("ipo")) return "listed";
  if (v.includes("ipo準備") || v.includes("ipoprep")) return "ipo_prep";
  return v;
}

// ─── スコアリング本体 ─────────────────────────────────────────────────────

export function scoreJob(
  job: Job,
  companyPhase: string | null | undefined,
  profile: ScoringProfile
): { score: number; reasonParts: string[] } {
  let score = 0;
  const reasonParts: string[] = [];

  // 1. 職種マッチ（Fix 2: マッピング経由で粒度差・表記揺れを吸収）
  if (profile.job_type && job.dept) {
    if (matchesJobCategory(profile.job_type, job.dept)) {
      score += WEIGHTS.JOB_TYPE;
      reasonParts.push(`希望職種「${profile.job_type}」に合致`);
    }
  }

  // 2. 年収重なり（job.salary_min/max は万円単位）
  const jMin = job.salary_min ?? 0;
  const jMax = job.salary_max ?? jMin;
  const pMin = profile.desired_salary_min;
  const pMax = profile.desired_salary_max;
  if (jMax > 0 && (pMin != null || pMax != null)) {
    const effectivePMin = pMin ?? 0;
    const effectivePMax = pMax ?? 9999;
    const overlapStart = Math.max(jMin, effectivePMin);
    const overlapEnd   = Math.min(jMax, effectivePMax);
    if (overlapEnd > overlapStart) {
      const jRange = jMax - jMin || 1;
      const ratio  = Math.min((overlapEnd - overlapStart) / jRange, 1);
      const pts    = Math.round(ratio * WEIGHTS.SALARY);
      if (pts > 0) {
        score += pts;
        const rangeLabel =
          pMin && pMax ? `${pMin}〜${pMax}万` :
          pMin ? `${pMin}万〜` : `〜${pMax}万`;
        reasonParts.push(`希望年収（${rangeLabel}）と重なる`);
      }
    }
  }

  // 3. 企業フェーズ
  if (profile.desired_phase?.length && companyPhase) {
    const normCompany = normPhase(companyPhase);
    const hit = profile.desired_phase.some((p) => normPhase(p) === normCompany);
    if (hit) {
      score += WEIGHTS.PHASE;
      reasonParts.push(`希望フェーズ（${companyPhase}）にマッチ`);
    }
  }

  // 4. 勤務スタイル
  if (profile.desired_work_style && job.work_style) {
    if (normWorkStyle(profile.desired_work_style) === normWorkStyle(job.work_style)) {
      score += WEIGHTS.WORK_STYLE;
      reasonParts.push(`勤務形態（${job.work_style}）が希望と一致`);
    }
  }

  return { score, reasonParts };
}

// ─── 全求人をスコアリングしてソート ───────────────────────────────────────

export function computeRecommendations(
  jobs: Job[],
  phaseMap: Map<string, string>,   // company_id → phase
  profile: ScoringProfile,
  alreadyShownIds?: Set<string>    // 既に他の場所で表示済みの求人ID（任意）
): RecommendedJob[] {
  const scored: RecommendedJob[] = [];

  for (const job of jobs) {
    if (alreadyShownIds?.has(job.id)) continue;

    const phase = phaseMap.get(job.company_id) ?? null;
    const { score, reasonParts } = scoreJob(job, phase, profile);

    if (score >= RECOMMEND_CONFIG.MIN_SCORE && reasonParts.length > 0) {
      const reasonText = reasonParts.slice(0, 2).join("・");
      scored.push({ job, score, reasonText });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, RECOMMEND_CONFIG.MAX_RESULTS);
}

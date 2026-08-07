import type { Job } from "@/app/jobs/mockJobData";

// ─── ユーザープロフィール（ow_profiles）──────────────────────────────────
export type ScoringProfile = {
  /** 希望職種（ow_profile_desired_roles）。**祖先まで展開済み**の role_id 配列 */
  desired_role_ids: string[] | null;
  /** 表示用。理由文に出す職種名（展開前の、本人が選んだものだけ） */
  desired_role_names?: string[] | null;
  desired_salary_min: number | null; // 万円
  desired_salary_max: number | null;
  desired_phase: string[] | null;    // 希望企業フェーズ（例: ["シリーズA","上場"]）
  /** 希望勤務スタイル（複数可）。"full_remote" | "hybrid" | "on_site" */
  desired_work_styles: string[] | null;
};

// ─── 出力型 ──────────────────────────────────────────────────────────────
export type RecommendedJob = {
  job: Job;
  score: number;
  reasonText: string; // 日本語で1〜2行の根拠説明
};

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

  /* 1. 職種マッチ
     ⚠️ **1つでも一致すれば満点**。按分にしない。
        希望を広く出した人ほど1件あたりのスコアが下がるのは、
        「幅を表現できるようにする」という今回の目的と逆行する。
        希望フェーズ（下の 3）が元からこの形なので揃えた。
     ⚠️ 両側とも祖先まで展開済みの role_id で突き合わせる。
        job.roleIds は queries.ts、希望職種は expandWithAncestors() で展開している。
        大分類（営業）でも子階層（エンタープライズセールス）でも同じ判定で当たる。 */
  const wantIds = profile.desired_role_ids;
  if (wantIds?.length && job.roleIds?.length) {
    const hit = job.roleIds.some((id) => wantIds.includes(id));
    if (hit) {
      score += WEIGHTS.JOB_TYPE;
      const label = profile.desired_role_names?.length
        ? profile.desired_role_names.slice(0, 2).join("・")
        : null;
      reasonParts.push(label ? `希望職種「${label}」に合致` : "希望職種に合致");
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

  // 4. 勤務スタイル。職種と同じく「1つでも一致なら満点」
  if (profile.desired_work_styles?.length && job.work_style) {
    const jw = normWorkStyle(job.work_style);
    if (profile.desired_work_styles.some((w) => normWorkStyle(w) === jw)) {
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

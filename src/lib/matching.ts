/**
 * マッチ理由生成ロジック
 * 求職者のprofileとjobのmatching_tags/条件を照合し、
 * 一致した項目を日本語文章に変換して返す（最大4件）
 */

type Profile = {
  tools?: string[];
  skills?: string[];
  desired_work_style?: string;
  desired_salary_min?: number;
  desired_salary_max?: number;
  desired_phase?: string[];
  job_type?: string;
};

type Job = {
  salary_min?: number | null;
  salary_max?: number | null;
  work_style?: string | null;
  matching_tags?: { tag_category: string; tag_value: string }[];
  company_phase?: string | null;
};

export type MatchReason = {
  text: string;
  score: number; // 0-1, higher = stronger match
};

// Tool/skill tag → readable reason
const TOOL_REASONS: Record<string, string> = {
  Salesforce: "Salesforce経験が直接活かせる",
  HubSpot: "HubSpot経験が直接活かせる",
  Marketo: "Marketo経験が活かせる",
  Tableau: "Tableauでのデータ分析経験が活かせる",
  SQL: "SQLスキルが活かせる",
};

// Work style mapping
const WORK_STYLE_MAP: Record<string, string[]> = {
  remote: ["フルリモート", "リモート中心", "リモート可"],
  hybrid: ["ハイブリッド", "リモート中心"],
  office: ["出社中心", "フル出社"],
};

// Phase mapping
const PHASE_MAP: Record<string, string[]> = {
  startup: ["スタートアップ経験", "0→1が好き", "アーリーステージ"],
  middle: ["1→10のフェーズ", "ミドルステージ"],
  listed: ["大手企業出身", "上場企業"],
  foreign: ["外資系経験", "英語力"],
};

// Job type mapping
const JOB_TYPE_REASONS: Record<string, Record<string, string>> = {
  cs: { CS経験: "カスタマーサクセス経験が活かせる" },
  sales: { SaaS営業経験: "SaaS営業経験が活かせる" },
  marketing: { マーケティング経験: "マーケティング経験が活かせる" },
  bizdev: { SaaS営業経験: "事業開発の経験が活かせる" },
};

export function generateMatchReasons(
  profile: Profile,
  job: Job
): MatchReason[] {
  const reasons: MatchReason[] = [];
  const tags = job.matching_tags || [];
  const tagValues = tags.map((t) => t.tag_value);

  // 1. Tool/skill match
  const profileTools = [...(profile.tools || []), ...(profile.skills || [])];
  for (const tool of profileTools) {
    if (tagValues.some((tv) => tv.includes(tool) || tool.includes(tv.replace("経験", "")))) {
      const reason = TOOL_REASONS[tool] || `${tool}の経験が活かせる`;
      if (!reasons.some((r) => r.text === reason)) {
        reasons.push({ text: reason, score: 0.9 });
      }
    }
  }

  // 2. Work style match
  if (profile.desired_work_style && job.work_style) {
    const preferred = WORK_STYLE_MAP[profile.desired_work_style] || [];
    if (
      preferred.some(
        (p) =>
          job.work_style?.includes(p) ||
          tagValues.some((tv) => tv.includes(p))
      )
    ) {
      const label =
        profile.desired_work_style === "remote"
          ? "フルリモート"
          : profile.desired_work_style === "hybrid"
          ? "ハイブリッド"
          : "出社";
      reasons.push({
        text: `${label}希望と一致している`,
        score: 0.85,
      });
    }
  }

  // 3. Salary match
  if (
    profile.desired_salary_min &&
    job.salary_max &&
    job.salary_max >= profile.desired_salary_min
  ) {
    reasons.push({
      text: "希望年収レンジに合致している",
      score: 0.8,
    });
  }

  // 4. Phase match
  if (profile.desired_phase && profile.desired_phase.length > 0) {
    for (const phase of profile.desired_phase) {
      const matchTags = PHASE_MAP[phase] || [];
      if (
        matchTags.some((mt) => tagValues.includes(mt)) ||
        job.company_phase === phase
      ) {
        const phaseLabel =
          phase === "startup"
            ? "スタートアップ"
            : phase === "middle"
            ? "ミドルステージ"
            : phase === "listed"
            ? "上場企業"
            : "外資系";
        reasons.push({
          text: `${phaseLabel}志向とフェーズが一致`,
          score: 0.75,
        });
        break;
      }
    }
  }

  // 5. Job type match
  if (profile.job_type) {
    const typeKey = profile.job_type.toLowerCase();
    for (const [key, mappings] of Object.entries(JOB_TYPE_REASONS)) {
      if (typeKey.includes(key)) {
        for (const [tagName, reason] of Object.entries(mappings)) {
          if (tagValues.includes(tagName)) {
            reasons.push({ text: reason, score: 0.7 });
          }
        }
      }
    }
  }

  // Sort by score desc, take max 4
  return reasons
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

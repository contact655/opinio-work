// ─── Mentor Matching Logic ──────────────────────────

export type MentorForMatching = {
  id: string;
  name: string;
  roles: string[] | null;
  worries: string[] | null;
  concerns: string[] | null;
  previous_career: string | null;
  current_career: string | null;
  current_company: string | null;
  current_role: string | null;
  total_consultations?: number | null;
  total_sessions?: number | null;
  display_order: number;
  prev_company?: string | null;
};

export type MatchUserProfile = {
  job_type: string | null;
  experience_years: string | null;
  worry: string | null;
  consultation_tags: string[] | null;
  current_company_type: string | null;
};

export type MentorMatchResult = {
  mentorId: string;
  score: number;
  reasons: string[];
};

// Map user job_type to mentor role keywords
const JOB_TYPE_ROLE_MAP: Record<string, string[]> = {
  フィールドセールス: ["営業", "セールス"],
  インサイドセールス: ["営業", "セールス", "IS"],
  カスタマーサクセス: ["CS", "カスタマーサクセス"],
  マーケティング: ["マーケ", "マーケティング"],
  "事業開発・BizDev": ["事業開発", "BizDev"],
  エンジニア: ["エンジニア", "開発"],
  PdM: ["PdM", "プロダクト"],
  // Simplified forms
  営業: ["営業", "セールス"],
  CS: ["CS", "カスタマーサクセス"],
  マーケ: ["マーケ", "マーケティング"],
  事業開発: ["事業開発", "BizDev"],
};

// Map company type keywords for prev_company matching
const COMPANY_TYPE_KEYWORDS: Record<string, string[]> = {
  外資系: ["Salesforce", "HubSpot", "Oracle", "SAP", "Google", "Microsoft", "AWS"],
  SaaS: ["Ubie", "LayerX", "SmartHR", "freee", "Sansan", "MoneyForward", "Zoho", "HubSpot", "Salesforce"],
  スタートアップ: ["Ubie", "LayerX"],
  人材: ["Recruit", "リクルート", "パーソル", "JACリクルートメント"],
  コンサル: ["アクセンチュア", "デロイト", "PwC", "KPMG", "McKinsey"],
};

export function calcMentorScore(
  mentor: MentorForMatching,
  userProfile: MatchUserProfile
): MentorMatchResult {
  let score = 0;
  const reasons: string[] = [];

  // ① タグマッチ（最重要・1タグ = 20点）
  const mentorWorries = mentor.worries || [];
  const userTags = userProfile.consultation_tags || [];
  const sharedTags = userTags.filter((tag) => mentorWorries.includes(tag));
  score += sharedTags.length * 20;
  if (sharedTags.length > 0) {
    reasons.push(`${sharedTags[0]}の相談実績が豊富です`);
  }

  // Also match single worry field against mentor worries
  if (userProfile.worry && !sharedTags.includes(userProfile.worry)) {
    const worryMatch = mentorWorries.includes(userProfile.worry);
    if (worryMatch) {
      score += 15;
      if (sharedTags.length === 0) {
        reasons.push(`${userProfile.worry}の相談実績が豊富です`);
      }
    }
  }

  // ② 前職の業界マッチ（15点）
  if (userProfile.current_company_type) {
    const keywords = COMPANY_TYPE_KEYWORDS[userProfile.current_company_type] || [];
    const companyStr = [
      mentor.current_company || "",
      mentor.prev_company || "",
    ].join(" ");
    const companyMatch = keywords.some((kw) => companyStr.includes(kw));
    if (companyMatch) {
      score += 15;
      reasons.push("あなたと似たキャリアバックグラウンドを持っています");
    }
  }

  // ③ 職種マッチ（10点）
  if (userProfile.job_type) {
    const mappedRoles = JOB_TYPE_ROLE_MAP[userProfile.job_type] || [userProfile.job_type];
    const mentorRoles = mentor.roles || [];
    const roleMatch = mappedRoles.some((r) =>
      mentorRoles.some((mr) => mr.includes(r) || r.includes(mr))
    );
    if (roleMatch) {
      score += 10;
      reasons.push(`${userProfile.job_type}職の転職支援が得意です`);
    }
  }

  // ④ 相談実績ボーナス（5点）
  const consultations = mentor.total_consultations || mentor.total_sessions || 0;
  if (consultations > 50) {
    score += 5;
    reasons.push(`相談実績${consultations}件の経験があります`);
  }

  return { mentorId: mentor.id, score, reasons: reasons.slice(0, 3) };
}

export function rankMentors(
  mentors: MentorForMatching[],
  userProfile: MatchUserProfile | null
): { mentorId: string; score: number; reasons: string[] }[] {
  if (!userProfile) return [];

  return mentors
    .map((m) => calcMentorScore(m, userProfile))
    .filter((r) => r.score > 0 && r.reasons.length > 0)
    .sort((a, b) => b.score - a.score);
}

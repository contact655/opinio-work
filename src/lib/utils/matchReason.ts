// ─── Job Match Reason Generator ─────────────────────

export function getMatchReason(job: any, score: number): string {
  const reasons: Record<string, string[]> = {
    "営業": [
      "SaaS営業経験とエンタープライズ新規開拓の実績が評価されます",
      "法人営業の経験とSaaS業界への関心が高く評価されます",
      "営業スキルとSaaSプロダクト理解が求められるポジションです",
    ],
    "カスタマーサクセス": [
      "CS経験とSaaSプロダクトへの深い理解がマッチしています",
      "顧客対応力とSaaS知識が評価されるポジションです",
      "CSとしての実績とコミュニケーション力が活かせます",
    ],
    "マーケ": [
      "BtoBマーケ経験とデジタルマーケへの知見がマッチします",
      "SaaSマーケの実務経験とデータ分析力が評価されます",
      "コンテンツマーケ・ABMの知識が活かせるポジションです",
    ],
    "インサイドセールス": [
      "IS経験とSaaSプロダクトへの関心が高く評価されます",
      "インサイドセールスの実績とコミュニケーション力がマッチします",
    ],
    "PdM": [
      "プロダクト開発への理解とビジネス視点がマッチします",
      "PdM経験とSaaSドメイン知識が評価されるポジションです",
    ],
    "事業開発": [
      "事業開発経験と戦略的思考が評価されるポジションです",
      "新規事業立ち上げの経験が活かせます",
    ],
    "エンジニア": [
      "技術スキルとプロダクト開発への理解がマッチしています",
      "エンジニアリング経験とSaaSドメイン知識が評価されます",
    ],
  };

  const phaseBonus: Record<string, string> = {
    "シード": "。スタートアップで裁量大きく働きたい方に最適です",
    "シリーズA": "。急成長フェーズで大きなインパクトを出せる環境です",
    "シリーズB": "。急成長フェーズでインパクトを出せる環境です",
    "シリーズC": "。プロダクトの拡大期に参画できる貴重なポジションです",
    "上場企業": "。安定した環境で専門性を深められます",
  };

  const jobType = job.job_category ?? "";
  const roleKey = Object.keys(reasons).find((r) => jobType.includes(r)) ?? "営業";
  const baseReasons = reasons[roleKey] ?? reasons["営業"];
  const idx = Math.floor(score / 10) % baseReasons.length;
  const base = baseReasons[idx];
  const phase = job.ow_companies?.phase ?? "";
  const bonus = phaseBonus[phase] ?? "";

  return base + bonus;
}

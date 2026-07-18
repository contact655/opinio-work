import type { Job } from "@/app/jobs/mockJobData";

// ─── 職種スラッグマップ（DB の job_category → URL slug）───────────────────

export const SALARY_SLUG_MAP: Record<string, {
  label: string;
  labelEn: string;
  description: string;
  tips: string[];
}> = {
  "enterprise-sales": {
    label: "エンタープライズ営業",
    labelEn: "Enterprise Account Executive",
    description: "外資系SaaS・IT企業の大企業向け営業職。基本給＋歩合の構成が多く、達成率により年収が大きく変動します。",
    tips: [
      "OTE（On Target Earnings）で表示される場合、基本給＋コミッションの合計額です",
      "外資系では達成率100%を前提とした年収で提示されることが多いです",
      "ストックオプション・RSUが上乗せされる企業も多くあります",
    ],
  },
  "customer-success": {
    label: "カスタマーサクセス",
    labelEn: "Customer Success Manager",
    description: "顧客の継続・活用支援を担うカスタマーサクセス職。GRR・NRRなどの指標に連動したインセンティブがある場合も。",
    tips: [
      "エンタープライズCSはより高い年収レンジが設定されることが多いです",
      "マネージャー・ディレクターポジションでは2000万円超の提示例もあります",
      "技術的なプロダクト知識が求められるほど年収レンジが上がる傾向があります",
    ],
  },
  "sales-engineer": {
    label: "セールスエンジニア",
    labelEn: "Sales Engineer / Solution Engineer",
    description: "技術的な知識でセールスを支援するプリセールス職。エンジニアリングとビジネスの橋渡し役として需要が高い。",
    tips: [
      "技術力＋営業スキルが求められる稀少な職種のため、市場価値が高い傾向",
      "Cloud・AIなど旬の技術スタックに精通すると年収レンジが上がります",
      "営業インセンティブが付く場合は提示年収以上に稼げる可能性があります",
    ],
  },
  "solutions-architect": {
    label: "ソリューションズアーキテクト",
    labelEn: "Solutions Architect",
    description: "顧客の技術的課題を解決するアーキテクチャ設計・提案職。深い技術知識と提案力が必要な高年収ポジション。",
    tips: [
      "AWS・Azure・GCPなどのクラウド資格があると年収アップに直結する職種",
      "AI/MLスペシャリストのポジションは2500万円超の事例もあります",
      "外資系大手では社内昇進でも大幅な年収アップが期待できます",
    ],
  },
  "backend-engineer": {
    label: "バックエンドエンジニア",
    labelEn: "Backend / Software Engineer",
    description: "サーバーサイドの開発を担うエンジニア職。外資系SaaSではフルリモートの求人も多く、スキルセットによる差が大きい。",
    tips: [
      "Go・Rust・Scala等の需要が高い言語スキルが年収に反映されやすい",
      "外資系はシニア以上のポジションから年収が急上昇する傾向があります",
      "ストックオプション・RSUを含めた総報酬で比較することが重要です",
    ],
  },
  "ml-engineer": {
    label: "MLエンジニア",
    labelEn: "ML / AI Engineer",
    description: "機械学習モデルの開発・実装・運用を担うエンジニア職。AI需要の高まりで市場価値が急上昇している職種。",
    tips: [
      "LLM・生成AI関連のスキルが特に需要が高く年収交渉で有利に働きます",
      "論文実績・OSS貢献がある場合、年収レンジの上限を超えた交渉も可能",
      "研究色が強いポジションはRSU・ボーナス比率が高い傾向があります",
    ],
  },
  "product-manager": {
    label: "プロダクトマネージャー",
    labelEn: "Product Manager",
    description: "プロダクトの企画・ロードマップ管理を担うPM職。エンジニアリング・ビジネス両方の知識が求められる。",
    tips: [
      "外資系では日本語ローカライズ能力も評価される場合があります",
      "シニアPMはエンジニア並みの年収レンジが設定されることが多い",
      "グロースPM・テクニカルPMなど専門性によってレンジが分かれます",
    ],
  },
  "smb-sales": {
    label: "SMB営業 / インサイドセールス",
    labelEn: "SMB Sales / Inside Sales",
    description: "中小企業向けの営業・インサイドセールス職。件数をこなすスピード型の営業スタイルで、成長企業に多いポジション。",
    tips: [
      "基本給は低めでも、コミッション次第で総額が大きく変わります",
      "マネージャーへのキャリアパスで年収が一段上がることが多い",
      "SaaS企業のAE（アカウントエグゼクティブ）へのステップにもなります",
    ],
  },
  "other": {
    label: "その他職種",
    labelEn: "Other Roles",
    description: "コーポレート・デザイナー・ビジネスオペレーションなど、IT/SaaS企業でのその他ポジション。",
    tips: [
      "専門性が高いポジションほど外資系での年収レンジが上がる傾向",
      "日本語能力に加えて英語力がある場合、レンジが広がることが多い",
    ],
  },
};

// DB の job_category → slug への変換マップ
export const CATEGORY_TO_SLUG: Record<string, string> = {
  "エンタープライズ営業": "enterprise-sales",
  "カスタマーサクセス": "customer-success",
  "セールスエンジニア": "sales-engineer",
  "ソリューションエンジニア": "sales-engineer",
  "ソリューションズアーキテクト": "solutions-architect",
  "バックエンドエンジニア": "backend-engineer",
  "ソフトウェアエンジニア": "backend-engineer",
  "MLエンジニア": "ml-engineer",
  "リサーチエンジニア": "ml-engineer",
  "プロダクトマネージャー": "product-manager",
  "プロダクトデザイナー": "other",
  "SMB営業": "smb-sales",
  "インサイドセールス": "smb-sales",
  "フィールドセールス": "smb-sales",
  "セールス": "enterprise-sales",
  "ビジネスオペレーション": "other",
};

export interface SalaryStats {
  slug: string;
  label: string;
  jobCount: number;
  avgMin: number;
  avgMax: number;
  minSalary: number;
  maxSalary: number;
  categories: string[];
}

export function buildSalaryStats(jobs: Job[]): SalaryStats[] {
  // group by slug
  const grouped: Record<string, { mins: number[]; maxs: number[]; cats: Set<string> }> = {};

  for (const job of jobs) {
    const cat = job.dept ?? "";
    const slug = CATEGORY_TO_SLUG[cat] ?? "other";
    if (!SALARY_SLUG_MAP[slug]) continue;
    const min = job.salary_min ?? 0;
    const max = job.salary_max ?? 0;
    if (min === 0 && max === 0) continue;
    if (!grouped[slug]) grouped[slug] = { mins: [], maxs: [], cats: new Set() };
    if (min > 0) grouped[slug].mins.push(min);
    if (max > 0) grouped[slug].maxs.push(max);
    grouped[slug].cats.add(cat);
  }

  const stats: SalaryStats[] = Object.entries(grouped)
    .filter(([, g]) => g.mins.length > 0 || g.maxs.length > 0)
    .map(([slug, g]) => {
      const avg = (arr: number[]) =>
        arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      return {
        slug,
        label: SALARY_SLUG_MAP[slug].label,
        jobCount: Math.max(g.mins.length, g.maxs.length),
        avgMin: avg(g.mins),
        avgMax: avg(g.maxs),
        minSalary: g.mins.length > 0 ? Math.min(...g.mins) : 0,
        maxSalary: g.maxs.length > 0 ? Math.max(...g.maxs) : 0,
        categories: Array.from(g.cats),
      };
    })
    .sort((a, b) => b.avgMax - a.avgMax);

  return stats;
}

export interface JobForSalary {
  id: string;
  slug: string | null;
  title: string;
  companyName: string;
  companySlug: string | null;
  salaryMin: number;
  salaryMax: number;
  workStyle: string | null;
  location: string | null;
  isNew: boolean;
}

export function getJobsForSlug(jobs: Job[], companyMap: Map<string, { name: string; slug: string | null }>, slug: string): JobForSalary[] {
  const targetCats = Object.entries(CATEGORY_TO_SLUG)
    .filter(([, s]) => s === slug)
    .map(([cat]) => cat);

  return jobs
    .filter((j) => {
      const cat = j.dept ?? "";
      return targetCats.includes(cat) && ((j.salary_min ?? 0) > 0 || (j.salary_max ?? 0) > 0);
    })
    .map((j) => {
      const co = companyMap.get(j.company_id);
      return {
        id: j.id,
        slug: j.slug ?? null,
        title: j.role,
        companyName: co?.name ?? "",
        companySlug: co?.slug ?? null,
        salaryMin: j.salary_min ?? 0,
        salaryMax: j.salary_max ?? 0,
        workStyle: j.work_style ?? null,
        location: j.location ?? null,
        isNew: j.is_new ?? false,
      };
    })
    .sort((a, b) => b.salaryMax - a.salaryMax);
}

import type { Company } from "../mockCompanies";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreshnessItem = {
  date: string;
  type: "interview" | "survey" | "article" | "sns";
  label: string;
};

export type JobItem = {
  title: string;
  tags: string[];
  salary: string;
  is_new?: boolean;
};

export type JobCat = {
  cat: string;
  total: number;
  items: JobItem[];
};

export type MemberRow = {
  dept: string;
  count: number;
  mentors: number;
  initials: string[];
  mentor_flags: boolean[];
};

export type InterviewCard = {
  name: string;
  role: string;
  tenure: string;
  career: string;
  catch: string;
  date: string;
  is_current: boolean;
  status_label?: string;
  photo: number; // 1–8
  ac: number;   // avatar color 1–7
  initial: string;
};

export type ArticleItem = {
  title: string;
  excerpt: string;
  type: "interview" | "feature";
  date: string;
  thumb: 1 | 2 | 3;
};

export type CompanyDetail = {
  id: string;
  mission: string;
  about: string;
  established: string;
  ceo: string;
  capital: string;
  hq: string;
  url: string;
  opinion_date: string;
  opinion_fit: string[];
  opinion_care: string[];
  freshness: FreshnessItem[];
  work_location: { label: string; note: string }[];
  work_style: { label: string; note: string }[];
  jobs: JobCat[];
  current: MemberRow[];
  alumni: MemberRow[];
  interviews: InterviewCard[];
  articles: ArticleItem[];
  related: string[];
  mentor_avatars: string[];
  mentor_current: number;
  mentor_alumni: number;
};

// ─── Full data ─────────────────────────────────────────────────────────────

const LAYERX: CompanyDetail = {
  id: "layerx",
  mission: "すべての経済活動を、デジタル化する。",
  about:
    "LayerXは「すべての経済活動を、デジタル化する」をミッションに掲げ、法人向けSaaS「バクラク」シリーズと資産運用DXを展開。バクラクは請求書・経費・契約書などバックオフィス業務をAIで自動化するプロダクト群で、導入企業数2,000社超。2023年にはシリーズCで30億円超を調達し、国内FinTechスタートアップでもトップクラスの成長率を誇る。",
  established: "2018年8月",
  ceo: "福島良典・松本勇気",
  capital: "59.3億円",
  hq: "東京都中央区銀座6丁目",
  url: "layerx.jp",
  opinion_date: "4月、編集部取材ベース",
  opinion_fit: [
    "バクラクシリーズの高成長を肌で感じながら、プロダクト開発・セールス・マーケに関われる",
    "CEOが現場に近く、意思決定の透明性が高いカルチャー。全社会議で全方針を開示",
    "フルリモート・副業OKで生産性を最大化できる環境",
  ],
  opinion_care: [
    "シリーズCフェーズで急成長中のため、制度・プロセスが整備途中の部分がある",
    "自律的に動くことが求められ、指示待ちスタイルの方には合わない可能性",
    "FinTechと法人SaaSの2軸が複雑で、全体像把握に一定の学習コストがかかる",
  ],
  freshness: [
    { date: "4/18", type: "interview", label: "銀座オフィス訪問・福島CEO インタビュー" },
    { date: "4/12", type: "sns", label: "バクラク企業ブログ更新「AI×バックオフィスの次」" },
    { date: "4/05", type: "survey", label: "働き方・組織情報 アンケート回答" },
    { date: "3/28", type: "article", label: "特集記事「シリーズCで描く未来」掲載" },
  ],
  work_location: [
    { label: "フルリモート可", note: "全職種対応、リモートファースト" },
    { label: "ハイブリッド勤務", note: "月1–2回の全社出社日あり（銀座オフィス）" },
  ],
  work_style: [
    { label: "フレックス制度", note: "コアタイムなし、完全自由" },
    { label: "副業可", note: "競合・守秘義務に抵触しない範囲で申請制" },
    { label: "裁量労働制", note: "エンジニア・PdM等が対象" },
  ],
  jobs: [
    {
      cat: "エンジニア・技術職",
      total: 8,
      items: [
        { title: "シニアバックエンドエンジニア（バクラク）", tags: ["フルリモート", "Go", "gRPC"], salary: "¥900–1,400万", is_new: true },
        { title: "MLエンジニア（OCR・ドキュメントAI）", tags: ["フルリモート", "Python", "LLM"], salary: "¥800–1,200万" },
        { title: "フロントエンドエンジニア", tags: ["フルリモート", "TypeScript", "React"], salary: "¥700–1,100万" },
      ],
    },
    {
      cat: "営業職",
      total: 4,
      items: [
        { title: "エンタープライズセールス（バクラク）", tags: ["リモート可", "東京"], salary: "¥600–1,000万", is_new: true },
        { title: "インサイドセールス", tags: ["フルリモート", "SaaS経験者歓迎"], salary: "¥500–800万" },
      ],
    },
  ],
  current: [
    { dept: "エンジニア", count: 4, mentors: 2, initials: ["福", "松", "山", "中"], mentor_flags: [true, true, false, false] },
    { dept: "営業", count: 2, mentors: 1, initials: ["田", "佐"], mentor_flags: [true, false] },
    { dept: "PdM", count: 1, mentors: 1, initials: ["林"], mentor_flags: [true] },
  ],
  alumni: [
    { dept: "エンジニア", count: 3, mentors: 2, initials: ["高", "木", "石"], mentor_flags: [true, true, false] },
    { dept: "営業", count: 2, mentors: 1, initials: ["渡", "橋"], mentor_flags: [true, false] },
  ],
  interviews: [
    {
      name: "山田 颯太さん",
      role: "シニアバックエンドエンジニア",
      tenure: "在籍 2年",
      career: "メルカリ SRE → LayerX（現職）",
      catch: "「技術と事業の両方に責任を持てる、珍しい場所」",
      date: "2026.04.10",
      is_current: true,
      photo: 1, ac: 1, initial: "山",
    },
    {
      name: "佐藤 彩香さん",
      role: "エンタープライズセールス",
      tenure: "在籍 1年",
      career: "SmartHR セールス → LayerX（現職）",
      catch: "「バクラクを売る前に、自分がバクラクに惚れた話」",
      date: "2026.03.22",
      is_current: true,
      photo: 2, ac: 3, initial: "佐",
    },
  ],
  articles: [
    {
      title: "LayerXが「経費精算の次」を見据える理由——AIで変わるバックオフィスの全体像",
      excerpt: "バクラクシリーズが経費・請求書・契約書に留まらず、バックオフィス全体のOS化を目指す。戦略と組織設計に迫った。",
      type: "feature",
      date: "2026.04.15",
      thumb: 1,
    },
    {
      title: "「スタートアップで働く」を選んだエンジニアが語るLayerXの技術的挑戦",
      excerpt: "Go + gRPCで構築されたバクラクの技術スタックと、急成長を支えるエンジニアリングカルチャーを徹底解剖。",
      type: "interview",
      date: "2026.03.28",
      thumb: 2,
    },
  ],
  related: ["smarthr", "freee", "sansan"],
  mentor_avatars: ["山", "佐", "田", "林"],
  mentor_current: 3,
  mentor_alumni: 2,
};

const SMARTHR: CompanyDetail = {
  id: "smarthr",
  mission: "労務・人事・タレントマネジメントをひとつに。",
  about:
    "SmartHRは、労務手続き・給与明細・勤怠管理から従業員サーベイ・タレントマネジメントまでを一気通貫でカバーするHR Techプラットフォーム。累計ユーザー数6万社超で業界シェアNo.1。2023年Series EラウンドでValuation1,500億円超の評価を受け、IPO準備段階にある。",
  established: "2013年1月",
  ceo: "芹澤雅人",
  capital: "非公開（Series E）",
  hq: "東京都港区六本木3丁目",
  url: "smarthr.jp",
  opinion_date: "4月、編集部取材ベース",
  opinion_fit: [
    "HR Techのデファクトスタンダード企業で、業界に与えるインパクトを実感できる",
    "フルリモート・副業OKで、時短勤務にも対応した柔軟な働き方制度",
    "Series Eからの上場準備フェーズで、組織づくりの最前線を経験できる",
  ],
  opinion_care: [
    "1,000名近い組織規模になり、スタートアップ初期の一体感よりも専門性分業が進んでいる",
    "プロダクトラインが多岐にわたり、自分の携わるプロダクトへの集中が必要",
    "HR領域の法改正・規制変更への対応が多く、専門知識の習得が求められる",
  ],
  freshness: [
    { date: "4/16", type: "interview", label: "六本木オフィス訪問・プロダクト責任者インタビュー" },
    { date: "4/10", type: "survey", label: "働き方・組織情報 アンケート回答" },
    { date: "3/30", type: "sns", label: "エンジニアブログ更新「SmartHR v2アーキテクチャ」" },
    { date: "3/15", type: "article", label: "特集記事「Series EからIPOへの道程」" },
  ],
  work_location: [
    { label: "フルリモート可", note: "全国どこでも勤務可能、月1回の出社推奨" },
    { label: "ハイブリッド勤務", note: "六本木・大阪・福岡の3拠点から選択可" },
  ],
  work_style: [
    { label: "フレックス制度", note: "コアタイムなし" },
    { label: "副業可", note: "原則OK（申請制）" },
    { label: "時短勤務", note: "育児・介護等で対応" },
  ],
  jobs: [
    {
      cat: "エンジニア・技術職",
      total: 10,
      items: [
        { title: "シニアRubyエンジニア（コアHR）", tags: ["フルリモート", "Ruby", "Rails"], salary: "¥800–1,300万", is_new: true },
        { title: "SRE（信頼性エンジニアリング）", tags: ["フルリモート", "Kubernetes", "GCP"], salary: "¥900–1,400万" },
        { title: "プロダクトマネージャー（タレントマネジメント）", tags: ["フルリモート", "PdM"], salary: "¥700–1,100万" },
      ],
    },
    {
      cat: "営業職",
      total: 8,
      items: [
        { title: "エンタープライズAE（中堅〜大手企業）", tags: ["リモート可", "東京"], salary: "¥600–1,000万", is_new: true },
        { title: "カスタマーサクセス（エンタープライズ）", tags: ["フルリモート", "SaaS経験者歓迎"], salary: "¥500–800万" },
      ],
    },
  ],
  current: [
    { dept: "エンジニア", count: 6, mentors: 3, initials: ["芹", "田", "山", "中", "佐", "高"], mentor_flags: [true, true, true, false, false, false] },
    { dept: "営業", count: 4, mentors: 2, initials: ["林", "鈴", "渡", "橋"], mentor_flags: [true, true, false, false] },
    { dept: "PdM", count: 2, mentors: 1, initials: ["木", "石"], mentor_flags: [true, false] },
  ],
  alumni: [
    { dept: "エンジニア", count: 4, mentors: 2, initials: ["伊", "松", "竹", "梅"], mentor_flags: [true, true, false, false] },
    { dept: "営業", count: 2, mentors: 1, initials: ["清", "福"], mentor_flags: [true, false] },
  ],
  interviews: [
    {
      name: "田中 健一さん",
      role: "シニアソフトウェアエンジニア",
      tenure: "在籍 3年",
      career: "リクルートテクノロジーズ → SmartHR（現職）",
      catch: "「6万社のHRを支えるプロダクトに、自分のコードが動いている」",
      date: "2026.04.08",
      is_current: true,
      photo: 3, ac: 3, initial: "田",
    },
    {
      name: "山本 恵さん",
      role: "カスタマーサクセス（現在は別会社）",
      tenure: "在籍 2年",
      career: "SaaS系スタートアップ → SmartHR（2年在籍）→ 独立",
      catch: "「SmartHRで磨いたCS力が、今のキャリアの土台になった」",
      date: "2026.03.15",
      is_current: false,
      status_label: "2026.02 退職、現在はフリーランス",
      photo: 2, ac: 4, initial: "山",
    },
  ],
  articles: [
    {
      title: "SmartHRが1,000名組織になっても「自律」を守り続ける仕組み",
      excerpt: "急拡大する組織でカルチャーと自律性を保つために、SmartHRが取り組んできた組織設計の秘訣。",
      type: "feature",
      date: "2026.04.10",
      thumb: 2,
    },
    {
      title: "HR Techのフロントランナーが語る「次の5年」",
      excerpt: "労務管理から始まったSmartHRが、タレントマネジメントへと進化するプロダクト戦略の全貌。",
      type: "interview",
      date: "2026.03.05",
      thumb: 1,
    },
  ],
  related: ["layerx", "freee", "money-forward"],
  mentor_avatars: ["田", "山", "芹", "林"],
  mentor_current: 5,
  mentor_alumni: 3,
};

// ─── Template generator (for the other 10 companies) ─────────────────────────

function makeDetail(c: Company, overrides: Partial<CompanyDetail> = {}): CompanyDetail {
  const currentCount = c.current_mentors + 2;
  const alumniCount = c.alumni_mentors + 1;
  const defMission = c.tagline;
  const INITIALS = ["田", "山", "佐", "中", "高", "林", "渡", "橋", "木", "石", "鈴", "竹"];
  const INITIALS2 = ["伊", "松", "清", "福", "岡", "村", "川", "安", "岩", "小"];

  const base: CompanyDetail = {
    id: c.id,
    mission: defMission,
    about: `${c.name}は、${c.tagline.replace(/。$/, "")}。${c.industry}領域をリードする${c.employee_count.toLocaleString()}名規模の組織で、${c.phase}フェーズにおいて事業成長を続けている。`,
    established: "2015年4月",
    ceo: "代表取締役 CEO",
    capital: "非公開",
    hq: "東京都",
    url: `${c.id}.com`,
    opinion_date: "4月、編集部取材ベース",
    opinion_fit: [
      `${c.industry}領域でのキャリア構築に最適な環境`,
      `${c.phase}フェーズの急成長を最前線で体験できる`,
      c.work_styles.slice(0, 2).join("・") + "など柔軟な働き方が可能",
    ],
    opinion_care: [
      "急成長中のため、制度・プロセスの整備が追いついていない部分がある",
      "自律的に動くことが求められ、指示待ちスタイルの方には合わない可能性",
      "変化のスピードが速く、適応力と自己学習が必要",
    ],
    freshness: [
      { date: "4/15", type: "interview", label: "編集部取材・HR責任者インタビュー" },
      { date: "4/08", type: "survey", label: "企業アンケート回答（働き方・組織情報）" },
      { date: "3/25", type: "article", label: "特集記事掲載" },
    ],
    work_location: [
      { label: c.work_styles.includes("フルリモート") ? "フルリモート可" : "オフィス出社（拠点勤務）", note: "求人ページで詳細確認" },
      { label: "ハイブリッド勤務", note: "部署・職種によって異なります" },
    ],
    work_style: [
      { label: c.work_styles.includes("フレックス") ? "フレックス制度" : "固定時間制", note: "" },
      { label: c.work_styles.includes("副業OK") ? "副業可（申請制）" : "副業不可", note: "" },
    ],
    jobs: c.job_count > 0 ? [
      {
        cat: "エンジニア・技術職",
        total: Math.max(2, Math.floor(c.job_count * 0.4)),
        items: [
          { title: "バックエンドエンジニア", tags: ["フルリモート", "Go", "AWS"], salary: "¥700–1,200万", is_new: true },
          { title: "フロントエンドエンジニア", tags: ["TypeScript", "React"], salary: "¥600–1,000万" },
        ],
      },
      {
        cat: "営業職",
        total: Math.max(2, Math.floor(c.job_count * 0.3)),
        items: [
          { title: "エンタープライズセールス", tags: ["リモート可", "東京"], salary: "¥500–900万", is_new: true },
          { title: "カスタマーサクセス", tags: ["フルリモート"], salary: "¥400–700万" },
        ],
      },
    ] : [],
    current: [
      {
        dept: "エンジニア",
        count: Math.max(2, currentCount),
        mentors: c.current_mentors,
        initials: INITIALS.slice(0, Math.min(6, currentCount)),
        mentor_flags: Array.from({ length: Math.min(6, currentCount) }, (_, i) => i < c.current_mentors),
      },
      {
        dept: "営業",
        count: Math.max(1, Math.floor(currentCount * 0.6)),
        mentors: Math.max(0, c.current_mentors - 1),
        initials: INITIALS.slice(6, 6 + Math.min(3, Math.floor(currentCount * 0.6))),
        mentor_flags: [true, false, false].slice(0, Math.min(3, Math.floor(currentCount * 0.6))),
      },
    ],
    alumni: alumniCount > 0 ? [
      {
        dept: "エンジニア",
        count: alumniCount,
        mentors: c.alumni_mentors,
        initials: INITIALS2.slice(0, Math.min(4, alumniCount)),
        mentor_flags: Array.from({ length: Math.min(4, alumniCount) }, (_, i) => i < c.alumni_mentors),
      },
    ] : [],
    interviews: [
      {
        name: "田中 翔太さん",
        role: `${c.industry}領域のエンジニア`,
        tenure: "在籍 2年",
        career: `前職SaaS系企業 → ${c.name}（現職）`,
        catch: `「${c.tagline.slice(0, 18)}...」を支えるプロダクト開発`,
        date: "2026.04.10",
        is_current: true,
        photo: 1, ac: 1, initial: "田",
      },
    ],
    articles: [
      {
        title: `${c.name}の${c.industry}戦略——${c.phase}フェーズで見えてきたこと`,
        excerpt: `${c.tagline}。Opinio編集部が取材した、組織の現在地と今後の展望。`,
        type: "feature",
        date: "2026.04.01",
        thumb: 1,
      },
    ],
    related: [],
    mentor_avatars: INITIALS.slice(0, Math.min(4, c.current_mentors + c.alumni_mentors)),
    mentor_current: c.current_mentors,
    mentor_alumni: c.alumni_mentors,
  };

  return { ...base, ...overrides };
}

// ─── Per-company overrides ────────────────────────────────────────────────────

import { MOCK_COMPANIES } from "../mockCompanies";

function companyById(id: string) {
  return MOCK_COMPANIES.find((c) => c.id === id)!;
}

const HUBSPOT: CompanyDetail = makeDetail(companyById("hubspot-japan"), {
  mission: "中小企業のインバウンドマーケティングを世界標準に。",
  about: "HubSpot Japanは、世界180ヶ国以上に展開するインバウンドマーケティング・営業プラットフォームの日本法人。CRM・マーケ・セールス・CSをひとつのプラットフォームで提供し、国内導入企業数は急増中。外資系でありながら日本チームの裁量が大きく、グローバルキャリアへの登竜門としても知られる。",
  established: "2016年（日本法人）",
  ceo: "傳 智之（Country Manager）",
  capital: "非公開（親会社 NYSE上場）",
  hq: "東京都千代田区大手町",
  url: "hubspot.jp",
  opinion_fit: [
    "グローバル規模のプロダクトを日本市場に届ける、インパクトある仕事",
    "外資でありながら、少数精鋭の日本チームで大きな裁量を持てる",
    "HubSpotアカデミーなど充実したラーニング制度で、マーケ・営業スキルが磨ける",
  ],
  opinion_care: [
    "グローバル本社の方針変更が日本チームに影響することがある",
    "英語でのコミュニケーションが日常的に必要",
    "日本法人は比較的小規模のため、専門職の希少性が高い",
  ],
  related: ["salesforce-japan", "datadog-japan", "notion-japan"],
});

const SALESFORCE: CompanyDetail = makeDetail(companyById("salesforce-japan"), {
  mission: "すべての企業のデジタルトランスフォーメーションを、AIで加速する。",
  about: "Salesforce Japanは、世界No.1 CRMプラットフォームの日本法人。Einstein AIを統合したCRM、Data Cloud、Slackなど多様なプロダクトを企業に提供し、DXを推進する。従業員3,000名超で、外資系IT企業の中でも最大規模の日本組織を持つ。",
  established: "2000年（日本法人）",
  ceo: "小出 伸一（代表取締役会長兼社長）",
  capital: "非公開（親会社 NYSE上場）",
  hq: "東京都千代田区丸の内",
  url: "salesforce.com/jp",
  opinion_fit: [
    "世界トップクラスのエンタープライズ営業スキルが身につく",
    "3,000名超の日本組織で、多様なキャリアパスが用意されている",
    "グローバルキャリアへの強力な跳躍台になるブランド力",
  ],
  opinion_care: [
    "大企業特有の組織の複雑さがあり、意思決定に時間がかかることがある",
    "成果主義が強く、ノルマ達成のプレッシャーが大きい職種もある",
    "グローバルのロードマップ優先で、日本独自の施策が通りにくい場面もある",
  ],
  related: ["hubspot-japan", "datadog-japan", "notion-japan"],
});

const UBIE: CompanyDetail = makeDetail(companyById("ubie"), {
  mission: "テクノロジーで、人々を適切な医療に案内する。",
  about: "Ubieは、AI問診サービス「ユビー」を展開するHealthTechスタートアップ。患者の症状をAIで分析し、適切な診療科・医療機関へ案内する。医療機関向けと患者向けの2サイドで事業を展開し、2024年時点で国内医療機関の約30%への導入を達成。週4日勤務や副業OKなど、医療×テックのユニークな制度設計でも注目されている。",
  established: "2017年5月",
  ceo: "阿部 吉倫・久保 恒太",
  capital: "非公開（Series D）",
  hq: "東京都中央区日本橋",
  url: "ubie.co.jp",
  opinion_fit: [
    "医療×AIという社会的インパクトの高い領域で、やりがいを持って働ける",
    "週4日勤務・副業OKなど、業界でも珍しい働き方を実現できる",
    "両共同代表がエンジニア出身で、技術に対するリスペクトが組織全体に浸透",
  ],
  opinion_care: [
    "医療業界特有の規制・コンプライアンスへの理解が必要",
    "Healthtech領域は競合も多く、差別化戦略の重要性が高い",
    "Series Dフェーズで組織が急拡大中のため、制度変化が多い",
  ],
  related: ["layerx", "pksha-technology", "smarthr"],
});

const FREEE: CompanyDetail = makeDetail(companyById("freee"), {
  mission: "スモールビジネスのバックオフィスを、まるごと自動化する。",
  about: "freeeは、中小企業・個人事業主向けの会計・人事労務クラウドサービスを展開。導入事業所数は60万超で国内ナンバーワンシェア。東証グロース上場後も年率30%超の成長を継続し、「誰もが自由に経営できる統合型バックオフィスプラットフォーム」を目指している。",
  established: "2012年7月",
  ceo: "佐々木 大輔",
  capital: "非公開（東証グロース上場）",
  hq: "東京都品川区大崎",
  url: "freee.co.jp",
  opinion_fit: [
    "中小企業支援という社会的意義の高い事業で、わかりやすいインパクトを実感できる",
    "上場企業でありながら年率30%超の成長が続く、両立型の環境",
    "フルリモート・副業OKで、プロフェッショナルとしての自律性が高い",
  ],
  opinion_care: [
    "会計・法務の専門知識が求められるプロダクト領域であり、勉強量が多い",
    "競合（マネーフォワード、弥生等）との差別化が継続的に求められる",
    "上場企業としての規律と、スタートアップ的なスピードのバランスを取る必要がある",
  ],
  related: ["layerx", "money-forward", "sansan"],
});

const SANSAN: CompanyDetail = makeDetail(companyById("sansan"), {
  mission: "出会いからビジネスを。名刺・契約・請求書データで働き方を変える。",
  about: "SansanはBtoB名刺管理SaaS「Sansan」、契約データベース「Contract One」、請求書受領クラウド「Bill One」など複数プロダクトを展開する東証プライム上場企業。名刺データから始まったデータクレンジング技術を活かし、ビジネス文書全体のDXを推進している。",
  established: "2007年6月",
  ceo: "寺田 親弘",
  capital: "非公開（東証プライム上場）",
  hq: "東京都渋谷区神宮前5丁目",
  url: "sansan.com",
  opinion_fit: [
    "東証プライム上場の安定基盤と、新規プロダクト展開の成長機会が両立する",
    "名刺管理という確立したシェアを持つ会社で、次の柱を作る経験が積める",
    "副業OK・フレックスで、プロフェッショナルとしての働き方が実現できる",
  ],
  opinion_care: [
    "プロダクトラインが多く、担当プロダクト以外の全体像の把握に時間がかかる",
    "上場企業として一定の規律があり、意思決定フローが整備されている",
    "名刺管理という認知から脱却し、データビジネス企業として再定義中の過渡期",
  ],
  related: ["freee", "money-forward", "kubell"],
});

const MONEY_FORWARD: CompanyDetail = makeDetail(companyById("money-forward"), {
  mission: "お金をポジティブな力に変える、FinTechインフラへ。",
  about: "マネーフォワードは「お金をポジティブな力に変える」をミッションに、個人向け家計簿アプリと法人向けバックオフィスSaaSを展開する東証プライム上場企業。法人向けMFクラウドシリーズは中小企業を中心に累計50万社超に利用されており、FintechとSaaSを融合させた「Money Forward Finance」も展開中。",
  established: "2012年5月",
  ceo: "辻 庸介",
  capital: "非公開（東証プライム上場）",
  hq: "東京都港区芝浦3丁目",
  url: "moneyforward.com",
  opinion_fit: [
    "個人向け・法人向け両面でのFinTech事業をBothSideで経験できる",
    "東証プライム上場で安定した経営基盤と、次世代金融インフラ構築の挑戦が共存",
    "ハイブリッド勤務・副業OKで、働き方の自由度が高い",
  ],
  opinion_care: [
    "2,000名超の大組織のため、意思決定フローが複雑化している部分がある",
    "金融規制への対応が厳しく、新機能リリースに時間がかかる面がある",
    "競合（freee、Sansanなど）との差別化戦略が継続的に求められる",
  ],
  related: ["freee", "sansan", "layerx"],
});

const PKSHA: CompanyDetail = makeDetail(companyById("pksha-technology"), {
  mission: "人間とソフトウェアの共進化をAIアルゴリズムで実現する。",
  about: "PKSHA Technologyは、独自開発のAIアルゴリズムを活用した自然言語処理・画像認識ソリューションを展開する東証グロース上場企業。金融・通信・製造など大手企業へのアルゴリズムライセンスやSaaS提供、さらには投資事業まで幅広くAI活用を推進している。現在は一部ポジションの採用を停止中。",
  established: "2012年6月",
  ceo: "上野山 勝也",
  capital: "非公開（東証グロース上場）",
  hq: "東京都文京区本郷2丁目",
  url: "pkshatech.com",
  opinion_fit: [
    "研究から事業化まで一気通貫でAIを活用する、唯一無二の環境",
    "大手企業との共同研究・実装プロジェクトで、即インパクトを出せる",
    "ハイブリッド勤務・裁量労働で、研究者・エンジニアが集中できる環境",
  ],
  opinion_care: [
    "現在一部ポジションの採用を停止中（詳細は公式サイト参照）",
    "AIアルゴリズムという技術難易度が高く、深いML/NLP知識が前提となる職種が多い",
    "東証グロースの中でも研究色が強いため、事業KPIよりも技術的探求を重視する文化",
  ],
  related: ["ubie", "layerx", "money-forward"],
});

const DATADOG: CompanyDetail = makeDetail(companyById("datadog-japan"), {
  mission: "クラウドインフラの可観測性を、エンタープライズのデファクトスタンダードに。",
  about: "Datadog Japanは、クラウド監視・可観測性プラットフォームの世界最大手 Datadogの日本法人。インフラ監視・APM・ログ管理・セキュリティを統合したプラットフォームで、国内大手エンタープライズ企業の採用が急増中。NASDAQ上場のグローバル企業の日本拠点として、少数精鋭での急拡大フェーズにある。",
  established: "2021年（日本法人）",
  ceo: "桐島 弘道（日本代表）",
  capital: "非公開（親会社 NASDAQ上場）",
  hq: "東京都千代田区丸の内",
  url: "datadoghq.com",
  opinion_fit: [
    "グローバルで急成長中のクラウドインフラ企業で、日本市場の立ち上げを経験できる",
    "観測性プラットフォームのトップシェア製品を扱うことで、技術的競争力が高まる",
    "フルリモート・副業OKで、高い自律性が認められている",
  ],
  opinion_care: [
    "グローバル本社（米国）との英語コミュニケーションが日常的に必要",
    "日本法人は200名規模と相対的に小さく、ポジションの幅が限られる場合がある",
    "エンタープライズ向けの複雑な製品知識の習得に時間がかかる",
  ],
  related: ["hubspot-japan", "salesforce-japan", "notion-japan"],
});

const KUBELL: CompanyDetail = makeDetail(companyById("kubell"), {
  mission: "Chatworkでビジネスコミュニケーションを再定義する。",
  about: "kubell（旧Chatwork株式会社）は、中小企業向けビジネスチャット「Chatwork」を展開する東証グロース上場企業。国内40万社超の導入実績を持ち、2024年に社名をkubellに変更。SaaS型のコミュニケーションツールを核に、バックオフィス支援サービスへと事業拡大中。",
  established: "2004年11月",
  ceo: "山本 正喜",
  capital: "非公開（東証グロース上場）",
  hq: "東京都品川区西五反田7丁目",
  url: "kubell.com",
  opinion_fit: [
    "40万社超の導入企業を持つ安定したプロダクトと、新事業創出の機会が共存",
    "フルリモート・フレックスで生産性重視の働き方が実現できる",
    "中小企業向け特化のため、ユーザーの課題解像度が上がりやすい",
  ],
  opinion_care: [
    "SlackやTeamsなど強力な競合が存在し、継続的な差別化が求められる",
    "上場企業としての規律とスタートアップ的なスピードのバランスが難しい局面もある",
    "社名変更（Chatwork → kubell）に伴う認知変化への対応が進行中",
  ],
  related: ["sansan", "smarthr", "notion-japan"],
});

const NOTION: CompanyDetail = makeDetail(companyById("notion-japan"), {
  mission: "思考・ドキュメント・プロジェクト管理をひとつのワークスペースに。",
  about: "Notion Japanは、オールインワンワークスペースツール「Notion」の日本法人。AIライティング補助・データベース・プロジェクト管理機能を統合したプロダクトで、スタートアップから大企業まで幅広く採用されている。Series Cで急成長中のグローバル企業の日本チームとして、少数精鋭での市場開拓フェーズにある。",
  established: "2023年（日本法人）",
  ceo: "Ivan Zhao（グローバルCEO）",
  capital: "非公開（Series C）",
  hq: "東京都渋谷区",
  url: "notion.so/ja-jp",
  opinion_fit: [
    "グローバルで高い認知度を持つプロダクトで、日本市場の立ち上げを担える",
    "少数精鋭の日本チームで、大きな裁量を持って働ける",
    "フルリモート・副業OKで、生産性重視のカルチャー",
  ],
  opinion_care: [
    "英語でのグローバルコミュニケーションが必要",
    "日本法人は小規模（100名以下）で、ポジション数が限られる",
    "親会社の方針変更が日本チームの事業に影響することがある",
  ],
  related: ["hubspot-japan", "datadog-japan", "kubell"],
});

// ─── Map & Getter ─────────────────────────────────────────────────────────────

const DETAILS: Record<string, CompanyDetail> = {
  layerx: LAYERX,
  smarthr: SMARTHR,
  "hubspot-japan": HUBSPOT,
  "salesforce-japan": SALESFORCE,
  ubie: UBIE,
  freee: FREEE,
  sansan: SANSAN,
  "money-forward": MONEY_FORWARD,
  "pksha-technology": PKSHA,
  "datadog-japan": DATADOG,
  kubell: KUBELL,
  "notion-japan": NOTION,
};

export function getCompanyDetail(c: Company): CompanyDetail {
  return DETAILS[c.id] ?? makeDetail(c);
}

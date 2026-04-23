import type { Company } from "../companies/mockCompanies";
import { MOCK_COMPANIES } from "../companies/mockCompanies";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PositionMember = {
  initial: string;
  gradient: string;
  name: string;
  catch: string;
  period: string;
  date: string;
  status: "current" | "moved" | "alumni";
  status_label: string;
  is_mentor: boolean;
};

export type SelectionStep = {
  step: string;
  name: string;
  meta: string;
};

export type BenefitRow = {
  key: string;
  value: string;
};

export type Job = {
  id: string;
  company_id: string;
  role: string;
  dept: string;
  employment_type: string;
  location: string;
  work_style: string;
  salary_min: number;
  salary_max: number;
  experience: string;
  tags: string[];
  highlight: string;
  updated_days_ago: number;
  is_new: boolean;
  dept_members: number;
  member_avatars: { initial: string; gradient: string }[];
  // detail
  overview: string;
  main_tasks: string[];
  required_skills: string[];
  preferred_skills: string[];
  benefits: BenefitRow[];
  selection_flow: SelectionStep[];
  selection_note: string;
  position_members: PositionMember[];
  related_article_title: string;
  related_article_excerpt: string;
};

// ─── Avatar gradient palette ──────────────────────────────────────────────────

const G = [
  "linear-gradient(135deg, #002366, #3B5FD9)",
  "linear-gradient(135deg, #34D399, #059669)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #0EA5E9, #0369A1)",
  "linear-gradient(135deg, #FB923C, #EA580C)",
  "linear-gradient(135deg, #4ADE80, #16A34A)",
];

// ─── Mock jobs ────────────────────────────────────────────────────────────────

export const MOCK_JOBS: Job[] = [
  // ── LayerX ────────────────────────────────────────────────────────────────
  {
    id: "layerx-pdm-bakuraku",
    company_id: "layerx",
    role: "プロダクトマネージャー（バクラク事業部）",
    dept: "PdM / PM",
    employment_type: "正社員",
    location: "東京（フルリモート可）",
    work_style: "フルリモート",
    salary_min: 800,
    salary_max: 1300,
    experience: "経験3年以上",
    tags: ["フルリモート", "東京", "フレックス", "経験3年以上"],
    highlight: "FinTechユニコーン。Fact & Logicの文化と、週5で顧客に会うPdM制度が特徴。プロダクト思考を磨きたい方へ。",
    updated_days_ago: 1,
    is_new: true,
    dept_members: 4,
    member_avatars: [
      { initial: "田", gradient: G[0] },
      { initial: "佐", gradient: G[2] },
      { initial: "山", gradient: G[1] },
    ],
    overview: "バクラクは経費精算・請求書処理・法人カードを束ねるFinTech SaaSです。今回募集するPdMには、CEO直下で意思決定に関わりながらプロダクトの中核を担う役割を期待しています。",
    main_tasks: [
      "プロダクト戦略の策定：事業計画と連動したロードマップ設計",
      "ユーザーリサーチ・要求定義：定性・定量の両面からユーザー課題を把握",
      "開発チームとの連携：エンジニア・デザイナーと協働し、優先順位を決定",
      "KPI設計と効果測定：機能リリース後の成果を測定し、次の意思決定に活かす",
    ],
    required_skills: [
      "SaaS / Webサービスでの PdM・PO・PjM いずれかの経験 3年以上",
      "ユーザーリサーチ・データ分析を通じた要求定義の経験",
      "エンジニア・デザイナーとの協働経験",
      "事業数値・KPIへの責任を持った経験",
    ],
    preferred_skills: [
      "0→1のプロダクト立ち上げ経験",
      "FinTech・バックオフィス領域の知見",
      "エンタープライズ向けSaaSのPdM経験",
      "SQL・Looker・BigQuery等のデータ分析ツール知見",
    ],
    benefits: [
      { key: "給与", value: "¥800-1,300万（経験・スキルに応じて決定）" },
      { key: "勤務時間", value: "フレックス制（コアタイムなし）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、有給・夏季・年末年始" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、リモート手当、書籍購入補助、健康診断" },
      { key: "副業", value: "業務に支障がない範囲で可（申請制）" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分・オンライン" },
      { step: "STEP 2", name: "書類選考", meta: "3-5営業日" },
      { step: "STEP 3", name: "1次面接", meta: "PdM部長" },
      { step: "STEP 4", name: "課題・最終", meta: "課題＋CEO面接" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "標準で2-3週間で内定までご案内します。カジュアル面談はいつでも可能です。",
    position_members: [
      { initial: "中", gradient: G[4], name: "中村 由紀", catch: "「やる」と決めたら翌週には動き出す、意思決定のスピード", period: "PdM 在籍1年", date: "2026.03.28", status: "current", status_label: "現役・PdM", is_mentor: true },
      { initial: "田", gradient: G[0], name: "田中 翔太", catch: "プロダクトを軸に事業開発まで広げる、職域を超える挑戦", period: "PdM 在籍2年", date: "2025.10.12", status: "moved", status_label: "現役・事業開発へ異動", is_mentor: false },
      { initial: "渡", gradient: G[5], name: "渡辺 美穂", catch: "「2年で得たプロダクト思考が、CPOになる礎になった」", period: "PdM 在籍2年", date: "2026.01.15", status: "alumni", status_label: "OBOG・現在は他社CPO", is_mentor: true },
    ],
    related_article_title: "LayerXが描くFinTechの次——バクラクが目指す「経費ゼロ企業」",
    related_article_excerpt: "バクラク事業部CTOに聞く、AI×FinTechの最前線とプロダクト開発の文化。",
  },
  {
    id: "layerx-eng-backend",
    company_id: "layerx",
    role: "バックエンドエンジニア（バクラク基盤）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京（フルリモート可）",
    work_style: "フルリモート",
    salary_min: 900,
    salary_max: 1500,
    experience: "経験4年以上",
    tags: ["フルリモート", "東京", "Go", "AWS", "経験4年以上"],
    highlight: "Go + AWS でバクラク基盤を支えるバックエンドエンジニア。高負荷環境での設計経験が活かせます。",
    updated_days_ago: 1,
    is_new: true,
    dept_members: 8,
    member_avatars: [
      { initial: "鈴", gradient: G[0] },
      { initial: "伊", gradient: G[7] },
      { initial: "木", gradient: G[3] },
    ],
    overview: "バクラクの請求書・経費精算プラットフォームを支えるバックエンド基盤チームです。月間数百万件のドキュメント処理を安定稼働させるための設計・実装・改善が中心業務です。",
    main_tasks: [
      "OCR・AI連携基盤のバックエンドAPI設計・実装",
      "高トラフィック下でのパフォーマンス改善・スケーリング",
      "マイクロサービス間の整合性設計とデータパイプライン構築",
      "コードレビュー・技術的負債の解消",
    ],
    required_skills: [
      "Go言語でのサーバーサイド開発経験 3年以上",
      "AWS（ECS / RDS / SQS等）を用いたインフラ設計・運用経験",
      "RDB設計・パフォーマンスチューニングの経験",
      "マイクロサービスアーキテクチャの知識",
    ],
    preferred_skills: [
      "DDD・クリーンアーキテクチャの実践経験",
      "gRPC・Protocol Buffersを使ったサービス間通信",
      "Terraform等によるIaC経験",
      "高負荷・高可用性システムの設計・運用経験",
    ],
    benefits: [
      { key: "給与", value: "¥900-1,500万（経験・スキルに応じて決定）" },
      { key: "勤務時間", value: "フレックス制（コアタイムなし）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、有給・夏季・年末年始" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、リモート手当、技術書籍補助、カンファレンス参加費支援" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分・オンライン" },
      { step: "STEP 2", name: "コーディング選考", meta: "オンライン課題" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "最終面接", meta: "CTO" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "コーディング課題は自宅で3時間程度。時間に余裕のある週末でも可能です。",
    position_members: [
      { initial: "鈴", gradient: G[0], name: "鈴木 拓海", catch: "「型安全なGoコードがそのままビジネス価値になる」", period: "エンジニア 在籍2年", date: "2026.02.10", status: "current", status_label: "現役・バックエンド", is_mentor: true },
      { initial: "伊", gradient: G[7], name: "伊藤 健", catch: "スタートアップの高速開発と品質の両立を学んだ3年間", period: "エンジニア 在籍3年", date: "2025.08.20", status: "alumni", status_label: "OBOG・現在は独立", is_mentor: false },
    ],
    related_article_title: "LayerXエンジニアリング文化——Fact & Logicがコードにも宿る",
    related_article_excerpt: "CTOの松本さんが語る、バクラクを支える技術選定と組織設計の哲学。",
  },

  // ── SmartHR ────────────────────────────────────────────────────────────────
  {
    id: "smarthr-eng-fullstack",
    company_id: "smarthr",
    role: "フルスタックエンジニア（人事プラットフォーム）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京",
    work_style: "フルリモート",
    salary_min: 900,
    salary_max: 1400,
    experience: "経験5年以上",
    tags: ["フルリモート", "東京", "Ruby", "AWS", "経験5年以上"],
    highlight: "国内シェアNo.1のクラウド人事労務ソフト。プラットフォーム化が加速中で、技術的にも面白いフェーズ。",
    updated_days_ago: 4,
    is_new: false,
    dept_members: 15,
    member_avatars: [
      { initial: "山", gradient: G[0] },
      { initial: "高", gradient: G[1] },
      { initial: "石", gradient: G[2] },
    ],
    overview: "SmartHRは労務・人事・タレントマネジメントをひとつのプラットフォームに統合するHR SaaSです。エンジニアとして新機能開発・既存機能改善・技術的負債の解消まで幅広く担います。",
    main_tasks: [
      "Ruby on Rails / React を使った機能開発・API設計",
      "既存システムのリファクタリングとパフォーマンス改善",
      "コードレビューと品質向上への取り組み",
      "デザイナー・PdMと協力した仕様策定",
    ],
    required_skills: [
      "Ruby on RailsまたはTypeScript/Reactでの開発経験 5年以上",
      "REST APIの設計・実装経験",
      "RDB設計・SQLの実用的な知識",
      "チームでのアジャイル開発経験",
    ],
    preferred_skills: [
      "大規模Railsアプリケーションの保守・改善経験",
      "AWSを使ったインフラ構築・運用経験",
      "HRドメイン（労務・人事制度）の知識",
      "OSS活動または技術記事の執筆経験",
    ],
    benefits: [
      { key: "給与", value: "¥900-1,400万（スキルに応じて決定）" },
      { key: "勤務時間", value: "フレックス制（コアタイム10-15時）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、有給休暇20日〜" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、住宅補助、育児・介護サポート、書籍補助" },
      { key: "時短勤務", value: "子育て中の方向けに6h勤務対応" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分・オンライン" },
      { step: "STEP 2", name: "技術課題", meta: "GitHubで提出" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "最終面接", meta: "VP of Engineering" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "技術課題は2-3時間程度。Githubリポジトリで提出いただきます。",
    position_members: [
      { initial: "山", gradient: G[0], name: "山田 敦", catch: "「RailsとReactを行き来しながら、ユーザーに近い場所で開発できる」", period: "エンジニア 在籍1年半", date: "2026.01.20", status: "current", status_label: "現役・フルスタック", is_mentor: true },
      { initial: "高", gradient: G[1], name: "高橋 美咲", catch: "育児とエンジニアリングを両立できた理由", period: "エンジニア 在籍3年", date: "2025.09.15", status: "current", status_label: "現役・時短勤務", is_mentor: false },
      { initial: "石", gradient: G[2], name: "石井 大輔", catch: "SmartHRで鍛えたRailsスキルでSREに転身", period: "エンジニア 在籍4年", date: "2025.06.01", status: "alumni", status_label: "OBOG・現在は他社SRE", is_mentor: true },
    ],
    related_article_title: "SmartHRエンジニアリングの現在地——160名組織での開発文化",
    related_article_excerpt: "VPoEの橋本さんが語る、急成長期の技術的意思決定と組織設計。",
  },
  {
    id: "smarthr-csm",
    company_id: "smarthr",
    role: "カスタマーサクセスマネージャー（エンタープライズ）",
    dept: "カスタマーサクセス",
    employment_type: "正社員",
    location: "東京",
    work_style: "フルリモート",
    salary_min: 700,
    salary_max: 1100,
    experience: "経験3年以上",
    tags: ["フルリモート", "東京", "フレックス", "エンタープライズ", "経験3年以上"],
    highlight: "労務DXのリーダー企業でエンタープライズCSMを担当。大企業の人事変革を伴走できる希少ポジション。",
    updated_days_ago: 4,
    is_new: false,
    dept_members: 9,
    member_avatars: [
      { initial: "林", gradient: G[5] },
      { initial: "岡", gradient: G[3] },
      { initial: "藤", gradient: G[4] },
    ],
    overview: "エンタープライズ顧客（従業員1,000名以上）を担当するCSMポジションです。導入後のオンボーディングから定着・拡大まで、長期的なパートナーとして顧客の成功を支えます。",
    main_tasks: [
      "担当企業の定期ミーティング・ヘルスチェック・改善提案",
      "オンボーディング計画の立案と実行支援",
      "活用データを元にしたアップセル・クロスセルの提案",
      "VOCの収集・プロダクトフィードバックの社内展開",
    ],
    required_skills: [
      "SaaS企業でのCSM・アカウントマネージャー経験 3年以上",
      "エンタープライズ向けの導入支援・プロジェクト管理経験",
      "顧客のKPI管理・定量的な成果測定の経験",
      "社内外ステークホルダーとの調整力",
    ],
    preferred_skills: [
      "HRTech・労務・人事領域の知識",
      "Salesforce・Gainsightの使用経験",
      "英語でのコミュニケーション（グローバル展開対応）",
      "データ分析（SQL・BIツール）の経験",
    ],
    benefits: [
      { key: "給与", value: "¥700-1,100万" },
      { key: "勤務時間", value: "フレックス制（コアタイム10-15時）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、住宅補助、育児サポート" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分・オンライン" },
      { step: "STEP 2", name: "書類選考", meta: "3営業日" },
      { step: "STEP 3", name: "1次面接", meta: "CSM部長" },
      { step: "STEP 4", name: "ケース面接・最終", meta: "VP＋事例発表" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "ケース面接では実際の顧客課題を題材に30分プレゼンをお願いします。",
    position_members: [
      { initial: "林", gradient: G[5], name: "林 奈緒美", catch: "大企業の変革を支えるCSMとして、毎日学びがある", period: "CSM 在籍2年", date: "2026.02.28", status: "current", status_label: "現役・エンタープライズCSM", is_mentor: true },
      { initial: "岡", gradient: G[3], name: "岡田 誠", catch: "CSMからPdMへ、ユーザー理解の深さが武器になった", period: "CSM 在籍3年", date: "2025.11.10", status: "moved", status_label: "現役・PdMへ異動", is_mentor: false },
    ],
    related_article_title: "SmartHR CSMの仕事——3,000社の人事変革を伴走する",
    related_article_excerpt: "エンタープライズCSMが語る、大企業の労務DX推進に必要なこと。",
  },

  // ── HubSpot Japan ─────────────────────────────────────────────────────────
  {
    id: "hubspot-solutions-engineer",
    company_id: "hubspot-japan",
    role: "Solutions Engineer",
    dept: "営業",
    employment_type: "正社員",
    location: "東京（フルリモート可）",
    work_style: "フルリモート",
    salary_min: 850,
    salary_max: 1200,
    experience: "経験3年以上",
    tags: ["フルリモート", "東京", "外資", "英語使用", "経験3年以上"],
    highlight: "米国本社のCRM/MA SaaS。日本オフィスはフルリモート前提、グローバルとの連携が日常的。テクニカルな提案力が活きます。",
    updated_days_ago: 3,
    is_new: false,
    dept_members: 3,
    member_avatars: [
      { initial: "林", gradient: G[5] },
      { initial: "田", gradient: G[3] },
      { initial: "中", gradient: G[4] },
    ],
    overview: "HubSpotのSolutions Engineerは、技術的な観点から顧客の課題を解決するプリセールス・ポストセールスの専門職です。日本の中堅・大企業向けにCRM/MAのデモ・POC・導入設計を担当します。",
    main_tasks: [
      "技術的なデモ・POC設計と顧客プレゼンテーション",
      "RFP対応・提案書作成における技術パート担当",
      "導入プロジェクトのキックオフ・設計支援",
      "社内AEとの連携、グローバルチームへの情報共有",
    ],
    required_skills: [
      "SaaS企業でのプリセールス / Solutions Engineer経験 3年以上",
      "CRM・MA・SFA等のビジネスアプリケーション知識",
      "技術的なデモ・提案ができるコミュニケーション力",
      "英語でのビジネスコミュニケーション（読み書き）",
    ],
    preferred_skills: [
      "HubSpot製品の使用・導入経験",
      "API連携・Webhookの技術知識",
      "プロジェクトマネジメント経験",
      "英語での会議・プレゼン経験",
    ],
    benefits: [
      { key: "給与", value: "¥850-1,200万（+ 業績賞与）" },
      { key: "勤務時間", value: "フレックス制（コアタイムなし）" },
      { key: "休日休暇", value: "完全週休2日制、年20日有給（入社即取得可）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "外資系水準の社会保険、株式報酬（RSU）、学習補助" },
      { key: "副業", value: "利益相反がなければ可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "HRスクリーニング", meta: "30分・英語/日本語" },
      { step: "STEP 2", name: "ヒアリング面接", meta: "マネージャー" },
      { step: "STEP 3", name: "テクニカルデモ", meta: "30分プレゼン" },
      { step: "STEP 4", name: "最終面接", meta: "シニアディレクター" },
      { step: "STEP 5", name: "内定", meta: "オファーレター" },
    ],
    selection_note: "テクニカルデモでは架空の顧客シナリオに基づき、HubSpotの機能を使って提案いただきます。",
    position_members: [
      { initial: "林", gradient: G[5], name: "林 誠一郎", catch: "グローバルSaaSで働くことで、視野が一気に広がった", period: "SE 在籍2年", date: "2026.03.05", status: "current", status_label: "現役・SE", is_mentor: true },
      { initial: "田", gradient: G[3], name: "田村 京", catch: "外資SaaS×プリセールスのキャリアパスを語る", period: "SE 在籍1年半", date: "2025.12.01", status: "alumni", status_label: "OBOG・現在は国内SaaS PM", is_mentor: true },
    ],
    related_article_title: "HubSpot Japanで働くということ——グローバルSaaSの日本拠点リアル",
    related_article_excerpt: "日本チームのカントリーマネージャーが語る、外資SaaSで成長するために必要なこと。",
  },

  // ── Salesforce Japan ──────────────────────────────────────────────────────
  {
    id: "salesforce-ae-enterprise",
    company_id: "salesforce-japan",
    role: "エンタープライズ営業（AE）",
    dept: "営業",
    employment_type: "正社員",
    location: "東京",
    work_style: "ハイブリッド",
    salary_min: 900,
    salary_max: 1800,
    experience: "経験5年以上",
    tags: ["ハイブリッド", "東京", "外資", "エンタープライズ", "経験5年以上"],
    highlight: "世界No.1 CRM。大企業のDXを推進するAEポジション。インセンティブ込みで年収2000万超も可能。",
    updated_days_ago: 20,
    is_new: false,
    dept_members: 22,
    member_avatars: [
      { initial: "松", gradient: G[0] },
      { initial: "中", gradient: G[4] },
      { initial: "村", gradient: G[2] },
    ],
    overview: "Fortune 500クラスの日本企業に対し、Salesforce製品群（Sales Cloud / Service Cloud / Einstein等）を活用したDX提案を行うエンタープライズAEです。顧客の経営課題を起点に、長期的な関係構築を担います。",
    main_tasks: [
      "ターゲット企業へのアウトバウンド営業・関係構築",
      "経営層・IT部門・現場ユーザーを巻き込んだ提案活動",
      "パートナー企業（SIer）と連携したソリューション設計",
      "年間売上目標（ARR）の達成と更新・拡大",
    ],
    required_skills: [
      "法人向けIT/SaaSの営業経験 5年以上",
      "エンタープライズ向け商談（稟議・複数ステークホルダー調整）の経験",
      "数億円規模の案件管理経験",
      "英語でのコミュニケーション（社内会議・レポート）",
    ],
    preferred_skills: [
      "Salesforce製品の営業・導入経験",
      "SIerとの協業・パートナーセールス経験",
      "経営課題のコンサルティング経験",
      "金融・製造・流通いずれかの業界知識",
    ],
    benefits: [
      { key: "給与", value: "¥900-1,800万（+ 業績インセンティブ）" },
      { key: "勤務時間", value: "フレックス制" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、年20日有給" },
      { key: "勤務地", value: "汐留シティセンター35F（ハイブリッド）" },
      { key: "福利厚生", value: "RSU/ESPP（持株制度）、医療保険拡充、Wellbeing手当" },
      { key: "副業", value: "利益相反がなければ可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "HRスクリーニング", meta: "30分" },
      { step: "STEP 2", name: "ヒアリング面接", meta: "セールスマネージャー" },
      { step: "STEP 3", name: "ロールプレイ", meta: "模擬商談30分" },
      { step: "STEP 4", name: "最終面接", meta: "VP of Sales" },
      { step: "STEP 5", name: "内定", meta: "オファーレター" },
    ],
    selection_note: "ロールプレイでは架空企業への提案シナリオを用意します。事前資料をお送りします。",
    position_members: [
      { initial: "松", gradient: G[0], name: "松下 龍之介", catch: "インセンティブ込みで1,500万を達成した1年目の話", period: "AE 在籍1年", date: "2026.03.10", status: "current", status_label: "現役・AE", is_mentor: false },
      { initial: "村", gradient: G[2], name: "村上 真理子", catch: "外資トップセールスから国内スタートアップCSOへ", period: "AE 在籍4年", date: "2025.07.20", status: "alumni", status_label: "OBOG・現在はスタートアップCSO", is_mentor: true },
    ],
    related_article_title: "Salesforce Japanのエンタープライズ営業とは何か",
    related_article_excerpt: "世界最大のCRMベンダーで大企業DXを推進するAEのリアルな1日。",
  },

  // ── Ubie ──────────────────────────────────────────────────────────────────
  {
    id: "ubie-backend-engineer",
    company_id: "ubie",
    role: "バックエンドエンジニア（AI問診基盤）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "全国どこでも",
    work_style: "フルリモート",
    salary_min: 800,
    salary_max: 1400,
    experience: "経験3年以上",
    tags: ["フルリモート", "全国どこでも", "Go", "GCP", "経験3年以上"],
    highlight: "AI問診のヘルステック。ホラクラシー型組織で、役職ではなく役割で動く文化。医療×テクノロジーの最前線。",
    updated_days_ago: 7,
    is_new: false,
    dept_members: 6,
    member_avatars: [
      { initial: "本", gradient: G[1] },
      { initial: "前", gradient: G[2] },
      { initial: "谷", gradient: G[3] },
    ],
    overview: "Ubieの「ユビー AI 問診」を支えるバックエンド基盤チームです。医療機関向けと患者向けの両サービスを支えるAPIサーバーおよびデータ処理基盤の設計・実装を担います。",
    main_tasks: [
      "Go言語によるAPIサーバーの設計・実装・運用",
      "医療データのセキュアな処理・ストレージ設計",
      "GCPを用いたインフラ構築・コスト最適化",
      "AIモデルチームとの連携によるML基盤の整備",
    ],
    required_skills: [
      "Go または Python でのサーバーサイド開発経験 3年以上",
      "クラウド（GCP / AWS / Azure）でのシステム構築経験",
      "RDB・NoSQLの設計・運用経験",
      "チームでのアジャイル開発経験",
    ],
    preferred_skills: [
      "医療・ヘルスケアシステムの開発経験",
      "機械学習モデルの組み込み・サービング経験",
      "Kubernetes / Cloud Runの運用経験",
      "HL7 FHIRなどの医療標準規格の知識",
    ],
    benefits: [
      { key: "給与", value: "¥800-1,400万（スキル・経験に応じて決定）" },
      { key: "勤務時間", value: "完全フレックス（コアタイムなし、週4日も相談可）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、有給休暇20日" },
      { key: "勤務地", value: "フルリモート（全国どこでもOK）" },
      { key: "福利厚生", value: "社会保険完備、在宅手当、書籍補助、カンファレンス費用全額支援" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分・オンライン" },
      { step: "STEP 2", name: "技術課題", meta: "GitHub提出" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "カルチャー面接", meta: "医師+エンジニア" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "カルチャー面接では医師とエンジニアが同席し、医療へのスタンスについてお話しします。",
    position_members: [
      { initial: "本", gradient: G[1], name: "本田 陽一", catch: "医療の「不確かさ」と向き合うシステム設計の面白さ", period: "エンジニア 在籍2年", date: "2026.01.30", status: "current", status_label: "現役・バックエンド", is_mentor: true },
      { initial: "前", gradient: G[2], name: "前田 彩花", catch: "ホラクラシー組織での意思決定スピードに驚いた", period: "エンジニア 在籍1年", date: "2025.10.05", status: "current", status_label: "現役・バックエンド", is_mentor: false },
      { initial: "谷", gradient: G[3], name: "谷口 雄介", catch: "週4日勤務で副業と両立しながら成長できた", period: "エンジニア 在籍3年", date: "2025.04.15", status: "alumni", status_label: "OBOG・現在は医療系スタートアップCTO", is_mentor: true },
    ],
    related_article_title: "Ubieのエンジニアリング文化——医師とエンジニアが同じテーブルで議論する",
    related_article_excerpt: "医療×テクノロジーの最前線で、Ubieが「ホラクラシー組織」を選んだ理由。",
  },

  // ── freee ─────────────────────────────────────────────────────────────────
  {
    id: "freee-csm",
    company_id: "freee",
    role: "カスタマーサクセスマネージャー（SMB）",
    dept: "カスタマーサクセス",
    employment_type: "正社員",
    location: "東京",
    work_style: "フルリモート",
    salary_min: 600,
    salary_max: 950,
    experience: "経験3年以上",
    tags: ["フルリモート", "東京", "フレックス", "経験3年以上"],
    highlight: "東証グロース上場のクラウド会計。スモールビジネスの成長を支えるミッション。SaaS CSのキャリアを伸ばせます。",
    updated_days_ago: 10,
    is_new: false,
    dept_members: 11,
    member_avatars: [
      { initial: "小", gradient: G[7] },
      { initial: "野", gradient: G[0] },
      { initial: "橋", gradient: G[5] },
    ],
    overview: "freeeの中小企業向けCSMポジションです。税理士・会計士・SMB経営者を顧客に持ち、クラウド会計の活用推進・更新・拡大を担います。",
    main_tasks: [
      "担当企業へのオンボーディング支援・定着率向上",
      "活用状況のモニタリングとプロアクティブなヘルスチェック",
      "アップセル・クロスセル提案の実施",
      "顧客フィードバックの収集・プロダクト改善への橋渡し",
    ],
    required_skills: [
      "SaaS企業でのCSM・カスタマーサポート経験 3年以上",
      "SMB顧客とのコミュニケーション・関係構築経験",
      "定量的なKPI管理・チャーン分析経験",
      "スプレッドシート・CRMツールの実務経験",
    ],
    preferred_skills: [
      "会計・経理・税務の基礎知識",
      "freeeまたは弥生などの会計SaaS使用経験",
      "SQLによるデータ抽出・分析経験",
      "カスタマーサクセスプラットフォーム（Gainsight等）の使用経験",
    ],
    benefits: [
      { key: "給与", value: "¥600-950万（経験・スキルに応じて）" },
      { key: "勤務時間", value: "フレックス制（コアタイム10-15時）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、時短勤務対応、書籍・勉強会補助" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分" },
      { step: "STEP 2", name: "書類選考", meta: "3営業日" },
      { step: "STEP 3", name: "1次面接", meta: "CSMリード" },
      { step: "STEP 4", name: "最終面接", meta: "部長＋ケース発表" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "最終面接では担当顧客の仮想ヘルスチェック計画を発表いただきます（20分程度）。",
    position_members: [
      { initial: "小", gradient: G[7], name: "小林 奈々", catch: "「会計の民主化」に共感してJoin。毎日顧客の変化を感じる仕事", period: "CSM 在籍2年", date: "2026.02.15", status: "current", status_label: "現役・SMB CSM", is_mentor: true },
      { initial: "橋", gradient: G[5], name: "橋本 隆志", catch: "freeeのCSMからPdMへ、顧客理解がそのまま武器になった", period: "CSM 在籍3年", date: "2025.09.01", status: "moved", status_label: "現役・PdMへ異動", is_mentor: true },
    ],
    related_article_title: "freee CSMの仕事——スモールビジネスの変革を最前線で支える",
    related_article_excerpt: "日本中の中小企業をバックオフィスから変えていくfreeeのCSMが語る、仕事の醍醐味。",
  },
  {
    id: "freee-engineer-platform",
    company_id: "freee",
    role: "プラットフォームエンジニア",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京",
    work_style: "フルリモート",
    salary_min: 850,
    salary_max: 1300,
    experience: "経験4年以上",
    tags: ["フルリモート", "東京", "Ruby", "Kubernetes", "経験4年以上"],
    highlight: "会計SaaSのインフラ基盤をKubernetesとRubyで支えるプラットフォームエンジニア。信頼性とスケールを両立する仕事。",
    updated_days_ago: 10,
    is_new: false,
    dept_members: 7,
    member_avatars: [
      { initial: "野", gradient: G[0] },
      { initial: "坂", gradient: G[4] },
      { initial: "長", gradient: G[1] },
    ],
    overview: "freeeのプラットフォームチームは、会計・人事・請求書SaaSを支えるインフラ基盤の設計・構築・運用を担います。開発者体験（DX）の向上とシステム信頼性の向上が主なミッションです。",
    main_tasks: [
      "Kubernetes / GKE クラスターの設計・運用・最適化",
      "CI/CDパイプラインの整備と開発生産性向上",
      "可観測性基盤（Datadog / OpenTelemetry）の構築",
      "セキュリティ・コンプライアンス要件への対応",
    ],
    required_skills: [
      "Kubernetes を用いたコンテナオーケストレーションの実務経験 3年以上",
      "GCP / AWSいずれかのクラウドインフラ構築・運用経験",
      "Terraformまたは類似IaCツールの使用経験",
      "監視・ログ基盤の設計・運用経験",
    ],
    preferred_skills: [
      "RubyまたはGoでのツール・スクリプト開発経験",
      "SREとしての信頼性向上施策（SLO/SLI設計等）の経験",
      "セキュリティ（ISMS / SOC 2等）の知識",
      "OSS（Kubernetes関連）へのコントリビューション経験",
    ],
    benefits: [
      { key: "給与", value: "¥850-1,300万" },
      { key: "勤務時間", value: "フレックス制" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、カンファレンス参加費全額支援、書籍補助" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分" },
      { step: "STEP 2", name: "技術課題", meta: "インフラ設計課題" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "最終面接", meta: "VPoE" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "技術課題ではKubernetesを使った設計課題（ドキュメント提出）をお願いします。",
    position_members: [
      { initial: "野", gradient: G[0], name: "野中 康平", catch: "「インフラは縁の下の力持ち」から「開発者体験の設計者」へ", period: "インフラ 在籍3年", date: "2026.01.10", status: "current", status_label: "現役・プラットフォームEng", is_mentor: true },
    ],
    related_article_title: "freeeのインフラ基盤——Kubernetes移行と開発者体験向上の5年間",
    related_article_excerpt: "VPoEが振り返る、freeeのインフラ近代化とプラットフォームチームの変遷。",
  },

  // ── Sansan ────────────────────────────────────────────────────────────────
  {
    id: "sansan-pdm",
    company_id: "sansan",
    role: "プロダクトマネージャー（Sansan事業部）",
    dept: "PdM / PM",
    employment_type: "正社員",
    location: "東京",
    work_style: "ハイブリッド",
    salary_min: 750,
    salary_max: 1200,
    experience: "経験3年以上",
    tags: ["ハイブリッド", "東京", "フレックス", "経験3年以上"],
    highlight: "名刺DXから請求書・契約書管理へ拡張する東証プライム企業。BtoB SaaSのPdMとして幅広いプロダクト経験が積めます。",
    updated_days_ago: 18,
    is_new: false,
    dept_members: 5,
    member_avatars: [
      { initial: "加", gradient: G[4] },
      { initial: "富", gradient: G[3] },
      { initial: "清", gradient: G[1] },
    ],
    overview: "Sansanのコア製品「Sansan」（法人向け名刺管理・顧客データベース）のPdMです。CRM連携・AI機能・エンタープライズ向けカスタマイズなど、複数の開発テーマを担当します。",
    main_tasks: [
      "ロードマップ策定・機能仕様定義・優先順位付け",
      "エンジニア・デザイナー・CSとの協働による機能開発",
      "市場調査・競合分析・ユーザーインタビュー",
      "リリース後の効果測定とイテレーション",
    ],
    required_skills: [
      "SaaS企業でのPdM経験 3年以上",
      "BtoB領域の業務フロー・顧客理解",
      "ユーザーリサーチ・仕様定義の実務経験",
      "エンジニア・デザイナーとの協働経験",
    ],
    preferred_skills: [
      "名刺管理・SFA・CRM領域の知識",
      "エンタープライズ向けSaaS開発経験",
      "SQL・BIツールを用いたデータ分析経験",
      "アジャイル/スクラムの実践経験",
    ],
    benefits: [
      { key: "給与", value: "¥750-1,200万" },
      { key: "勤務時間", value: "フレックス制（コアタイム10-16時）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "渋谷（ハイブリッド）" },
      { key: "福利厚生", value: "社会保険完備、書籍補助、副業可" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分" },
      { step: "STEP 2", name: "書類選考", meta: "3営業日" },
      { step: "STEP 3", name: "1次面接", meta: "PdMリード" },
      { step: "STEP 4", name: "最終面接", meta: "事業部長" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "1次面接では過去のプロダクト開発経験を詳しくお聞きします。",
    position_members: [
      { initial: "加", gradient: G[4], name: "加藤 瞬", catch: "「名刺からCRMへ」拡張するプロダクトの面白さ", period: "PdM 在籍2年", date: "2026.02.01", status: "current", status_label: "現役・PdM", is_mentor: true },
      { initial: "富", gradient: G[3], name: "富田 沙織", catch: "BtoB PdMとして上場企業で得たプロダクト戦略の全体像", period: "PdM 在籍4年", date: "2025.05.10", status: "alumni", status_label: "OBOG・現在はVC", is_mentor: false },
    ],
    related_article_title: "Sansanプロダクト戦略——名刺管理から顧客データプラットフォームへ",
    related_article_excerpt: "CPO目黒氏が語る、SansanがBtoBデータプラットフォームへ進化する道筋。",
  },

  // ── マネーフォワード ────────────────────────────────────────────────────────
  {
    id: "moneyforward-engineer-cloud",
    company_id: "money-forward",
    role: "バックエンドエンジニア（MFクラウド会計）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京",
    work_style: "ハイブリッド",
    salary_min: 800,
    salary_max: 1300,
    experience: "経験4年以上",
    tags: ["ハイブリッド", "東京", "Ruby", "AWS", "経験4年以上"],
    highlight: "東証プライム上場のFinTechインフラ。会計・給与・経費が揃うプラットフォームのバックエンドを支える。",
    updated_days_ago: 14,
    is_new: false,
    dept_members: 12,
    member_avatars: [
      { initial: "原", gradient: G[6] },
      { initial: "竹", gradient: G[1] },
      { initial: "上", gradient: G[4] },
    ],
    overview: "マネーフォワードクラウドのコアプロダクト「MFクラウド会計」のバックエンド開発・運用を担います。法人向けの大規模会計データを扱うシステムで、信頼性と拡張性の両立が求められます。",
    main_tasks: [
      "Ruby on Rails によるAPI開発・機能追加",
      "大規模データ処理の最適化・パフォーマンス改善",
      "マイクロサービス化に伴うアーキテクチャ改善",
      "セキュリティ要件対応とコードレビュー",
    ],
    required_skills: [
      "Ruby on Rails でのサーバーサイド開発経験 4年以上",
      "AWS（EC2 / RDS / S3等）を用いた運用経験",
      "大規模DBのパフォーマンスチューニング経験",
      "チームでのアジャイル開発経験",
    ],
    preferred_skills: [
      "会計・財務システムの開発経験",
      "マイクロサービスアーキテクチャの設計経験",
      "Kubernetes / Docker の運用経験",
      "ISMS / セキュリティ監査対応経験",
    ],
    benefits: [
      { key: "給与", value: "¥800-1,300万" },
      { key: "勤務時間", value: "フレックス制" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（ハイブリッド）" },
      { key: "福利厚生", value: "社会保険完備、書籍補助、社内勉強会参加支援" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分" },
      { step: "STEP 2", name: "技術課題", meta: "オンライン課題" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "最終面接", meta: "CTO" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "技術課題はRails APIの設計・実装課題です（目安3時間）。",
    position_members: [
      { initial: "原", gradient: G[6], name: "原田 健太", catch: "上場企業のFinTechインフラで、大規模DBと向き合う醍醐味", period: "エンジニア 在籍3年", date: "2026.01.25", status: "current", status_label: "現役・バックエンド", is_mentor: true },
      { initial: "上", gradient: G[4], name: "上野 直美", catch: "Rubyを武器に会計SaaSエンジニアから機械学習エンジニアへ転身", period: "エンジニア 在籍4年", date: "2025.08.12", status: "alumni", status_label: "OBOG・現在はMLエンジニア", is_mentor: false },
    ],
    related_article_title: "マネーフォワードの開発文化——2,000名を超えても失わないもの",
    related_article_excerpt: "急成長期に入社したエンジニアが語る、組織拡大と技術品質の両立。",
  },

  // ── Datadog Japan ─────────────────────────────────────────────────────────
  {
    id: "datadog-enterprise-ae",
    company_id: "datadog-japan",
    role: "エンタープライズ営業（新規開拓）",
    dept: "営業",
    employment_type: "正社員",
    location: "東京（フルリモート可）",
    work_style: "フルリモート",
    salary_min: 900,
    salary_max: 1600,
    experience: "経験5年以上",
    tags: ["フルリモート", "東京", "外資", "DevOps", "経験5年以上"],
    highlight: "クラウド可観測性のグローバルリーダー。NASDAQ上場企業でエンタープライズ新規開拓を担う。インセンティブ込みで高収入を狙える。",
    updated_days_ago: 5,
    is_new: false,
    dept_members: 4,
    member_avatars: [
      { initial: "赤", gradient: G[2] },
      { initial: "橘", gradient: G[3] },
      { initial: "寺", gradient: G[5] },
    ],
    overview: "Datadogの日本エンタープライズチームで、大手製造・金融・IT企業に対するクラウド監視・可観測性プラットフォームの新規開拓を担います。",
    main_tasks: [
      "エンタープライズ企業へのアウトバウンド・インバウンド新規開拓",
      "技術部門・CTO/CDOへの提案・デモ実施",
      "POC（概念実証）の設計・支援",
      "ARR目標の達成とパイプライン管理",
    ],
    required_skills: [
      "IT/SaaS・インフラ領域の法人営業経験 5年以上",
      "エンタープライズ商談（複数ステークホルダー・稟議）の経験",
      "DevOps・クラウドの技術的な理解",
      "英語でのビジネスコミュニケーション",
    ],
    preferred_skills: [
      "監視・ログ・APM等のオブザーバビリティ製品の営業経験",
      "AWS / GCP / Azureのクラウドサービス知識",
      "Salesforceを使ったパイプライン管理経験",
      "金融・製造いずれかの業界知識",
    ],
    benefits: [
      { key: "給与", value: "¥900-1,600万（+ 業績インセンティブ）" },
      { key: "勤務時間", value: "フレックス制" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、年20日有給" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "RSU、医療保険拡充、学習補助、リモート手当" },
      { key: "副業", value: "利益相反がなければ可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "HRスクリーニング", meta: "30分" },
      { step: "STEP 2", name: "ヒアリング面接", meta: "セールスマネージャー" },
      { step: "STEP 3", name: "ロールプレイ", meta: "架空顧客への提案" },
      { step: "STEP 4", name: "最終面接", meta: "エリアVP" },
      { step: "STEP 5", name: "内定", meta: "オファーレター" },
    ],
    selection_note: "ロールプレイでは架空のエンタープライズ顧客シナリオを用意します。",
    position_members: [
      { initial: "赤", gradient: G[2], name: "赤坂 洋平", catch: "外資監視SaaSで学んだ「技術を売る」ではなく「価値を売る」こと", period: "AE 在籍2年", date: "2026.03.15", status: "current", status_label: "現役・エンタープライズAE", is_mentor: true },
      { initial: "橘", gradient: G[3], name: "橘 涼介", catch: "Datadogから次のキャリアへ——外資ITセールスの歩み方", period: "AE 在籍3年", date: "2025.11.20", status: "alumni", status_label: "OBOG・現在は国内スタートアップCRO", is_mentor: true },
    ],
    related_article_title: "Datadog Japanの営業チームとは——クラウドネイティブ時代の可観測性を売る",
    related_article_excerpt: "グローバルで急成長するDatadogで、日本市場の拡大を担うセールスチームのリアル。",
  },

  // ── kubell ─────────────────────────────────────────────────────────────────
  {
    id: "kubell-engineer-backend",
    company_id: "kubell",
    role: "バックエンドエンジニア（Chatwork）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京",
    work_style: "フルリモート",
    salary_min: 700,
    salary_max: 1100,
    experience: "経験3年以上",
    tags: ["フルリモート", "東京", "PHP", "Go", "経験3年以上"],
    highlight: "300万社が使うビジネスチャット。レガシーPHPをGoにマイグレーション中。技術的挑戦とユーザーへの影響が大きいフェーズ。",
    updated_days_ago: 8,
    is_new: false,
    dept_members: 7,
    member_avatars: [
      { initial: "福", gradient: G[0] },
      { initial: "久", gradient: G[1] },
      { initial: "安", gradient: G[4] },
    ],
    overview: "Chatworkのバックエンドチームは、300万社以上が利用するメッセージング基盤の改善・拡張を担います。現在レガシーPHPからGoへのマイグレーションが進行中で、技術的に挑戦的な局面です。",
    main_tasks: [
      "PHP / Go によるメッセージング基盤APIの開発・保守",
      "PHPからGoへのマイグレーション設計・実装",
      "高可用性・高スケーラビリティの設計",
      "パフォーマンス監視と障害対応",
    ],
    required_skills: [
      "PHP またはGoでのサーバーサイド開発経験 3年以上",
      "RDB / KVS の設計・運用経験",
      "AWSまたはGCPでのシステム運用経験",
      "大規模サービスの運用保守経験",
    ],
    preferred_skills: [
      "PHPからGoへの移行・リプレイス経験",
      "リアルタイムメッセージングシステム（WebSocket等）の知識",
      "Kubernetes / Docker の運用経験",
      "障害対応・オンコール対応の経験",
    ],
    benefits: [
      { key: "給与", value: "¥700-1,100万" },
      { key: "勤務時間", value: "フレックス制（コアタイムなし）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "社会保険完備、リモート手当、書籍補助" },
      { key: "副業", value: "申請制で可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "30分" },
      { step: "STEP 2", name: "技術課題", meta: "コーディング課題" },
      { step: "STEP 3", name: "技術面接", meta: "エンジニア×2名" },
      { step: "STEP 4", name: "最終面接", meta: "VPoE" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "技術課題は2時間程度のコーディングテストです。",
    position_members: [
      { initial: "福", gradient: G[0], name: "福山 健司", catch: "PHPレガシーコードと格闘しながら、300万社を支えているという誇り", period: "エンジニア 在籍2年", date: "2026.02.20", status: "current", status_label: "現役・バックエンド", is_mentor: true },
    ],
    related_article_title: "kubell（Chatwork）のエンジニアリング——レガシーから脱却する3年計画",
    related_article_excerpt: "CTOが語る、PHPからGoへのマイグレーション戦略と技術的負債との向き合い方。",
  },

  // ── Notion Japan ─────────────────────────────────────────────────────────
  {
    id: "notion-enterprise-cs",
    company_id: "notion-japan",
    role: "Enterprise Customer Success Manager",
    dept: "カスタマーサクセス",
    employment_type: "正社員",
    location: "東京（フルリモート可）",
    work_style: "フルリモート",
    salary_min: 800,
    salary_max: 1200,
    experience: "経験4年以上",
    tags: ["フルリモート", "東京", "外資", "英語使用", "経験4年以上"],
    highlight: "Series C / 評価額100億ドル超のグローバルSaaS。日本の大手企業向けNotionの定着・拡大を担うCSM。英語力が直接活かせる環境。",
    updated_days_ago: 2,
    is_new: true,
    dept_members: 2,
    member_avatars: [
      { initial: "北", gradient: G[0] },
      { initial: "南", gradient: G[5] },
    ],
    overview: "Notion Japanのエンタープライズチームで、日本の大手企業向けにNotionの導入・定着・拡大を支援するCSMです。日本本社はグローバルチームと密接に連携しながら動きます。",
    main_tasks: [
      "担当企業のNotion活用推進・定着支援",
      "オンボーディング・トレーニングの設計と実施",
      "アップセル・拡張提案と更新交渉",
      "グローバルCSチームとの連携・フィードバック共有",
    ],
    required_skills: [
      "SaaS企業でのCSM・アカウントマネジメント経験 4年以上",
      "エンタープライズ顧客との関係構築・導入支援経験",
      "英語でのビジネスコミュニケーション（会議・メール）",
      "データを活用した活用状況分析・改善提案経験",
    ],
    preferred_skills: [
      "Notion / Confluence / Asanaなどの生産性ツール活用経験",
      "日本の大企業（従業員5,000名以上）の組織文化理解",
      "グローバルチームとの協働経験",
      "プロジェクトマネジメント経験",
    ],
    benefits: [
      { key: "給与", value: "¥800-1,200万（+ 業績ボーナス）" },
      { key: "勤務時間", value: "フレックス制（コアタイムなし）" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）、年20日有給（入社即取得可）" },
      { key: "勤務地", value: "東京（フルリモート可）" },
      { key: "福利厚生", value: "RSU / 株式オプション、医療保険、学習補助" },
      { key: "副業", value: "利益相反がなければ可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "HRスクリーニング", meta: "30分・英語/日本語" },
      { step: "STEP 2", name: "ヒアリング面接", meta: "CSMマネージャー" },
      { step: "STEP 3", name: "プレゼン課題", meta: "架空顧客の活用計画" },
      { step: "STEP 4", name: "最終面接", meta: "Head of CS" },
      { step: "STEP 5", name: "内定", meta: "オファーレター" },
    ],
    selection_note: "プレゼン課題では架空の日本企業に対するNotionの活用計画を30分で発表いただきます。",
    position_members: [
      { initial: "北", gradient: G[0], name: "北村 梨花", catch: "グローバルSaaSで日本の働き方を変えていく、その手触り感", period: "CSM 在籍1年", date: "2026.03.20", status: "current", status_label: "現役・エンタープライズCSM", is_mentor: true },
    ],
    related_article_title: "Notion Japan——グローバルSaaSが日本市場を攻略するリアル",
    related_article_excerpt: "国内チームのゼロから100名を超えた企業がどう組織文化を築くか。Notion Japanの挑戦。",
  },

  // ── PKSHA Technology ──────────────────────────────────────────────────────
  {
    id: "pksha-ml-engineer",
    company_id: "pksha-technology",
    role: "機械学習エンジニア（LLMアプリ開発）",
    dept: "エンジニア",
    employment_type: "正社員",
    location: "東京",
    work_style: "ハイブリッド",
    salary_min: 900,
    salary_max: 1600,
    experience: "経験3年以上",
    tags: ["ハイブリッド", "東京", "Python", "LLM", "経験3年以上"],
    highlight: "東証グロース上場のAI企業。LLM/NLPを使ったエンタープライズ向けAIアプリケーション開発。裁量労働制で研究×実装両立。",
    updated_days_ago: 32,
    is_new: false,
    dept_members: 3,
    member_avatars: [
      { initial: "新", gradient: G[4] },
      { initial: "宮", gradient: G[0] },
      { initial: "浜", gradient: G[7] },
    ],
    overview: "PKSHAのLLMアプリチームでは、エンタープライズ顧客向けにLLMを活用した業務自動化・知識管理システムの開発を担います。研究者と実装エンジニアが同じチームで動く、珍しい環境です。",
    main_tasks: [
      "LLM（GPT-4 / Claude等）を活用したアプリケーションの設計・実装",
      "RAG・ファインチューニング・エージェントの研究・実装",
      "エンタープライズ顧客向けのAIシステム導入支援",
      "論文調査・社内での知識共有",
    ],
    required_skills: [
      "Pythonを使ったMLシステムの設計・実装経験 3年以上",
      "LLM / NLP関連の研究・実装経験",
      "機械学習モデルのサービング・MLOps経験",
      "論文実装・調査能力",
    ],
    preferred_skills: [
      "学術研究（修士・博士・査読付き論文）のバックグラウンド",
      "RAG・ベクターDB（Qdrant / Weaviate等）の実装経験",
      "LangChain / LlamaIndex等のフレームワーク使用経験",
      "エンタープライズ向けAIシステムの設計・実装経験",
    ],
    benefits: [
      { key: "給与", value: "¥900-1,600万（裁量労働制）" },
      { key: "勤務時間", value: "裁量労働制" },
      { key: "休日休暇", value: "完全週休2日制（土日祝）" },
      { key: "勤務地", value: "東京（ハイブリッド）" },
      { key: "福利厚生", value: "社会保険完備、論文投稿・カンファレンス費用支援、GPU環境提供" },
      { key: "副業", value: "研究活動は相談可" },
    ],
    selection_flow: [
      { step: "STEP 1", name: "カジュアル面談", meta: "研究者との対話" },
      { step: "STEP 2", name: "技術課題", meta: "LLMを使った課題" },
      { step: "STEP 3", name: "技術面接", meta: "研究者×エンジニア" },
      { step: "STEP 4", name: "最終面接", meta: "CTO" },
      { step: "STEP 5", name: "内定", meta: "条件提示" },
    ],
    selection_note: "技術課題ではLLMを活用したシステムの設計・実装（Pythonノートブック提出）をお願いします。",
    position_members: [
      { initial: "新", gradient: G[4], name: "新井 武史", catch: "「論文とプロダクトを同時に作れる」PKSHA独自の研究文化", period: "ML Engineer 在籍2年", date: "2026.01.05", status: "current", status_label: "現役・ML Engineer", is_mentor: true },
      { initial: "宮", gradient: G[0], name: "宮崎 理恵", catch: "PhD後の就職先にPKSHAを選んだ理由——アカデミアとの橋渡し", period: "ML Engineer 在籍3年", date: "2025.06.20", status: "alumni", status_label: "OBOG・現在は外資AIスタートアップ", is_mentor: false },
    ],
    related_article_title: "PKSHAのAI研究文化——アカデミアとプロダクトを繋ぐ組織設計",
    related_article_excerpt: "「人間とソフトウェアの共進化」を掲げるPKSHAが、研究者とエンジニアを同じチームに置く理由。",
  },
];

// ─── Filter constants ──────────────────────────────────────────────────────────

export const JOB_DEPTS = [
  "PdM / PM",
  "エンジニア",
  "営業",
  "カスタマーサクセス",
  "マーケティング",
  "デザイナー",
  "経営 / CxO",
  "コーポレート",
];

export const SALARY_PRESETS = [400, 500, 600, 700, 800, 1000, 1200, 1500];

export const WORK_STYLES = ["フルリモート", "ハイブリッド", "フレックス", "副業OK", "週4日勤務"];

export const JOB_LOCATIONS = ["全国どこでも", "東京", "大阪・関西", "名古屋", "福岡", "海外"];

// ─── Filter helpers ───────────────────────────────────────────────────────────

export type JobFilterParams = {
  dept?: string;
  salary?: string;
  work_style?: string;
  location?: string;
  industry?: string;
  sort?: string;
};

export function filterJobs(jobs: Job[], params: JobFilterParams): Job[] {
  let result = [...jobs];

  if (params.dept) {
    result = result.filter((j) => j.dept === params.dept);
  }
  if (params.salary) {
    const min = parseInt(params.salary, 10);
    if (!isNaN(min)) {
      result = result.filter((j) => j.salary_max >= min);
    }
  }
  if (params.work_style) {
    result = result.filter((j) => j.work_style === params.work_style || j.tags.includes(params.work_style!));
  }
  if (params.location) {
    result = result.filter((j) =>
      j.location.includes(params.location!) || (params.location === "全国どこでも" && j.location.includes("全国"))
    );
  }
  if (params.industry) {
    const companyIds = MOCK_COMPANIES
      .filter((c) => c.industry === params.industry)
      .map((c) => c.id);
    result = result.filter((j) => companyIds.includes(j.company_id));
  }

  if (params.sort === "salary") {
    result.sort((a, b) => b.salary_max - a.salary_max);
  } else {
    result.sort((a, b) => a.updated_days_ago - b.updated_days_ago);
  }

  return result;
}

export function getJobById(id: string): Job | undefined {
  return MOCK_JOBS.find((j) => j.id === id);
}

export function getJobsByCompany(companyId: string): Job[] {
  return MOCK_JOBS.filter((j) => j.company_id === companyId);
}

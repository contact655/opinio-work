export type CompanyType = "master" | "custom" | "anon";

export type Experience = {
  id: string;
  companyType: CompanyType;
  companyId?: string;        // master
  companyText?: string;      // custom
  companyAnonymized?: string; // anon
  displayCompanyName: string; // computed for display
  roleCategoryId: string;
  roleTitle?: string;
  startedAt: string;         // "YYYY-MM"
  endedAt?: string;          // "YYYY-MM", undefined = current
  isCurrent: boolean;
  description?: string;
};

export type SocialLinks = {
  twitter?: string;
  linkedin?: string;
  note?: string;
};

export type ProfileData = {
  name: string;
  location: string;
  ageRange: string;
  aboutMe: string;
  avatarColor: string;
  coverColor: string;
  experiences: Experience[];
  socialLinks: SocialLinks;
  email: string;
  visibility: "public" | "login_only" | "private";
};

export const LOCATIONS = [
  "東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府",
  "愛知県", "福岡県", "北海道", "海外", "非公開",
];

export const AGE_RANGES = [
  "20代前半", "20代後半", "30代前半", "30代後半", "40代", "50代以上", "非公開",
];

export const MOCK_PROFILE: ProfileData = {
  name: "田中 翔太",
  location: "東京都",
  ageRange: "30代前半",
  aboutMe:
    "リクルートで4年間営業を経験後、タイミーへ転職しPdM・エンタープライズ営業を経験。2024年よりLayerXにジョイン。Bakuraku事業のプロダクトマネージャーとして、企業の経費精算・請求書処理の自動化を推進しています。「業務の民主化」というビジョンに共感し、プロダクト・ビジネス両面から事業成長に貢献しています。",
  avatarColor: "linear-gradient(135deg, #002366, #3B5FD9)",
  coverColor: "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)",
  experiences: [
    {
      id: "exp-1",
      companyType: "master",
      companyId: "layerx",
      displayCompanyName: "株式会社LayerX",
      roleCategoryId: "product_manager",
      roleTitle: "プロダクトマネージャー（Bakuraku事業）",
      startedAt: "2024-04",
      isCurrent: true,
      description:
        "Bakuraku経費精算・Bakuraku請求書のPdMとして、企業の経費・経理業務を自動化するプロダクト開発を主導。エンタープライズ企業のオンボーディング改善とAI活用による処理自動化が主なミッション。",
    },
    {
      id: "exp-2",
      companyType: "custom",
      companyText: "株式会社タイミー",
      displayCompanyName: "株式会社タイミー",
      roleCategoryId: "enterprise_sales",
      roleTitle: "エンタープライズ営業（元PdM）",
      startedAt: "2020-04",
      endedAt: "2024-03",
      isCurrent: false,
      description:
        "最初の2年はPdMとしてタイミーキャリアプラスの新機能企画・要求定義を担当。その後エンタープライズ営業に異動し、大手企業向けの導入・展開を担当。スポットワーク市場の拡大期を両ポジションで経験。",
    },
    {
      id: "exp-3",
      companyType: "custom",
      companyText: "株式会社リクルート",
      displayCompanyName: "株式会社リクルート",
      roleCategoryId: "field_sales",
      roleTitle: "法人営業",
      startedAt: "2016-04",
      endedAt: "2020-03",
      isCurrent: false,
      description: "新卒入社。中堅・中小企業向けの広告営業を担当。3年目以降はチームマネジメントも経験。",
    },
  ],
  socialLinks: {
    twitter: "",
    linkedin: "",
    note: "",
  },
  email: "tanaka@example.com",
  visibility: "public",
};

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

export const LOCATIONS = [
  "東京都", "神奈川県", "埼玉県", "千葉県", "大阪府", "京都府",
  "愛知県", "福岡県", "北海道", "海外", "非公開",
];


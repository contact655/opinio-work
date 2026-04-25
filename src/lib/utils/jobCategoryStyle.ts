/**
 * 職種タグの色マッピング
 * job_category の文字列に対して部分一致で判定する
 */

type TagStyle = {
  background: string;
  color: string;
  border: string;
};

const CATEGORY_RULES: { keywords: string[]; style: TagStyle }[] = [
  {
    keywords: ["営業", "セールス", "フィールドセールス", "インサイドセールス", "BDR", "SDR"],
    style: { background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" },
  },
  {
    keywords: ["カスタマーサクセス", "CS", "CX"],
    style: { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" },
  },
  {
    keywords: ["エンジニア", "バックエンド", "フロントエンド", "QA", "ソリューションエンジニア", "SRE", "インフラ", "開発"],
    style: { background: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" },
  },
  {
    keywords: ["マーケティング", "マーケ", "広報", "PR"],
    style: { background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" },
  },
  {
    keywords: ["PdM", "プロダクトマネージャー", "事業開発", "BizDev", "プロダクト"],
    style: { background: "#FDF4FF", color: "#7E22CE", border: "1px solid #E9D5FF" },
  },
];

const DEFAULT_STYLE: TagStyle = {
  background: "#f9fafb",
  color: "#4b5563",
  border: "0.5px solid #e5e7eb",
};

export function getJobCategoryStyle(tag: string): TagStyle {
  const t = tag.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => t.includes(kw.toLowerCase()))) {
      return rule.style;
    }
  }
  return DEFAULT_STYLE;
}

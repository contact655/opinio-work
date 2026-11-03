import { PrevCareerSummary } from "@/components/people/PrevCareerSummary";
import type { PathsView, PathsCardView } from "@/lib/paths/server";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 「前の経歴」の集計のプレビュー（2026-11-04。2026-11-03 に /paths を /people の「前の経歴」と /home の「同じ経歴の人の行き先」へまとめた）。
 * ⚠️ 実データで集計が出るのは「職種：営業」だけ（2026-11-03 実測）。下限ちょうど・届かない・広げる提案はここで見る。
 * ⚠️ DB を読まない。固定データだけ。カードは /people の一覧（GridCard）がそのまま出すのでここには並べない。
 */
const options = {
  roles: [{ slug: "sales", name: "営業" }, { slug: "engineer", name: "エンジニア" }],
  industries: [{ slug: "it", name: "IT・インターネット" }, { slug: "finance", name: "金融" }],
  companies: [{ slug: "salesforce", name: "Salesforce" }],
};
const SALES = { role: { slug: "sales", name: "営業" }, industry: null, company: null };
const SALES_IT = { role: { slug: "sales", name: "営業" }, industry: { slug: "it", name: "IT・インターネット" }, company: null };
const card = (i: number, name: string, fromLabel: string, toLabel: string, toIsCurrent = true): PathsCardView => ({
  userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, name, avatarUrl: null,
  gradient: "linear-gradient(135deg, #002366, #3B5FD9)", initial: name.charAt(0), fromLabel, toLabel, toIsCurrent,
});
const CARDS = [
  card(1, "山田 太郎", "株式会社セールスフォース・ジャパン - アカウントエグゼクティブ", "伊藤忠テクノソリューションズ株式会社 - 営業"),
  card(2, "佐藤 花子", "みずほ証券株式会社 - 法人営業", "Salesforce - カスタマーサクセス", false),
  card(3, "寿限無寿限無五劫のすりきれ海砂利水魚の水行末雲来末風来末", "とても長い会社名の株式会社エンタープライズソリューションズジャパン - インサイドセールス", "もうひとつのとても長い会社名合同会社 - フィールドセールス"),
];
const base = (o: Partial<PathsView>): PathsView => ({ options, start: SALES, autoStart: false, selfStart: SALES_IT, summary: null, wider: [], cards: [], ...o });

const FIVE: PathsView = base({
  summary: {
    moverCount: 5,
    company: [{ label: "Salesforce", count: 5, href: "/companies/salesforce" }],
    role: [{ label: "営業", count: 5, href: null }],
    industry: [{ label: "IT・インターネット", count: 5, href: null }],
  },
  cards: CARDS,
});
const MANY: PathsView = base({
  start: SALES_IT,
  autoStart: true,
  summary: {
    moverCount: 23,
    company: [{ label: "Salesforce", count: 9, href: "/companies/salesforce" }, { label: "とても長い会社名の株式会社エンタープライズソリューションズジャパン", count: 6, href: null }],
    role: [{ label: "営業", count: 14 }, { label: "カスタマーサクセス", count: 5 }].map((r) => ({ ...r, href: null })),
    industry: [{ label: "IT・インターネット", count: 18, href: null }, { label: "金融", count: 5, href: null }],
  },
  cards: CARDS,
});
const FEW_WIDER: PathsView = base({ start: SALES_IT, summary: { moverCount: null, company: [], role: [], industry: [] }, wider: [SALES, { role: null, industry: { slug: "it", name: "IT・インターネット" }, company: null }], cards: CARDS.slice(0, 2) });
const FEW_NONE: PathsView = base({ start: { role: { slug: "engineer", name: "エンジニア" }, industry: null, company: null }, summary: { moverCount: null, company: [], role: [], industry: [] }, cards: [] });

export default function PathsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="前の経歴の集計（/people・/home）">
        <code>PrevCareerSummary</code> です。集計の各行は5人以上。/people（一覧の上）と /home（あなたと同じ経歴の人の行き先）が同じ部品を使います。
      </PreviewHeader>
      <Variant label="/people: 5人ちょうど"><PrevCareerSummary view={FIVE} /></Variant>
      <Variant label="/people: 多い・長い社名"><PrevCareerSummary view={MANY} /></Variant>
      <Variant label="/people: 5人に届かない → 広げる提案" note="⚠️ 人数が出ないこと。広げた先のリンク（/people?prev_…）が出ること"><PrevCareerSummary view={FEW_WIDER} /></Variant>
      <Variant label="/people: 届かず、広げても出ない" note="⚠️ 広げる提案が出ないこと"><PrevCareerSummary view={FEW_NONE} /></Variant>
      <Variant label="/home: 出せる行がある" note="⚠️ 下に「この経歴から進んだ人を見る →」"><div><style>{`.home-box { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; }`}</style><PrevCareerSummary view={MANY} variant="home" /></div></Variant>
      <Variant label="/home: 出せる行が無い" note="⚠️ 何も出ないこと（空の箱を出さない）"><PrevCareerSummary view={FEW_WIDER} variant="home" /></Variant>
    </div>
  );
}

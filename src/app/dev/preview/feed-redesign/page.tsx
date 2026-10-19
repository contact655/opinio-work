import { NewCompaniesCarousel, NEW_COMPANIES_CSS, type NewCompanyItem } from "@/components/feed/NewCompaniesCarousel";
import { CareerMovesSection, CAREER_MOVES_CSS, type CareerMovePerson, type MoveCompany } from "@/components/people/CareerMovesSection";
import { NewJobsCarousel, ArticlesBlock, FEED_BLOCKS_CSS, type FeedJobItem, type FeedArticleItem } from "@/components/feed/FeedSectionBlocks";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * ホームの見直しの見本（2026-10-19 / 柴さんの依頼。LinkedIn と比べて見づらい）。
 * ⚠️ 本物のホームにはまだ入れていない。見た目に OK をもらってから配線する。
 * ⚠️ DB を読まない。企業のロゴは公開中の画像の URL、人は架空の名前。
 * ★人の提案は LinkedIn の「つながりの提案」と同じ形にしない（柴さんの判断）。キャリアの移り変わりを主役にする（CareerMovesSection）。
 */
const LOGO = (id: string, ext = "png") => `https://xtutnecqeamftygufxco.supabase.co/storage/v1/object/public/ow-uploads/companies/logos/${id}/logo.${ext}`;
const COMPANIES: NewCompanyItem[] = [
  { id: "1", href: "/companies/openai", name: "OpenAI Japan", logoUrl: LOGO("daa558e5-054f-4475-ab00-3817170759ce"), logoLetter: "O", domain: "AI・データ", tagline: null },
  { id: "2", href: "/companies/databricks", name: "Databricks Japan", logoUrl: LOGO("ae15610d-477a-410d-b74a-54ab3e351add"), logoLetter: "D", domain: "AI・データ", tagline: null },
  { id: "3", href: "/companies/datadog", name: "Datadog Japan", logoUrl: LOGO("a5ffac90-70aa-4242-b867-6d9334317851"), logoLetter: "D", domain: "クラウド・インフラ", tagline: null },
  { id: "4", href: "/companies/hubspot", name: "HubSpot Japan", logoUrl: LOGO("aaaaaaaa-0001-0001-0001-000000000007"), logoLetter: "H", domain: "CRM・営業支援", tagline: null },
  { id: "5", href: "/companies/okta", name: "Okta Japan", logoUrl: LOGO("f8ebbe74-b647-46ea-869f-b126d1c4f316", "jpg"), logoLetter: "O", domain: "セキュリティ", tagline: null },
  { id: "6", href: "/companies/sansan", name: "Sansan", logoUrl: LOGO("8b9f84b0-b4be-4191-8322-07c6a2e5e91a"), logoLetter: "S", domain: "CRM・営業支援", tagline: null },
];
const SF = { name: "Salesforce", logoUrl: null };
const co = (i: number) => ({ name: COMPANIES[i].name, logoUrl: COMPANIES[i].logoUrl });
const move = (id: string, name: string, role: string | null, from: MoveCompany, to: MoveCompany, movedYear: number | null): CareerMovePerson =>
  ({ id, href: "#", name, avatarUrl: null, role, from, to, movedYear });
const FROM_SF = [
  move("b", "佐藤 花子", "カスタマーサクセス", SF, co(3), 2021),
  move("c", "鈴木 一郎", "エンタープライズ営業", SF, co(2), 2023),
  move("d", "Alexander Johnson", "Solutions Engineer", SF, co(4), 2020),
  move("g", "伊藤 さくら", "パートナーセールス", SF, co(0), 2024),
];
const SAME_ROLE = [
  move("e", "高橋 美咲", "アカウントエグゼクティブ", { name: "Sansan", logoUrl: COMPANIES[5].logoUrl }, co(0), 2024),
  move("f", "田中 健", "アカウントエグゼクティブ", { name: "株式会社リクルート", logoUrl: null }, co(1), 2022),
];

/* ★2026-10-20 案の見本データ（募集・記事）。募集名・記事名は架空 */
const JOBS: FeedJobItem[] = [
  { id: "j1", href: "#", title: "Account Executive（エンタープライズ営業）", companyName: COMPANIES[0].name, logoUrl: COMPANIES[0].logoUrl, logoLetter: "O", salary: "900〜1,800万円" },
  { id: "j2", href: "#", title: "Solution Engineer", companyName: COMPANIES[1].name, logoUrl: COMPANIES[1].logoUrl, logoLetter: "D", salary: "800〜1,300万円" },
  { id: "j3", href: "#", title: "カスタマーサクセスマネージャー（大手企業担当・リーダー候補）", companyName: COMPANIES[3].name, logoUrl: COMPANIES[3].logoUrl, logoLetter: "H", salary: null },
];
const ARTICLES: FeedArticleItem[] = [
  { id: "a1", href: "#", title: "「スカウトなし、真剣な対話だけ」OPINIOが目指す、IT転職の新しいスタンダード", meta: "取材記事・3月1日", gradient: "linear-gradient(135deg,#001233,#3B5FD9)", initial: "O" },
];

/* 普段の投稿の見本（見た目を合わせるため。本物は FeedClient の PostCard） */
function SamplePost() {
  return (
    <article style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e3a8a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>中</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>中村 誠（見本）</div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>日系SIer ／ 法人営業・3時間前</div>
        </div>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.75 }}>外資から日系 SIer に移って半年。意思決定のスピードの違いに最初は戸惑いましたが、今は顧客との距離の近さが面白いです。</p>
      <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 }}>
        <span>♡ いいね</span><span>💬 コメント</span>
      </div>
    </article>
  );
}

export default function FeedRedesignPreview() {
  devOnly();
  return (
    <div>
      <style>{NEW_COMPANIES_CSS + CAREER_MOVES_CSS + FEED_BLOCKS_CSS}</style>
      <PreviewHeader title="ホームの見直し（見本）">
        「新規掲載」の企業カードが1社ずつ縦に続いていたのを、1枚の横に送るカードにまとめ、そのあいだに
        <strong>「◯◯から次に進んだ人」</strong>（キャリアの移り変わりと「メッセージで聞く」）を差し込んだ見本です。
        <strong>ブラウザを 375px にして見てください。</strong>
      </PreviewHeader>
      <Variant label="★2026-10-20 案：タブなし・投稿の合間に4つの枠" note="上から: 投稿 → 新しく掲載された企業 → 投稿 → 新着の募集 → ◯◯から次に進んだ人 → 投稿 → 記事。⚠️「フォロー中」タブはなくす。投稿はフォローしている人のものを先に">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto", background: "var(--bg, #f4f5f7)", padding: 12, borderRadius: 12 }}>
          <SamplePost />
          <NewCompaniesCarousel items={COMPANIES} totalCount={21} moreHref="/companies" />
          <SamplePost />
          <NewJobsCarousel items={JOBS} totalCount={2} moreHref="/jobs" />
          <CareerMovesSection title="Salesforce から次に進んだ人" sub="いまの勤務先と同じ会社にいた人が、次にどこへ進んだか" people={FROM_SF} moreHref="/people" hideFrom />
          <SamplePost />
          <ArticlesBlock items={ARTICLES} moreHref="/articles" />
        </div>
      </Variant>
      <Variant label="（前の案）ホームの並び（スマホ）" note="上から: 投稿 → 新しく掲載された企業（横に送る）→ Salesforce から次に進んだ人 → 投稿 → 同じ職種から次に進んだ人">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto", background: "var(--bg, #f4f5f7)", padding: 12, borderRadius: 12 }}>
          <SamplePost />
          <NewCompaniesCarousel items={COMPANIES} totalCount={21} moreHref="/companies" />
          <CareerMovesSection title="Salesforce から次に進んだ人" sub="いまの勤務先と同じ会社にいた人が、次にどこへ進んだか" people={FROM_SF} moreHref="/people" hideFrom />
          <SamplePost />
          <CareerMovesSection title="アカウントエグゼクティブから次に進んだ人" sub="あなたと同じ職種の人のその後" people={SAME_ROLE} moreHref="/people" />
        </div>
      </Variant>
      <Variant label="長い名前・長い社名・年なし" note="⚠️ はみ出さないこと（社名は途中で省略し、title で全文）">
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <CareerMovesSection title="同じ職種から次に進んだ人" people={[
            move("x", "寿限無寿限無五劫のすりきれ海砂利水魚", "シニアカスタマーサクセスマネージャー",
              { name: "グローバル・エンタープライズ・ソリューションズ・アンド・コンサルティング・ジャパン合同会社", logoUrl: null }, co(2), null),
            move("y", "検証 五郎", null, SF, co(5), 2019),
          ]} />
        </div>
      </Variant>
    </div>
  );
}

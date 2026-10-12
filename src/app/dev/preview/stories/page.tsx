import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PostsClient } from "@/app/biz/posts/PostsClient";
import { BizShellProvider } from "@/components/business/BizShellContext";
import { StoryEditor } from "@/app/biz/posts/StoryEditor";
import { CompanyStoryCard } from "@/components/companies/CompanyStoryCard";
import type { StoryWithDraft } from "@/lib/companyStories/server";
import { storyTemplate } from "@/lib/companyStories/shared";

/**
 * 企業ストーリー（/biz/posts と企業ページの「企業からの投稿」）のプレビュー（2026-09-22）。
 *
 * ⚠️★実データは本番で1件（検証用アカウントの本文3文字）しかない。
 *    公開・下書き・長文・カバー画像あり／なしは、ここでしか並べて見られない。
 * ⚠️ 公開・編集・削除は Server Action を呼ぶ。この画面では未ログイン相当なので
 *    **押すとエラー帯が出るのが正しい。** 見るのは並び・常に出る操作・タブの切り替えまで。
 * ⚠️ DB は読まない（固定データだけ）。
 */

const LONG_BODY = [
  "## なぜこのプロダクトを作っているのか",
  "",
  "私たちは、中小企業の経理担当者が月末に3日かけていた作業を、半日で終わらせることを目指しています。",
  "",
  "創業のきっかけは、代表が前職で見た**経理チームの残業**でした。数字を扱う仕事なのに、手作業の転記と確認に時間の大半が使われていました。",
  "",
  "- 転記をなくす",
  "- 確認を自動にする",
  "- 人は判断に集中する",
  "",
  "## チームについて",
  "",
  "エンジニア8名、デザイナー2名、カスタマーサクセス4名の小さなチームです。週に一度、全員で顧客の声を読む時間を取っています。",
].join("\n");

const now = "2026-09-20T10:00:00.000Z";
function story(id: string, over: Partial<StoryWithDraft>): StoryWithDraft {
  return {
    id, title: "", body: "", category: "culture", coverImageUrl: null, isPublished: false,
    publishedAt: null, createdAt: now, updatedAt: now, draft: null, ...over,
  };
}

const STORIES: StoryWithDraft[] = [
  story("s1", { title: "なぜ私たちはこのプロダクトを作っているのか", body: LONG_BODY, category: "product", isPublished: true, publishedAt: now }),
  story("s2", { title: "入社1年目のエンジニアに聞いた、最初の3か月", body: "配属初日に任されたのは、請求書の読み取り精度を上げる改修でした。", category: "interview" }),
  story("s3", {
    title: "とても長いタイトルが入ったときに一覧で省略されるかを確かめるためのストーリー（オフィス移転のお知らせと新しい働き方について）",
    body: "短い本文。", category: "event", isPublished: true, publishedAt: now,
    coverImageUrl: "/brand/opinio-symbol.svg",
    draft: { title: "書きかけ", body: "短い本文。", category: "event", coverImageUrl: null, updatedAt: now },
  }),
  story("s4", { title: "ひな形のまま", body: storyTemplate("interview"), category: "interview" }),
  story("s5", { title: "種類が古い値（team）", body: "その他として出ること。", category: "team" }),
];
const VIEWS: Record<string, number> = { s1: 1234, s3: 0 };

export default function StoriesPreviewPage() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="企業ストーリー（/biz/posts と企業ページ）">
        <code>/biz/posts</code> の一覧と、求職者向け企業ページの本文の出し方です。
        見るところ：<strong>公開・編集・削除が hover しなくても見えること</strong>／タブで絞れること／
        本文が長いものだけ「続きを読む」で開けること。
      </PreviewHeader>

      <Variant label="/biz/posts：5件（企業ページ公開中）" note="⚠️ 状態が色のバッジでなく灰色の文字で出ること。⋯ に「企業ページで見る」が出るのは公開中だけ。表紙が無いカードは種類名が出ること。古い種類（team）が英語で出ないこと">
        <BizShellProvider value={{ tenantId: "c", hasPublicPage: true, userName: null, permission: "admin" }}>
          <PostsClient initialStories={STORIES} views={VIEWS} />
        </BizShellProvider>
      </Variant>

      <Variant label="/biz/posts：企業ページが非公開・閲覧数が取れない" note="⚠️ 「公開中のストーリーも求職者には表示されていません」が出ること。「閲覧」が出ないこと（0 と出さない）">
        <BizShellProvider value={{ tenantId: "c", hasPublicPage: false, userName: null, permission: "admin" }}>
          <PostsClient initialStories={STORIES} views={null} />
        </BizShellProvider>
      </Variant>

      <Variant label="/biz/posts：0件" note="⚠️ 「＋ 新しいストーリー」のカードだけが出ること">
        <PostsClient initialStories={[]} views={{}} />
      </Variant>

      <Variant label="/biz/posts：読み込めなかった" note="⚠️ 「まだ無い」と区別して、読み込めなかったと出ること">
        <PostsClient initialStories={null} views={null} />
      </Variant>

      <Variant label="編集画面：公開中・未公開の変更あり" note="⚠️ ブラウザ幅 1280 以上で左右2画面、1279 以下で「編集／プレビュー」の切り替え。この画面では保存は失敗する（未ログイン相当）">
        <BizShellProvider value={{ tenantId: "c", hasPublicPage: true, userName: null, permission: "admin" }}>
          <StoryEditor initial={STORIES[2]} />
        </BizShellProvider>
      </Variant>

      <Variant label="企業ページ：長い本文" note="⚠️ 見出し・箇条書き・太字が記号のまま出ないこと。「続きを読む」で全文が開くこと">
        <div style={{ maxWidth: 720 }}>
          <CompanyStoryCard title="なぜこのプロダクトを作っているのか" body={LONG_BODY} category="product" coverImageUrl={null} publishedAt={now} />
        </div>
      </Variant>
    </div>
  );
}

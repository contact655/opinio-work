import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PostsClient } from "@/app/biz/posts/PostsClient";
import { BizShellProvider } from "@/components/business/BizShellContext";
import { ExpandableStoryBody } from "@/app/(jobseeker)/companies/[id]/ExpandableStoryBody";
import { Markdown } from "@/components/common/Markdown";

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
function story(id: string, over: Record<string, unknown>) {
  return {
    id, company_id: "c", author_user_id: null, title: "", body: "", category: "culture",
    cover_image_url: null, is_published: false, published_at: null, created_at: now, updated_at: now,
    ...over,
  } as Parameters<typeof PostsClient>[0]["initialStories"][number];
}

const STORIES = [
  story("s1", { title: "なぜ私たちはこのプロダクトを作っているのか", body: LONG_BODY, category: "product", is_published: true, published_at: now }),
  story("s2", { title: "入社1年目のエンジニアに聞いた、最初の3か月", body: "配属初日に任されたのは、請求書の読み取り精度を上げる改修でした。", category: "interview" }),
  story("s3", {
    title: "とても長いタイトルが入ったときに一覧で省略されるかを確かめるためのストーリー（オフィス移転のお知らせと新しい働き方について）",
    body: "短い本文。", category: "event", is_published: true, published_at: now,
    cover_image_url: "/brand/opinio-symbol.svg",
  }),
];

export default function StoriesPreviewPage() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="企業ストーリー（/biz/posts と企業ページ）">
        <code>/biz/posts</code> の一覧と、求職者向け企業ページの本文の出し方です。
        見るところ：<strong>公開・編集・削除が hover しなくても見えること</strong>／タブで絞れること／
        本文が長いものだけ「続きを読む」で開けること。
      </PreviewHeader>

      <Variant label="/biz/posts：3件（企業ページ公開中）" note="⚠️ 公開中の行にだけ「企業ページで見る」が出ること。カバー画像の無い行に絵文字の枠が出ないこと">
        <BizShellProvider value={{ tenantId: "c", hasPublicPage: true, userName: null, permission: "admin" }}>
          <PostsClient companyId="c" companyName="サンプル株式会社" initialStories={STORIES} />
        </BizShellProvider>
      </Variant>

      <Variant label="/biz/posts：企業ページが非公開" note="⚠️ 「公開中のストーリーも求職者には表示されていません」が出ること。「企業ページで見る」が出ないこと">
        <BizShellProvider value={{ tenantId: "c", hasPublicPage: false, userName: null, permission: "admin" }}>
          <PostsClient companyId="c" companyName="サンプル株式会社" initialStories={STORIES} />
        </BizShellProvider>
      </Variant>

      <Variant label="/biz/posts：0件" note="⚠️ 絵文字の3段図が無いこと。「ストーリーを書く」が見出しと空状態で2つ出ないこと">
        <PostsClient companyId="c" companyName="サンプル株式会社" initialStories={[]} />
      </Variant>

      <Variant label="企業ページ：長い本文" note="⚠️ 見出し・箇条書き・太字が記号のまま出ないこと。「続きを読む」で全文が開くこと">
        <div style={{ maxWidth: 720 }}>
          <ExpandableStoryBody title="なぜこのプロダクトを作っているのか">
            <Markdown>{LONG_BODY}</Markdown>
          </ExpandableStoryBody>
        </div>
      </Variant>
    </div>
  );
}

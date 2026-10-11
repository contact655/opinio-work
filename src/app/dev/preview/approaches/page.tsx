import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { MessagesView } from "@/app/biz/messages/MessagesView";
import type { ConversationRow } from "@/app/biz/messages/page";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";

/**
 * ★企業のメッセージ（/biz/messages）の見え方（2026-10-11）。
 * ⚠️ DB は読まない（固定データ）。日付は表示した時点から逆算する。
 * ⚠️ 実画面は BusinessLayout（左ナビ）の中に出る。ここは本文だけ。
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const person = (id: string, name: string, headline: string | null) => ({ id, name, headline, avatarUrl: null, avatarColor: null, username: null });

const REASON_LONG = "前職で中堅企業向けの新規開拓からチームの立ち上げまで担われてきた経歴を拝見しました。当社でも同じ規模の顧客を広げる段階にあり、その進め方をぜひ伺いたいと考えています。";

const pending3: SentApproach = {
  id: "p3", createdAt: daysAgo(3), reason: REASON_LONG, status: "pending", conversationId: null,
  body: "ご都合のよいときに、30分ほどオンラインでお話しできればうれしいです。", acceptedAt: null, unseen: false, jobTitle: "インサイドセールス（IT・SaaS 領域の法人開拓）",
  candidate: person("u1", "検証 花子", "法人営業 / SaaS"), senderName: "検証 一郎",
};
const pending25: SentApproach = {
  id: "p25", createdAt: daysAgo(25), reason: "大手クラウド企業でのエンタープライズ営業の経験を、当社の大型案件の立ち上げに活かしていただけると考えました。",
  status: "pending", conversationId: null, candidate: person("u2", "検証 次郎", null), senderName: "検証 二郎",
  body: null, acceptedAt: null, unseen: false, jobTitle: null,
};
/* ⚠️ 返信あり・企業がまだ会話を開いていない */
const accepted: SentApproach = {
  id: "a1", createdAt: daysAgo(6), reason: "カスタマーサクセスの立ち上げ経験について、直接お話を伺いたいと考えました。",
  status: "accepted", conversationId: "c1", candidate: person("u3", "検証 三郎", "カスタマーサクセス"), senderName: "検証 一郎",
  body: null, acceptedAt: daysAgo(2), unseen: true, jobTitle: "フィールドセールス（リクルーティングアドバイザー）",
};
const expired: SentApproach = {
  id: "e1", createdAt: daysAgo(40), reason: "マーケティングの組織づくりの経験を伺いたいと考えました。",
  status: "expired", conversationId: null, candidate: person("u4", "検証 四郎", null), senderName: null,
  body: null, acceptedAt: null, unseen: false, jobTitle: null,
};

const quotaEmpty: ApproachQuota = { monthlyUsed: 0, monthlyLimit: 10, openCount: 0, openLimit: 10 };
const quotaFull: ApproachQuota = { monthlyUsed: 2, monthlyLimit: 10, openCount: 2, openLimit: 10 };

const NOW = new Date().toISOString();

const conv = (id: string, name: string, extra: Partial<ConversationRow> = {}): ConversationRow => ({
  id, kind: "company", stage: "active", status: "active", last_message_at: daysAgo(1), created_at: daysAgo(5),
  candidate: { id: `cu-${id}`, name, avatar_color: null, avatar_url: null }, isUnread: false, isParticipant: true, isNewReply: false, fromInterest: false,
  lastMessage: "ご連絡ありがとうございます。来週のどこかで30分ほどお話しできればと思います。", lastSender: "candidate", ...extra,
});
const convs: ConversationRow[] = [
  conv("c1", "検証 三郎", { isUnread: true, isNewReply: true }),
  /* ★「話を聞いてみたい」と答えてできた会話（名前の下に灰色で「貴社に興味があります」） */
  conv("c5", "検証 八郎", { fromInterest: true, isNewReply: true, lastMessage: "（検証）御社の営業体制についてお話を伺いたいです。" }),
  conv("c2", "検証 五郎", { lastSender: "me", lastMessage: "ありがとうございます。では水曜の15時でお願いします。" }),
  conv("c4", "検証 七郎", { lastSender: { colleague: "検証 一郎" }, lastMessage: "日程の候補をお送りします。" }),
  conv("c3", "検証 六郎", { isParticipant: false, lastMessage: null, lastSender: null }),
];

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="メッセージ（/biz/messages）">
        <p>実画面は検証用データでは状態が揃わないので、ここで4つの状態を見る。</p>
      </PreviewHeader>
      <Variant label="0件・送れる人 3人" note="仕組みは大きく・数字のカードは出さない（見出しの横の今月の残りだけ）。左に案内（人数・コツ・候補者を探す）、右に見本。見出しの右に「候補者を探す」も出る">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} sent={[]} quota={quotaEmpty} approachableCount={3} />
      </Variant>
      <Variant label="0件・送れる人 0人・公開中の求人なし" note="1文と「提案を見る」（主）・「求人を公開する」・文字リンク「候補者を探す」。見出しの右の「候補者を探す」は出さない">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} sent={[]} quota={quotaEmpty} approachableCount={0} hasPublishedJob={false} />
      </Variant>
      <Variant label="0件・送れる人 0人・公開中の求人あり" note="「求人を公開する」は出さない">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} sent={[]} quota={quotaEmpty} approachableCount={0} hasPublishedJob />
      </Variant>
      <Variant label="0件・人数を取れなかった" note="0人と出さず「取得できませんでした」">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} sent={[]} quota={quotaEmpty} approachableCount={null} />
      </Variant>
      <Variant label="返事待ちタブ・2件（3日前・25日前）" note="灰色で「返信を待っています・あと〇日」。25日前のほうは「あと5日」">
        <MessagesView autoSelect={false} now={NOW} allowed initialTab="pending" conversations={[]} sent={[pending3, pending25]} quota={quotaFull} />
      </Variant>
      <Variant label="すべてタブ・会話3件（新しい返信1・未参加1）" note="「新しい返信」の印・未読のドット">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={convs} sent={[accepted]} quota={{ ...quotaEmpty, monthlyUsed: 1 }} />
      </Variant>
      <Variant label="30日を過ぎたもの1件（すべてに並ぶ）" note="灰色で「返信はありませんでした・〇年〇月〇日から再び送れます」。バッジは無い">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} sent={[expired]} quota={quotaEmpty} />
      </Variant>
      <Variant label="結果の出たメッセージ 10件" note="返信あり4・30日を過ぎた6">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={[]} quota={{ monthlyUsed: 10, monthlyLimit: 10, openCount: 0, openLimit: 10 }}
          sent={[...Array.from({ length: 4 }, (_, i) => ({ ...accepted, id: `a${i}`, unseen: false, candidate: person(`ua${i}`, `検証 受入${i + 1}`, null) })),
            ...Array.from({ length: 6 }, (_, i) => ({ ...expired, id: `e${i}`, candidate: person(`ue${i}`, `検証 期限${i + 1}`, null) }))]} />
      </Variant>
      <Variant label="混在（すべてタブ）" note="会話3件＋返事待ち2・30日1">
        <MessagesView autoSelect={false} now={NOW} allowed conversations={convs} sent={[pending3, accepted, pending25, expired]} quota={{ monthlyUsed: 3, monthlyLimit: 10, openCount: 2, openLimit: 10 }} />
      </Variant>
    </div>
  );
}

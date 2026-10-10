import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ApproachesView } from "@/app/biz/approaches/ApproachesView";
import type { ApproachQuota, SentApproach } from "@/lib/approaches/server";

/**
 * ★声かけの一覧（/biz/approaches）の見え方（2026-10-11）。
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
/* ⚠️ 受け入れ済み・企業がまだ会話を開いていない */
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

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="声かけの一覧（/biz/approaches）">
        <p>実画面は検証用データでは状態が揃わないので、ここで4つの状態を見る。</p>
      </PreviewHeader>
      <Variant label="0件・声をかけられる人 3人" note="仕組みは大きく。人数・書き方のコツ・ボタン2つ。見出し横の「候補者を探す」は出さない">
        <ApproachesView now={NOW} allowed rows={[]} quota={quotaEmpty} approachableCount={3} />
      </Variant>
      <Variant label="0件・声をかけられる人 0人" note="受け取る設定の人がいない文と「提案を見る」">
        <ApproachesView now={NOW} allowed rows={[]} quota={quotaEmpty} approachableCount={0} />
      </Variant>
      <Variant label="0件・人数を取れなかった" note="0人と出さない">
        <ApproachesView now={NOW} allowed rows={[]} quota={quotaEmpty} approachableCount={null} />
      </Variant>
      <Variant label="返事待ち2件（3日前・25日前）" note="25日前のほうは「あと5日で枠に戻る」はず">
        <ApproachesView now={NOW} allowed rows={[pending3, pending25]} quota={quotaFull} />
      </Variant>
      <Variant label="やり取り中1件（受け入れ済み・未読）" note="まだ開いていない受け入れの強調・受け入れた日">
        <ApproachesView now={NOW} allowed rows={[accepted]} quota={{ ...quotaEmpty, monthlyUsed: 1 }} />
      </Variant>
      <Variant label="30日を過ぎたもの1件" note="再び送れる日（送った日＋180日）">
        <ApproachesView now={NOW} allowed rows={[expired]} quota={quotaEmpty} />
      </Variant>
      <Variant label="結果の出た声かけ 10件（受け入れ率を出す）" note="受け入れ4・30日を過ぎた6 → 受け入れ率 40%">
        <ApproachesView now={NOW} allowed quota={{ monthlyUsed: 10, monthlyLimit: 10, openCount: 0, openLimit: 10 }}
          rows={[...Array.from({ length: 4 }, (_, i) => ({ ...accepted, id: `a${i}`, unseen: false, candidate: person(`ua${i}`, `検証 受入${i + 1}`, null) })),
            ...Array.from({ length: 6 }, (_, i) => ({ ...expired, id: `e${i}`, candidate: person(`ue${i}`, `検証 期限${i + 1}`, null) }))]} />
      </Variant>
      <Variant label="4状態をまとめて（すべて）" note="並び順・混在時の見え方">
        <ApproachesView now={NOW} allowed rows={[pending3, accepted, pending25, expired]} quota={{ monthlyUsed: 3, monthlyLimit: 10, openCount: 2, openLimit: 10 }} />
      </Variant>
    </div>
  );
}

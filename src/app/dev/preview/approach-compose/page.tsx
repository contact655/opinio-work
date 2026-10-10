import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import ApproachComposeClient from "@/app/biz/approaches/new/ApproachComposeClient";

/**
 * ★声かけを書く画面（/biz/approaches/new）の見え方（2026-10-11）。
 * ⚠️ DB は読まない（固定データ）。実画面は「いま送れる候補者」が居ないと開けないので、ここで見る。
 * ⚠️ 「声をかける」を押すと実際の API に送る。**ここでは押さないこと**（固定の候補者 id は実在しないので 404 で止まる）。
 */
const base = {
  candidate: { id: "00000000-0000-0000-0000-000000000000", name: "検証 花子", headline: "法人営業 / SaaS", currentRole: "インサイドセールス", currentCompany: "検証株式会社" },
  quotes: [{ label: "職歴", text: "SaaS の新規開拓を担当" }],
  senders: [{ id: "s1", name: "検証 一郎" }],
  defaultSenderId: "s1",
  jobs: [{ id: "j1", title: "インサイドセールス（IT・SaaS 領域の法人開拓）" }],
  company: { name: "株式会社検証", logoUrl: null, logoLetter: "検", logoGradient: null, isOwnCompany: false },
  disclosure: null,
};

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="メッセージリクエストを書く（/biz/approaches/new）">
        <p>右の「今月の枠」と「送る前に」の言い方（今月の残り・返事待ち・返信がある）を見る。</p>
      </PreviewHeader>
      <Variant label="残り8通・返事待ち2件" note="送ったあとの今月の残り：7通">
        <ApproachComposeClient {...base} quota={{ monthlyUsed: 2, monthlyLimit: 10, openCount: 2, openLimit: 10 }} />
      </Variant>
      <Variant label="枠を取れなかった" note="（—）と出る">
        <ApproachComposeClient {...base} quota={null} />
      </Variant>
    </div>
  );
}

import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import ApproachComposeClient from "@/app/biz/messages/new/ApproachComposeClient";

/**
 * ★声かけを書く画面（/biz/messages/new）の見え方（2026-10-11）。
 * ⚠️ DB は読まない（固定データ）。実画面は「いま送れる候補者」が居ないと開けないので、ここで見る。
 * ⚠️ 「声をかける」を押すと実際の API に送る。**ここでは押さないこと**（固定の候補者 id は実在しないので 404 で止まる）。
 */
const base = {
  candidate: { id: "00000000-0000-0000-0000-000000000000", name: "検証 花子", headline: "法人営業 / SaaS", currentRole: "インサイドセールス", currentCompany: "検証株式会社" },
  quotes: [{ label: "職歴", text: "SaaS の新規開拓を担当" }],
  senders: [{ id: "s1", name: "検証 一郎", role: "人事部 採用担当" }],
  defaultSenderId: "s1",
  jobs: [{ id: "j1", title: "インサイドセールス（IT・SaaS 領域の法人開拓）" }],
  company: { name: "株式会社検証", logoUrl: null, logoLetter: "検", logoGradient: null, isOwnCompany: false },
};

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="メッセージを送る（/biz/messages/new）">
        <p>右の ①返事待ちのバー ②〇〇さんにはこう見えます（返信欄つき） ③送る前に を見る（2026-10-11 にモックに合わせた）。</p>
      </PreviewHeader>
      <Variant label="返事待ち2件" note="返事待ち 2件／10件">
        <ApproachComposeClient {...base} quota={{ sentThisMonth: 2, openCount: 2, openLimit: 10 }} />
      </Variant>
      <Variant label="枠を取れなかった" note="「送れる数を確認できませんでした」と出る">
        <ApproachComposeClient {...base} quota={null} />
      </Variant>
    </div>
  );
}

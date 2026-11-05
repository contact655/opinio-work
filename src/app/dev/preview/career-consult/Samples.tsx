"use client";

import { NewMessageComposer } from "@/components/profile/DMButton";
import { ConsultCard, ConsultLabel, CommonPointsLine } from "@/components/messages/Consult";
import { ChatBubble } from "@/components/messages/ChatBubble";
import { CAREER_GENERAL_OPTION, type ConsultAboutOption, type ConsultPayload } from "@/lib/constants/careerConsult";
import { Variant } from "../Variant";

/* ⚠️ 見本の操作（ワンタップの返信）は関数を渡すので、クライアントの部品に分けてある（サーバーの page.tsx からは関数を渡せない） */
const opt = (key: string, label: string, period: string | null): ConsultAboutOption => ({
  key, kind: "company", companyId: key.startsWith("company:") ? key.slice(8) : null, label, period, experienceIds: [],
});
const MANY: ConsultAboutOption[] = [
  opt("company:c1", "Salesforce", "いま"),
  opt("company:c2", "日本アイ・ビー・エム", "2016〜2021"),
  opt("exp:e3", "株式会社ずっと長い社名のスタートアップテクノロジーズホールディングス", "2012〜2016"),
  CAREER_GENERAL_OPTION,
];
const NONE: ConsultAboutOption[] = [CAREER_GENERAL_OPTION];

const full: ConsultPayload = {
  v: 1, about: { kind: "company", companyId: "c1", companyName: "Salesforce", period: "2018〜2022" },
  points: ["work_style", "salary", "job_change"], format: "online_30",
  note: "来年マネージャーになる予定で、最初の1年でつまずいたことを伺いたいです。お忙しいところ恐縮ですが、よろしくお願いします。",
};
const minimal: ConsultPayload = { v: 1, about: { kind: "career" }, points: [], format: null, note: null };
const longName: ConsultPayload = {
  v: 1, about: { kind: "company", companyId: null, companyName: "株式会社ずっと長い社名のスタートアップテクノロジーズホールディングス", period: null },
  points: ["rewarding", "join_reason", "industry", "work_style", "salary", "job_change"], format: "message", note: "あ".repeat(500),
};
const noop = async () => null;

export function CareerConsultSamples() {
  return (
    <>
      <Variant label="最初の1通（職歴が3社ある相手）">
        <div style={{ maxWidth: 560 }}>
          <NewMessageComposer titleId="p1" recipientName="木村 雅樹" sample
            compose={{ connected: false, options: MANY, selectedAbout: null, maxLength: 500 }} />
        </div>
      </Variant>
      <Variant label="「この経験について聞く」から（Salesforce を選んだ状態）">
        <div style={{ maxWidth: 560 }}>
          <NewMessageComposer titleId="p2" recipientName="木村 雅樹" sample
            compose={{ connected: true, options: MANY, selectedAbout: "company:c1", maxLength: 2000 }} />
        </div>
      </Variant>
      <Variant label="職歴が無い相手（キャリア全般だけ）">
        <div style={{ maxWidth: 560 }}>
          <NewMessageComposer titleId="p3" recipientName="検証 五郎" sample
            compose={{ connected: false, options: NONE, selectedAbout: null, maxLength: 500 }} />
        </div>
      </Variant>

      <Variant label="チャットの中（受け取った側・共通点あり・ワンタップの返信）">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <ChatBubble mine={false} sender="大塚 悠貴" at="2026-11-05T01:23:00Z" plain>
            <ConsultCard payload={full} commonPoints={["同じ高校（朝霞西高校）", "同じ会社の出身（Salesforce）", "同じ職種（営業）"]} onDecline={noop} />
          </ChatBubble>
          <ChatBubble mine sender="自分" at="2026-11-05T01:30:00Z">ありがとうございます。来週オンラインでいかがでしょう。</ChatBubble>
        </div>
      </Variant>
      <Variant label="チャットの中（送った側・聞きたい話だけ）">
        <ChatBubble mine sender="自分" at="2026-11-05T01:23:00Z" plain>
          <ConsultCard payload={minimal} />
        </ChatBubble>
      </Variant>
      <Variant label="長い社名・6つ全部・ひとこと500字">
        <ChatBubble mine={false} sender="Alexander Johnson" at="2026-11-05T01:23:00Z" plain>
          <ConsultCard payload={longName} commonPoints={["同業（IT・ソフトウェア）"]} onDecline={noop} />
        </ChatBubble>
      </Variant>
      <Variant label="一覧のラベル・共通点の行だけ">
        <div style={{ display: "grid", gap: 8 }}>
          <div><ConsultLabel /></div>
          <CommonPointsLine points={["同じ大学（早稲田大学）", "同じ職種（エンジニア）"]} />
          <CommonPointsLine points={[]} />
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>（共通点が無いと何も出ない ← これが正しい）</p>
        </div>
      </Variant>
    </>
  );
}

import { HomeActionList } from "@/components/business/home/HomeActionList";
import { HomeChecklist } from "@/components/business/home/HomeChecklist";
import { HomeSideColumn } from "@/components/business/home/HomeSideColumn";
import { buildHomeChecklist, type HomeChecklistInput } from "@/lib/business/homeChecklist";
import type { HomeActions, HomeSide } from "@/lib/business/homeTypes";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 企業ホーム（/biz/dashboard）のプレビュー（2026-10-12）。⚠️ DB は読まない（固定データ）。
 * ⚠️★「はじめにやること」が全部済んだ状態・対応が多い状態は、検証用の企業でも作れないのでここで見る。
 * 部品は本番と同じ（HomeActionList / HomeChecklist / HomeSideColumn）。項目と判定も同じ `buildHomeChecklist`。
 */
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const MEETINGS: HomeActions["meetings"] = [
  { id: "m1", dayLabel: "今日", time: "15:00", name: "山田 太郎", detail: "オンライン・30分", href: "#" },
  { id: "m2", dayLabel: "明日", time: "10:30", name: "佐藤 花子", detail: "対面・60分", href: "#" },
];

const ACTIONS: HomeActions = {
  failed: [],
  meetings: MEETINGS,
  items: [
    { kind: "reply", at: ago(0), title: "鈴木 鉄平さんから返信がありました", sub: "今日", action: "返信する", href: "#" },
    { kind: "interest", at: ago(1), title: "山田 花子さんが、貴社の話を聞いてみたいそうです", sub: "1日前", action: "返信する", href: "#" },
    { kind: "message", at: ago(2), title: "佐藤 一郎さんから新しいメッセージがあります", sub: "2日前", action: "返信する", href: "#" },
    { kind: "unanswered", at: ago(2), title: "鈴木 鉄平さんに返信していません（10月12日 03:00〜）", action: "返信する", href: "#" },
    { kind: "meetingRequest", at: ago(2), title: "高橋 次郎さんから面談の申し込み", sub: "2日前", action: "確認する", href: "#" },
    { kind: "application", at: ago(3), title: "田中 三郎さんから応募がありました", sub: "3日前 ・ 求人：フィールドセールス（SaaS 新規開拓）", action: "確認する", href: "#" },
    { kind: "savedSearch", at: ago(0), title: "保存した条件「SaaS営業 5年以上」に新着 3名", sub: "うちメッセージを送れる方 2名", action: "確認する", href: "#" },
    { kind: "stoppedJobs", at: ago(0), title: "運営が停止した求人 1件", sub: "内容を直して、再開を依頼できます", action: "確認する", href: "#" },
  ],
};

const SIDE: HomeSide = {
  quota: { sentText: "3通", openText: "2/10", openSub: "同時に10件まで・30日で枠に戻ります", openPct: 20 },
  jobs: { published: 2, draft: 1, stopped: 1 },
  companyStatus: "公開中",
};

const START: HomeChecklistInput = {
  listed: false, listingRequested: false, companyMissing: 2, totalJobs: 1, publishedJobs: 0,
  nearestDraft: { id: "x", title: "フィールドセールス", missing: 3 }, roles: 0, employees: 0, acceptingCasualMeetings: true,
};
const ALL_DONE: HomeChecklistInput = {
  listed: true, listingRequested: false, companyMissing: 0, totalJobs: 3, publishedJobs: 2,
  nearestDraft: null, roles: 2, employees: 4, acceptingCasualMeetings: true,
};

function Home({ actions, checklist, side }: { actions: HomeActions; checklist: HomeChecklistInput; side: HomeSide }) {
  return (
    <div className="biz-home-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <HomeActionList actions={actions} />
        <HomeChecklist items={buildHomeChecklist(checklist)} />
      </div>
      <HomeSideColumn side={side} />
      <style>{`
        .biz-home-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 1024px) { .biz-home-grid { grid-template-columns: minmax(0, 1fr) 280px; } }
      `}</style>
    </div>
  );
}

export default function BizHomePreview() {
  devOnly();
  return (
    <>
      <PreviewHeader title="企業ホーム（/biz/dashboard）">
        <p>左に「対応が必要なもの」と「はじめにやること」、右に今月のメッセージ・求人・企業ページ。左右は上揃えで、高さをそろえない。</p>
      </PreviewHeader>
      <Variant label="対応あり・今日と明日の面談・はじめにやることが途中" note="面談は件数に入らない。済んだ項目（カジュアル面談）はチェック付きで下へ">
        <Home actions={ACTIONS} checklist={START} side={{ ...SIDE, companyStatus: "非公開・公開まであと2つ" }} />
      </Variant>
      <Variant label="対応0件・はじめにやることが全部済んだ" note="⚠️ はじめにやること・面談の枠ごと出ないこと。対応は「今日の対応はありません」（灰色）">
        <Home actions={{ items: [], failed: [], meetings: [] }} checklist={ALL_DONE} side={SIDE} />
      </Variant>
      <Variant label="一部を取得できなかった" note="⚠️ 0件を装わず、確認できなかった種類を一言添える。求人の数は「—」">
        <Home actions={{ items: ACTIONS.items.slice(0, 1), failed: ["保存した条件"], meetings: null }} checklist={START} side={{ ...SIDE, quota: null, jobs: null }} />
      </Variant>
    </>
  );
}

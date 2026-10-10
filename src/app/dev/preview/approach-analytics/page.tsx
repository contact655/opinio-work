import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ApproachTab } from "@/app/biz/analytics/ApproachTab";
import type { AnalyticsRow, ApproachAnalytics } from "@/lib/approaches/analytics";

/**
 * ★声かけの振り返り（/biz/analytics?tab=approaches）の見え方（2026-10-10 / 段6）。
 * ⚠️ 実画面は検証用アカウントを除いて数えるので、検証用のデータでは「出る側」を描けない。ここで見る。
 * ⚠️ DB は読まない（固定データ）。
 */
const row = (key: string, label: string, sent: number, resolved: number, accepted: number, meetings = 0): AnalyticsRow => ({ key, label, sent, resolved, accepted, meetings });
const empty: ApproachAnalytics = { total: { sent: 0, resolved: 0, accepted: 0, meetings: 0 }, bySender: [], byJob: [], byReasonLength: [], byTemplate: [] };
const sentOnly: ApproachAnalytics = {
  total: { sent: 3, resolved: 0, accepted: 0, meetings: 0 },
  bySender: [row("a", "検証 一郎", 3, 0, 0)], byJob: [row("without", "添えていない", 3, 0, 0)],
  byReasonLength: [row("30-79", "30〜79字", 2, 0, 0), row("80-139", "80〜139字", 1, 0, 0), row("140-200", "140〜200字", 0, 0, 0)],
  byTemplate: [row("none", "テンプレートなし", 3, 0, 0)],
};
const withData: ApproachAnalytics = {
  total: { sent: 13, resolved: 11, accepted: 5, meetings: 1 },
  bySender: [row("a", "検証 一郎", 9, 8, 4, 1), row("b", "検証 二郎", 4, 3, 1)],
  byJob: [row("without", "添えていない", 9, 7, 3, 1), row("none-recorded", "記録なし", 3, 3, 1), row("with", "求人を添えた", 1, 1, 1)],
  byReasonLength: [row("30-79", "30〜79字", 5, 4, 2, 1), row("80-139", "80〜139字", 5, 4, 2), row("140-200", "140〜200字", 3, 3, 1)],
  byTemplate: [row("none", "テンプレートなし", 10, 8, 4, 1), row("none-recorded", "記録なし", 3, 3, 1)],
};

export default function Page() {
  devOnly();
  return (
    <div>
      <style>{`.an-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; } @media (max-width: 900px) { .an-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`}</style>
      <PreviewHeader title="声かけの振り返り（/biz/analytics の声かけタブ）">
        <p>実画面は検証用アカウントを除いて数えるので、ここで3つの状態を見る。</p>
      </PreviewHeader>
      <Variant label="送った数 0" note="1文と「候補者を探す」だけ。件数カードと表は出さない">
        <ApproachTab data={empty} periodLabel="直近30日" />
      </Variant>
      <Variant label="送った数 3・結果 0" note="件数カードは「送った数」だけ出し、ほかは「—」。表のかわりに1文と入口">
        <ApproachTab data={sentOnly} periodLabel="直近30日" />
      </Variant>
      <Variant label="結果 11（参考値なし）・行に5件未満あり" note="行の率は5件未満で「—」">
        <ApproachTab data={withData} periodLabel="全期間" />
      </Variant>
      <Variant label="取得に失敗" note="「0件という意味ではありません」">
        <ApproachTab data={null} periodLabel="直近30日" />
      </Variant>
    </div>
  );
}

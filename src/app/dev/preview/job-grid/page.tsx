import { JobCardGrid } from "@/components/jobs/JobCardGrid";
import { JobListItem } from "@/components/jobs/JobListItem";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  JOB_GRID_TWO, JOB_GRID_MANY, JOB_CARDS_MISSING,
  PREVIEW_COMPANY_MAP, PREVIEW_COMPANY_MAP_MULTI,
} from "../fixtures";

/**
 * ★`/jobs` に「一覧（グリッド）」を足すか決めるための試作（2026-10-01 / 柴さんの指示）。
 *
 * ⚠️★★**まだ `/jobs` には繋いでいない。** 本番の見た目は何も変わっていない。
 *    採らないと決めたら、`JobCardGrid.tsx` と globals.css の `.job-grid-*` と
 *    この画面を**まとめて消す**（半端に残さない）。
 *
 * ⚠️ 実データは**公開求人2件**で、両方 Salesforce・両方フル項目。
 *    「枚数が増えたとき」「社名が長いとき」「欠けたとき」は実データで踏めない。
 */
function Grid({ children }: { children: React.ReactNode }) {
  /* ⚠️ 実ページに入れるときと同じ class。ここで独自のグリッドを組まない */
  return <div className="jobs-grid">{children}</div>;
}

export default function JobGridPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="求人カード（一覧＝グリッド）／試作">
        <code>/jobs</code> に「一覧 / 詳細」の切り替えを足すとどう見えるかの試作です。
        <strong>まだ本番には繋いでいません。</strong>
        列は <code>/companies</code> と同じ段（1200px 未満で2列・600px 未満で1列）。
        <br />
        ⚠️ 1列のカード（<code>JobListItem</code>）との違いは2つ。
        <strong>キャッチコピーを出す</strong>（1列では 2026-09-17 に高さのため落とした）ことと、
        <strong>♡を常に出す</strong>（1列では分割表示のときだけ）ことです。
      </PreviewHeader>

      <Variant
        label="① いまの実データと同じ「2件だけ」"
        note="⚠️★3列グリッドに2枚。右3分の1が空くのが許せるかどうか。1200px 未満なら2列でぴったり埋まる"
      >
        <Grid>
          {JOB_GRID_TWO.map((j) => (
            <JobCardGrid key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </Grid>
      </Variant>

      <Variant
        label="② 求人が増えたとき（9件 / 3社）"
        note="⚠️ グリッドが効くのはこの量から、という判断材料。長い職種名・長い社名・年収なし・項目が空のカードを混ぜてある"
      >
        <Grid>
          {JOB_GRID_MANY.map((j) => (
            <JobCardGrid key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP_MULTI} />
          ))}
        </Grid>
      </Variant>

      <Variant
        label="③ 項目が欠けている7件"
        note="⚠️★年収なしが「年収0万円〜」に化けないこと。勤務地・勤務形態・雇用形態が空のとき、チップの行ごと消えて区切りが残らないこと"
      >
        <Grid>
          {JOB_CARDS_MISSING.map((j) => (
            <JobCardGrid key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </Grid>
      </Variant>

      <Variant
        label="④ ブックマーク済み / 応募済み"
        note="⚠️ ♡は常に右上。押すと API を叩くので押さないこと（preview の求人IDは本番に無い）"
      >
        <Grid>
          <JobCardGrid job={JOB_GRID_TWO[0]} companyMap={PREVIEW_COMPANY_MAP} initialBookmarked />
          <JobCardGrid job={JOB_GRID_TWO[1]} companyMap={PREVIEW_COMPANY_MAP} isApplied />
          <JobCardGrid job={JOB_GRID_MANY[6]} companyMap={PREVIEW_COMPANY_MAP_MULTI} initialBookmarked isApplied />
        </Grid>
      </Variant>

      <Variant
        label="⑤ 見比べ: いまの1列（JobListItem）"
        note="⚠️★同じ求人を1列で並べたもの。**情報が増えているか**をここで見る —— 増えていないなら切り替えを足す意味は薄い"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {JOB_GRID_TWO.map((j) => (
            <JobListItem key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </div>
      </Variant>
    </div>
  );
}

import { JobListItem } from "@/components/jobs/JobListItem";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import {
  JOB_CARDS_MISSING, JOB_CARDS_LONG, JOB_CARD_NO_COMPANY, PREVIEW_COMPANY_MAP,
} from "../fixtures";

/**
 * 求人カード（一覧）のプレビュー（2026-08-31）。
 *
 * ⚠️ 公開求人は **2件だけ**（2026-08-30 実測）。しかも両方 Salesforce で
 *    年収もキャッチコピーも入っているので、**欠けた形を実データで踏めない。**
 *
 * ⚠️★**実ページと同じ呼び方をすること。** `/jobs` は
 *    `job / companyMap / initialBookmarked / isApplied / matchReason` を渡す。
 *    ⚠️ `matchReason` は現行の実装では**使われていない**（`_matchReason` として捨てている）。
 *       ここでも渡さない。渡すと「効いている」と誤解される。
 *
 * ⚠️ ブックマークの状態は `initialBookmarked` で決まる。押すと API を叩くので、
 *    プレビューでは**押さないこと**（押しても preview の求人IDは本番に無い）。
 */
function Rows({ children }: { children: React.ReactNode }) {
  /* ⚠️ `/jobs` の一覧と同じ縦積み。独自のグリッドを組まない */
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;
}

export default function JobCardsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="求人カード（一覧）">
        <code>/jobs</code> の <code>JobListItem</code> です。
        年収は <code>salary_min</code> / <code>salary_max</code> の有無で
        <strong>4通り</strong>の表示になります（両方 / 下限だけ / 上限だけ / なし）。
      </PreviewHeader>

      <Variant
        label="項目が欠けている7件"
        note="⚠️★年収なしが「年収0万円〜」に化けないこと。キャッチコピー・勤務地が空のときに区切り文字だけ残らないこと"
      >
        <Rows>
          {JOB_CARDS_MISSING.map((j) => (
            <JobListItem key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </Rows>
      </Variant>

      <Variant label="長い職種名・長いキャッチコピー・4桁万円" note="⚠️ 折り返しと省略。年収12,000〜25,000万円でも桁が崩れないか">
        <Rows>
          {JOB_CARDS_LONG.map((j) => (
            <JobListItem key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </Rows>
      </Variant>

      {/* ⚠️★2026-08-31 にこの画面で分かったこと。**未対応**。
             `JobListItem` は `if (!company) return null;` で、
             **会社が引けない求人はカードごと静かに消える**（落ちはしない）。

             ⚠️ `/jobs` の `companies` は `createPublicClient()`（**anon**）で
                フィルタ無しに取っているが、**RLS が `is_published = false` の企業を落とす。**
                実測（2026-08-31）: 全89社のうち **anon から見えるのは85社**。

             ⚠️ つまり「**企業を非公開にしたのに、その企業の求人が published のまま**」だと、
                求人クエリには残るのにカードが描画されず、**画面から静かに消える。**
                現時点の実害は0件（見えない4社はいずれも求人0件）。

             ⚠️ 消えたことは**画面からは分からない**。カードが1枚少ないだけで、
                エラーも空状態も出ない。CLAUDE.md「0件を読むときは、起きなかった0か
                起こせなかった0かを分ける」と同じ形。 */}
      <Variant
        label="会社が companyMap に無い"
        note="⚠️★カードが1枚も描画されない（落ちはしないが静かに消える）。本番でも企業を非公開にすると起きうる"
      >
        <Rows>
          {JOB_CARD_NO_COMPANY.map((j) => (
            <JobListItem key={j.id} job={j} companyMap={PREVIEW_COMPANY_MAP} />
          ))}
        </Rows>
      </Variant>

      <Variant label="ブックマーク済み / 応募済み" note="⚠️ バッジの出方。押すと API を叩くので押さないこと">
        <Rows>
          <JobListItem job={JOB_CARDS_MISSING[0]} companyMap={PREVIEW_COMPANY_MAP} initialBookmarked />
          <JobListItem job={JOB_CARDS_MISSING[1]} companyMap={PREVIEW_COMPANY_MAP} isApplied />
          <JobListItem job={JOB_CARDS_MISSING[2]} companyMap={PREVIEW_COMPANY_MAP} initialBookmarked isApplied />
        </Rows>
      </Variant>
    </div>
  );
}

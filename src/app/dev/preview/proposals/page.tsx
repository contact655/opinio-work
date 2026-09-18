import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import EvidenceList from "@/components/proposals/EvidenceList";
import {
  buildCounterEvidence,
  buildEvidence,
  isProposable,
  MIN_EVIDENCE_FOR_PROPOSAL,
  type CounterFacts,
  type EvidenceFacts,
} from "@/lib/evidence/engine";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";

/**
 * 根拠つき提案（②⑨）の見え方。2026-09-18 追加。
 *
 * ── ★なぜ要るか ────────────────────────────────────────────────────────────
 * **実データでは n=1 が最大**（2026-09-18 実測 / docs/phase0-9screens-20260918.md）。
 * 掲載22社のうち根拠が2件以上そろう企業は**0社**なので、
 * **本番では ② も ⑨ も「提案なし」しか描かれない。**
 * n>=3 の分岐（比率を出す側）は、ここでしか目で見られない。
 *
 * ⚠️★**本番のデータを検証用で膨らませて確かめないこと**（CLAUDE.md）。
 *    `is_test` の企業は `filterListedCompanies` に落とされるので、
 *    テストアカウントを作っても提案画面には出てこない。
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️ n=1 / n=2 で**比率（「N人のうち M人」）が出ていない**こと。
 *    ここが崩れると、決め手を答えた1人が何を選んだかが読めてしまう。
 * ⚠️ 反証の枠が**必ず出ている**こと。根拠だけが並んだカードを作らない。
 * ⚠️ 根拠が4件以上のとき「ほかに根拠が N 件あります」が出ること（黙って切らない）。
 * ⚠️ 375px で横にはみ出さないこと。
 */
const OPTS = { minAggregate: MIN_AGGREGATE_COUNT };

/** n を変えるだけの素材。★しきい値の前後（2 と 3）を必ず含める */
function facts(n: number, opts?: Partial<EvidenceFacts>): EvidenceFacts {
  return {
    companyName: "サンプルワークス",
    samePath: n > 0 ? { n, fromRoleName: "アカウントエグゼクティブ", fromIndustryName: "IT・ソフトウェア" } : null,
    sharedMotive: n > 0 ? { n, k: Math.max(1, n - 1), reasonLabel: "裁量の大きさ" } : null,
    talkable: n > 0 ? { n } : null,
    preference: { matchedLabels: ["希望フェーズ（上場企業）にマッチ"] },
    ...opts,
  };
}

const COUNTER_FULL: CounterFacts = {
  shortTenure: { n: 3, total: 5 },
  salaryGap: { jobMin: 400, jobMax: 600, wantMin: 800, wantMax: null },
  workStyleGap: { actual: "原則出社", wanted: ["フルリモート"] },
};
const COUNTER_NONE: CounterFacts = { shortTenure: null, salaryGap: null, workStyleGap: null };

function Card({ f, counter }: { f: EvidenceFacts; counter: CounterFacts }) {
  const ev = buildEvidence(f, OPTS);
  const ce = buildCounterEvidence(counter, OPTS);
  if (!isProposable(ev)) {
    return (
      <p style={{ fontSize: 13, lineHeight: 1.9, margin: 0 }}>
        根拠 <strong>{ev.length}</strong> 件 → <strong>提案に出さない</strong>
        （下限 {MIN_EVIDENCE_FOR_PROPOSAL} 件）。
        <br />
        <span style={{ color: "var(--ink-soft)" }}>
          ただし件数は出す:「根拠を{MIN_EVIDENCE_FOR_PROPOSAL}件以上そろえられたのは N 社でした」
        </span>
      </p>
    );
  }
  return <EvidenceList evidence={ev} counter={ce} />;
}

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="根拠つき提案（②⑨）">
        <p>
          しきい値は <strong>根拠 {MIN_EVIDENCE_FOR_PROPOSAL} 件以上</strong>で提案、
          <strong>n {MIN_AGGREGATE_COUNT} 人以上</strong>で比率を出す。
        </p>
        <p>
          ★<strong>n=1 / n=2 で「N人のうち M人」が出ていないこと</strong>を必ず見ること。
          出ていたら、決め手を答えた1人が何を選んだかが読めてしまう。
        </p>
      </PreviewHeader>

      <Variant label="n = 0" note="根拠が1件（希望条件のみ）→ 提案に出さない。件数だけ出す">
        <Card f={facts(0)} counter={COUNTER_FULL} />
      </Variant>

      <Variant label="n = 1" note="★比率を出さない。「決め手を挙げた人がいます」まで">
        <Card f={facts(1)} counter={COUNTER_FULL} />
      </Variant>

      <Variant label="n = 2" note="★まだ比率を出さない（しきい値は3）">
        <Card f={facts(2)} counter={COUNTER_FULL} />
      </Variant>

      <Variant label="n = 3" note="ここから比率が出る。「3人のうち 2人が…」">
        <Card f={facts(3)} counter={COUNTER_FULL} />
      </Variant>

      <Variant label="n = 5" note="根拠4件 → 3件だけ出し、「ほかに根拠が 1 件あります」が付く">
        <Card f={facts(5)} counter={COUNTER_FULL} />
      </Variant>

      <Variant
        label="反証なし（＝確かめていない）"
        note="★反証の枠が消えず、「確かめていません」と出ること。省略しない"
      >
        <Card f={facts(5)} counter={COUNTER_NONE} />
      </Variant>

      <Variant
        label="根拠2件未満で除外"
        note="話を聞ける人だけ（1件）→ 提案に出さない"
      >
        <Card
          f={{ companyName: "サンプルワークス", samePath: null, sharedMotive: null, talkable: { n: 2 }, preference: null }}
          counter={COUNTER_FULL}
        />
      </Variant>

      <Variant
        label="職種・業種が解決できない"
        note="★「他社」「不明」で埋めず、件数だけ出ること"
      >
        <Card
          f={{
            companyName: "サンプルワークス",
            samePath: { n: 4, fromRoleName: null, fromIndustryName: null },
            sharedMotive: null, talkable: { n: 3 }, preference: null,
          }}
          counter={COUNTER_NONE}
        />
      </Variant>
    </div>
  );
}

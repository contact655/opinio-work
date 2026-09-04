import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { IndustryMatchSection } from "@/components/mypage/IndustryMatchSection";
import type { IndustryMatchBlock } from "@/lib/companies/industryMatch";

/**
 * 「◯◯の経験が活きる会社」（`/mypage` の右カラム）。2026-09-04 追加。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * ⚠️★**実画面で見るのが難しい。** 条件が3つ重なっている:
 *    ① ログインの内側 ② 職歴の業界が対象業界と一致する ③ 除外後に2社以上
 *    さらに検証用アカウントは `/onboarding/stance` のゲートに阻まれて
 *    `/mypage` に到達できない（2026-09-04 に実際に踏んだ）。
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️ 0ブロックのときに**何も描かれない**こと（「該当なし」も出さない）。
 * ⚠️ 見出しに「業界」が付いていないこと（`公共・団体業界` が不自然になるため）。
 * ⚠️ 長い社名が右カラム 320px で**はみ出さない**こと（1行クランプ）。
 * ⚠️ 経験年数が **0年のときは行ごと出ない**こと。
 */
const co = (name: string, slug: string, letter: string) => ({
  id: slug, slug, name, tagline: null,
  logoUrl: null, logoLetter: letter, logoGradient: "linear-gradient(135deg, var(--royal), #3B5FD9)",
});

const CONSTRUCTION: IndustryMatchBlock = {
  industryId: "c", industryName: "建設", years: 9,
  companies: [
    co("ANDPAD", "andpad", "A"),
    co("SPIDERPLUS", "spiderplus", "S"),
    co("Photoruction", "photoruction", "P"),
    co("ダンドリワーク", "dandori-work", "ダ"),
  ],
};

const IT: IndustryMatchBlock = {
  industryId: "i", industryName: "IT・ソフトウェア", years: 5,
  companies: [co("ゲインサイト・ジャパン", "gainsight", "ゲ"), co("エヌシーノ", "ncino", "エ")],
};

/** ⚠️ 見出しが最長になる業界＋長い社名。右カラム幅での折り返しを見る */
const LONG: IndustryMatchBlock = {
  industryId: "l", industryName: "メディア・広告・エンタメ", years: 0,
  companies: [
    co("富士フイルムビジネスイノベーションジャパン株式会社", "fujifilm-bi", "富"),
    co("アマゾン ウェブ サービス ジャパン合同会社", "aws", "ア"),
  ],
};

export default function IndustryMatchPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="◯◯の経験が活きる会社（/mypage 右カラム）">
        <p style={{ margin: 0 }}>
          職歴の業界 × 企業の対象業界（軸2）の突合。⚠️ 実画面はログインの内側で、
          さらに職歴と企業データの条件が揃わないと出ません。
        </p>
      </PreviewHeader>

      <Variant label="0ブロック" note="★何も描かれないこと。「該当なし」も出さない">
        <IndustryMatchSection blocks={[]} />
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
          （この行の上に何も出ていなければ正しい）
        </p>
      </Variant>

      <Variant label="1ブロック・4社" note="建設出身の人。実データで出るのはこの形">
        <IndustryMatchSection blocks={[CONSTRUCTION]} />
      </Variant>

      <Variant label="2ブロック（上限）" note="経験年数の長い順。3つ以上あってもここで切る">
        <IndustryMatchSection blocks={[CONSTRUCTION, IT]} />
      </Variant>

      <Variant
        label="長い社名・長い業界名・0年"
        note="★320px で社名がはみ出さないこと／0年のときは「あなたの職歴から」の行が出ないこと"
      >
        <IndustryMatchSection blocks={[LONG]} />
      </Variant>
    </div>
  );
}

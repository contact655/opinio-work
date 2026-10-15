import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import FitPageIntro from "@/app/(jobseeker)/mypage/proposals/FitPageIntro";
import ProposalsClient, { type ProposalView } from "@/app/(jobseeker)/mypage/proposals/ProposalsClient";
import ForYouSection, { type ForYouView } from "@/app/(jobseeker)/mypage/proposals/ForYouSection";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";

/**
 * 「あなたに合う会社」（/mypage/proposals）の見え方。2026-10-15 追加（おすすめ＋あなたに合う順を統合）。
 *
 * ⚠️★実画面はログインが要り、提案は実在の利用者に0件なので、上段と下段が並ぶ形はここでしか見られない。
 * ⚠️ ボタンを押すと本物の API を叩く（存在しない id なので 404 になる）。ここでは押さない。
 * 何を見るか:
 *   ・冒頭は2文＋「担当者未登録」の説明1回＋「詳しく」
 *   ・カードは「担当者あり／担当者未登録」の小さなラベルだけ
 *   ・理由は緑の枠・タグ（話を聞ける人・募集あり・フェーズ）
 *   ・押した後（会話あり／運営に記録＋取り消す）・「気をつけて見てほしいこと」の器
 */
const PROPOSAL: ProposalView = {
  id: "p1", companyName: "サンプルワークス", companyHref: null, tagline: "設備の稼働を見える化する",
  logoUrl: null, isOwnCompany: false,
  evidence: [
    { kind: "same_path", n: 2, label: "アカウントエグゼクティブから、サンプルワークスへ 2人が移っています" },
    { kind: "talkable", n: 1, label: "話を聞ける人が 1人います" },
  ],
  counter: [{ kind: "unknown", label: "都合の悪い点は確かめていません（在籍期間・年収・勤務形態のデータが足りていません）" }],
  status: "pending", jobTitle: "エンタープライズセールス", jobHref: null, jobClosed: false,
  note: null, conversationId: null, computedAt: "2026-10-15", daysLeft: 28,
};

const base: Omit<ForYouView, "id" | "rank" | "name"> = {
  href: null, tagline: "チームの作業を割り当て、進捗を追う", reasons: [], hasTalkable: false, hasOpenJobs: false,
  phaseLabel: "上場企業", cautions: [], hasResponder: false, reaction: null, conversationId: null, interested: false,
};
const COMPANIES: ForYouView[] = [
  { ...base, id: "c1", rank: 1, name: "担当者のいる会社（未回答）", hasResponder: true, hasOpenJobs: true, hasTalkable: true,
    reasons: ["あなたの経験職種（エンタープライズセールス）の募集があります", "前職と同じCRM・営業支援領域の会社です"] },
  { ...base, id: "c2", rank: 2, name: "担当者未登録の会社（未回答）",
    reasons: ["いまの勤務先と同じAI・データ領域の会社です"],
    cautions: ["（器の確認用）勤務形態は「原則出社」で、希望（フルリモート）とは異なります"] },
  { ...base, id: "c3", rank: 3, name: "担当者のいる会社（話を聞いてみたい済み）", hasResponder: true, interested: true, reaction: "interested", conversationId: "x",
    reasons: ["前職と同じCRM・営業支援領域の会社から、この会社に移った人がいます"] },
  { ...base, id: "c4", rank: 4, name: "担当者未登録の会社（話を聞いてみたい済み）", interested: true, reaction: "interested",
    reasons: ["希望しているフェーズ（上場企業）の会社です"] },
  { ...base, id: "c5", rank: 5, name: "理由のない会社（あとで）", reaction: "later", phaseLabel: null },
  { ...base, id: "c6", rank: 6, name: "興味なしにした会社", reaction: "not_interested" },
];
const DECLINE = CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label }));

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="あなたに合う会社（/mypage/proposals）"><p>実画面はログインが要り、実在の利用者の提案は0件。上段と下段が並ぶ形はここで見る。ボタンは押さない（本物の API を叩く）。</p></PreviewHeader>
      <Variant label="提案あり ＋ すべての会社" note="上段に1件・下段に6件（1件は「興味なし」で畳まれる）">
        <main style={{ maxWidth: 720, margin: "0 auto" }}>
          <FitPageIntro showNoResponderNote />
          <ProposalsClient proposals={[PROPOSAL]} minEvidence={MIN_EVIDENCE_FOR_PROPOSAL} loadFailed={false} />
          <ForYouSection companies={COMPANIES} loadFailed={false} noReasons={false} declineReasons={DECLINE} />
        </main>
      </Variant>
      <Variant label="提案0件・理由0社" note="上段は出ない。下段の上に「職歴を追加すると…」">
        <main style={{ maxWidth: 720, margin: "0 auto" }}>
          <FitPageIntro showNoResponderNote />
          <ForYouSection companies={COMPANIES.slice(4, 5).map((c) => ({ ...c, reaction: null, rank: 1, name: "理由のない会社" }))} loadFailed={false} noReasons declineReasons={DECLINE} />
        </main>
      </Variant>
    </div>
  );
}

import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import FitPageIntro from "@/app/(jobseeker)/mypage/proposals/FitPageIntro";
import ProposalsClient, { type ProposalView } from "@/app/(jobseeker)/mypage/proposals/ProposalsClient";
import ForYouSection, { type ForYouView } from "@/app/(jobseeker)/mypage/proposals/ForYouSection";
import { CANDIDATE_DECLINE_REASONS } from "@/lib/constants/declineReasons";

/**
 * 「あなたに合う会社」（/mypage/proposals）の見え方。2026-10-15 追加（おすすめ＋あなたに合う順を統合）。
 *
 * ⚠️★実画面はログインが要り、提案は実在の利用者に0件なので、上段と下段が並ぶ形はここでしか見られない。
 * ⚠️ ボタンを押すと本物の API を叩く（存在しない id なので 404 になる）。ここでは押さない。
 * 何を見るか:
 *   ・冒頭は2文＋「担当者未登録」の説明1回＋「詳しく」
 *   ・カードは「担当者あり／担当者未登録」の小さなラベルだけ
 *   ・理由は緑の枠・タグ（募集あり・フェーズ）
 *   ・押した後（会話あり／運営に記録＋取り消す）・「気をつけて見てほしいこと」の器
 */
const PROPOSAL: ProposalView = {
  id: "p1", companyName: "サンプルワークス", companyHref: null, tagline: "設備の稼働を見える化する",
  logoUrl: null, isOwnCompany: false,
  evidence: [
    { kind: "same_path", n: 2, label: "アカウントエグゼクティブから、サンプルワークスへ 2人が移っています" },
    { kind: "preference_match", n: 1, label: "希望フェーズ（シリーズB）に合っています" },
  ],
  /* ★確かめられなかったこと（unknown）だけ → 枠は出ない */
  counter: [{ kind: "unknown", label: "都合の悪い点は確かめていません（在籍期間・年収・勤務形態のデータが足りていません）" }],
  status: "pending", jobTitle: "エンタープライズセールス", jobHref: "/jobs/x", jobClosed: false,
  note: null, conversationId: null, computedAt: "2026-10-15", daysLeft: 28, phaseLabel: "シリーズB",
};
const PROPOSAL_ANSWERED: ProposalView = {
  ...PROPOSAL, id: "p2", companyName: "サンプル商事（回答済み）", status: "introduced", conversationId: "x", daysLeft: null,
  note: "フィールドセールスの体制について伺いたいです。",
  /* ★具体的な注意点がある → 枠が出る */
  counter: [{ kind: "salary_gap", label: "提示されている上限（700万円）は、希望の下限（800万円）に届きません" }],
  phaseLabel: "上場企業",
};

const base: Omit<ForYouView, "id" | "rank" | "name"> = {
  href: null, tagline: "チームの作業を割り当て、進捗を追う", reasons: [], groupLabel: null, hasOpenJobs: false,
  phaseLabel: "上場企業", cautions: [], hasResponder: false, reaction: null, conversationId: null, interested: false,
};
const AI = { reasons: ["いまの勤務先と同じAI・データ領域の会社です"], groupLabel: "いまの勤務先と同じAI・データ領域" };
const COMPANIES: ForYouView[] = [
  { ...base, id: "c1", rank: 1, name: "担当者のいる会社（未回答）", hasResponder: true, hasOpenJobs: true,
    reasons: ["あなたの経験職種（エンタープライズセールス）の募集があります", "前職と同じCRM・営業支援領域の会社です"],
    groupLabel: "あなたの経験職種（エンタープライズセールス）の募集がある会社" },
  { ...base, id: "c2", rank: 2, name: "AI・データの会社A（担当者未登録）", ...AI,
    cautions: ["（器の確認用）勤務形態は「原則出社」で、希望（フルリモート）とは異なります"] },
  { ...base, id: "c3", rank: 3, name: "AI・データの会社B（話を聞いてみたい済み）", ...AI, hasResponder: true, interested: true, reaction: "interested", conversationId: "x",
    reasons: [...AI.reasons, "希望しているフェーズ（上場企業）の会社です"] },
  { ...base, id: "c4", rank: 4, name: "AI・データの会社C（運営に記録済み）", ...AI, interested: true, reaction: "interested" },
  { ...base, id: "c5", rank: 5, name: "理由のない会社（あとで）", reaction: "later", phaseLabel: null },
  { ...base, id: "c6", rank: 6, name: "理由のない会社2" },
  { ...base, id: "c7", rank: 7, name: "興味なしにした会社", reaction: "not_interested" },
];
const DECLINE = CANDIDATE_DECLINE_REASONS.map((o) => ({ value: o.value, label: o.label }));

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="あなたに合う会社（/mypage/proposals）"><p>実画面はログインが要り、実在の利用者の提案は0件。上段と下段が並ぶ形はここで見る。ボタンは押さない（本物の API を叩く）。</p></PreviewHeader>
      <Variant label="提案あり ＋ すべての会社" note="上段2件（未回答・回答済み）。下段は理由ごとにまとまる：募集あり1社／AI・データ3社／その他2社（＋「興味なし」1社は畳まれる）">
        <main style={{ maxWidth: 720, margin: "0 auto" }}>
          <FitPageIntro showNoResponderNote />
          <ProposalsClient proposals={[PROPOSAL, PROPOSAL_ANSWERED]} loadFailed={false} />
          <ForYouSection companies={COMPANIES} loadFailed={false} noReasons={false} declineReasons={DECLINE} />
        </main>
      </Variant>
      <Variant label="提案0件・理由0社" note="上段は出ない。下段の上に「職歴を追加すると…」">
        <main style={{ maxWidth: 720, margin: "0 auto" }}>
          <FitPageIntro showNoResponderNote />
          <ForYouSection companies={COMPANIES.slice(4, 6).map((c, i) => ({ ...c, reaction: null, rank: i + 1 }))} loadFailed={false} noReasons declineReasons={DECLINE} />
        </main>
      </Variant>
    </div>
  );
}

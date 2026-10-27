import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import {
  CompanyPageMock, CompanyTabsMock, JobMock, StoryMock, CandidateSearchMock, ProposalMock,
} from "@/components/business/lp/ScreenMocks";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 600;

/*
 * ═══ 企業向けLP ═══════════════════════════════════════════════════════════
 *
 * ★2026-10-22 に v4 として作り直した（柴さんの了承。見本 https://claude.ai/artifact/Rds7ioFQc3LgGb5mk3EnEi）。
 *   ① FV（企業ページの見本） ② 求人票と社員の経歴の対比
 *   ③ OPINIOでできる5つのこと（企業ページ／募集／企業記事／人を探して声をかける／紹介。説明と画面の見本を交互に）
 *   ④ 求職者が安心して使えるしくみ ⑤ はじめ方 ⑥ 最終CTA
 *   ⚠️★言葉は「意味がそのまま伝わる言い方」にする（柴さんの指示。「空いた席」「手ざわり」「最初のメッセージ」は分かりにくいとして外した）。
 *      「OB・OG」は「元社員」、業界の略語（AE など）は使わない。
 *
 * ⚠️★id `people` / `onpage` / `proposal` はヘッダーのナビ（BusinessHeader）と外部のリンクが指している。**消さないこと。**
 *
 * ⚠️★**料金の話を本文に書かない。** 金額・プラン・FAQ は
 *    **[/business/pricing](pricing/page.tsx)** にある。
 *    掲載利用規約 第4条2項が「有料プランの内容・料金・支払方法・契約期間は
 *    本サービス上に表示するところによる」と定めているので、
 *    **単純に消すことはできず、移設という形にした。**
 *    ⚠️ ここに金額を書き戻さないこと。**表示先が2つになると片方だけ古くなる。**
 *    ⚠️ 数字は `PAID_PLAN_MONTHLY_FEE`（lib/constants/plans.ts）が唯一の定義で、
 *       読むのは pricing 側だけ。
 *    ⚠️ ヘッダーのナビとフッターに料金へのリンクがあるので、掲示先へは辿り着ける。
 *    ⚠️★候補者検索とメッセージを「無料」と書かないこと。いまは無料プランでも使えるが、
 *       ベータ期間の無料を定めた規約の改定は未公開（CLAUDE.md「契約プランと機能のゲート」）。
 *
 * ⚠️★**「話せる人」（面談OK・アンバサダーの招待）は 2026-10-16 に機能ごと撤去した。** 書き戻さないこと。
 *
 * ⚠️★紹介は「OPINIOが紹介します」と書いてよい（2026-10-22 に変えた）。
 *    2026-09-17 時点は企業への紹介の仕組みが無く「紹介していきます」としていたが、
 *    2026-10-11 から求職者が「話を聞いてみたい」と答えると企業に届く（lib/evidence/introduce.ts）。
 *    ⚠️ 紹介が届くのは**有効な担当者がいる企業だけ**。「必ず届く」「毎月届く」とは書かない。
 *
 * ⚠️ **次の主張を書き足さないこと。** どれも実体が無い。
 *   ・候補者の質・量　・応募が来ること（数）　・カジュアル面談の実績
 *   ・スカウト（2026-10-08 に廃止した機能の名前。「メッセージ」と書く）　・メンター（機能が存在しない）
 *
 * ⚠️ **数値を載せないこと。** 登録者数・通過率・承諾率・定着率・日数のいずれも
 *    実測値が無い。出身企業のロゴ帯も復活させない。導入企業の声も枠ごと作らない。
 *    ⚠️ 「10人」は返事待ちの上限（lib/constants/companyApproaches.ts）で、実績の数ではない。変えたらここも直す。
 *
 * ⚠️ 掲載が無料であることは /terms/listing 第4条1項に定めがあるので、
 *    **「掲載は無料」はここに書いてよい**（金額と有料プランの話は pricing 側）。
 *
 * ⚠️ **「審査なし」「確認なし」と書かないこと。** 2026-10-28 から企業ページは企業が自分で公開するが、
 *    公開後に運営が内容を確認し、問題があれば停止する（「はじめ方」の3はこの事実）。
 *    候補者へのメッセージ（スカウト機能）は運営が企業ごとに許可する。
 *
 * ⚠️★**mailto: を置かないこと。** メーラーの無い環境では押しても何も起きない。
 *    相談の導線は `/business/contact`（フォーム）。
 *    ⚠️ ここを `**` で囲まないこと。`**` とパスの `/` が並ぶと `*&#47;` になり、
 *       **このブロックコメントがその場で閉じる**（実際に一度壊した）。
 *
 * ⚠️★**`<main>` に paddingTop を足さないこと（2026-09-17）。**
 *    `BusinessHeader` は `position: sticky` で**すでに 60px を占めている**。
 *    fixed ヘッダー用の逃がしを足すと、その下に**約60pxの白い帯**ができる。
 *
 * ⚠️ 画面の見本は components/business/lp/ScreenMocks.tsx。**画像ファイルにしない。** 名前・経歴は架空で、
 *    「画面はイメージです」の注記を FV と「できること」の下に置いてある。**消さないこと。**
 *    ⚠️ 2026-10-22 に PathsVisual / SeatVisual / CareerTimeline は削除した（唯一の使い手がここだった）。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "そこで働く人が、会社を伝える。 | OPINIO for Business" },
  description:
    "求人票に書けるのは、仕事内容や年収などの条件までです。OPINIOでは、社員と元社員の経歴を企業ページに並べて、どんな人が働いている会社かを伝えられます。IT業界に特化した採用プラットフォーム。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "そこで働く人が、会社を伝える。 | OPINIO for Business",
    description: "社員と元社員の経歴で、どんな人が働いている会社かを伝える。IT業界に特化した採用プラットフォーム OPINIO の企業向けページ。",
    type: "website",
    url: "https://opinio.jp/business",
    images: [{ url: "https://opinio.jp/api/og?name=OPINIO+for+Business&sub=%E6%8E%A1%E7%94%A8%E3%81%AF%E3%80%81%E6%A4%9C%E7%B4%A2%E3%81%8B%E3%82%89%E6%8F%90%E6%A1%88%E3%81%B8&v=2", width: 1200, height: 630 }],
  },
};

/** 求人票が伝えること / 社員の経歴が伝えること */
const SPEC_ITEMS = ["職種と仕事内容", "年収レンジと勤務地", "必須・歓迎要件"];
const PEOPLE_ITEMS = [
  "どんな経歴の人が、この職種で働いているか",
  "どんな会社から転職してきた人が多いか",
  "ここで働いたあと、どんな仕事に就いた人がいるか",
];

/* ── ③ OPINIOでできる5つのこと。⚠️ 書いてよいのは、いまの管理画面でできることだけ（冒頭の注記）。
      ⚠️ 絞り込みの項目は CandidateFilterDrawer と揃える。年齢・性別は書かない（本番で絞り込めない・絞り込ませない）。 ── */
type Feature = { id: string; label: string; title: string; body: string; tags: string[]; mock: React.ReactNode };
const FEATURES: Feature[] = [
  {
    id: "onpage", label: "企業ページ",
    title: "会社の情報を登録すると、社員の経歴が集まります。",
    body: "事業・製品・拠点は、求職者がログインしなくても読めます。社員や元社員が自分の職歴に御社を登録すると、企業ページに並びます。載せたくない経歴は、御社側で非表示にできます。",
    tags: ["掲載は無料", "人数・求人の件数に上限なし"],
    mock: <CompanyTabsMock />,
  },
  {
    id: "jobs", label: "募集をつくる",
    title: "求人を載せると、同じ職種で働く社員の経歴も一緒に見てもらえます。",
    body: "企業ページが掲載されたあとは、必要な項目を入れればすぐに公開できます。求人のページには、その職種を経験した社員の経歴が自動で並びます。応募とカジュアル面談の申し込みは、管理画面で受け取れます。",
    tags: ["掲載は無料", "応募者の連絡先も見られる"],
    mock: <JobMock />,
  },
  {
    id: "story", label: "企業記事を書く",
    title: "会社のことを、記事で詳しく伝えられます。",
    body: "事業への思い、チームの働き方、入社した人の話などを、管理画面から記事にして企業ページに載せられます。",
    tags: [],
    mock: <StoryMock />,
  },
  {
    id: "reach-out", label: "人を探して、声をかける",
    title: "登録している人を探して、御社からメッセージを送れます。",
    body: "経験した職種・希望する職種・社会人年数・お住まい・転職への意向で探せます。声をかけた理由を添えて送り、相手が返信すると、そのままやり取りを続けられます。",
    tags: ["条件は保存できる", "返事待ちは10人まで"],
    mock: <CandidateSearchMock />,
  },
  {
    id: "proposal", label: "OPINIOからの紹介",
    title: "募集に合いそうな人を、OPINIOが紹介します。",
    body: "御社で活躍している社員と経歴が近い人に、OPINIOから御社の募集を案内します。本人が「話を聞いてみたい」と答えたときだけ御社に届くので、はじめから御社に興味を持っている人と話せます。",
    tags: [],
    mock: <ProposalMock />,
  },
];

/* ── ④ 求職者が安心して使えるしくみ。⚠️ どれも仕組みどおりの事実（can_send_scout の在籍企業の除外・返信で始まる会話・返事待ちの上限）。 ── */
const TRUST_ITEMS = [
  { title: "いまの会社には出ない", body: "本人が職歴に登録している会社には、候補者検索に表示されません。" },
  { title: "返信するまで、始まらない", body: "企業からのメッセージは、本人が返信したときにはじめてやり取りになります。" },
  { title: "一方的な大量送信はできない", body: "返信があるまで同じ人へ続けて送れず、返事待ちは10人までです。" },
];

/* ── ⑤ はじめ方。⚠️ 公開は企業、確認と停止は運営（2026-10-28）。「審査なし」と書かない。 ── */
const START_STEPS = [
  { title: "担当者のアカウントをつくる", body: "メールアドレスで登録します。会社名だけで始められます。" },
  { title: "会社の情報を入れて公開する", body: "業種・事業領域・事業の説明を入れ、「公開する」を押すと企業一覧に載ります。" },
  { title: "OPINIOが内容を確認", body: "公開後に運営が内容を確認し、問題がある場合は停止します。候補者へのメッセージは、利用を依頼すると運営が確認して使えるようにします。" },
];

/** CTA 下の補足。⚠️ FV と最終CTA で必ず同じ文言にする */
const CTA_NOTE = "企業ページと求人の掲載は無料です。クレジットカードは不要です。";

export default async function ForCompaniesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth?mode=signup";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins").select("id").limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }

  return (
    <>
      <BusinessHeader />
      {/* ⚠️ `id="main-content"` はルート layout が出すスキップリンクの着地点。**外さないこと。**
             ⚠️ paddingTop を足さないこと（冒頭の注記。白い帯になる）。 */}
      <main id="main-content">
        <style>{`
          /* ── 見出し。span を inline-block にして、折り返しを句の境目に固定する（和文は文節を無視して割れるため） ── */
          .lpv4-h1, .lpv4-h2, .lpv4-h3 { font-family: var(--font-noto-serif), serif; font-weight: 500; color: var(--ink); text-wrap: balance; }
          .lpv4-h1 span, .lpv4-h2 span { display: inline-block; }
          .lpv4-h1 { font-size: clamp(28px, 3.6vw, 44px); line-height: 1.4; letter-spacing: -0.01em; }
          .lpv4-h2 { font-size: clamp(22px, 2.6vw, 30px); line-height: 1.5; }
          .lpv4-h3 { font-size: clamp(18px, 2vw, 23px); line-height: 1.55; word-break: auto-phrase; }
          .lpv4-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; color: #2f5bd3; }

          .lpv4-inner { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
          .lpv4-section { padding: 84px 0; }
          @media (max-width: 767px) { .lpv4-section { padding: 60px 0; } }
          .lpv4-tint { background: var(--bg-tint); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
          /* ⚠️ auto-phrase は文節で折る。対応していないブラウザは黙って無視するだけ */
          .lpv4-lead { font-size: clamp(14px, 1.5vw, 16px); color: var(--ink-soft); line-height: 1.95; text-wrap: pretty; word-break: auto-phrase; }
          .lpv4-center { text-align: center; }
          .lpv4-center .lpv4-lead { margin-left: auto; margin-right: auto; }

          /* ── CTA。⚠️ 矢印記号を付けないこと ── */
          .lpv4-cta { display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 28px; }
          .lpv4-cta-primary { background: var(--royal); color: #fff; }
          .lpv4-cta-secondary { background: #fff; color: var(--royal); border: 1.5px solid var(--royal-100); }
          .lpv4-cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
          @media (max-width: 479px) {
            .lpv4-cta-row { flex-direction: column; align-items: stretch; }
            .lpv4-cta { width: 100%; }
          }
          .lpv4-note { margin-top: 14px; font-size: 12.5px; color: var(--ink-mute); line-height: 1.8; }
          .lpv4-mocknote { font-size: 11px; color: var(--ink-mute); text-align: right; margin-top: 12px; }

          /* ── FV。900px 未満で縦積み ── */
          .lpv4-fv-bg { background: linear-gradient(180deg, #fff 0%, var(--bg-tint) 100%); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
          .lpv4-fv { display: grid; grid-template-columns: minmax(0, 1fr); gap: 44px; align-items: center; }
          @media (min-width: 900px) { .lpv4-fv { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 56px; } }

          /* ── 対比。760px 未満で縦積み ── */
          .lpv4-compare { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; margin-top: 40px; }
          @media (min-width: 760px) { .lpv4-compare { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
          .lpv4-compare-card { border: 1px solid var(--line); border-radius: 14px; padding: 26px; background: #fafbfd; }
          .lpv4-compare-card.is-focus { border: 1.5px solid var(--royal); background: #fff; }
          .lpv4-compare-head { font-size: 13px; font-weight: 700; color: var(--ink-mute); letter-spacing: 0.04em; }
          .lpv4-compare-card.is-focus .lpv4-compare-head { color: var(--royal); }
          .lpv4-compare-list { margin: 14px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 14.5px; line-height: 1.75; word-break: auto-phrase; }

          /* ── できること。説明と画面の見本を交互に（900px 未満は説明 → 見本の順で縦積み） ── */
          .lpv4-feature { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; align-items: center; }
          .lpv4-feature + .lpv4-feature { margin-top: 64px; }
          @media (min-width: 900px) {
            .lpv4-feature { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 56px; }
            .lpv4-feature.is-flip .lpv4-feature-text { order: 2; }
          }
          .lpv4-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--royal); background: var(--royal-50); padding: 4px 12px; border-radius: 99px; }
          .lpv4-tags { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
          .lpv4-tag { font-size: 12px; color: var(--ink-soft); border: 1px solid var(--royal-100); border-radius: 99px; padding: 3px 12px; background: #fff; }

          /* ── 安心・はじめ方 ── */
          .lpv4-grid3 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; margin-top: 40px; }
          @media (min-width: 760px) { .lpv4-grid3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
          .lpv4-trust { border-top: 2px solid var(--royal); padding-top: 18px; }
          .lpv4-trust-title { font-weight: 700; font-size: 15.5px; }
          .lpv4-small { margin: 8px 0 0; font-size: 14px; color: var(--ink-soft); line-height: 1.85; word-break: auto-phrase; }
          .lpv4-steps { margin: 40px 0 0; padding: 0; list-style: none; }
          .lpv4-step { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 24px; }
          .lpv4-step-num { font-family: var(--font-noto-serif), serif; font-size: 28px; color: #2f5bd3; line-height: 1.2; }
          .lpv4-step-title { margin-top: 6px; font-weight: 700; font-size: 15.5px; }

          /* ── 最終CTA。⚠️★白の不透明度を 0.78 未満に戻さないこと（濃紺の上で 4.5:1 を下回る） ── */
          .lpv4-final { background: var(--royal); text-align: center; padding: 88px 0; }
          .lpv4-final .lpv4-h2 { color: #fff; }
          .lpv4-final .lpv4-lead { color: rgba(255,255,255,0.82); }
          .lpv4-final .lpv4-note { color: rgba(255,255,255,0.78); }
          .lpv4-final .lpv4-cta-row { justify-content: center; }
          .lpv4-final .lpv4-cta-primary { background: #fff; color: var(--royal); }
          .lpv4-final .lpv4-cta-secondary { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
        `}</style>

        {/* ─── ① FV ───────────────────────────────────────────────────── */}
        <section className="lpv4-section lpv4-fv-bg" style={{ paddingTop: 68 }}>
          <div className="lpv4-inner">
            <div className="lpv4-fv">
              <div>
                <p className="lpv4-eyebrow" style={{ marginBottom: 14 }}>IT企業向けの採用プラットフォーム</p>
                {/* ⚠️ h1 はページに1つだけ。 */}
                <h1 className="lpv4-h1" style={{ marginBottom: 22 }}>
                  <span>そこで働く人が、</span><span>会社を伝える。</span>
                </h1>
                <p className="lpv4-lead" style={{ marginBottom: 32, maxWidth: 520 }}>
                  求人票に書けるのは、仕事内容や年収などの条件までです。OPINIOでは、社員と元社員の経歴を企業ページに並べて、どんな人が働いている会社かを伝えられます。登録している人を探して、メッセージを送ることもできます。
                </p>
                <div className="lpv4-cta-row">
                  <Link href={bizCtaHref} className="lpv4-cta lpv4-cta-primary">企業ページをつくる</Link>
                  {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
                  <Link href="/business/contact" className="lpv4-cta lpv4-cta-secondary">話を聞いてみる</Link>
                </div>
                {/* ⚠️ どちらも事実。掲載は /terms/listing 第4条1項で無料（件数・期間・職種を問わない）。
                       登録に支払い手段は求めていない。 */}
                <p className="lpv4-note">{CTA_NOTE}</p>
              </div>
              <div>
                <CompanyPageMock />
                {/* ⚠️★この注記を消さないこと。見本の社名・経歴は架空。 */}
                <p className="lpv4-mocknote">※ 画面はイメージです</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ② 対比 ─────────────────────────────────────────────────── */}
        <section id="people" className="lpv4-section">
          <div className="lpv4-inner lpv4-center">
            <h2 className="lpv4-h2"><span>求人票だけでは、</span><span>伝わらないことがあります。</span></h2>
            <p className="lpv4-lead" style={{ marginTop: 14, maxWidth: 640 }}>
              求職者が本当に知りたいのは、入社したあとに一緒に働く人のことです。
            </p>
            <div className="lpv4-compare" style={{ textAlign: "left" }}>
              <div className="lpv4-compare-card">
                <div className="lpv4-compare-head">求人票が伝えること</div>
                <ul className="lpv4-compare-list" style={{ color: "var(--ink-mute)" }}>
                  {SPEC_ITEMS.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
              <div className="lpv4-compare-card is-focus">
                <div className="lpv4-compare-head">OPINIOで社員の経歴が伝えること</div>
                <ul className="lpv4-compare-list">
                  {PEOPLE_ITEMS.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ③ OPINIOでできる5つのこと ───────────────────────────────── */}
        <section id="features" className="lpv4-section lpv4-tint">
          <div className="lpv4-inner">
            <div className="lpv4-center" style={{ marginBottom: 52 }}>
              <p className="lpv4-eyebrow">OPINIOでできること</p>
              <h2 className="lpv4-h2" style={{ marginTop: 8 }}>OPINIOでできる5つのこと</h2>
            </div>
            {FEATURES.map((f, i) => (
              <div key={f.id} id={f.id} className={`lpv4-feature${i % 2 === 1 ? " is-flip" : ""}`} style={{ scrollMarginTop: 80 }}>
                <div className="lpv4-feature-text">
                  <span className="lpv4-badge">{i + 1}　{f.label}</span>
                  <h3 className="lpv4-h3" style={{ marginTop: 14 }}>{f.title}</h3>
                  <p className="lpv4-lead" style={{ marginTop: 12 }}>{f.body}</p>
                  {f.tags.length > 0 && (
                    <div className="lpv4-tags">{f.tags.map((t) => <span key={t} className="lpv4-tag">{t}</span>)}</div>
                  )}
                </div>
                <div>{f.mock}</div>
              </div>
            ))}
            {/* ⚠️★この注記を消さないこと。見本の名前・経歴は架空。 */}
            <p className="lpv4-mocknote" style={{ marginTop: 36 }}>※ 画面はイメージです。名前・経歴は架空です</p>
          </div>
        </section>

        {/* ─── ④ 求職者が安心して使えるしくみ ─────────────────────────────── */}
        <section id="trust" className="lpv4-section">
          <div className="lpv4-inner">
            <h2 className="lpv4-h2 lpv4-center">求職者が安心して使えるしくみ</h2>
            <div className="lpv4-grid3">
              {TRUST_ITEMS.map((t) => (
                <div key={t.title} className="lpv4-trust">
                  <div className="lpv4-trust-title">{t.title}</div>
                  <p className="lpv4-small">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ⑤ はじめ方 ─────────────────────────────────────────────── */}
        <section id="start" className="lpv4-section lpv4-tint">
          <div className="lpv4-inner">
            <h2 className="lpv4-h2 lpv4-center">はじめ方</h2>
            <ol className="lpv4-steps lpv4-grid3">
              {START_STEPS.map((s, i) => (
                <li key={s.title} className="lpv4-step">
                  <div className="lpv4-step-num">{i + 1}</div>
                  <div className="lpv4-step-title">{s.title}</div>
                  <p className="lpv4-small">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── ⑥ 最終CTA ─────────────────────────────────────────────── */}
        <section className="lpv4-final">
          <div className="lpv4-inner" style={{ maxWidth: 640 }}>
            <h2 className="lpv4-h2" style={{ marginBottom: 16 }}>
              <span>まずは、企業ページを</span><span>つくってみてください。</span>
            </h2>
            <p className="lpv4-lead" style={{ marginBottom: 36 }}>
              登録は無料です。会社名だけで始められます。
            </p>
            <div className="lpv4-cta-row">
              <Link href={bizCtaHref} className="lpv4-cta lpv4-cta-primary">企業ページをつくる</Link>
              {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
              <Link href="/business/contact" className="lpv4-cta lpv4-cta-secondary">話を聞いてみる</Link>
            </div>
            <p className="lpv4-note">{CTA_NOTE}</p>
          </div>
        </section>

        {/*
          Mobile sticky
          ⚠️ ボタンは1本だけにする（2026-08-21）。FV に主CTAと副CTAが並んでいるため、
             ここにも2本置くと同じボタンが画面内に重複する。
        */}
        <div className="md:hidden" style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line)",
          padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
          zIndex: 50,
        }}>
          <Link href={bizCtaHref} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "14px 12px", background: "var(--royal)", color: "#fff",
            borderRadius: 6, fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}>
            企業ページをつくる
          </Link>
        </div>
        <div className="md:hidden" style={{ height: 76 }} />

      </main>
      <JobseekerFooter />
    </>
  );
}

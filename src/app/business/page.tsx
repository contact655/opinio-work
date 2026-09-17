import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { PathsVisual } from "@/components/business/lp/PathsVisual";
import { SeatVisual } from "@/components/business/lp/SeatVisual";
import { CareerTimeline } from "@/components/business/lp/CareerTimeline";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 600;

/*
 * ═══ 企業向けLP ═══════════════════════════════════════════════════════════
 *
 * 2026-09-17 に v3 として作り直した。メッセージは3段:
 *   ① 求職者は、人から会社を知る（FV）
 *   ② だから企業は、働く人で伝わる（対比 → 企業ページに並ぶもの）
 *   ③ 集まった経歴を使って、空いた席に合う人を提案する（提案のしくみ）
 *
 * ⚠️★**FV下の一文は、トップページ（LandingPage.tsx）の h1 と完全一致させる。**
 *    「会社を、そこで働く人から知る。」。片方だけ直すと対にならない。
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
 *
 * ⚠️★**「話せる人」を「無料で招待できる」と書かないこと（2026-09-17 実測）。**
 *    `ambassadorInvite` は `free: false`（lib/constants/plans.ts）で、
 *    本番の有料プランは **0社**。招待は今日1社も通らない。
 *    一方**本人の自己申告でその企業に並ぶのは無料**なので、
 *    セクション3の文はその2つを分けて書いてある。**片方だけにしないこと。**
 *
 * ⚠️★**「提案します」と断定しないこと（2026-09-17 実測）。**
 *    企業へ候補者を提案する処理・画面・通知は**存在しない**。
 *    `ow_transitions` の参照は src で0件、`/biz/candidates` の `Candidate` 型は
 *    **過去の在籍先も経歴の順序も持っていない**（現職1件のみ）。
 *    だから本文は「提案していきます」。**実装が入った日に「提案します」へ直す。**
 *
 * ⚠️ **次の主張を書き足さないこと。** どれも実体が無い。
 *   ・候補者の質・量　・応募が来ること（ow_job_applications は0行）
 *   ・スカウト（SCOUT_SENDING_ENABLED 未設定で停止中）
 *   ・カジュアル面談の実績　・メンター（機能が存在しない）
 *
 * ⚠️ **数値を載せないこと。** 登録者数・通過率・承諾率・定着率・日数のいずれも
 *    実測値が無い。出身企業のロゴ帯も復活させない。導入企業の声も枠ごと作らない。
 *
 * ⚠️ 掲載が無料であることは /terms/listing 第4条1項に定めがあるので、
 *    **「掲載は無料」はここに書いてよい**（金額と有料プランの話は pricing 側）。
 *
 * ⚠️ **「審査なし」と書かないこと。** 自己登録した企業は `is_published: false` で
 *    作られ、`is_published` が true になるまで求人を published にできない。
 *
 * ⚠️★**mailto: を置かないこと。** メーラーの無い環境では押しても何も起きない。
 *    相談の導線は `/business/contact`（フォーム）。
 *    ⚠️ ここを `**` で囲まないこと。`**` とパスの `/` が並ぶと `*&#47;` になり、
 *       **このブロックコメントがその場で閉じる**（実際に一度壊した）。
 *
 * ⚠️★**`<main>` に paddingTop を足さないこと（2026-09-17）。**
 *    `BusinessHeader` は `position: sticky` で**すでに 60px を占めている**。
 *    fixed ヘッダー用の逃がしを足すと、その下に**約60pxの白い帯**ができる
 *    （実測: header bottom 61px / 最初の section top 121px）。
 *
 * ⚠️ 図版は components/business/lp/ の3つ。**画像ファイルにしない。**
 *    ⚠️ 2026-09-17 に `ProposalDiagrams.tsx` は削除した（唯一の使い手がここで、
 *       FV の組織図ごと差し替えたため）。**復活させるなら使い手ごと。**
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "そこで働く人が、会社を伝える。 | OPINIO for Business" },
  description:
    "求人票に書けるのは、条件までです。どんな人が集まり、どこから来て、どこへ進んでいったのか。OPINIOでは、社員とOB・OGが歩いてきた道が、そのまま会社の紹介になります。IT業界に特化したキャリアプラットフォーム。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "そこで働く人が、会社を伝える。 | OPINIO for Business",
    description: "社員とOB・OGが歩いてきた道が、そのまま会社の紹介になります。IT業界に特化したキャリアプラットフォーム OPINIO の企業向けページ。",
    type: "website",
    url: "https://opinio.jp/business",
    images: [{ url: "https://opinio.jp/api/og?name=OPINIO+for+Business&sub=%E6%8E%A1%E7%94%A8%E3%81%AF%E3%80%81%E6%A4%9C%E7%B4%A2%E3%81%8B%E3%82%89%E6%8F%90%E6%A1%88%E3%81%B8&v=2", width: 1200, height: 630 }],
  },
};

/* ── セクション3の行。⚠️ タグは「無料で今できること」と「有料プラン」を
      取り違えないこと。冒頭の注記を読んでから触る。 ───────────────────── */
const ON_PAGE_ROWS = [
  {
    title: "会社の輪郭",
    body: "事業、製品、拠点。求職者はログインしなくても読めます。",
    tag: "無料",
  },
  {
    title: "働く人の経歴",
    body: "社員やOB・OGが自分の職歴に御社を入れると、企業ページに並びます。載せたくない経歴は、御社側で非表示にできます。",
    tag: "人数の上限なし",
  },
  {
    title: "話せる人",
    body: "現場の社員が、候補者の質問に答える役を自分から引き受けられます。人事の言葉ではなく、現場の言葉で会社が伝わります。社員を指名して招待するのは、有料プランの機能です。",
    tag: "招待は有料プラン",
  },
  {
    title: "求人",
    body: "募集中のポジションを、会社と働く人の情報の隣に並べて掲載します。",
    tag: "件数の上限なし",
  },
];

/** 求人票が伝えること / 働く人が伝えること */
const SPEC_ITEMS = ["職種と仕事内容", "年収レンジと勤務地", "必須・歓迎要件"];
const PEOPLE_ITEMS = [
  "どんな経歴の人が、この職種で働いているか",
  "前の会社から、何を持ち込んだ人が多いか",
  "ここを経て、どこへ進んだ人がいるか",
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
          /* ── 見出し ──
             ⚠️ span を inline-block にして、折り返しを句の境目に固定する。
                和文は文節を無視してどこでも割れるので、これが無いと
                「歩いてき／た人を」になる。balance は行の均しで、
                塊を守るのは inline-block のほう。**両方要る。** */
          .lpv3-h1, .lpv3-h2 { font-family: var(--font-noto-serif), serif; font-weight: 500; color: var(--ink); text-wrap: balance; }
          .lpv3-h1 span, .lpv3-h2 span { display: inline-block; }
          .lpv3-h1 { font-size: clamp(27px, 3.4vw, 42px); line-height: 1.4; letter-spacing: -0.01em; }
          .lpv3-h2 { font-size: clamp(22px, 2.8vw, 32px); line-height: 1.45; }

          .lpv3-inner { max-width: 1040px; margin: 0 auto; padding: 0 24px; }
          .lpv3-section { padding: 76px 0; }
          /* ⚠️ 和文は文節を無視してどこでも割れる（「発揮してい／る人」になる）。
                auto-phrase は文節で折る。対応していないブラウザは黙って無視するだけ。
                ⚠️ 見出しの塊は span の inline-block が守る。こちらは本文用。 */
          .lpv3-lead { font-size: clamp(14px, 1.5vw, 16.5px); color: var(--ink-soft); line-height: 1.95; text-wrap: pretty; word-break: auto-phrase; }

          /* ── CTA。⚠️ 矢印記号を付けないこと ── */
          .lpv3-cta { display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 30px; }
          .lpv3-cta-primary { background: var(--royal); color: #fff; }
          .lpv3-cta-secondary { background: #fff; color: var(--royal); border: 1.5px solid var(--royal-100); }
          .lpv3-cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
          /* ⚠️ 狭い画面では2本の幅が揃わないと不揃いに見える（実測 390px）。
                縦に積んで全幅にする。 */
          @media (max-width: 479px) {
            .lpv3-cta-row { flex-direction: column; align-items: stretch; }
            .lpv3-cta { width: 100%; }
          }
          .lpv3-note { margin-top: 16px; font-size: 12.5px; color: var(--ink-mute); line-height: 1.8; }

          /* ── FV。900px 未満で縦積み ── */
          .lpv3-fv { display: grid; grid-template-columns: 1fr; gap: 44px; align-items: center; }
          @media (min-width: 900px) {
            .lpv3-fv { grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: 56px; }
          }
          .lpv3-echo { margin-top: 34px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-mute); line-height: 1.9; word-break: auto-phrase; }
          .lpv3-echo b { font-family: var(--font-noto-serif), serif; font-weight: 500; font-size: 15.5px; color: var(--ink-soft); }

          /* ── 対比。760px 未満で縦積み ── */
          .lpv3-compare { display: grid; grid-template-columns: 1fr; gap: 28px; }
          @media (min-width: 760px) { .lpv3-compare { grid-template-columns: 1fr 1fr; gap: 48px; } }
          .lpv3-col-head { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; padding-bottom: 12px; border-bottom: 2px solid var(--line); }
          .lpv3-col-head.is-focus { color: var(--royal); border-bottom-color: var(--royal); }
          .lpv3-col-head.is-mute { color: var(--ink-mute); }
          .lpv3-item { font-size: 14.5px; line-height: 1.8; padding: 15px 0; border-bottom: 1px solid var(--line-soft); word-break: auto-phrase; }

          /* ── 企業ページに並ぶもの。760px 未満で縦積み ── */
          .lpv3-rows { border-top: 2px solid var(--royal); }
          .lpv3-row { display: grid; grid-template-columns: 1fr; gap: 6px; padding: 22px 0; border-bottom: 1px solid var(--line); }
          @media (min-width: 760px) {
            .lpv3-row { grid-template-columns: 172px minmax(0, 1fr) 132px; gap: 24px; align-items: start; }
          }
          .lpv3-row-title { font-family: var(--font-noto-serif), serif; font-size: 17px; font-weight: 500; color: var(--ink); line-height: 1.6; }
          .lpv3-row-body { font-size: 14px; color: var(--ink-soft); line-height: 1.9; word-break: auto-phrase; }
          .lpv3-row-tag { font-size: 12px; font-weight: 700; color: var(--ink-mute); line-height: 1.7; }
          @media (min-width: 760px) { .lpv3-row-tag { text-align: right; } }

          /* ── 提案のしくみ。900px 未満で縦積み ── */
          .lpv3-proposal { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: center; }
          @media (min-width: 900px) { .lpv3-proposal { grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr); gap: 52px; } }

          /* ── 最終CTA ──
             ⚠️★白の不透明度を 0.78 未満に戻さないこと。濃紺（#002366）の上で
                小さい文字に必要な 4.5:1（WCAG AA）を下回る。 */
          .lpv3-final { background: var(--royal); text-align: center; padding: 88px 0; }
          .lpv3-final .lpv3-h2 { color: #fff; }
          .lpv3-final .lpv3-lead { color: rgba(255,255,255,0.82); }
          .lpv3-final .lpv3-note { color: rgba(255,255,255,0.78); }
          .lpv3-final .lpv3-cta-row { justify-content: center; }
          .lpv3-final .lpv3-cta-primary { background: #fff; color: var(--royal); }
          .lpv3-final .lpv3-cta-secondary { background: transparent; color: #fff; border-color: rgba(255,255,255,0.5); }
        `}</style>

        {/* ─── ① FV ───────────────────────────────────────────────────── */}
        <section className="lpv3-section" style={{ borderTop: "1px solid var(--line)", paddingTop: 68 }}>
          <div className="lpv3-inner">
            <div className="lpv3-fv">
              <div>
                {/* ⚠️ h1 はページに1つだけ。 */}
                <h1 className="lpv3-h1" style={{ marginBottom: 22 }}>
                  <span>そこで働く人が、</span><span>会社を伝える。</span>
                </h1>

                <p className="lpv3-lead" style={{ marginBottom: 32 }}>
                  求人票に書けるのは、条件までです。どんな人が集まり、どこから来て、どこへ進んでいったのか。
                  OPINIOでは、社員とOB・OGが歩いてきた道が、そのまま会社の紹介になります。
                </p>

                <div className="lpv3-cta-row">
                  <Link href={bizCtaHref} className="lpv3-cta lpv3-cta-primary">企業ページをつくる</Link>
                  {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
                  <Link href="/business/contact" className="lpv3-cta lpv3-cta-secondary">話を聞いてみる</Link>
                </div>

                {/* ⚠️ どちらも事実。掲載は /terms/listing 第4条1項で無料（件数・期間・職種を問わない）。
                       登録に支払い手段は求めていない。 */}
                <p className="lpv3-note">{CTA_NOTE}</p>

                {/* ⚠️★かぎかっこの中はトップページの h1 と完全一致。片方だけ直さないこと。 */}
                <p className="lpv3-echo">
                  求職者は、OPINIOで<b>「会社を、そこで働く人から知る。」</b>
                </p>
              </div>

              <div>
                <PathsVisual />
              </div>
            </div>
          </div>
        </section>

        {/* ─── ② 対比 ─────────────────────────────────────────────────── */}
        <section id="people" className="lpv3-section" style={{ background: "var(--bg-tint)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div className="lpv3-inner">
            <h2 className="lpv3-h2" style={{ marginBottom: 14 }}>
              <span>条件は、求人票で。</span><span>手ざわりは、人で。</span>
            </h2>
            <p className="lpv3-lead" style={{ marginBottom: 44, maxWidth: 640 }}>
              求職者が本当に知りたいのは、入ったあとに隣にいる人のことです。
            </p>

            <div className="lpv3-compare">
              <div>
                <div className="lpv3-col-head is-mute">求人票が伝えること</div>
                {SPEC_ITEMS.map((t) => (
                  <div key={t} className="lpv3-item" style={{ color: "var(--ink-mute)" }}>{t}</div>
                ))}
              </div>
              <div>
                <div className="lpv3-col-head is-focus">働く人が伝えること</div>
                {PEOPLE_ITEMS.map((t) => (
                  <div key={t} className="lpv3-item" style={{ color: "var(--ink)" }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── ③ 企業ページに並ぶもの ──────────────────────────────────── */}
        <section id="onpage" className="lpv3-section">
          <div className="lpv3-inner">
            <h2 className="lpv3-h2" style={{ marginBottom: 14 }}>企業ページに並ぶもの</h2>
            <p className="lpv3-lead" style={{ marginBottom: 40, maxWidth: 640 }}>
              会社の情報を置けば、あとは働く人の経歴が少しずつ集まっていきます。
            </p>

            {/* ⚠️ 番号を付けないこと。順序のある内容ではない。 */}
            <div className="lpv3-rows">
              {ON_PAGE_ROWS.map(({ title, body, tag }) => (
                <div key={title} className="lpv3-row">
                  <div className="lpv3-row-title">{title}</div>
                  <div className="lpv3-row-body">{body}</div>
                  <div className="lpv3-row-tag">{tag}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ④ 提案のしくみ ─────────────────────────────────────────── */}
        <section id="proposal" className="lpv3-section" style={{ background: "var(--bg-tint)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div className="lpv3-inner">
            <h2 className="lpv3-h2" style={{ marginBottom: 14 }}>
              <span>空いた席には、</span><span>同じ道を歩いてきた人を。</span>
            </h2>
            {/* ⚠️★「提案します」に直さないこと。未実装（冒頭の注記）。 */}
            <p className="lpv3-lead" style={{ marginBottom: 44, maxWidth: 660 }}>
              {/* ⚠️ 「手がかり」だけは `word-break: auto-phrase` でも 420px 以下で
                     「手が／かり」に割れる（2026-09-17 に全幅を掃いて確認。割れるのはここ1語だけ）。
                     見出しと同じ手で塊にして守る。**span を外さないこと。** */}
              集まった経歴は、次の一人を見つける<span style={{ display: "inline-block" }}>手がかり</span>にもなります。
              その席で力を発揮している人と、似た道を歩いてきた人を、OPINIOが御社に提案していきます。
            </p>

            <div className="lpv3-proposal">
              <CareerTimeline />
              <SeatVisual />
            </div>

            {/* ⚠️★この注記を消さないこと。図の経歴・チーム構成は架空。 */}
            <p style={{ marginTop: 24, fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              ※ 本ページの図（経歴・チーム構成）は仕組みのイメージです
            </p>
          </div>
        </section>

        {/* ─── ⑤ 最終CTA ─────────────────────────────────────────────── */}
        <section className="lpv3-final">
          <div className="lpv3-inner" style={{ maxWidth: 640 }}>
            <h2 className="lpv3-h2" style={{ marginBottom: 16 }}>
              <span>まず、会社を</span><span>置いてみてください。</span>
            </h2>
            <p className="lpv3-lead" style={{ marginBottom: 36 }}>
              企業ページをつくるところから始められます。
            </p>
            <div className="lpv3-cta-row">
              <Link href={bizCtaHref} className="lpv3-cta lpv3-cta-primary">企業ページをつくる</Link>
              {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
              <Link href="/business/contact" className="lpv3-cta lpv3-cta-secondary">話を聞いてみる</Link>
            </div>
            <p className="lpv3-note">{CTA_NOTE}</p>
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

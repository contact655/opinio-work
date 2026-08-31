import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { OrgChart, CareerMatch } from "@/components/business/ProposalDiagrams";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 600;

/*
 * ═══ 企業向けLP ═══════════════════════════════════════════════════════════
 *
 * 2026-08-31 に「提案」1本へ絞って作り直した。
 * FV（組織図）→ マニフェスト → 提案のしくみ（職歴年表）→ 3ステップ → 最終CTA。
 *
 * ⚠️★**料金の話をこのページに書かない。** 金額・プラン・FAQ は
 *    **[/business/pricing](pricing/page.tsx)** にある。
 *    掲載利用規約 第4条2項が「有料プランの内容・料金・支払方法・契約期間は
 *    本サービス上に表示するところによる」と定めているので、
 *    **単純に消すことはできず、移設という形にした。**
 *    ⚠️ ここに金額を書き戻さないこと。**表示先が2つになると片方だけ古くなる。**
 *    ⚠️ 数字は `PAID_PLAN_MONTHLY_FEE`（lib/constants/plans.ts）が唯一の定義で、
 *       読むのは pricing 側だけ。
 *
 * ⚠️★**トップに戻さないと決めたもの（2026-08-31）。**
 *    ・料金セクション・FAQ →（上記のとおり /business/pricing へ移設）
 *    ・導入の流れ（STEP1〜3）→ 3ステップに統合した
 *    ・製品UIのキャプチャ（企業ページ / 求人フォーム）→ 図版に置き換えた
 *      ⚠️ 求人フォームのキャプチャは、プレースホルダに**実在他社名**
 *         （タイミー）が写り込んでいた。戻すなら撮り直しから。
 *
 * ⚠️ **次の主張を書き足さないこと。** どれも 2026-08-21 時点で実体が無い。
 *   ・候補者の質・量（IT/SaaS の職歴を持つ外部実ユーザーは1人）
 *   ・応募が来ること（ow_job_applications は0行）
 *   ・スカウト（SCOUT_SENDING_ENABLED 未設定で停止中）
 *   ・カジュアル面談の実績（ow_casual_meetings は0行）
 *   ・メンター（機能が存在しない。ow_users.is_mentor は書き込み経路0件の死列）
 *
 * ⚠️ **数値を載せないこと。** 登録者数・通過率・承諾率・定着率・日数のいずれも
 *    実測値が無い。出身企業のロゴ帯も復活させない（実データと乖離した経緯がある）。
 *    導入企業の声も、掲載可能な実在の事例が出るまで枠ごと作らない。
 *
 * ⚠️ 掲載が無料であることは /terms/listing 第4条1項に定めがあるので、
 *    **「掲載は無料」はここに書いてよい**（金額と成果報酬の話は pricing 側）。
 *
 * ⚠️ **「審査なし」と書かないこと（2026-08-21 実測）。**
 *    自己登録した企業は `is_published: false` で作られ
 *    （api/biz/companies/route.ts）、`is_published` が true になるまで
 *    求人を published にできない（api/biz/jobs/[id]/route.ts が 403 を返す）。
 *
 * ⚠️★**mailto: を置かないこと。** メーラーの無い環境では押しても何も起きない。
 *    相談の導線は `/business/contact`（フォーム）。
 *    ⚠️ ここを `**` で囲まないこと。`**` とパスの `/` が並ぶと `*&#47;` になり、
 *       **このブロックコメントがその場で閉じる**（実際に一度壊した）。
 *
 * ⚠️ 図版は [components/business/ProposalDiagrams.tsx](../../components/business/ProposalDiagrams.tsx)。
 *    広い画面と狭い画面で**別の SVG** を出している。片方だけ直さないこと。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS採用プラットフォーム | OPINIO for Business" },
  description:
    "自社の組織のどこに、どんな形の空きがあるのか。条件を打ち込んで探すのではなく、そこに収まる人を OPINIO が指し示します。IT/SaaS業界に特化したキャリアプラットフォーム。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "IT/SaaS採用プラットフォーム | OPINIO for Business",
    description: "足りないところに、ぴったり収まる人を。IT/SaaS業界に特化したキャリアプラットフォーム OPINIO の企業向けページ。",
    type: "website",
    url: "https://opinio.jp/business",
    images: [{ url: "https://opinio.jp/api/og?name=OPINIO+for+Business&sub=%E6%8E%A1%E7%94%A8%E3%81%AF%E3%80%81%E6%A4%9C%E7%B4%A2%E3%81%8B%E3%82%89%E6%8F%90%E6%A1%88%E3%81%B8&v=2", width: 1200, height: 630 }],
  },
};

/** セクション頭の小文字ラベル */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block", fontSize: 12, fontWeight: 700,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
      color: "var(--royal)", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

/*
 * ⚠️ 3ステップは**カード枠にしない**（2026-08-31）。
 *    上辺 2px のアクセント罫線と余白だけで区切る。
 *    枠を足すと、外した「導入の流れ」のカードに戻ることになる。
 */
const STEPS = [
  {
    title: "会社を置く",
    body: "事業・製品・拠点を載せた企業ページをつくります。求職者は登録なしで読めます。",
  },
  {
    title: "組織の形が見える",
    body: "社員とOB・OGの経歴が並びます。どんな人で成り立っている会社なのかが、人の側から立ち上がります。",
  },
  {
    title: "空いた席に合う人を示す",
    body: "その席で力を発揮した人と同じ道を歩いてきた人を、OPINIOが提案します。",
  },
];

export default async function ForCompaniesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth?mode=signup";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins").select("id").limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }

  const innerStyle: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };

  return (
    <>
      <BusinessHeader />
      {/* ⚠️ `id="main-content"` はルート layout が出すスキップリンク
             （`<a href="#main-content">メインコンテンツへスキップ</a>`）の着地点。
             **外さないこと。** 2026-08-31 まで /business には着地点が無く、
             **押しても何も起きない死にアンカー**だった（`BusinessLayout` を
             通らないページなので、あちらの `<main id="main-content">` が効かない）。 */}
      <main id="main-content" style={{ paddingTop: 60 }}>

        {/* ─── FV ─────────────────────────────────────────────────────── */}
        <section style={{
          background: "linear-gradient(180deg, var(--royal-50) 0%, #fff 100%)",
          borderTop: "1px solid var(--line)",
          padding: "80px 24px 72px",
        }}>
          <div style={{ ...innerStyle, textAlign: "center" }}>
            <SectionLabel>採用は、検索から提案へ</SectionLabel>

            {/* ⚠️ h1 はページに1つだけ。
                ⚠️ 和文は文節を無視してどこでも改行される。割りたくない塊を
                   inline-block で包んでいる（390px で「ぴった / り」に割れる）。 */}
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 500,
              color: "var(--ink)", lineHeight: 1.35, marginBottom: 20,
            }}>
              {/* ⚠️ 2行に固定する。広い画面では1行に収まってしまうので `<br />` を入れる。
                     inline-block は「割りたくない塊」を守るためのもので、
                     **改行位置は指定できない**（和文はどこでも改行される）。
                     390px でも各行が収まるので、3行にはならない。 */}
              <span style={{ display: "inline-block" }}>足りないところに、</span>
              <br />
              <span style={{ display: "inline-block" }}>ぴったり収まる人を。</span>
            </h1>

            <p style={{
              fontSize: "clamp(14px, 2vw, 17px)", color: "var(--ink-soft)",
              lineHeight: 1.9, marginBottom: 40, maxWidth: 660,
              marginLeft: "auto", marginRight: "auto",
            }}>
              自社の組織のどこに、どんな形の空きがあるのか。
              条件を打ち込んで探すのではなく、そこに収まる人をOPINIOが指し示します。
            </p>

            {/* 組織図。⚠️ 広い画面と狭い画面で別の SVG（ProposalDiagrams.tsx） */}
            <div style={{ maxWidth: 680, margin: "0 auto 40px" }}>
              <OrgChart />
            </div>

            <div style={{
              display: "flex", gap: 12, justifyContent: "center",
              flexWrap: "wrap", alignItems: "center",
            }}>
              <Link href={bizCtaHref} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "15px 34px", background: "var(--royal)", color: "#fff",
                borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 16px rgba(0,35,102,0.22)",
              }}>
                企業ページをつくる
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </Link>
              {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
              <Link href="/business/contact" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "15px 28px", background: "#fff", color: "var(--royal)",
                border: "1.5px solid var(--royal-100)", borderRadius: 10,
                fontSize: 15, fontWeight: 700, textDecoration: "none",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                話を聞いてみる
              </Link>
            </div>

            {/* ⚠️ どちらも事実。登録はメールアドレスだけで完了し、
                   支払い手段の登録は求めていない（掲載は /terms/listing 第4条1項で無料）。 */}
            <p style={{ marginTop: 16, fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              メールアドレスだけ　·　クレジットカード不要
            </p>
          </div>
        </section>

        {/* ─── マニフェスト帯 ──────────────────────────────────────────── */}
        <section style={{
          background: "var(--bg-tint)",
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          padding: "72px 24px",
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <h2 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 500,
              color: "var(--ink)", lineHeight: 1.4, marginBottom: 22,
            }}>
              探す前に、届く。
            </h2>
            <p style={{ fontSize: "clamp(14px, 2vw, 16px)", color: "var(--ink-soft)", lineHeight: 2 }}>
              <span style={{ display: "block" }}>検索は、欲しい人物像がわかっている前提の道具です。</span>
              <span style={{ display: "block" }}>本当に足りない人は、たいてい言葉になっていません。</span>
            </p>
          </div>
        </section>

        {/* ─── 提案のしくみ ────────────────────────────────────────────── */}
        <section id="how" style={{ background: "#fff", padding: "80px 24px" }}>
          <div style={innerStyle}>
            <div style={{ maxWidth: 660, marginBottom: 48 }}>
              <SectionLabel>提案のしくみ</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.4,
              }}>
                根拠は、その人の歩いてきた道。
              </h2>
              <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                どこから来て、いま何をしているのか。
                空いている席で力を発揮した人と同じ道を歩いてきた人を、OPINIOが指し示します。
              </p>
            </div>

            {/* 職歴年表 → 空席 */}
            <CareerMatch />

            {/* ⚠️★この注記を消さないこと。**組織図と職歴の両方**にかかる文言にしてある。
                   図に出てくる経歴は仕組みを説明するための例で、実データではない。
                   片方だけの注記にすると、FV の組織図が実在の自社組織だと読まれる。 */}
            <p style={{ marginTop: 20, fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              ※ 本ページの図（組織図・職歴）は仕組みのイメージです。経歴・組織は実在の特定個人や実際の求人を示すものではありません。
            </p>
          </div>
        </section>

        {/* ─── 3ステップ ──────────────────────────────────────────────── */}
        <section id="steps" style={{ background: "var(--bg-tint)", padding: "80px 24px" }}>
          <div style={innerStyle}>
            {/* ⚠️ カード枠にしない。上辺2pxの罫線＋余白だけで区切る（理由は STEPS の上） */}
            <div className="grid grid-cols-1 gap-y-10 gap-x-8 md:grid-cols-3">
              {STEPS.map(({ title, body }, i) => (
                <div key={title} style={{ borderTop: "2px solid var(--royal)", paddingTop: 20 }}>
                  <div style={{
                    fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 800,
                    letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 12,
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 10, lineHeight: 1.45 }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Final CTA ──────────────────────────────────────────────── */}
        <section style={{
          padding: "96px 24px",
          background: "linear-gradient(135deg, #001F5B 0%, #002E8A 50%, #003BB5 100%)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 40%)" }} />
          <div style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(25px, 4vw, 40px)", fontWeight: 500, color: "#fff", lineHeight: 1.35, marginBottom: 16 }}>
              <span style={{ display: "inline-block" }}>まず、会社を</span>
              <span style={{ display: "inline-block" }}>置いてみてください。</span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, marginBottom: 40 }}>
              企業ページをつくるところから始められます。掲載は無料です。
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={bizCtaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 40px", background: "#fff", color: "var(--royal)", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.16)" }}>
                企業ページをつくる
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
              {/* ⚠️ mailto に戻さないこと。実体は /business/contact のフォーム。 */}
              <Link href="/business/contact" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 32px", background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                話を聞いてみる
              </Link>
            </div>
            {/* ⚠️★白の不透明度を 0.78 未満に戻さないこと（2026-08-31 実測）。
                   濃紺グラデ（rgb(0,31,91)→rgb(0,59,181)）の**明るい側**で測ると
                   0.55 で 3.79 / 0.5 で 3.38 となり、小さい文字に必要な
                   4.5:1（WCAG AA）を下回る。0.78 なら 6.1 で通る。
                ⚠️ 測るときは**グラデーションの明るい側**で計算すること。 */}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              {["求人掲載は無料", "既存媒体と並行可能"].map((txt) => (
                <div key={txt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.78)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {txt}
                </div>
              ))}
            </div>
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
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "14px 12px", background: "var(--royal)", color: "#fff",
            borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
          }}>
            企業ページをつくる
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="md:hidden" style={{ height: 76 }} />

      </main>
      <JobseekerFooter />
    </>
  );
}

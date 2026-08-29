import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";
import { PAID_PLAN_MONTHLY_FEE } from "@/lib/constants/plans";

export const revalidate = 600;

/*
 * ═══ 企業向けLP ═══════════════════════════════════════════════════════════
 *
 * ⚠️ **約束してよいのは、無料の範囲と有料プランの3機能だけ。**
 *    金額は `PAID_PLAN_MONTHLY_FEE`（lib/constants/plans.ts）から出す。
 *    **このファイルに数字を書かない。**
 *
 * 2026-08-21 に全面的に作り直した。それ以前は「即戦力がもう登録しています」
 * 「メンター面談を経た本気層」「編集部が直接ヒアリングしてプロフィールを整えます」
 * を主張していたが、実データの裏付けが1つも無かった（削除の経緯は同日のコミット）。
 *
 * ⚠️ **次の主張を書き足さないこと。** どれも 2026-08-21 時点で実体が無い。
 *   ・候補者の質・量（IT/SaaS の職歴を持つ外部実ユーザーは1人）
 *   ・応募が来ること（ow_job_applications は0行）
 *   ・スカウト（SCOUT_SENDING_ENABLED 未設定で停止中）
 *   ・カジュアル面談の実績（ow_casual_meetings は0行）
 *   ・メンター（機能が存在しない。ow_users.is_mentor は書き込み経路0件の死列）
 *
 * ⚠️ **金額は定数から出す。ここに数字を書かない**（LPと運営画面で二重に持たない）。
 *    掲載が無料であることは /terms/listing 第4条1項に定めがある。
 *    **「成果報酬は発生しません」も書いてよい**（2026-08-21 の規約改定以降。
 *    第4条2項「費用は有料プランの利用料金のみ」／第6条3項「人数にかかわらず費用が
 *    発生しない」と一致する）。
 *
 * ⚠️ **スカウト送信を有料プランの機能として書かないこと。**
 *    SCOUT_SENDING_ENABLED で停止中で、`PLAN_FEATURES` からも外してある。
 *
 * ⚠️ **「審査なし」と書かないこと（2026-08-21 実測）。**
 *    自己登録した企業は `is_published: false` で作られ
 *    （api/biz/companies/route.ts）、`is_published` が true になるまで
 *    求人を published にできない（api/biz/jobs/[id]/route.ts が 403 を返す）。
 *    以前の「登録は1分・審査なし」「登録後すぐに求人を公開できます」は誤り。
 *
 * ── スクリーンショット ──────────────────────────────────────────────────
 * /images/lp-business/*.webp。**ライブプレビューにしない**（求職者向けLPと同じ理由）。
 *
 *   company-page-v2.webp     2688×2084  viewport 1440 / clip x=48 y=1250 w=1344 h=1042
 *   company-page-sm-v2.webp   800×1720  viewport  440 / clip x=20 y=1600 w=400  h=860
 *   job-form-v2.webp         1820×1400  viewport 1440 / clip x=490 y=626 w=910 h=700
 *   job-form-sm-v2.webp       480×816   viewport 1440 / clip x=246 y=126 w=240 h=408
 *
 * ⚠️ **切り出し幅 c と表示幅 d は 0.77 ≦ d/c ≦ 1.3 に収める**
 *    （根拠は ProductShot.tsx のコメント）。表示幅を変えるなら撮り直すこと。
 * ⚠️ **差し替えるときはファイル名の連番を上げる（v1 → v2）。**
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける。
 *
 * ⚠️ **撮り直すときは写り込みを必ず確認する。** 実在ユーザーの氏名・所属・在籍期間が
 *    入ってはいけない（LPは公開かつインデックス対象）。現在の4枚は検査済みで0件。
 *    ・企業ページの「現役社員」枠は**入れない**。実データは社内のダミーが大半。
 *    ・/biz/candidates は**使わない**。出るのは13人全員がダミーか運営本人。
 *    ・求人フォームの上部は**入れない**。プレースホルダーが
 *      「例：プロダクトマネージャー（タイミーキャリアプラス）」で、実在他社名が写る。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS採用プラットフォーム | OPINIO for Business" },
  description:
    "IT/SaaS業界に特化したキャリアプラットフォーム OPINIO の企業向けページ。企業ページの開設と求人の掲載は無料で、掲載件数・掲載期間の制限はありません。",
  alternates: { canonical: "/business" },
  openGraph: {
    title: "IT/SaaS採用プラットフォーム | OPINIO for Business",
    description: "企業ページの開設と求人の掲載は無料。掲載件数・掲載期間の制限はありません。IT/SaaS業界に特化したキャリアプラットフォーム OPINIO。",
    type: "website",
    url: "https://opinio.jp/business",
    images: [{ url: "https://opinio.jp/api/og?name=OPINIO+for+Business&sub=%E6%8E%B2%E8%BC%89%E3%81%AF%E7%84%A1%E6%96%99%E3%81%A7%E3%81%99&v=2", width: 1200, height: 630 }],
  },
};

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

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.7 }}>{children}</span>
    </div>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid var(--line)", overflow: "hidden",
    }}>
      <summary style={{
        padding: "20px 24px", fontSize: 15, fontWeight: 700, color: "var(--ink)",
        display: "flex", gap: 10, alignItems: "flex-start",
        cursor: "pointer", listStyle: "none", userSelect: "none",
      }}>
        <span style={{ color: "var(--royal)", flexShrink: 0 }}>Q.</span>
        <span style={{ flex: 1, minWidth: 0 }}>{q}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2, opacity: 0.4 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </summary>
      <div style={{
        padding: "16px 24px 22px", fontSize: 14, color: "var(--ink-soft)",
        lineHeight: 1.9, borderTop: "1px solid var(--line-soft)",
      }}>
        {children}
      </div>
    </details>
  );
}

/**
 * プロダクトの実画面。広い画面と狭い画面で別ファイルを出し分ける。
 * ⚠️ 片方だけ差し替えないこと（狭い側だけ古い画面が残る）。
 */
function Shot({ wide, narrow, alt, narrowMaxWidth }: {
  wide: { src: string; w: number; h: number };
  narrow: { src: string; w: number; h: number };
  alt: string;
  /* ⚠️ 狭幅の切り出しが小さい画像で使う。指定しないと 390px 幅いっぱい（340px）まで
        引き伸ばされ、切り出し幅に対する倍率が 1.3 を超えてぼやける。
        job-form-sm は切り出しが 240px しかないので 300 に抑えている（1.25倍）。 */
  narrowMaxWidth?: number;
}) {
  /* ⚠️ 広い側と狭い側で**枠ごと分ける**。1つの枠に2枚入れて maxWidth を掛けると、
        広い画面の枠まで狭められる（レスポンシブで変えたい値をインラインに書かない）。 */
  const frame: React.CSSProperties = {
    borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden",
    background: "#fff", boxShadow: "0 4px 20px rgba(0,35,102,0.07)",
    maxWidth: "100%",
  };
  return (
    <>
      <div className="hidden md:block" style={frame}>
        <Image
          src={wide.src} alt={alt} width={wide.w} height={wide.h}
          sizes="(min-width: 1180px) 1100px, 92vw"
          style={{ width: "100%", height: "auto" }}
        />
      </div>
      <div
        className="block md:hidden"
        style={narrowMaxWidth
          ? { ...frame, maxWidth: narrowMaxWidth, marginLeft: "auto", marginRight: "auto" }
          : frame}
      >
        <Image
          src={narrow.src} alt={alt} width={narrow.w} height={narrow.h}
          sizes={narrowMaxWidth ? `${narrowMaxWidth}px` : "92vw"}
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    </>
  );
}

export default async function ForCompaniesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let bizCtaHref = "/biz/auth?mode=signup";
  if (user) {
    const { data: memberships } = await supabase
      .from("ow_company_admins").select("id").limit(1);
    bizCtaHref = (memberships?.length ?? 0) > 0 ? "/biz/dashboard" : "/biz/companies/add/new";
  }

  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg, padding: "80px 24px",
  });
  const innerStyle: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };
  /* ⚠️ 実画面のスクショはここに置く。900 だと切り出し(1344px)を 0.67 倍まで
        縮めることになり、文字が読めなくなる（0.77 を下回る）。 */
  const wideInnerStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto" };

  return (
    <>
      <BusinessHeader />
      <main style={{ paddingTop: 60 }}>

        {/* ─── FV ─── */}
        <section style={{
          background: "linear-gradient(180deg, var(--royal-50) 0%, #fff 100%)",
          borderTop: "1px solid var(--line)",
          padding: "88px 24px 76px",
        }}>
          <div style={{ ...innerStyle, textAlign: "center" }}>
            <h1 style={{
              fontFamily: "var(--font-noto-serif)",
              fontSize: "clamp(27px, 5vw, 44px)", fontWeight: 500,
              color: "var(--ink)", lineHeight: 1.35, marginBottom: 20,
            }}>
              {/* ⚠️ 和文は文節を無視してどこでも改行される。390px で「無 / 料で。」に
                     割れたので、割りたくない塊を inline-block で包んでいる。 */}
              <span style={{ display: "inline-block" }}>求人も、</span>
              <span style={{ display: "inline-block" }}>企業ページも、</span>
              <span style={{ display: "inline-block" }}>無料で。</span>
            </h1>
            <p style={{
              fontSize: "clamp(14px, 2vw, 17px)", color: "var(--ink-soft)",
              lineHeight: 1.9, marginBottom: 36, maxWidth: 640,
              marginLeft: "auto", marginRight: "auto",
            }}>
              IT/SaaS業界に特化したキャリアプラットフォームです。<br className="hidden sm:inline" />
              企業ページの開設と求人掲載に費用はかかりません。
            </p>

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
                無料で企業登録
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7"/>
                </svg>
              </Link>
              <a href="mailto:contact@opinio.co.jp" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "15px 28px", background: "#fff", color: "var(--royal)",
                border: "1.5px solid var(--royal-100)", borderRadius: 10,
                fontSize: 15, fontWeight: 700, textDecoration: "none",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                相談する
              </a>
            </div>

            {/*
              ⚠️ 数字バッジは置かない（2026-08-21 の判断）。
                 公開企業84社は大半が運営が作成したもので、
                 「84社が使っている」の意味にならない。
            */}
          </div>
        </section>

        {/* ─── 01 できること ─── */}
        <section id="can" style={sectionStyle("#fff")}>
          <div style={wideInnerStyle}>
            <div style={{ maxWidth: 640, marginBottom: 56 }}>
              <SectionLabel>01 / できること</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.35,
              }}>
                自社の情報を、置いておける場所。
              </h2>
              <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                企業ページと求人を、費用をかけずに公開できます。<br />
                既存の採用媒体と並行して使えます。
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
              {[
                {
                  num: "01",
                  title: "企業ページをつくる",
                  body: "事業内容・製品・導入事例・拠点・資本関係などを載せられます。求職者は登録なしで読めます。",
                  wide:   { src: "/images/lp-business/company-page-v2.webp", w: 2688, h: 2084 },
                  narrow: { src: "/images/lp-business/company-page-sm-v2.webp", w: 800, h: 1720 },
                  alt: "OPINIO の企業ページ。主な製品・サービスと導入事例が並び、右側に業界・資本区分・親会社・従業員数などの企業情報が表示されている。",
                },
                {
                  num: "02",
                  title: "求人を出す",
                  body: "掲載は無料で、件数にも期間にも制限はありません。雇用形態・業態タグ・技術スタックなどを選んで作成します。",
                  wide:   { src: "/images/lp-business/job-form-v2.webp", w: 1820, h: 1400 },
                  narrow: { src: "/images/lp-business/job-form-sm-v2.webp", w: 480, h: 816 },
                  narrowMaxWidth: 300,
                  alt: "OPINIO の求人作成画面。業態タグと技術スタックを選択肢から選べる。",
                },
              ].map(({ num, title, body, wide, narrow, alt, narrowMaxWidth }) => (
                <div key={num}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                    <span style={{
                      fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 800,
                      color: "var(--royal)", letterSpacing: "0.08em", flexShrink: 0,
                    }}>{num}</span>
                    <h3 style={{ fontSize: "clamp(17px, 2.6vw, 20px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                      {title}
                    </h3>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 22, maxWidth: 620 }}>
                    {body}
                  </p>
                  <Shot wide={wide} narrow={narrow} alt={alt} narrowMaxWidth={narrowMaxWidth} />
                </div>
              ))}
            </div>

            <p style={{ marginTop: 24, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              ※ 画面は実際のものです。掲載内容は変わることがあります。
            </p>
          </div>
        </section>

        {/* ─── 02 料金 ─── */}
        {/*
          ⚠️ **金額は `PAID_PLAN_MONTHLY_FEE` から出す。ここに数字を書かないこと。**
             LPと運営画面で二重に持つと、片方だけ直したときに表示と請求が食い違う。

          ⚠️ **「成果報酬は発生しません」は書いてよい**（2026-08-21 の規約改定以降）。
             /terms/listing 第4条2項「費用は有料プランの利用料金のみ」と
             第6条3項「当社の人材紹介サービスによらずに採用した場合は
             人数にかかわらず費用が発生しない」に一致する。

          ⚠️ **スカウト送信は書かないこと。** `SCOUT_SENDING_ENABLED` で停止中で、
             再開の判断もしていない。売れないものを機能表に載せない
             （`PLAN_FEATURES` からも外してある）。

          ⚠️ 次も書かないこと。**どれも実装が無い。**
             ・スカウト通数・検索の種別・「月3名まで」等の内訳
             ・年払い（`billing_cycle` 列はあるが UI も料金表も月額のみ）

          ⚠️ 無料側の4項目は断定してよい（2026-08-21 実測）。
             求人・社員・アンバサダーのいずれにも件数/人数の上限は実装されていない。
             掲載が無料であることは規約第4条1項に定めがある。

          ⚠️ **料金表のすぐ下の一文は `/biz/candidates` のゲート文言と揃えている。**
             LPと製品内で言うことを食い違わせないため。片方だけ直さないこと。
        */}
        <section id="pricing" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ marginBottom: 44 }}>
              <SectionLabel>02 / 料金</SectionLabel>
              <h2 style={{
                fontFamily: "var(--font-noto-serif)", fontSize: "clamp(21px, 3.5vw, 32px)",
                fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.4,
              }}>
                <span style={{ display: "inline-block" }}>「出す」は無料。</span>
                <span style={{ display: "inline-block" }}>「取りに行く」から有料です。</span>
              </h2>
              <p style={{ fontSize: 16, color: "var(--ink-soft)", lineHeight: 1.9, maxWidth: 620 }}>
                自社の情報を置いて、応募を受け取るところまでは費用がかかりません。
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
              {[
                {
                  key: "free",
                  label: "Free",
                  price: "0円",
                  priceNote: "ずっと無料",
                  badge: null,
                  items: [
                    "企業ページの作成・公開",
                    "求人掲載（件数の上限なし）",
                    /* ⚠️ 「社員の登録」と書かない。企業は社員を登録できない。
                          求職者が職歴にその企業を入れると自動で載り、企業側は
                          非表示にできるだけ（/api/biz/hidden-experiences）。
                          企業が招くのは「話せる人」だけ（/api/biz/ambassador/invite）。 */
                    "社員・OB/OGの掲載（人数の上限なし）",
                    "応募の受付",
                  ],
                  bg: "#fff",
                  border: "var(--royal-100)",
                  dashed: false,
                  accent: "var(--success)",
                  itemColor: "var(--ink)",
                },
                {
                  key: "paid",
                  label: "有料プラン",
                  /* ⚠️ 金額は定数から。ここに数字を書かない */
                  price: `月額 ${PAID_PLAN_MONTHLY_FEE.toLocaleString()}円`,
                  priceNote: "税別",
                  badge: null,
                  items: [
                    "Free のすべて",
                    "候補者検索",
                    "応募者の連絡先の表示",
                    "話せる社員（アンバサダー）の招待",
                  ],
                  /* ⚠️ 「スカウトの送信」を戻さないこと。停止中で機能表から外してある。 */
                  bg: "#fff",
                  border: "var(--royal)",
                  dashed: false,
                  accent: "var(--royal)",
                  itemColor: "var(--ink)",
                },
              ].map(({ key, label, price, priceNote, badge, items, bg, border, dashed, accent, itemColor }) => (
                <div key={key} style={{
                  padding: "28px 26px", background: bg,
                  border: `1.5px ${dashed ? "dashed" : "solid"} ${border}`, borderRadius: 16,
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
                    {badge && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                        background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A",
                        whiteSpace: "nowrap",
                      }}>{badge}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: "var(--font-inter), var(--font-noto)", fontSize: "clamp(22px, 3vw, 28px)",
                      fontWeight: 800, color: key === "paid" ? "var(--royal)" : "var(--ink)",
                      letterSpacing: "-0.02em", lineHeight: 1.2,
                    }}>{price}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{priceNote}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
                    {items.map((t) => (
                      <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: 14, color: itemColor, lineHeight: 1.7 }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20, padding: "18px 22px",
              background: "#fff", border: "1px solid var(--line)", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 16, flexWrap: "wrap",
            }}>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
                <strong style={{ color: "var(--ink)" }}>成果報酬は発生しません。</strong>
                採用人数にかかわらず月額のみです。
              </p>
              <a href="mailto:contact@opinio.co.jp" style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "11px 22px", background: "#fff", color: "var(--royal)",
                border: "1.5px solid var(--royal-100)", borderRadius: 9,
                fontSize: 13, fontWeight: 700, textDecoration: "none",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                料金について問い合わせる
              </a>
            </div>

            {/* ⚠️ この一文は `/biz/candidates` のゲート文言と同じ内容にしてある。
                   LPと製品内で言うことを食い違わせないため。片方だけ直さないこと。 */}
            <p style={{
              marginTop: 18, fontSize: 13, color: "var(--ink-soft)",
              lineHeight: 1.9, margin: "18px 0 0",
            }}>
              候補者検索については、現在は登録者を増やしている段階です。
              人数が揃ってからのご利用をお勧めしています。
            </p>
          </div>
        </section>

        {/* ─── 03 導入の流れ ─── */}
        <section id="flow" style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <SectionLabel>03 / 導入の流れ</SectionLabel>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)" }}>
                登録から求人公開まで
              </h2>
            </div>

            {/*
              ⚠️ 「候補者から応募が届く」をステップに置かないこと。
                 ow_job_applications は0行で、一度も発生していない（2026-08-21 実測）。
            */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_28px_1fr_28px_1fr] items-stretch">
              {[
                {
                  step: "STEP 1",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                  ),
                  title: "企業を登録",
                  body: "メールアドレスだけで完了します。入力は1分ほどで、すぐに企業ページの編集を始められます。",
                },
                {
                  step: "STEP 2",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                    </svg>
                  ),
                  title: "企業ページを整える",
                  body: "事業内容・製品・拠点などを入力します。この間に運営が内容を確認します（通常2〜3営業日）。",
                },
                {
                  step: "STEP 3",
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  ),
                  title: "求人を公開",
                  body: "確認が済むと求人を公開できます。掲載は無料で、件数にも期間にも制限はありません。",
                },
              ].map(({ step, icon, title, body }, i, arr) => (
                <React.Fragment key={step}>
                  <div style={{
                    padding: "24px 20px", background: "var(--bg-tint)",
                    borderRadius: 12, border: "1px solid var(--line)",
                    height: "100%", display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", fontFamily: "var(--font-inter), var(--font-noto)", marginBottom: 12 }}>
                      {step}
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--royal-50)", border: "1px solid var(--royal-100)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      {icon}
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.4 }}>{title}</h3>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.8, flex: 1 }}>{body}</p>
                  </div>
                  {/* ⚠️ 矢印は「最後の1枚以外」。段数を変えたら grid-cols も一緒に直す */}
                  {i < arr.length - 1 && (
                    <div className="hidden md:flex items-center justify-center" style={{ color: "var(--ink-mute)", fontSize: 18 }}>→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--royal)", marginBottom: 18,
                boxShadow: "0 4px 16px rgba(0,35,102,0.20)",
              }}>
                <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 800, fontSize: 24, color: "#fff", lineHeight: 1 }}>?</span>
              </div>
              <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(22px, 3.5vw, 32px)", fontWeight: 500, color: "var(--ink)", marginBottom: 10 }}>
                よくある質問
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>採用担当者からよくいただく質問に、正直にお答えします。</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/*
                ⚠️ 金額と成果報酬をここに書かないこと（理由は 02 料金セクションのコメント）。
                   規約へのリンクを外さない（無料の範囲だけ書いて他を伏せると、
                   書かないことによって誤解させることになる）。
              */}
              <FaqItem q="費用はかかりますか？">
                企業ページの作成、求人の掲載、応募の受け取りまでは無料です。
                候補者検索と応募者の連絡先の表示、話せる社員の招待は、
                月額{PAID_PLAN_MONTHLY_FEE.toLocaleString()}円（税別）の有料プランでご利用いただけます。
                <strong style={{ color: "var(--ink)" }}>成果報酬は発生しません。</strong>
                {" "}取引条件の全文は{" "}
                <Link href="/terms/listing" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
                  掲載利用規約
                </Link>
                {" "}に定めています。ご不明な点は contact@opinio.co.jp までお問い合わせください。
              </FaqItem>

              <FaqItem q="どのような業界・職種に対応していますか？">
                IT/SaaS 業界に特化しています。掲載企業も IT/SaaS 業界に絞っており、
                職種は SaaS 営業・カスタマーサクセス・インサイドセールス・プロダクトマネージャー・
                エンジニア・マーケターなどが中心です。IT/SaaS 以外の業界での採用には向いていません。
              </FaqItem>

              <FaqItem q="営業電話はかかってきますか？">
                かかってきません。ご質問・ご相談はメール（contact@opinio.co.jp）でのみ承っています。
                自動で課金が始まることもありません。
              </FaqItem>

              {/*
                ⚠️ 「審査なし」と書かないこと。自己登録した企業は is_published=false で作られ、
                   運営が確認するまで求人を published にできない（403 で弾かれる）。
              */}
              <FaqItem q="登録に審査はありますか？すぐに始められますか？">
                登録自体はメールアドレスだけで完了し、その場で企業ページの編集を始められます。
                ただし求人を公開するには運営による内容の確認が必要で、通常2〜3営業日いただいています。
                確認が済めば、以降は「公開」の操作だけで反映されます。
              </FaqItem>

              <FaqItem q="OPINIO が向いていないのは、どのような場合ですか？">
                <span style={{ display: "block", marginBottom: 14 }}>
                  次のような場合は、あまりお役に立てません。ミスマッチを防ぐため正直にお伝えしています。
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <CrossItem>短期間で採用数を最大化したい</CrossItem>
                  {/*
                    ⚠️ 「スカウトを送りたい」を残さないこと。スカウト送信は
                       SCOUT_SENDING_ENABLED 未設定で停止中（2026-08-21）。
                       再開したらこの一文を直す。
                  */}
                  <CrossItem>候補者へのスカウト送信を主な手段にしたい（スカウト送信機能は現在ご利用いただけません）</CrossItem>
                  <CrossItem>IT/SaaS 以外の業界での採用が中心</CrossItem>
                </span>
              </FaqItem>
            </div>

            <div style={{ textAlign: "center", marginTop: 36 }}>
              <p style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                その他のご質問は{" "}
                <a href="mailto:contact@opinio.co.jp" style={{ color: "var(--royal)", textDecoration: "underline" }}>
                  contact@opinio.co.jp
                </a>{" "}
                までお気軽にどうぞ。
              </p>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section style={{
          padding: "96px 24px",
          background: "linear-gradient(135deg, #001F5B 0%, #002E8A 50%, #003BB5 100%)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 40%)" }} />
          <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(25px, 4vw, 40px)", fontWeight: 500, color: "#fff", lineHeight: 1.35, marginBottom: 16 }}>
              掲載は無料です。<br className="sm:hidden" />まず置いてみてください。
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, marginBottom: 44 }}>
              企業ページをつくるところから始められます。
            </p>
            <Link href={bizCtaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 44px", background: "#fff", color: "var(--royal)", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.16)" }}>
              無料で企業登録
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            {/* ⚠️ 「入社まで費用なし（成果報酬制）」を戻さないこと（2026-08-21 に削除） */}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              {["求人掲載は無料", "既存媒体と並行可能"].map((txt) => (
                <div key={txt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {txt}
                </div>
              ))}
              <a href="mailto:contact@opinio.co.jp" style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>相談する</a>
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
            企業を新規登録
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
        </div>
        <div className="md:hidden" style={{ height: 76 }} />

      </main>
      <JobseekerFooter />
    </>
  );
}

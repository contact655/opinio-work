import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { PAID_PLAN_MONTHLY_FEE } from "@/lib/constants/plans";

export const revalidate = 600;

/*
 * ═══ 企業向け 料金ページ ═══════════════════════════════════════════════════
 *
 * ⚠️★**このページは消せない。掲載利用規約が表示を義務づけている。**
 *    `content/legal/terms-of-service-listing.md` 第4条2項が
 *    「有料プランの内容・料金・支払方法・契約期間は本サービス上に表示するところによる」
 *    と定めている。**料金の掲示先はサイト内にここ1枚しかない。**
 *    トップ（/business）から料金セクションを外したのが 2026-08-31 で、
 *    そのとき「単純削除ではなくここへ移設する」形にしたのはこの条文が理由。
 *    → 消すなら**先に規約を改定すること。**
 *
 * ⚠️ **金額は `PAID_PLAN_MONTHLY_FEE`（lib/constants/plans.ts）から出す。
 *    このファイルに数字を書かない。** LPと運営画面で二重に持つと、
 *    片方だけ直したときに表示と請求が食い違う。
 *
 * ⚠️ **「成果報酬は発生しません」は書いてよい**（2026-08-21 の規約改定以降）。
 *    第4条2項「費用は有料プランの利用料金のみ」／第6条3項「当社の人材紹介
 *    サービスによらずに採用した場合は人数にかかわらず費用が発生しない」と一致する。
 *
 * ⚠️ **スカウト送信を有料プランの機能として書かないこと。**
 *    `SCOUT_SENDING_ENABLED` で停止中で、`PLAN_FEATURES` からも外してある。
 *    売れないものを機能表に載せない。
 *
 * ⚠️ 次も書かないこと。**どれも実装が無い。**
 *    ・スカウト通数・検索の種別・「月3名まで」等の内訳
 *    ・年払い（`billing_cycle` 列はあるが UI も料金表も月額のみ）
 *
 * ⚠️ **「審査なし」と書かないこと（2026-08-21 実測）。**
 *    自己登録した企業は `is_published: false` で作られ
 *    （api/biz/companies/route.ts）、`is_published` が true になるまで
 *    求人を published にできない（api/biz/jobs/[id]/route.ts が 403 を返す）。
 *
 * ⚠️ **料金表のすぐ下の一文は `/biz/candidates` のゲート文言と揃えている。**
 *    LPと製品内で言うことを食い違わせないため。片方だけ直さないこと。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "料金 | OPINIO for Business" },
  description:
    "OPINIO の企業向け料金。企業ページの作成・求人掲載・応募の受付は無料です。候補者検索などの有料プランは月額のみで、成果報酬は発生しません。",
  alternates: { canonical: "/business/pricing" },
  openGraph: {
    title: "料金 | OPINIO for Business",
    description: "企業ページの作成・求人掲載・応募の受付は無料。有料プランは月額のみで、成果報酬は発生しません。",
    type: "website",
    url: "https://opinio.jp/business/pricing",
    images: [{ url: "https://opinio.jp/api/og?name=OPINIO+for+Business&sub=%E6%96%99%E9%87%91&v=2", width: 1200, height: 630 }],
  },
};

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

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 1, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.7 }}>{children}</span>
    </div>
  );
}

export default function BusinessPricingPage() {
  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg, padding: "80px 24px",
  });
  const innerStyle: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };

  return (
    <>
      <BusinessHeader />
      {/* ⚠️ `id="main-content"` はルート layout のスキップリンクの着地点。外さないこと
             （理由は /business の同じ箇所のコメント）。 */}
      <main id="main-content" style={{ paddingTop: 60 }}>

        {/* ─── 料金 ─── */}
        <section id="pricing" style={{
          background: "linear-gradient(180deg, var(--royal-50) 0%, var(--bg-tint) 100%)",
          borderTop: "1px solid var(--line)",
          padding: "72px 24px 80px",
        }}>
          <div style={innerStyle}>
            <div style={{ marginBottom: 44 }}>
              <div style={{
                display: "inline-block", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                color: "var(--royal)", marginBottom: 16,
              }}>
                料金
              </div>
              {/* ⚠️ h1 はページに1つだけ。ここが唯一の h1。 */}
              <h1 style={{
                fontFamily: "var(--font-noto-serif)", fontSize: "clamp(21px, 3.5vw, 32px)",
                fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.4,
              }}>
                {/* ⚠️ 和文は文節を無視してどこでも改行される。割りたくない塊を
                       inline-block で包んでいる（トップの h1 と同じ扱い）。 */}
                <span style={{ display: "inline-block" }}>「出す」は無料。</span>
                <span style={{ display: "inline-block" }}>「取りに行く」から有料です。</span>
              </h1>
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
                  border: "var(--royal-100)",
                  accent: "var(--success)",
                },
                {
                  key: "paid",
                  label: "有料プラン",
                  /* ⚠️ 金額は定数から。ここに数字を書かない */
                  price: `月額 ${PAID_PLAN_MONTHLY_FEE.toLocaleString()}円`,
                  priceNote: "税別",
                  items: [
                    "Free のすべて",
                    "候補者検索",
                    "応募者の連絡先の表示",
                    "話せる社員（アンバサダー）の招待",
                  ],
                  /* ⚠️ 「スカウトの送信」を戻さないこと。停止中で機能表から外してある。 */
                  border: "var(--royal)",
                  accent: "var(--royal)",
                },
              ].map(({ key, label, price, priceNote, items, border, accent }) => (
                <div key={key} style={{
                  padding: "28px 26px", background: "#fff",
                  border: `1.5px solid ${border}`, borderRadius: 16,
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
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
                        <span style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.7 }}>{t}</span>
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
              fontSize: 13, color: "var(--ink-soft)",
              lineHeight: 1.9, margin: "18px 0 0",
            }}>
              候補者検索については、現在は登録者を増やしている段階です。
              人数が揃ってからのご利用をお勧めしています。
            </p>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section id="faq" style={sectionStyle("#fff")}>
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
                ⚠️ 規約へのリンクを外さないこと（無料の範囲だけ書いて他を伏せると、
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

            <div style={{ textAlign: "center", marginTop: 44 }}>
              <Link href="/business" style={{
                fontSize: 14, fontWeight: 600, color: "var(--royal)", textDecoration: "none",
              }}>
                ← 企業向けトップに戻る
              </Link>
            </div>
          </div>
        </section>

      </main>
      <JobseekerFooter />
    </>
  );
}

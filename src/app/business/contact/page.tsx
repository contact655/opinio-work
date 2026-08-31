import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { BusinessContactForm } from "@/components/business/BusinessContactForm";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export const revalidate = 600;

/*
 * ═══ 企業からの相談フォーム ═══════════════════════════════════════════════
 *
 * 2026-08-31 に新設。それまで企業向けの相談導線は `mailto:` しか無かった。
 *
 * ⚠️★**保存先はメール1本で、DB には残らない。**
 *    したがって送信の失敗を握り潰すと問い合わせが消える。
 *    `POST /api/business/contact` が `sendEmailStrict` で成否を受け、
 *    失敗を 502 で返し、フォームがそれを画面に出す。**この鎖を切らないこと。**
 *
 * ⚠️ **返信までの日数を書かないこと。** 運営の対応時間を約束できる根拠が無い。
 *
 * ⚠️ **料金の話をここに書かない。** 金額の掲示先は /business/pricing の1枚だけ
 *    （掲載利用規約 第4条2項）。増やすと片方だけ古くなる。
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const metadata: Metadata = {
  title: { absolute: "採用のご相談 | OPINIO for Business" },
  description:
    "OPINIO の企業向けお問い合わせフォーム。掲載・採用についてのご相談を承ります。営業のお電話はいたしません。",
  alternates: { canonical: "/business/contact" },
  /* ⚠️ フォームなので検索結果に出す必要が無い。導線は /business から辿れる。 */
  robots: { index: false, follow: true },
};

export default function BusinessContactPage() {
  return (
    <>
      <BusinessHeader />
      {/* ⚠️ `id="main-content"` はルート layout のスキップリンクの着地点。外さないこと
             （理由は /business の同じ箇所のコメント）。 */}
      <main id="main-content" style={{ paddingTop: 60 }}>
        <section style={{
          background: "linear-gradient(180deg, var(--royal-50) 0%, var(--bg-tint) 100%)",
          borderTop: "1px solid var(--line)",
          padding: "72px 24px 88px",
        }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>

            <div style={{ marginBottom: 36 }}>
              <div style={{
                display: "inline-block", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                color: "var(--royal)", marginBottom: 16,
              }}>
                お問い合わせ
              </div>
              {/* ⚠️ h1 はページに1つだけ */}
              <h1 style={{
                fontFamily: "var(--font-noto-serif)", fontSize: "clamp(23px, 3.5vw, 32px)",
                fontWeight: 500, color: "var(--ink)", marginBottom: 16, lineHeight: 1.4,
              }}>
                {/* ⚠️ 和文は文節を無視してどこでも改行される。割りたくない塊を包む。 */}
                <span style={{ display: "inline-block" }}>採用について、</span>
                <span style={{ display: "inline-block" }}>お話を聞かせてください。</span>
              </h1>
              <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9, margin: 0 }}>
                掲載の進め方、いま採用で困っていること、どんなことでも構いません。
                内容を確認のうえ、担当者からメールでご連絡します。
              </p>
            </div>

            <div style={{
              padding: "32px 28px", background: "#fff",
              border: "1px solid var(--line)", borderRadius: 16,
            }}>
              <BusinessContactForm />
            </div>

            <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginTop: 24 }}>
              企業ページはご自身で無料で作成できます。すぐに始めたい場合は{" "}
              <Link href="/biz/auth?mode=signup" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
                企業登録
              </Link>
              {" "}へ。料金は{" "}
              <Link href="/business/pricing" style={{ color: "var(--royal)", textDecoration: "underline", fontWeight: 600 }}>
                料金ページ
              </Link>
              {" "}に掲載しています。
            </p>

          </div>
        </section>
      </main>
      <JobseekerFooter />
    </>
  );
}

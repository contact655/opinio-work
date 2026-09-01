import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "お問い合わせ | OPINIO" },
  description: "OPINIO へのお問い合わせ・ご報告はこちらから。",
  alternates: { canonical: "https://opinio.jp/contact" },
};

const cards = [
  {
    emoji: "💬",
    bg: "var(--royal-50)",
    title: "一般のお問い合わせ",
    desc: "サービスに関するご質問・ご意見・ご要望",
    cta: "contact@opinio.co.jp",
    ctaColor: "var(--royal)",
    href: "mailto:contact@opinio.co.jp?subject=お問い合わせ",
  },
  {
    emoji: "🚨",
    bg: "var(--error-soft)",
    title: "トラブル・不具合の報告",
    desc: "サービス上での不具合・不審なユーザーへの報告",
    cta: "メールテンプレートを開く →",
    /* ⚠️ ここは `--error` のまま。**カードの背景は白**で 4.83（基準は 4.5）。
          上の `bg` は 44px の絵文字タイルにしか当たっていないので、
          同じオブジェクトにあっても背景ではない。`--error` を淡い赤の上に
          置いている組み合わせだけを `--error-ink` にする、が globals.css の方針。 */
    ctaColor: "var(--error)",
    href: "mailto:contact@opinio.co.jp?subject=【トラブル報告】&body=【お名前】%0A%0A【発生した問題】%0A%0A【発生日時】%0A%0A【URL / 操作手順】%0A",
  },
  /*
   * ⚠️ **ここに企業向けの料金の話を書かないこと**（2026-08-23）。
   *    ここは求職者向けのページ。以前は「掲載内容の変更・料金・採用成功報酬に
   *    関するご質問」と書いてメールアドレスを出していたが、
   *    ① 成功報酬は 2026-08-21 の規約改定で廃止済み（記載が古かった）
   *    ② 料金の話が求職者向けページと企業向けLPの2か所に散っていた
   *    の2点から、**企業向けLPへ寄せた。**
   * ⚠️ メールアドレスもここには書かない。問い合わせ導線は /business の
   *    料金セクションと FAQ にある。増やすと片方だけ古くなる。
   */
  {
    emoji: "🏢",
    /* ⚠️ 黄色（--warm 系）にしないこと。このサイトの黄色は「注意・未完了・待ち」の色で、
          企業向けページへの案内は注意ではない。3色目が要るという理由だけで
          warm を借りると、黄色の意味がまた2つになる（2026-09-02）。 */
    bg: "var(--royal-50)",
    title: "企業のご担当者さまへ",
    desc: "掲載・料金については企業向けページをご覧ください",
    cta: "企業向けページを見る →",
    ctaColor: "var(--royal)",
    href: "/business",
    /** サイト内リンクなので next/link で遷移する（全ページ再読み込みにしない） */
    internal: true,
  },
];

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)", paddingTop: 64, paddingBottom: 80 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>

        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            CONTACT
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            お問い合わせ
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
            ご質問・ご報告・ご要望はメールにてお受けしています。<br />
            内容を確認の上、2営業日以内にご返信します。
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {cards.map((card) => {
            /* 内部リンクは Link、mailto は素の <a>。中身は共通。 */
            const Wrapper = card.internal ? Link : "a";
            return (
            <Wrapper key={card.href} href={card.href} className="contact-card" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: card.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>{card.emoji}</div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{card.title}</p>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>{card.desc}</p>
                  <p style={{ margin: 0, fontSize: 13, color: card.ctaColor, fontWeight: 600 }}>{card.cta}</p>
                </div>
              </div>
            </Wrapper>
            );
          })}
        </div>

        <div style={{
          marginTop: 40, padding: "20px 24px", background: "var(--line-soft)",
          borderRadius: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7,
        }}>
          <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--ink)" }}>ご返信について</p>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>返信は平日10:00〜18:00に対応しています</li>
            <li>土日・祝日のお問い合わせは翌営業日以降のご返信となります</li>
            <li>内容によっては返信にお時間をいただく場合があります</li>
          </ul>
        </div>

        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none" }}>
            ← トップページに戻る
          </Link>
        </div>

      </div>

      <style>{`
        .contact-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 24px 28px;
          display: block;
          transition: box-shadow 0.15s;
        }
        .contact-card:hover {
          box-shadow: 0 4px 16px rgba(0,35,102,0.08);
        }
      `}</style>
    </div>
  );
}

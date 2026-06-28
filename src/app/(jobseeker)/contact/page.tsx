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
    ctaColor: "var(--error)",
    href: "mailto:contact@opinio.co.jp?subject=【トラブル報告】&body=【お名前】%0A%0A【発生した問題】%0A%0A【発生日時】%0A%0A【URL / 操作手順】%0A",
  },
  {
    emoji: "🏢",
    bg: "var(--warm-soft)",
    title: "企業掲載・採用についてのご相談",
    desc: "掲載内容の変更・料金・採用成功報酬に関するご質問",
    cta: "contact@opinio.co.jp",
    ctaColor: "var(--warm)",
    href: "mailto:contact@opinio.co.jp?subject=【企業掲載について】",
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
          {cards.map((card) => (
            <a key={card.href} href={card.href} className="contact-card" style={{ textDecoration: "none" }}>
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
            </a>
          ))}
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

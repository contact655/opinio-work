import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "採用担当者の方へ | opinio.jp",
  description:
    "IT/SaaS特化の採用支援。ミスマッチのない採用を実現します。",
};

export default function ForCompaniesPage() {
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#FAFAF9" }}>
        {/* ── ヒーロー ── */}
        <section
          style={{
            background: "#fff",
            borderBottom: "0.5px solid #e5e7eb",
            padding: "64px 24px",
          }}
        >
          <div style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 14px",
                border: "0.5px solid #5DCAA5",
                borderRadius: 999,
                fontSize: 11,
                color: "#0F6E56",
                background: "#E1F5EE",
                marginBottom: 20,
              }}
            >
              IT/SaaS特化 · ビジネス職専門
            </div>

            <h1
              style={{
                fontSize: 32,
                fontWeight: 500,
                lineHeight: 1.3,
                marginBottom: 16,
                letterSpacing: "-0.3px",
              }}
            >
              ミスマッチのない採用を、
              <br />
              <span style={{ color: "#1D9E75" }}>対話から実現する。</span>
            </h1>

            <p
              style={{
                fontSize: 15,
                color: "#6b7280",
                lineHeight: 1.8,
                marginBottom: 32,
                maxWidth: "var(--max-w-form)",
                margin: "0 auto 32px",
              }}
            >
              求職者は入社前に企業のリアルを知り、納得して応募します。
              だから早期離職が起きません。創業以来、早期離職ゼロ。
            </p>

            <div
              style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
            >
              <Link
                href="/biz/auth/signup"
                style={{
                  padding: "13px 28px",
                  background: "#1D9E75",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                無料で企業登録する
              </Link>
              <a
                href="mailto:hshiba@opinio.co.jp"
                style={{
                  padding: "12px 24px",
                  border: "0.5px solid #d1d5db",
                  borderRadius: 10,
                  color: "#6b7280",
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </section>

        {/* ── 実績 ── */}
        <section
          style={{
            padding: "48px 24px",
            background: "#fff",
            borderBottom: "0.5px solid #e5e7eb",
            marginTop: 20,
          }}
        >
          <div
            style={{
              maxWidth: "var(--max-w-text)",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 32,
              textAlign: "center",
            }}
          >
            {[
              { num: "0件", label: "早期離職（創業以来）", desc: "ミスマッチのない採用だから" },
              { num: "128社", label: "掲載企業数", desc: "IT/SaaS特化の企業が集まる" },
              { num: "200名+", label: "登録求職者", desc: "ビジネス職専門の人材が集まる" },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 32, fontWeight: 500, color: "#1D9E75", marginBottom: 4 }}>
                  {item.num}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 特徴 ── */}
        <section style={{ padding: "48px 24px" }}>
          <div style={{ maxWidth: "var(--max-w-text)", margin: "0 auto" }}>
            <h2
              style={{ fontSize: 22, fontWeight: 500, marginBottom: 8, textAlign: "center" }}
            >
              なぜopinio.jpで採用するのか
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                textAlign: "center",
                marginBottom: 32,
              }}
            >
              求職者が「納得して応募する」仕組みがある
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                {
                  title: "求職者は入社前に会社のリアルを知っている",
                  desc: "カルチャー・働き方・平均年収・社員の声まで事前公開。「こんなはずじゃなかった」が起きない。",
                  icon: "1",
                },
                {
                  title: "マッチ理由が言葉で届く",
                  desc: "「なぜこの求人があなたに合うか」をAIが言語化して求職者に届けます。納得感が高いから応募の質が上がる。",
                  icon: "2",
                },
                {
                  title: "メンターがキャリア相談に乗る",
                  desc: "入社前にメンターから本音を聞いた求職者が応募します。覚悟を持って入社するから離職しない。",
                  icon: "3",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    background: "#fff",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "20px 24px",
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#E1F5EE",
                      color: "#1D9E75",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link
                href="/biz/auth/signup"
                style={{
                  display: "inline-block",
                  padding: "14px 32px",
                  background: "#1D9E75",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                無料で企業登録する →
              </Link>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                初期費用無料 · 掲載無料 · 成果報酬型
              </div>
            </div>
          </div>
        </section>

        {/* ── 求職者リンク ── */}
        <div
          style={{
            borderTop: "0.5px solid #e5e7eb",
            padding: "20px 24px",
            textAlign: "center",
          }}
        >
          <Link
            href="/"
            style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}
          >
            ← 求職者の方はこちら
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

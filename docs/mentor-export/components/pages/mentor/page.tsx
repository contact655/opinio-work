import type { Metadata } from "next";
import Link from "next/link";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export const metadata: Metadata = {
  title: "メンター制度 | OPINIO",
  description:
    "OPINIOのメンターは、キャリアの経験を次の世代の意思決定に渡す存在です。現在は招待制でスタートしています。",
  alternates: { canonical: "/mentor" },
  openGraph: {
    title: "メンター制度 | OPINIO",
    description: "OPINIOのメンターは、キャリアの経験を次の世代の意思決定に渡す存在です。現在は招待制でスタートしています。",
    url: "https://opinio.jp/mentor",
    type: "website",
  },
};

// ── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: "var(--royal)",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

// ── Check / Cross items ───────────────────────────────────────────────────────
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--royal)", fontWeight: 700, marginTop: 2, flexShrink: 0 }}>
        ✓
      </span>
      <span style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        {children}
      </span>
    </div>
  );
}

function CrossItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ color: "var(--ink-mute)", marginTop: 2, flexShrink: 0 }}>✕</span>
      <span style={{ fontSize: 15, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        {children}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MentorPage() {
  const sectionStyle = (bg = "#fff"): React.CSSProperties => ({
    background: bg,
    padding: "80px 24px",
  });

  const innerStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
  };

  return (
    <>
      <JobseekerHeader />
      <main style={{ paddingTop: 60 }}>

        {/* ─── Section 1: Hero ───────────────────────────────────────────────── */}
        <section
          style={{
            background: "linear-gradient(135deg, #001233 0%, #002366 55%, #1a3569 100%)",
            padding: "100px 24px 88px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", right: -80, top: -80, width: 440, height: 440, borderRadius: "50%", background: "rgba(59,95,217,0.1)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: -60, bottom: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(245,158,11,0.06)", pointerEvents: "none" }} />
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'Inter', sans-serif",
                marginBottom: 24,
              }}
            >
              OPINIO メンター制度
            </p>
            <h1
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(24px, 4vw, 40px)",
                fontWeight: 500,
                color: "#fff",
                lineHeight: 1.45,
                marginBottom: 24,
              }}
            >
              あなたのキャリアの経験を、<br />
              次の世代の意思決定に。
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.8,
              }}
            >
              現在は招待制でスタートしています。
            </p>
          </div>
        </section>

        {/* ─── Section 2: メンターとは ────────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <SectionLabel>メンターとは</SectionLabel>
            <h2
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 32,
                lineHeight: 1.4,
              }}
            >
              メンターとは
            </h2>
            <div
              style={{
                fontSize: 16,
                color: "var(--ink-soft)",
                lineHeight: 2,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <p>
                OPINIOのメンターは、自らのキャリア経験を、これから意思決定をする求職者に渡す存在です。
              </p>
              <p>
                業界の実情、職種の現実、特定企業の内側、キャリア選択の壁打ち。求職者が一次情報をもとに判断できるよう、率直な対話の場をつくります。
              </p>
              <p
                style={{
                  fontFamily: "var(--font-noto-serif)",
                  fontSize: 17,
                  color: "var(--ink)",
                  fontWeight: 500,
                  paddingLeft: 20,
                  borderLeft: "3px solid var(--royal)",
                }}
              >
                「教える」「導く」のではなく、「経験を渡す」関係です。
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 3: できること / できないこと ─────────────────────────────── */}
        <section style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <SectionLabel>できること・できないこと</SectionLabel>
            <h2
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 40,
                lineHeight: 1.4,
              }}
            >
              メンターにできること、できないこと
            </h2>

            {/* 2-column grid, stacks on mobile */}
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
            >
              {/* できること */}
              <div
                style={{
                  padding: "32px 28px",
                  background: "var(--royal-50)",
                  border: "1px solid var(--royal-100)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--royal)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    marginBottom: 24,
                  }}
                >
                  ✓ できること
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <CheckItem>業界・職種の実情を共有する</CheckItem>
                  <CheckItem>キャリアの選択肢を一緒に整理する</CheckItem>
                  <CheckItem>特定企業の内情を、知っている範囲で伝える</CheckItem>
                  <CheckItem>意思決定の壁打ち相手になる</CheckItem>
                </div>
              </div>

              {/* できないこと */}
              <div
                style={{
                  padding: "32px 28px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink-mute)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    marginBottom: 24,
                  }}
                >
                  ✕ できないこと
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <CrossItem>特定企業への応募を勧めること</CrossItem>
                  <CrossItem>企業の採用担当者を紹介すること</CrossItem>
                  <CrossItem>面接の調整・推薦を行うこと</CrossItem>
                  <CrossItem>報酬・謝礼を受け取ること</CrossItem>
                </div>
              </div>
            </div>

            <p
              style={{
                marginTop: 24,
                fontSize: 13,
                color: "var(--ink-mute)",
                lineHeight: 1.8,
              }}
            >
              これは OPINIO のメンター制度の前提です。詳細は{" "}
              <Link
                href="/mentor-terms"
                style={{ color: "var(--royal)", textDecoration: "underline" }}
              >
                メンター向け利用規約
              </Link>
              をご確認ください。
            </p>
          </div>
        </section>

        {/* ─── Section 4: 金銭報酬を介さない ────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <SectionLabel>報酬について</SectionLabel>
            <h2
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 32,
                lineHeight: 1.4,
              }}
            >
              金銭報酬を介さない関係です
            </h2>
            <div
              style={{
                fontSize: 16,
                color: "var(--ink-soft)",
                lineHeight: 2,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <p>
                メンターは、求職者からも企業からも報酬を受け取りません。OPINIOからの金銭支払いもありません。
              </p>
              <p>
                利害から自由な立場だからこそ、率直な情報共有と、求職者の意思決定に資する対話が成立すると考えています。
              </p>
              <p>
                メンターの活動は、ボランタリーな意思によって支えられています。
              </p>
            </div>
          </div>
        </section>

        {/* ─── Section 5: なぜメンターになるのか ─────────────────────────────────── */}
        <section style={sectionStyle("var(--bg-tint)")}>
          <div style={innerStyle}>
            <SectionLabel>参加する理由</SectionLabel>
            <h2
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 40,
                lineHeight: 1.4,
              }}
            >
              なぜ、メンターになるのか
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 理由 1 */}
              <div
                style={{
                  padding: "32px 28px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--royal)",
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: 12,
                    textTransform: "uppercase" as const,
                  }}
                >
                  01
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-noto-serif)",
                    fontSize: 20,
                    fontWeight: 500,
                    color: "var(--ink)",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  経験を、次の世代の意思決定に渡す
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                  自分が過去に欲しかった一次情報を、これからキャリアを決める誰かに届ける。それ自体に意味があると感じる方に参加いただいています。
                </p>
              </div>

              {/* 理由 2 */}
              <div
                style={{
                  padding: "32px 28px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--royal)",
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: 12,
                    textTransform: "uppercase" as const,
                  }}
                >
                  02
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-noto-serif)",
                    fontSize: 20,
                    fontWeight: 500,
                    color: "var(--ink)",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  キャリアを言語化し、可視化する
                </h3>
                <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.9 }}>
                  メンターとして活動する過程で、自分の経験が整理され、OPINIO上のプロフィールとして可視化されます。これは外部からの信頼を得る一つの形でもあります。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 6: 招待制と審査 ──────────────────────────────────────────── */}
        <section style={sectionStyle("#fff")}>
          <div style={innerStyle}>
            <SectionLabel>参加方法</SectionLabel>
            <h2
              style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(22px, 3.5vw, 32px)",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 32,
                lineHeight: 1.4,
              }}
            >
              招待制でスタートしています
            </h2>
            <div
              style={{
                fontSize: 16,
                color: "var(--ink-soft)",
                lineHeight: 2,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                marginBottom: 40,
              }}
            >
              <p>
                現在、メンター制度はOpinioからの招待制で運営しています。
              </p>
              <p>
                ご経歴とご動機を拝見し、当社からご招待しています。承認にあたっては、経歴・動機・本人確認・マッチングの4つの観点で確認させていただきます。承認結果の理由は開示しておりません。
              </p>
            </div>

            <div
              style={{
                padding: "28px 32px",
                background: "var(--royal-50)",
                border: "1px solid var(--royal-100)",
                borderRadius: 14,
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: "var(--ink)",
                  lineHeight: 1.9,
                  marginBottom: 12,
                }}
              >
                招待をご希望の方は、メールにてご連絡ください。
              </p>
              <a
                href="mailto:contact@opinio.co.jp"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--royal)",
                  textDecoration: "underline",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                contact@opinio.co.jp
              </a>
            </div>
          </div>
        </section>

      </main>
      <JobseekerFooter />
    </>
  );
}

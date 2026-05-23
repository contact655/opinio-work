import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import Link from "next/link";

export const metadata = {
  title: "転職しない人のために | OPINIO",
  description: "転職を急がない方へ。社内キャリアの作り方、市場価値を上げる学び方、半年後にもう一度相談する選択肢。",
  openGraph: {
    title: "転職しない人のために | OPINIO",
    description: "転職を急がない方への、OPINIOからの提案です。",
    url: "https://opinio.jp/not-job-changing",
  },
};

const articles = [
  {
    title: "社内キャリアの作り方",
    desc: "今の会社で次のステップを踏むには。異動希望の伝え方、上司との対話、評価制度の見極め方。",
    tag: "社内キャリア",
  },
  {
    title: "市場価値を上げる学習リソース",
    desc: "業界・職種別に、半年〜1年で着実にスキルを伸ばすための書籍・コミュニティ・実践課題をまとめました。",
    tag: "学び",
  },
  {
    title: "転職市場の「相場感」を知る",
    desc: "今の年収は妥当か、転職するなら何年後がよいか。市場価値の測り方を解説します。",
    tag: "市場価値",
  },
];

export default function NotJobChangingPage() {
  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 20 }}>
            <Link href="/" style={{ color: "var(--royal)", textDecoration: "none" }}>ホーム</Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            <span style={{ color: "#6b7280" }}>転職しない人のために</span>
          </nav>

          <header style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
              FOR THOSE NOT JOB-CHANGING
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 12, lineHeight: 1.4 }}>
              転職しない人のために
            </h1>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, margin: 0 }}>
              転職するか、しないか。<br />
              答えを急がなくていい。OPINIOは「今すぐ転職しない」あなたにも、価値ある情報を届けます。
            </p>
          </header>

          {/* Articles */}
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
              読んでおきたい記事
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {articles.map((a) => (
                <div key={a.title} style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "#f0fdf4", color: "#15803d", display: "inline-block", marginBottom: 8 }}>
                    {a.tag}
                  </span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 6 }}>
                    {a.title}
                  </h3>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>
                    {a.desc}
                  </p>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
                    準備中（近日公開予定）
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 半年後リマインド */}
          <section style={{ background: "var(--royal-50)", borderRadius: 14, padding: 28, border: "1px solid var(--royal-100)", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
              半年後にまた相談する
            </h2>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 16, margin: "0 0 16px" }}>
              「今は動かないけど、半年後に状況を整理したい」<br />
              そんなときは、OPINIOに登録だけしておいてください。<br />
              半年後にメールでお知らせし、ご都合に合わせてメンターと再相談できます。
            </p>
            <Link
              href="/auth/signup?intent=remind_6m"
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, background: "var(--royal)", color: "#fff", textDecoration: "none",
              }}
            >
              半年後リマインドに登録する →
            </Link>
          </section>

          {/* メンター相談 CTA */}
          <div style={{
            background: "var(--warm-soft)", border: "1.5px solid #FDE68A",
            borderRadius: 14, padding: 28, marginBottom: 24,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap",
          }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
                今すぐ先輩に話を聞く
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
                転職するかどうか迷っている段階でも大丈夫。30分・完全無料です
              </p>
            </div>
            <Link
              href="/mentors"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px", borderRadius: 10,
                fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                color: "#fff", textDecoration: "none",
                flexShrink: 0,
              }}
            >
              先輩メンターを見る（無料）
            </Link>
          </div>
        </div>
      </main>
      <JobseekerFooter />
    </>
  );
}

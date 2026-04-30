import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "掲載企業の審査基準 | opinio.jp",
  description:
    "opinio.jpは編集部による独自の審査を経た企業のみを掲載しています。審査プロセス・3軸の評価基準・取材体制をご紹介します。",
  openGraph: {
    title: "掲載企業の審査基準 | opinio.jp",
    description: "Opinio編集部の独自審査と取材体制について。",
    url: "https://opinio.jp/about/selection-criteria",
  },
};

export default function SelectionCriteriaPage() {
  const axes = [
    {
      title: "プロダクト成長性",
      desc: "事業フェーズ・ARR・直近の資金調達・市場ポテンシャルを総合評価。中長期で成長が見込める企業のみを掲載しています。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      title: "カルチャー",
      desc: "経営者・現場メンバーへの取材から、実際の働き方・意思決定の透明性・心理的安全性を確認。表面的な情報では分からない実態を重視します。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: "待遇",
      desc: "給与水準・リモート率・残業時間・福利厚生が業界水準に達しているか、求人票と現場の実態に齟齬がないかを検証します。",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
  ];

  const steps = [
    { n: 1, title: "公開情報の収集", desc: "コーポレートサイト・IR資料・採用ページ・SNSから事業実態と公表データを整理。" },
    { n: 2, title: "経営者・現場メンバーへの取材", desc: "編集部が実際に経営層と現場メンバーへヒアリング。求人票では見えない実態を確認。" },
    { n: 3, title: "3軸スコアリング", desc: "プロダクト成長性・カルチャー・待遇の3軸で評価。基準を満たす企業のみ掲載候補に。" },
    { n: 4, title: "編集部の最終承認", desc: "編集会議で「この企業の求人をユーザーに紹介して良いか」を最終判断。" },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 20 }}>
            <Link href="/" style={{ color: "#1a6fd4", textDecoration: "none" }}>ホーム</Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            <span style={{ color: "#6b7280" }}>掲載企業の審査基準</span>
          </nav>

          <header style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
              ABOUT — SELECTION CRITERIA
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 10, lineHeight: 1.4 }}>
              掲載企業の審査基準
            </h1>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.8, margin: 0 }}>
              opinio.jpはエージェント仲介ではなく、編集部による独自の審査を経た企業のみを掲載しています。
              「ユーザーに自信を持って紹介できる企業か」を編集会議で判断し、基準を満たす企業のみ求人を公開します。
            </p>
          </header>

          {/* 3軸の評価基準 */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>3軸の評価基準</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              それぞれを定量・定性の両面で評価し、いずれかが基準を満たさない企業は掲載を見送ります。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {axes.map((a) => (
                <div key={a.title} style={{ display: "flex", gap: 14, padding: 16, borderRadius: 12, background: "#f9fafb", border: "0.5px solid #e5e7eb" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{a.title}</div>
                    <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 審査プロセス */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>編集部の審査プロセス</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              掲載までに4つのステップを踏みます。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {steps.map((s, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <div key={s.n} style={{ display: "flex", gap: 16, position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "#1D9E75", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700,
                      }}>
                        {s.n}
                      </div>
                      {!isLast && (
                        <div style={{ width: 2, flex: 1, background: "#e5e7eb", marginTop: 4, marginBottom: 4, minHeight: 30 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 22 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 早期離職ゼロの根拠 */}
          <section style={{ background: "#f0fdf4", borderRadius: 14, padding: 28, border: "0.5px solid #b7e4c7", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>早期離職ゼロ実績の根拠</h2>
            <p style={{ fontSize: 14, color: "#15803d", lineHeight: 1.8, margin: 0, marginBottom: 12 }}>
              <strong>創業以来、Opinio経由で入社した方の早期離職（1年以内）は0件です。</strong>
            </p>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, margin: 0 }}>
              この実績は、求人票の体裁ではなく「企業のリアル」を取材ベースで把握し、
              ミスマッチが起きそうな組み合わせは編集部の段階でフィルタリングしているためです。
              入社後にギャップが生まれない情報をユーザーに届けることを最優先しています。
            </p>
          </section>

          {/* 取材体制 */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>取材体制</h2>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.8, margin: 0, marginBottom: 12 }}>
              Opinio編集部は、IT/SaaS業界での実務経験を持つメンバーが中心です。
              企業の経営者・現場メンバーへの取材を通じて、求人票には現れない一次情報を蓄積しています。
            </p>
            <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
              {[
                "編集部による経営層・現場メンバーへの直接取材",
                "OB/OGへの追跡インタビューで入社後ギャップの有無を確認",
                "IT/SaaS業界経験者をメンターネットワークに招聘し、業界横断の知見を活用",
              ].map((item) => (
                <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#f0fdf4", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* CTA */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/jobs"
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, background: "#1D9E75", color: "#fff", textDecoration: "none",
              }}
            >
              掲載求人を見る →
            </Link>
            <Link
              href="/career-consultation"
              style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, background: "#fff", color: "#1D9E75", border: "1.5px solid #1D9E75", textDecoration: "none",
              }}
            >
              メンターに相談する
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

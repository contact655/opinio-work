import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "IT/SaaS転職ガイド | OPINIO" },
  description:
    "外資系・SaaS企業への転職を考えているあなたへ。企業情報・求人・先輩の声を一気に比較できるOPINIOの転職ガイド。",
  keywords: ["IT転職", "SaaS転職", "外資転職", "転職ガイド", "キャリアチェンジ", "エンタープライズ営業 転職"],
  alternates: { canonical: "/careers" },
  openGraph: {
    title: "IT/SaaS転職ガイド | OPINIO",
    description: "外資系・SaaS企業への転職を考えているあなたへ。企業・求人・年収・先輩の声を一気に比較。",
    type: "website",
    url: "/careers",
  },
};

// ─── コンテンツ定数 ──────────────────────────────────────────────────────────

const STEPS = [
  {
    step: "01",
    icon: "🏢",
    title: "企業を深く知る",
    desc: "取材記事・フィットポイント・組織構造・社員インタビューで「この企業が自分に合うか」を判断する。",
    href: "/companies",
    cta: "企業を探す →",
    color: "var(--royal)",
    bg: "var(--royal-50)",
  },
  {
    step: "02",
    icon: "💼",
    title: "求人を比較する",
    desc: "職種・給与・勤務形態でフィルタして、自分の条件に合う求人を絞り込む。",
    href: "/jobs",
    cta: "求人を見る →",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    step: "04",
    icon: "💬",
    title: "先輩に話を聞く",
    desc: "カジュアル面談で現役社員・OB/OGに率直な質問をする。情報収集から選考の相談まで対応。",
    href: "/companies",
    cta: "面談を申し込む →",
    color: "var(--purple)",
    bg: "var(--purple-soft)",
  },
];

const ROLE_GUIDES = [
  { slug: "sales",       label: "エンタープライズ営業",    salaryRange: "800〜1,800万円", icon: "📈" },
  { slug: "cs",          label: "カスタマーサクセス",      salaryRange: "600〜1,200万円", icon: "🤝" },
  { slug: "eng",         label: "ソフトウェアエンジニア", salaryRange: "700〜1,500万円", icon: "⚙️" },
  { slug: "pm",          label: "プロダクトマネージャー", salaryRange: "800〜1,400万円", icon: "🗂️" },
  { slug: "mkt",         label: "マーケティング",          salaryRange: "600〜1,100万円", icon: "📣" },
  { slug: "hr",          label: "人事・採用",              salaryRange: "500〜900万円",   icon: "👥" },
];

const FAQS = [
  {
    q: "OPINIOは転職エージェントですか？",
    a: "いいえ。OPINIOは転職エージェントではありません。企業の実態情報・求人・先輩との対話の場を提供するプラットフォームです。担当者からの電話や、無理な求人紹介はありません。",
  },
  {
    q: "登録なしで使えますか？",
    a: "企業情報・求人・記事は登録不要で閲覧できます。カジュアル面談の申込みには無料会員登録が必要です。",
  },
  {
    q: "どんな企業が掲載されていますか？",
    a: "Salesforce・HubSpot・Datadog などの外資系SaaS企業、国内スタートアップ（Timee・Archi Villageなど）が中心です。OPINIOが取材した企業のみ掲載しています。",
  },
  {
    q: "カジュアル面談の費用はかかりますか？",
    a: "MVP期間中は完全無料です。求職者・企業担当者ともに費用はかかりません。",
  },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CareersPage() {
  return (
    <>
      <style>{`
        .cg-step-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:24px 22px; text-decoration:none; display:block; transition:box-shadow .15s,border-color .15s; }
        .cg-step-card:hover { box-shadow:0 4px 20px rgba(0,35,102,.10); border-color:var(--royal-100); }
        .cg-role-chip { display:flex; align-items:center; gap:10px; background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; text-decoration:none; transition:border-color .15s,background .15s; }
        .cg-role-chip:hover { border-color:var(--royal-100); background:var(--royal-50); }
        .cg-faq-item { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px 20px; }
        @media(max-width:600px){ .cg-step-grid { grid-template-columns:1fr!important; } }
      `}</style>

      {/* ─ ヒーロー ─ */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "56px 24px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 14 }}>
            Career Guide
          </div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(26px,4vw,44px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 16px", lineHeight: 1.25 }}>
            IT / SaaS 転職ガイド
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: "0 0 28px", lineHeight: 1.8, maxWidth: 540 }}>
            外資系・IT・SaaS企業への転職を深く考えたい人のための情報ハブ。企業の実態・求人・年収・先輩の声を一か所で比較できます。
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/companies" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 100, background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              まず企業を見る →
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 20px 80px" }}>

        {/* ─ 転職4ステップ ─ */}
        <div style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(18px,2.5vw,26px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 24px" }}>
            OPINIO で転職を進める 4 ステップ
          </h2>
          <div className="cg-step-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {STEPS.map((s) => (
              <Link key={s.step} href={s.href} className="cg-step-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, letterSpacing: "0.08em" }}>STEP {s.step}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.4 }}>{s.title}</div>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.7 }}>{s.desc}</p>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.cta}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─ 職種別ガイド ─ */}
        <div style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(18px,2.5vw,26px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            職種別 転職マップ
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 20px" }}>職種を選ぶと、その職種の先輩と求人を一気に確認できます。</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {ROLE_GUIDES.map((r) => (
              <Link key={r.slug} href={`/people/role/${r.slug}`} className="cg-role-chip">
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, fontFamily: "var(--font-inter), var(--font-noto)" }}>{r.salaryRange}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─ 記事リンク ─ */}
        <div style={{ marginBottom: 60, padding: "28px 24px", background: "var(--royal-50)", borderRadius: 18, border: "1px solid var(--royal-100)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>先輩の声・取材記事</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
            {[
              { href: "/articles/type/employee", icon: "💬", label: "社員インタビュー" },
              { href: "/articles/type/mentor",   icon: "🌟", label: "キャリアの軌跡" },
              { href: "/articles/type/ceo",      icon: "👔", label: "CEO・経営陣" },
              { href: "/articles/type/report",   icon: "📊", label: "組織レポート" },
            ].map((a) => (
              <Link key={a.href} href={a.href} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid var(--royal-100)", textDecoration: "none", fontSize: 13, fontWeight: 600, color: "var(--ink)", transition: "background .15s" }}>
                <span>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <Link href="/articles" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>すべての記事を見る →</Link>
          </div>
        </div>

        {/* ─ FAQ ─ */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(18px,2.5vw,26px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 20px" }}>
            よくある質問
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((f) => (
              <div key={f.q} className="cg-faq-item">
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8, display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--royal)", flexShrink: 0 }}>Q.</span>
                  {f.q}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, paddingLeft: 20 }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─ 最終CTA ─ */}
        <div style={{ padding: "32px 24px", borderRadius: 20, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(18px,3vw,28px)", fontWeight: 700, color: "#fff", margin: "0 0 12px", lineHeight: 1.3 }}>
            まず、知ることから始めよう。
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.80)", margin: "0 0 24px", lineHeight: 1.6 }}>
            登録不要で企業・求人・年収を比較できます。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/companies" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              企業を探す →
            </Link>
            <Link href="/jobs" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 100, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)" }}>
              求人を見る
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

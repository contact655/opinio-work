import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticles } from "@/lib/supabase/queries";
import { TYPE_BADGE, TYPE_EYECATCH_ICON, type Article } from "@/app/articles/mockArticleData";

export const revalidate = 3600;

// ─── カテゴリ定義 ─────────────────────────────────────────────────────────────

const ARTICLE_TYPE_MAP: Record<string, {
  type: string;
  label: string;
  labelEn: string;
  description: string;
  icon: string;
}> = {
  employee: {
    type: "employee",
    label: "社員インタビュー",
    labelEn: "Employee Stories",
    description: "IT/SaaS企業で実際に働く社員の声。仕事のやりがい・組織文化・日々の業務をリアルに語ってもらいました。",
    icon: "💬",
  },
  mentor: {
    type: "mentor",
    label: "OB・OGの声",
    labelEn: "Alumni Voices",
    description: "転職経験者・先輩社員が語るキャリアの軌跡。転職の動機から現在の仕事まで、リアルなストーリーをお届けします。",
    icon: "🌟",
  },
  ceo: {
    type: "ceo",
    label: "CEO・経営陣インタビュー",
    labelEn: "CEO & Leadership",
    description: "IT/SaaS企業の経営者・経営陣が語る事業ビジョン・組織づくり・業界の未来。意思決定の背景に迫ります。",
    icon: "👔",
  },
  report: {
    type: "report",
    label: "組織レポート",
    labelEn: "Company Reports",
    description: "OPINIOが取材した企業の組織・開発文化・プロダクト戦略の深掘りレポート。数字だけではわからない実態を伝えます。",
    icon: "📊",
  },
};

export async function generateStaticParams() {
  return Object.keys(ARTICLE_TYPE_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = ARTICLE_TYPE_MAP[params.slug];
  if (!cat) return { title: { absolute: "記事 | OPINIO" } };

  const title = `${cat.label} | OPINIO`;
  const description = `${cat.description} IT/SaaS業界特化のキャリアメディアOPINIO。`;

  return {
    title: { absolute: title },
    description,
    keywords: [cat.label, "IT転職", "SaaS", "キャリア", cat.labelEn],
    alternates: { canonical: `/articles/type/${params.slug}` },
    openGraph: { title, description, type: "website", url: `/articles/type/${params.slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

// ─── 記事カード ───────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const badge = TYPE_BADGE[article.type];
  const icon = TYPE_EYECATCH_ICON[article.type];

  return (
    <Link href={`/articles/${article.slug}`} className="at-card-link">
      <div className="at-card">
        {/* アイキャッチ */}
        <div style={{
          height: 120, borderRadius: "10px 10px 0 0",
          background: article.eyecatch_gradient ?? "linear-gradient(135deg,var(--royal),#3B5FD9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, marginBottom: 0,
        }}>
          {icon}
        </div>
        <div style={{ padding: "14px 16px 18px" }}>
          {/* バッジ */}
          <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 100, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, marginBottom: 8 }}>
            {badge.label}
          </span>
          {/* タイトル */}
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
            marginBottom: 10,
          }}>
            {article.title}
          </div>
          {/* メタ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-mute)" }}>
            {article.company_name && (
              <span style={{ fontWeight: 600, color: "var(--ink-soft)" }}>{article.company_name}</span>
            )}
            {article.company_name && article.read_min && <span>·</span>}
            {article.read_min && <span>{article.read_min}分で読める</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticleTypePage({ params }: { params: { slug: string } }) {
  const cat = ARTICLE_TYPE_MAP[params.slug];
  if (!cat) notFound();

  const articles = await getArticles({ type: cat.type });

  const otherTypes = Object.entries(ARTICLE_TYPE_MAP).filter(([slug]) => slug !== params.slug);

  return (
    <>
      <style>{`
        .at-card-link { text-decoration:none; display:block; }
        .at-card { background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; transition:box-shadow .15s,border-color .15s; height:100%; }
        .at-card-link:hover .at-card { box-shadow:0 4px 20px rgba(0,35,102,.10); border-color:var(--royal-100); }
        .at-type-chip { display:block; padding:12px 16px; border-radius:12px; background:#fff; border:1px solid var(--line); text-decoration:none; transition:border-color .15s,background .15s; }
        .at-type-chip:hover { border-color:var(--royal-100); background:var(--royal-50); }
        .at-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:18px; }
        @media(max-width:600px){ .at-grid { grid-template-columns:1fr; } }
      `}</style>

      {/* ─ ヘッダー ─ */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "40px 24px 36px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12 }}>
            <Link href="/articles" style={{ color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>記事</Link>
            <span style={{ color: "var(--ink-mute)" }}>›</span>
            <span style={{ color: "var(--royal)", fontWeight: 600 }}>{cat.label}</span>
          </div>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{cat.icon}</div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(22px,3.2vw,34px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
            {cat.label}
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.7, maxWidth: 540 }}>
            {cat.description}
          </p>
          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 100, fontSize: 13, fontWeight: 700, background: "#fff", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
            {articles.length}件の記事
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ─ 記事グリッド ─ */}
        {articles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{cat.icon}</div>
            <p style={{ fontSize: 15, margin: 0 }}>このカテゴリの記事は準備中です</p>
            <Link href="/articles" style={{ display: "inline-block", marginTop: 14, fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              すべての記事を見る →
            </Link>
          </div>
        ) : (
          <div className="at-grid">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        )}

        {/* ─ 他のカテゴリ ─ */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>他のカテゴリ</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
            {otherTypes.map(([slug, info]) => (
              <Link key={slug} href={`/articles/type/${slug}`} className="at-type-chip">
                <div style={{ fontSize: 20, marginBottom: 4 }}>{info.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{info.label}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{info.labelEn}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─ CTA ─ */}
        <div style={{ marginTop: 40, padding: "28px 24px", borderRadius: 16, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
            記事の続きが気になったら、企業の先輩に直接話を聞いてみましょう。
          </p>
          <Link href="/companies" style={{ display: "inline-block", padding: "10px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            企業を探す →
          </Link>
        </div>
      </div>
    </>
  );
}

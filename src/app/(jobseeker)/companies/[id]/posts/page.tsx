import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import PostCard from "@/components/jobseeker/PostCard";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data: company } = await supabase
    .from("ow_companies")
    .select("name")
    .eq("id", params.id)
    .single();

  if (!company) return { title: "企業が見つかりません" };
  return {
    title: `${company.name} の発信 | Opinio`,
    description: `${company.name} の記事・動画・イベントなど外部発信コンテンツ一覧`,
  };
}

export default async function CompanyPostsPage({ params }: Props) {
  const supabase = createClient();

  const [companyRes, postsRes] = await Promise.all([
    supabase
      .from("ow_companies")
      .select("id, name, logo_gradient, logo_letter")
      .eq("id", params.id)
      .single(),
    supabase
      .from("ow_company_external_links")
      .select("*")
      .eq("company_id", params.id)
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!companyRes.data) notFound();

  const company = companyRes.data;
  const posts = postsRes.data ?? [];

  const logoGradient = company.logo_gradient ?? "linear-gradient(135deg, var(--royal), var(--accent))";
  const logoLetter = company.logo_letter ?? company.name.charAt(0);

  return (
    <>
      {/* ページ固有 CSS */}
      <style>{`
        .post-card-link:hover { border-color: var(--royal) !important; }
      `}</style>

      <div
        style={{
          background: "var(--bg-tint)",
          minHeight: "100vh",
          paddingTop: 64, /* header height */
        }}
      >
        <div
          style={{
            maxWidth: "var(--max-w-text)",
            margin: "0 auto",
            padding: "var(--space-12) var(--space-6) var(--space-24)",
          }}
        >
          {/* 戻るリンク */}
          <Link
            href={`/companies/${params.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--ink-mute)",
              fontSize: 13,
              textDecoration: "none",
              marginBottom: "var(--space-8)",
              transition: "color 0.15s",
            }}
          >
            <ChevronLeft size={14} strokeWidth={2} />
            {company.name} へ戻る
          </Link>

          {/* ヘッダー: ロゴ + タイトル */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              marginBottom: "var(--space-6)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: logoGradient,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {logoLetter}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--ink-mute)",
                  marginBottom: 2,
                }}
              >
                {company.name}
              </p>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "'Noto Serif JP', serif",
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                この企業の発信
              </h1>
            </div>
          </div>

          {/* 件数 */}
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-mute)",
              marginBottom: "var(--space-6)",
            }}
          >
            {posts.length} 件の記事・動画・SNS 投稿
          </p>

          {/* 一覧 */}
          {posts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "var(--space-12)",
                textAlign: "center",
                color: "var(--ink-mute)",
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              まだ発信が登録されていません
            </div>
          )}
        </div>
      </div>
    </>
  );
}

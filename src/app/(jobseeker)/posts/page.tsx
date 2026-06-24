import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import PostsTimelineFilter from "./PostsTimelineFilter";
import { CATEGORY_META } from "./categoryMeta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "企業の投稿 — OPINIO",
  description:
    "IT/SaaS企業からのイベント告知・採用情報・カルチャーストーリーをタイムラインで確認できます。",
};

// ─── 型 ──────────────────────────────────────────────────────────────────────

type PostWithCompany = {
  id: string;
  company_id: string;
  title: string;
  body: string;
  category: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  ow_companies: {
    id: string;
    name: string;
    logo_gradient: string | null;
    logo_letter: string | null;
  } | null;
};

// ─── 日付フォーマット ─────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)         return "たった今";
  if (diff < 3600)       return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: PostWithCompany }) {
  const company = post.ow_companies;
  const cat = CATEGORY_META[post.category] ?? CATEGORY_META.other;
  const dateStr = post.published_at ?? post.created_at;
  const gradient = company?.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 100%)";
  const letter = company?.logo_letter ?? (company?.name?.[0] ?? "?");

  return (
    <article style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "20px 24px",
      transition: "box-shadow 0.15s, transform 0.15s",
    }} className="post-timeline-card">

      {/* ── ヘッダー：会社 + 日時 + カテゴリ ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Link href={company ? `/companies/${company.id}` : "#"} style={{ flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 16, fontWeight: 700,
            border: "2px solid var(--line-soft)",
          }}>
            {letter}
          </div>
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>
            <Link href={company ? `/companies/${company.id}` : "#"} style={{
              color: "inherit", textDecoration: "none",
            }} className="company-name-link">
              {company?.name ?? "企業"}
            </Link>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
            {timeAgo(dateStr)}
          </div>
        </div>

        <span style={{
          flexShrink: 0,
          fontSize: 10, fontWeight: 700,
          background: cat.bg, color: cat.color,
          padding: "3px 9px", borderRadius: 100,
        }}>
          {cat.emoji} {cat.label}
        </span>
      </div>

      {/* ── カバー画像（あれば） ── */}
      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_image_url}
          alt=""
          style={{
            width: "100%", height: 180, objectFit: "cover",
            borderRadius: 10, marginBottom: 14,
            border: "1px solid var(--line-soft)",
          }}
        />
      )}

      {/* ── タイトル ── */}
      <div style={{
        fontSize: 15, fontWeight: 800, color: "var(--ink)",
        fontFamily: "var(--font-noto-serif)",
        lineHeight: 1.5, marginBottom: 8,
      }}>
        {post.title}
      </div>

      {/* ── 本文（3行クランプ） ── */}
      {post.body && (
        <p style={{
          fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75,
          margin: "0 0 14px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {post.body}
        </p>
      )}

      {/* ── フッター ── */}
      {company && (
        <Link href={`/companies/${company.id}`} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, fontWeight: 700, color: "var(--royal)",
          textDecoration: "none",
        }}>
          {company.name} の詳細を見る
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </Link>
      )}
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: { category?: string; q?: string };
};

export default async function PostsPage({ searchParams }: Props) {
  const adminSupabase = createAdminClient();
  const category = searchParams.category ?? "all";
  const q = searchParams.q?.trim() ?? "";

  // カテゴリ別件数（フィルター前、全件）
  const { data: allRaw } = await adminSupabase
    .from("ow_company_posts")
    .select("category")
    .eq("is_published", true);
  const allPosts = allRaw ?? [];
  const categoryCounts: Record<string, number> = { all: allPosts.length };
  for (const p of allPosts) {
    categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
  }

  // タイムラインデータ取得
  let query = adminSupabase
    .from("ow_company_posts")
    .select(`
      id, company_id, title, body, category, cover_image_url, published_at, created_at,
      ow_companies ( id, name, logo_gradient, logo_letter )
    `)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (category !== "all") {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  }

  const { data: rawPosts } = await query;
  const posts = (rawPosts ?? []) as unknown as PostWithCompany[];

  return (
    <>
      {/* ── 粘着フィルターバー ── */}
      <Suspense fallback={null}>
        <PostsTimelineFilter
          currentCategory={category}
          currentQ={q}
          categoryCounts={categoryCounts}
          total={posts.length}
        />
      </Suspense>

      {/* ── タイムライン ── */}
      <div style={{ background: "var(--bg-tint)", minHeight: "60vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>

          {posts.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "80px 24px",
              color: "var(--ink-mute)",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                まだ投稿がありません
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
                企業からのイベント告知・採用情報・カルチャーストーリーがここに表示されます。
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* ── 企業へのCTA ── */}
          <div style={{
            marginTop: 48,
            padding: "28px 32px",
            background: "linear-gradient(135deg, var(--royal-50) 0%, #f0f4ff 100%)",
            border: "1.5px solid var(--royal-100)",
            borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 20, flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--royal)", marginBottom: 6, textTransform: "uppercase" }}>
                企業の方へ
              </div>
              <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>
                イベント・採用情報を無料で投稿できます
              </p>
              <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.6 }}>
                OPINIOに掲載中の企業は管理画面から投稿可能です。
              </p>
            </div>
            <a href="mailto:contact@opinio.co.jp" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "var(--royal)", color: "#fff", textDecoration: "none",
              flexShrink: 0,
            }}>
              掲載について問い合わせる →
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .post-timeline-card:hover {
          box-shadow: 0 6px 24px rgba(0,35,102,0.08) !important;
          transform: translateY(-1px) !important;
        }
        .company-name-link:hover { text-decoration: underline !important; }
      `}</style>
    </>
  );
}

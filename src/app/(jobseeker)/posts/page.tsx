import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PostCard from "@/components/jobseeker/PostCard";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "企業の発信 — OPINIO",
  description:
    "LayerX・SmartHR・HubSpotなど、IT/SaaS企業が発信する記事・動画・SNS投稿をまとめてお届けします。",
};

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type PostRow = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

type PostWithCompany = PostRow & {
  ow_companies: { id: string; name: string } | null;
};

// ─── 定数 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

// ─── Pagination (Server Component、Link ベース) ────────────────────────────

function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  // 表示するページ番号を決定 (最大 7 要素、省略は "ellipsis")
  const items: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    items.push(1);
    if (currentPage > 3) items.push("ellipsis");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      items.push(i);
    }
    if (currentPage < totalPages - 2) items.push("ellipsis");
    items.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 38,
    height: 38,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "#fff",
    color: "var(--ink-soft)",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.1s, background 0.1s, color 0.1s",
  };

  const activeBtnBase: React.CSSProperties = {
    ...btnBase,
    background: "var(--royal)",
    borderColor: "var(--royal)",
    color: "#fff",
  };

  const disabledBase: React.CSSProperties = {
    ...btnBase,
    opacity: 0.4,
    cursor: "not-allowed",
  };

  return (
    <nav
      aria-label="ページネーション"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginTop: 48,
        flexWrap: "wrap",
      }}
    >
      {/* 前へ */}
      {currentPage > 1 ? (
        <Link href={`/posts?page=${currentPage - 1}`} style={{ ...btnBase, minWidth: 80 }}>
          ← 前へ
        </Link>
      ) : (
        <span style={{ ...disabledBase, minWidth: 80 }}>← 前へ</span>
      )}

      {/* ページ番号 */}
      {items.map((item, idx) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${idx}`}
            style={{ color: "var(--ink-mute)", padding: "0 4px", fontSize: 13 }}
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={`/posts?page=${item}`}
            style={item === currentPage ? activeBtnBase : btnBase}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </Link>
        )
      )}

      {/* 次へ */}
      {currentPage < totalPages ? (
        <Link href={`/posts?page=${currentPage + 1}`} style={{ ...btnBase, minWidth: 80 }}>
          次へ →
        </Link>
      ) : (
        <span style={{ ...disabledBase, minWidth: 80 }}>次へ →</span>
      )}
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: { page?: string };
};

export default async function PostsPage({ searchParams }: Props) {
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const supabase = createClient();

  // 総件数
  const { count } = await supabase
    .from("ow_company_external_links")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // 該当ページのデータ (ow_companies を JOIN)
  const { data: rawPosts } = await supabase
    .from("ow_company_external_links")
    .select("*, ow_companies(id, name)")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const posts = (rawPosts ?? []) as PostWithCompany[];

  return (
    <>
      {/* Breadcrumb */}
      <div style={{
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--line)",
        padding: "10px 0",
      }}>
        <div style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }} className="px-5 md:px-12">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5 }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>発信</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid var(--line)",
        padding: "48px 0 40px",
      }}>
        <div
          style={{ maxWidth: "var(--max-w-text)", margin: "0 auto", textAlign: "center" }}
          className="px-5"
        >
          {/* 件数ピル */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 100,
            background: "var(--royal-50)",
            color: "var(--royal)",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 20,
          }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 700 }}>
              {totalCount}
            </span>
            件の発信が集まっています
          </div>

          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "0.04em",
            marginBottom: 16,
            lineHeight: 1.4,
          }}>
            企業の発信を読む。
          </h1>

          <p style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.8,
            maxWidth: 480,
            margin: "0 auto",
          }}>
            IT/SaaS 企業が note・YouTube・SNS などで発信する
            記事・動画・ポッドキャストをまとめてお届けします。
          </p>
        </div>
      </div>

      {/* Grid */}
      <div style={{ background: "var(--bg-tint)" }}>
        <div
          style={{ maxWidth: "var(--max-w-page)", margin: "0 auto" }}
          className="px-5 py-8 md:px-12 md:py-10"
        >
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  variant="with-company"
                  companyName={post.ow_companies?.name}
                  companyId={post.ow_companies?.id}
                />
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: "center",
              padding: "80px 0",
              color: "var(--ink-mute)",
              fontSize: 15,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.22 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91" />
                  <path d="M16 3h5v5" /><path d="M21 3l-7 7" />
                </svg>
              </div>
              <div>発信がまだ登録されていません</div>
            </div>
          )}

          {/* Pagination */}
          <Pagination currentPage={safePage} totalPages={totalPages} />

          {/* ── 先輩に相談 CTA ── */}
          <div style={{
            marginTop: 64,
            padding: "32px 36px",
            background: "var(--royal-50)",
            border: "1.5px solid var(--royal-100)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--royal)", marginBottom: 8, textTransform: "uppercase" }}>
                OPINIO MENTOR
              </div>
              <p style={{
                fontFamily: "var(--font-noto-serif)",
                fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 500,
                color: "var(--ink)", margin: 0, lineHeight: 1.55,
              }}>
                発信を読んで気になったら、その企業の先輩に話を聞いてみよう。
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
                OPINIOのメンターは編集部が個別に声がけした現役・元社員のみ。30分・完全無料で相談できます。
              </p>
            </div>
            <Link href="/mentors" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 700,
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff", textDecoration: "none",
              boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              先輩に相談する（無料）
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .post-card-link:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 8px 24px rgba(0,35,102,0.08) !important;
          transform: translateY(-2px) !important;
        }
      `}</style>
    </>
  );
}

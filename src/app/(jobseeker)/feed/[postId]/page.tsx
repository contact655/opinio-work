import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LinkPreviewCard } from "@/components/feed/LinkPreviewCard";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";
import { stripActorPrefix } from "@/lib/feed/postContent";
import { isPostVisibleTo, isJobPostAlive, isCompanyPostAlive } from "@/lib/feed/visibility";
import { resolveExperienceCompanyName, EXPERIENCE_COMPANY_COLS } from "@/lib/experiences/companyName";
import { truncateAtBoundary } from "@/lib/utils/truncate";

type ActorCompany = { id: string; slug: string | null; name: string; brand_name: string | null; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null; /* ⚠️ isCompanyPostAlive で使う（2026-08-13） */ is_published: boolean | null; is_test: boolean | null } | null;

const ACTOR_SELECT = `
  ref_company:ow_companies!ref_company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url, is_published, is_test),
  ref_job:ow_jobs!ref_job_id(status, company:ow_companies!company_id(id, slug, name, brand_name, logo_letter, logo_gradient, logo_url))
`;

/** 表示上の主体。一覧側の resolveActor と同じ規則にすること */
function actorCompany(p: { post_type: string; ref_company: ActorCompany; ref_job: { status?: string | null; company: ActorCompany } | null }): ActorCompany {
  if (p.post_type === "company_joined") return p.ref_company;
  if (p.post_type === "job_posted") return p.ref_company ?? p.ref_job?.company ?? null;
  return null;
}

type RawPost = {
  id: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_description: string | null;
  link_domain: string | null;
  created_at: string;
  post_type: string;
  visibility: string;
  user: { id: string; name: string; avatar_color: string | null; avatar_url: string | null; visibility: string | null; is_system: boolean | null } | null;
  ref_company: ActorCompany;
  ref_job: { status: string | null; company: ActorCompany } | null;
  likes: { count: number }[];
  comments: { count: number }[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { postId: string } }): Promise<Metadata> {
  if (!UUID_RE.test(params.postId)) notFound();

  const adminSupabase = createAdminClient();
  const { data: raw } = await adminSupabase
    .from("ow_posts_visible")
    .select(`content, post_type, user:ow_users!user_id(name), ${ACTOR_SELECT}`)
    .eq("id", params.postId)
    .maybeSingle();

  if (!raw) notFound();
  const p = raw as unknown as { content: string; post_type: string; user: { name: string } | null; ref_company: ActorCompany; ref_job: { status: string | null; company: ActorCompany } | null };
  const co = actorCompany(p);
  // 一覧と同じ関数を通す。actor 行と本文で社名が二重にならないようにする
  const body = co ? stripActorPrefix(p.content, p.post_type, [co.brand_name ?? co.name, co.name]) : p.content;
  const excerpt = truncateAtBoundary(body, 50);
  const authorName = co ? (co.brand_name ?? co.name) : (p.user?.name ?? "ユーザー");
  // OGP。画像は動的生成（/api/og）に寄せる。
  // ⚠️ actor 企業のロゴを og:image に使うのは避けている。85社中76社の logo_url が
  //    死んだ Clearbit を指しており（B-0 参照）、SNS 側は onError で差し替えられないため、
  //    共有カードが壊れた画像になる。usableLogoUrl が通る9社だけ別扱いにすると
  //    企業によってカードの見た目が変わるので、生成画像に統一する。
  const ogImageUrl = `/api/og?type=${co ? "company" : "default"}`
    + `&name=${encodeURIComponent(excerpt)}`
    + `&sub=${encodeURIComponent(authorName)}`;
  const url = `/feed/${params.postId}`;

  return {
    title: `${authorName}: ${excerpt} | OPINIO`,
    description: body.slice(0, 120),
    alternates: { canonical: url },
    openGraph: {
      title: `${authorName}: ${excerpt}`,
      description: body.slice(0, 120),
      type: "article",
      url,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${authorName}: ${excerpt}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${authorName}: ${excerpt}`,
      description: body.slice(0, 120),
      images: [ogImageUrl],
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function FeedPostPage({ params }: { params: { postId: string } }) {
  if (!UUID_RE.test(params.postId)) notFound();

  // 閲覧は未ログインOK（login_only 投稿は非表示）
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminSupabase = createAdminClient();
  const { data: raw } = await adminSupabase
    .from("ow_posts_visible")
    .select(`
      id, content, image_url, link_url, link_title, link_image_url, link_description, link_domain, created_at,
      post_type, visibility,
      user:ow_users!user_id(id, name, avatar_color, avatar_url, visibility, is_system),
      ${ACTOR_SELECT},
      likes:ow_post_likes(count),
      comments:ow_post_comments(count)
    `)
    .eq("id", params.postId)
    .maybeSingle();

  // ⚠️ ow_posts_visible に無い＝参照先が消えた投稿。ここで 404 になる。
  //    f34ba43d で is_system の例外を入れた結果いったん 200 になっていたのを、
  //    ビュー側で塞いでいる（行は消していないので ow_posts には残っている）。
  if (!raw) notFound();
  const p = raw as unknown as RawPost;
  // ⚠️ 一覧側（(list)/page.tsx の visiblePosts と /api/jobseeker/posts の filterVisible）と
  //    同じ判定順序にすること。is_system を先に通す。
  //    システムユーザー（00000000-…-0001 / OPINIO）は visibility='private' なので、
  //    この例外が無いとシステム投稿170件すべてのパーマリンクが 404 になる。
  //    一覧には出ているのにシェアURLだけ 404 という状態だった（2026-08-05 修正）。
  // ⚠️ 判定は lib/feed/visibility に集約している。一覧と食い違わせない
  if (!isPostVisibleTo({ postVisibility: p.visibility, author: p.user }, !!user)) notFound();
  // 掲載を下ろした求人の「公開しました」投稿は、パーマリンクでも出さない
  if (!isJobPostAlive(p)) notFound();
  // 取り下げた企業の「参加しました」投稿も同じく（2026-08-13）
  if (!isCompanyPostAlive(p)) notFound();

  const actorCo = actorCompany(p);
  const actorName = actorCo ? (actorCo.brand_name ?? actorCo.name) : (p.user?.name ?? "不明");
  // ⚠️ 一覧と同じ関数を通す。DB の content は書き換えない
  const displayContent = actorCo
    ? stripActorPrefix(p.content, p.post_type, [actorName, actorCo.name])
    : p.content;

  // 現職情報
  let roleTitle: string | null = null;
  let company: string | null = null;
  if (p.user?.id) {
    const { data: exp } = await adminSupabase
      .from("ow_experiences")
      .select(`role_title, ${EXPERIENCE_COMPANY_COLS}`)
      .eq("user_id", p.user.id)
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (exp) {
      roleTitle = exp.role_title ?? null;
      company = resolveExperienceCompanyName(exp);
    }
  }

  const likeCount = p.likes?.[0]?.count ?? 0;
  const commentCount = p.comments?.[0]?.count ?? 0;
  const avatarColor = p.user?.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px 64px" }}>
      {/* 戻るリンク */}
      <Link
        href="/feed"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--ink-soft)",
          textDecoration: "none",
          fontSize: 14,
          fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
          marginBottom: 20,
        }}
      >
        ← フィードに戻る
      </Link>

      {/* 投稿カード */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        {/* ヘッダー。actor（表示上の主体）は一覧と同じ規則で決める */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          {actorCo ? (
            <Link href={`/companies/${actorCo.slug ?? actorCo.id}`} style={{ flexShrink: 0 }} aria-label={actorName}>
              <CompanyLogoImg
                logoUrl={actorCo.logo_url} logoLetter={actorCo.logo_letter} logoGradient={actorCo.logo_gradient}
                name={actorName} size={44} borderRadius={10}
              />
            </Link>
          ) : (
            <Link href={`/u/${p.user?.id ?? ""}`} style={{ flexShrink: 0 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: p.user?.avatar_url ? undefined : avatarColor,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 16,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {p.user?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  (p.user?.name ?? "?")[0]
                )}
              </div>
            </Link>
          )}
          <div>
            <Link
              href={actorCo ? `/companies/${actorCo.slug ?? actorCo.id}` : `/u/${p.user?.id ?? ""}`}
              style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}
            >
              {actorName}
            </Link>
            {!actorCo && (roleTitle || company) && (
              <div style={{ fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif', fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                {[roleTitle, company].filter(Boolean).join(" · ")}
              </div>
            )}
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
              {formatDate(p.created_at)}
            </div>
          </div>
        </div>

        {/* 本文 */}
        <p
          style={{
            margin: "0 0 14px",
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
            fontSize: 15,
            color: "var(--ink)",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {displayContent}
        </p>

        {/* 画像 */}
        {p.image_url && (
          <div style={{ marginBottom: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt=""
              style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
            />
          </div>
        )}

        {/* リンクプレビュー */}
        {p.link_url && (
          <div style={{ marginBottom: 14 }}>
            <LinkPreviewCard
              linkUrl={p.link_url}
              linkTitle={p.link_title}
              linkImageUrl={p.link_image_url}
              linkDescription={p.link_description}
              linkDomain={p.link_domain}
            />
          </div>
        )}

        {/* フッター: いいね・コメント数 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            fontFamily: 'var(--font-noto), "Noto Sans JP", sans-serif',
            fontSize: 14,
            color: "var(--ink-soft)",
          }}
        >
          <span>❤️ {likeCount}</span>
          <span>💬 {commentCount}</span>
          <Link
            href="/feed"
            style={{ marginLeft: "auto", color: "var(--royal)", textDecoration: "none", fontSize: 14 }}
          >
            フィードで返信する →
          </Link>
        </div>
      </div>
    </div>
  );
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPostVisibleTo } from "@/lib/feed/visibility";
import { isRegisteredUser } from "@/lib/users/registered";

/**
 * ★横断検索の「投稿」（フィードの利用者の投稿。2026-10-21 / 柴さんの指示）。
 *
 * - 対象は利用者が書いた投稿（`post_type = 'user_post'`）だけ。
 *   企業の参加・募集の掲載・記事の公開の告知は、企業・募集・記事の欄と同じものが2回出るので入れない。
 * - 条件の解釈（`interpretQuery`）は通さない。**入力したことばが本文に含まれるか**で引く
 *   （空白で区切った語はすべて含むもの＝AND）。投稿は自由文なので、職種などの条件では当たらない。
 * - ★ログインしている人にだけ返す（フィードと同じ。投稿はログインした人向けの面）。
 * - 見せてよいかはフィードと同じ `isPostVisibleTo` を通す（検証用・非公開の投稿者・システムの扱いも同じ）。
 *   ⚠️ 読むのは `ow_posts_visible`（フィードと同じビュー）。素の `ow_posts` に戻さないこと
 */

export type PostHit = {
  id: string;
  /** 本文の抜粋（当たった語のまわり） */
  excerpt: string;
  /** 抜粋の中で強調する語 */
  terms: string[];
  createdAt: string;
  author: { id: string; name: string; initial: string; avatarUrl: string | null; gradient: string };
  /** ★ホームと同じカードにするための中身（2026-10-21）。本文は全文（カード側で畳む） */
  content: string;
  imageUrl: string | null;
  link: { url: string; title: string | null; imageUrl: string | null; description: string | null; domain: string | null } | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

const POST_LIMIT = 24;
const EXCERPT_LEN = 90;
const FALLBACK_GRADIENT = "linear-gradient(135deg, var(--royal), var(--accent))";

/** ilike のワイルドカードを打ち消す（入力の % や _ で全件に当たらないように） */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function splitTerms(raw: string): string[] {
  return Array.from(new Set(raw.trim().split(/[\s　]+/).filter((t) => t.length > 0))).slice(0, 5);
}

function excerptAround(content: string, terms: string[]): string {
  const flat = content.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const hit = terms.map((t) => lower.indexOf(t.toLowerCase())).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 20);
  const body = flat.slice(start, start + EXCERPT_LEN);
  return `${start > 0 ? "…" : ""}${body}${start + EXCERPT_LEN < flat.length ? "…" : ""}`;
}

export async function searchPostHits(
  raw: string,
  viewer: { isLoggedIn: boolean; isTest: boolean; owUserId?: string | null },
): Promise<{ items: PostHit[]; total: number }> {
  const terms = splitTerms(raw);
  if (!viewer.isLoggedIn || terms.length === 0) return { items: [], total: 0 };

  const db = createAdminClient();
  let q = db
    .from("ow_posts_visible")
    .select("id, content, created_at, visibility, image_url, link_url, link_title, link_image_url, link_description, link_domain, likes:ow_post_likes(count), comments:ow_post_comments(count), user:ow_users!user_id(id, name, avatar_url, avatar_color, visibility, is_test, is_system, auth_id)")
    .eq("post_type", "user_post");
  for (const t of terms) q = q.ilike("content", `%${escapeLike(t)}%`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("[searchPostHits]", error.message);
    return { items: [], total: 0 };
  }

  type Author = { id: string; name: string | null; avatar_url: string | null; avatar_color: string | null; visibility: string | null; is_test: boolean | null; is_system: boolean | null; auth_id: string | null };
  const hits: PostHit[] = [];
  for (const r of data ?? []) {
    const a = (Array.isArray(r.user) ? r.user[0] : r.user) as unknown as Author | null;
    if (!a || !a.name || !isRegisteredUser(a)) continue;
    /* ⚠️ 投稿の検索は user_post だけ（会社・求人・記事を指さない）なので、検証用の指す先は無い */
    if (!isPostVisibleTo({ postVisibility: r.visibility as string | null, author: a, refersToTest: false }, true, viewer.isTest)) continue;
    const count = (x: unknown) => (Array.isArray(x) && typeof x[0]?.count === "number" ? (x[0].count as number) : 0);
    hits.push({
      content: (r.content as string) ?? "",
      imageUrl: (r.image_url as string | null) ?? null,
      link: r.link_url
        ? { url: r.link_url as string, title: (r.link_title as string | null) ?? null, imageUrl: (r.link_image_url as string | null) ?? null, description: (r.link_description as string | null) ?? null, domain: (r.link_domain as string | null) ?? null }
        : null,
      likeCount: count(r.likes),
      commentCount: count(r.comments),
      likedByMe: false,
      id: r.id as string,
      excerpt: excerptAround((r.content as string) ?? "", terms),
      terms,
      createdAt: r.created_at as string,
      author: {
        id: a.id, name: a.name, initial: a.name.charAt(0), avatarUrl: a.avatar_url,
        gradient: a.avatar_color?.startsWith("linear-gradient") ? a.avatar_color : FALLBACK_GRADIENT,
      },
    });
  }
  const items = hits.slice(0, POST_LIMIT);
  /* ★自分がいいねしたか（ホームと同じ表）。⚠️ 失敗しても「押していない」に倒すだけ（ログは出す） */
  if (viewer.owUserId && items.length > 0) {
    const { data: liked, error: likedErr } = await db.from("ow_post_likes").select("post_id")
      .eq("user_id", viewer.owUserId).in("post_id", items.map((i) => i.id));
    if (likedErr) console.error("[searchPostHits] liked:", likedErr.message);
    const set = new Set(((liked ?? []) as { post_id: string }[]).map((x) => x.post_id));
    for (const it of items) it.likedByMe = set.has(it.id);
  }
  return { items, total: hits.length };
}

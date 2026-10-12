import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWording, wordingMessage } from "@/lib/jobs/wordingCheck";
import {
  STORY_BODY_MAX, STORY_COVER_MAX_BYTES, STORY_COVER_MIMES, STORY_TITLE_MAX,
  isStoryCategory, storyPublishProblems, type StoryCategory,
} from "./shared";

/**
 * ★企業ストーリーの読み書き（2026-10-12）。**サーバー専用。**
 *
 * ⚠️ 会社の担当者かどうかは**呼び出し側**（`/biz/posts` のページと Server Action）が確かめ、
 *    ここには確かめた会社の id を渡す。ここでは「そのストーリーがその会社のものか」だけを見る。
 * ⚠️ 書きかけの置き場は2つ。
 *    ・下書き（未公開）のストーリー … ow_company_posts を直接書く（誰にも見えない）
 *    ・公開中のストーリー … ow_company_post_drafts（anon が ow_company_posts を読めるため。migration 20261012170000）
 */

export type StoryRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  coverImageUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

/** 編集画面と一覧に渡す形。`draft` は公開中のストーリーの未公開の変更（無ければ null） */
export type StoryWithDraft = StoryRow & {
  draft: { title: string; body: string; category: string; coverImageUrl: string | null; updatedAt: string } | null;
};

export type StoryFields = { title: string; body: string; category: string; coverImageUrl: string | null };

type Result<T> = { ok: true; value: T } | { ok: false; error: string; wording?: string[] };

const POST_COLS = "id, company_id, title, body, category, cover_image_url, is_published, published_at, updated_at, created_at" as const;

function toRow(r: Record<string, unknown>): StoryRow {
  return {
    id: r.id as string,
    title: (r.title as string) ?? "",
    body: (r.body as string) ?? "",
    category: (r.category as string) ?? "other",
    coverImageUrl: (r.cover_image_url as string | null) ?? null,
    isPublished: r.is_published === true,
    publishedAt: (r.published_at as string | null) ?? null,
    updatedAt: r.updated_at as string,
    createdAt: r.created_at as string,
  };
}

/** 一覧。⚠️ 取れなかったら null（「まだ無い」と区別する） */
export async function listCompanyStories(companyId: string): Promise<StoryWithDraft[] | null> {
  const db = createAdminClient();
  const [{ data: posts, error }, { data: drafts, error: dErr }] = await Promise.all([
    db.from("ow_company_posts").select(POST_COLS).eq("company_id", companyId).order("created_at", { ascending: false }),
    db.from("ow_company_post_drafts").select("post_id, title, body, category, cover_image_url, updated_at").eq("company_id", companyId),
  ]);
  if (error) { console.error("[companyStories] list:", error.message); return null; }
  if (dErr) console.error("[companyStories] drafts:", dErr.message);
  const byId = new Map((drafts ?? []).map((d) => [d.post_id as string, d]));
  return (posts ?? []).map((p) => {
    const row = toRow(p);
    const d = row.isPublished ? byId.get(row.id) : undefined;
    return {
      ...row,
      draft: d ? {
        title: (d.title as string) ?? "", body: (d.body as string) ?? "", category: (d.category as string) ?? "other",
        coverImageUrl: (d.cover_image_url as string | null) ?? null, updatedAt: d.updated_at as string,
      } : null,
    };
  });
}

/** 1件。⚠️ 別の会社のものは null（存在を区別させない） */
export async function getCompanyStory(companyId: string, id: string): Promise<StoryWithDraft | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data: p, error } = await db.from("ow_company_posts").select(POST_COLS).eq("id", id).eq("company_id", companyId).maybeSingle();
  if (error) { console.error("[companyStories] get:", error.message); return null; }
  if (!p) return null;
  const row = toRow(p);
  let draft: StoryWithDraft["draft"] = null;
  if (row.isPublished) {
    const { data: d, error: dErr } = await db.from("ow_company_post_drafts")
      .select("title, body, category, cover_image_url, updated_at").eq("post_id", id).maybeSingle();
    if (dErr) console.error("[companyStories] draft:", dErr.message);
    if (d) draft = { title: d.title as string, body: d.body as string, category: d.category as string, coverImageUrl: (d.cover_image_url as string | null) ?? null, updatedAt: d.updated_at as string };
  }
  return { ...row, draft };
}

/** 閲覧数（ストーリーごとの合計）。⚠️ 取れなかったら null（0 と出さない） */
export async function storyViewTotals(companyId: string): Promise<Record<string, number> | null> {
  const { data, error } = await createAdminClient().from("ow_page_view_daily")
    .select("target_id, views").eq("company_id", companyId).eq("page_type", "story");
  if (error) { console.error("[companyStories] views:", error.message); return null; }
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.target_id as string] = (out[r.target_id as string] ?? 0) + ((r.views as number) ?? 0);
  return out;
}

function validateFields(f: StoryFields): string | null {
  if (f.title.length > STORY_TITLE_MAX) return `タイトルは${STORY_TITLE_MAX}字以内にしてください。`;
  if (f.body.length > STORY_BODY_MAX) return "本文が長すぎます。";
  if (!isStoryCategory(f.category)) return "種類が正しくありません。";
  if (f.coverImageUrl) {
    if (f.coverImageUrl.length > 2048) return "表紙写真の URL が長すぎます。";
    try { if (new URL(f.coverImageUrl).protocol !== "https:") return "表紙写真の URL が正しくありません。"; }
    catch { return "表紙写真の URL が正しくありません。"; }
  }
  return null;
}

const same = (a: StoryFields, b: StoryFields) =>
  a.title === b.title && a.body === b.body && a.category === b.category && (a.coverImageUrl ?? null) === (b.coverImageUrl ?? null);

/**
 * ★自動保存。`id` が null なら下書きとして作る。
 *   公開中なら書きかけ（ow_company_post_drafts）に置き、公開中の内容と同じに戻ったら書きかけを消す。
 */
export async function saveStory(
  companyId: string, owUserId: string, id: string | null, f: StoryFields,
): Promise<Result<{ id: string; hasDraft: boolean; savedAt: string }>> {
  const bad = validateFields(f);
  if (bad) return { ok: false, error: bad };
  const db = createAdminClient();
  const now = new Date().toISOString();

  if (!id) {
    const { data, error } = await db.from("ow_company_posts").insert({
      company_id: companyId, author_user_id: owUserId, title: f.title, body: f.body,
      category: f.category as StoryCategory, cover_image_url: f.coverImageUrl, is_published: false, published_at: null,
    }).select("id").single();
    if (error || !data) { console.error("[companyStories] create:", error?.message); return { ok: false, error: "保存できませんでした。" }; }
    return { ok: true, value: { id: data.id as string, hasDraft: false, savedAt: now } };
  }

  const cur = await getCompanyStory(companyId, id);
  if (!cur) return { ok: false, error: "このストーリーは見つかりません。" };

  if (!cur.isPublished) {
    const { data, error } = await db.from("ow_company_posts").update({
      title: f.title, body: f.body, category: f.category, cover_image_url: f.coverImageUrl, updated_at: now,
    }).eq("id", id).eq("company_id", companyId).select("id");
    if (error || !data?.length) { console.error("[companyStories] update:", error?.message); return { ok: false, error: "保存できませんでした。" }; }
    return { ok: true, value: { id, hasDraft: false, savedAt: now } };
  }

  /* 公開中: 書きかけに置く。公開中の内容と同じなら書きかけを消す（「未公開の変更あり」を残さない） */
  if (same(f, cur)) {
    const { error } = await db.from("ow_company_post_drafts").delete().eq("post_id", id);
    if (error) { console.error("[companyStories] draft clear:", error.message); return { ok: false, error: "保存できませんでした。" }; }
    return { ok: true, value: { id, hasDraft: false, savedAt: now } };
  }
  const { error } = await db.from("ow_company_post_drafts").upsert({
    post_id: id, company_id: companyId, title: f.title, body: f.body, category: f.category,
    cover_image_url: f.coverImageUrl, updated_by_ow_user_id: owUserId, updated_at: now,
  }, { onConflict: "post_id" });
  if (error) { console.error("[companyStories] draft save:", error.message); return { ok: false, error: "保存できませんでした。" }; }
  return { ok: true, value: { id, hasDraft: true, savedAt: now } };
}

/**
 * ★公開する／変更を公開する。求人と同じ禁止表現の確認（wordingCheck）を通す。
 *   ⚠️ 公開中の書きかけを公開するときは公開日（published_at）を変えない。
 */
export async function publishStory(companyId: string, id: string): Promise<Result<StoryWithDraft>> {
  const cur = await getCompanyStory(companyId, id);
  if (!cur) return { ok: false, error: "このストーリーは見つかりません。" };
  const eff: StoryFields = cur.draft ?? cur;
  const problems = storyPublishProblems(eff);
  if (problems.length) return { ok: false, error: problems.join(" ") };
  const hits = checkWording([{ field: "タイトル", text: eff.title }, { field: "本文", text: eff.body }]);
  if (hits.length) return { ok: false, error: "公開できない表現があります。", wording: hits.map(wordingMessage) };
  const bad = validateFields(eff);
  if (bad) return { ok: false, error: bad };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("ow_company_posts").update({
    title: eff.title.trim(), body: eff.body.trim(), category: eff.category, cover_image_url: eff.coverImageUrl,
    is_published: true, published_at: cur.isPublished ? cur.publishedAt ?? now : now, updated_at: now,
  }).eq("id", id).eq("company_id", companyId).select("id");
  if (error || !data?.length) { console.error("[companyStories] publish:", error?.message); return { ok: false, error: "公開できませんでした。" }; }
  const { error: dErr } = await db.from("ow_company_post_drafts").delete().eq("post_id", id);
  if (dErr) console.error("[companyStories] publish draft clear:", dErr.message);
  const after = await getCompanyStory(companyId, id);
  return after ? { ok: true, value: after } : { ok: false, error: "公開しましたが、読み込めませんでした。" };
}

/** ★下書きに戻す。書きかけがあればそれを本体に移す（下書きは誰にも見えないので分けておく必要が無い） */
export async function unpublishStory(companyId: string, id: string): Promise<Result<StoryWithDraft>> {
  const cur = await getCompanyStory(companyId, id);
  if (!cur) return { ok: false, error: "このストーリーは見つかりません。" };
  const eff: StoryFields = cur.draft ?? cur;
  const db = createAdminClient();
  const { data, error } = await db.from("ow_company_posts").update({
    title: eff.title, body: eff.body, category: eff.category, cover_image_url: eff.coverImageUrl,
    is_published: false, published_at: null, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("company_id", companyId).select("id");
  if (error || !data?.length) { console.error("[companyStories] unpublish:", error?.message); return { ok: false, error: "下書きに戻せませんでした。" }; }
  const { error: dErr } = await db.from("ow_company_post_drafts").delete().eq("post_id", id);
  if (dErr) console.error("[companyStories] unpublish draft clear:", dErr.message);
  const after = await getCompanyStory(companyId, id);
  return after ? { ok: true, value: after } : { ok: false, error: "下書きに戻しましたが、読み込めませんでした。" };
}

/** 未公開の変更を捨てて、公開中の内容に戻す */
export async function discardStoryChanges(companyId: string, id: string): Promise<Result<StoryWithDraft>> {
  const cur = await getCompanyStory(companyId, id);
  if (!cur) return { ok: false, error: "このストーリーは見つかりません。" };
  const { error } = await createAdminClient().from("ow_company_post_drafts").delete().eq("post_id", id).eq("company_id", companyId);
  if (error) { console.error("[companyStories] discard:", error.message); return { ok: false, error: "取り消せませんでした。" }; }
  return { ok: true, value: { ...cur, draft: null } };
}

export async function deleteCompanyStory(companyId: string, id: string): Promise<Result<null>> {
  const { data, error } = await createAdminClient().from("ow_company_posts").delete().eq("id", id).eq("company_id", companyId).select("id");
  if (error || !data?.length) { console.error("[companyStories] delete:", error?.message); return { ok: false, error: "削除できませんでした。" }; }
  return { ok: true, value: null };
}

/**
 * ★表紙写真をブラウザから Storage に直接置くための短時間の URL。
 *   ⚠️ 置き場所はこの会社のフォルダだけ（`companies/story-covers/{companyId}/…`）。
 *   ⚠️ 種類と大きさはバケット側（5MB・画像のみ）でも止まる。
 */
export async function createStoryCoverUploadUrl(
  companyId: string, mime: string, size: number,
): Promise<Result<{ signedUrl: string; publicUrl: string }>> {
  if (!(STORY_COVER_MIMES as readonly string[]).includes(mime)) return { ok: false, error: "JPG・PNG・WebP の画像を選んでください。" };
  if (!(size > 0) || size > STORY_COVER_MAX_BYTES) return { ok: false, error: "5MB 以内の画像を選んでください。" };
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `companies/story-covers/${companyId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const db = createAdminClient();
  const s = await db.storage.from("ow-uploads").createSignedUploadUrl(path);
  if (s.error || !s.data) { console.error("[companyStories] cover url:", s.error?.message); return { ok: false, error: "アップロードの準備ができませんでした。" }; }
  const { data: pub } = db.storage.from("ow-uploads").getPublicUrl(path);
  return { ok: true, value: { signedUrl: s.data.signedUrl, publicUrl: pub.publicUrl } };
}

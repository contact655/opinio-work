"use server";

import { revalidatePath } from "next/cache";
import { checkBizAction } from "@/lib/auth/companyAccess";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import {
  saveStory, publishStory, unpublishStory, discardStoryChanges, deleteCompanyStory, createStoryCoverUploadUrl,
  type StoryFields, type StoryWithDraft,
} from "@/lib/companyStories/server";

/**
 * ★企業ストーリーの Server Action（2026-10-12 に4本から1本にまとめた）。
 * ⚠️ 会社は「いま選んでいる会社」（biz_current_company_id）。その会社の**有効な担当者**だけが通る
 *    （getCompanyContext は is_active の行しか見ない）。中身は lib/companyStories/server.ts。
 * ⚠️ 求職者側に見える変化（公開・下書きに戻す・削除）のときだけ企業ページを作り直す。
 *    自動保存では作り直さない（書きかけは公開側に出ないため）。
 */

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string; wording?: string[] };

/* ★企業ストーリーを書けるのは 管理者・採用担当（2026-10-12 / stories.edit）。判定は can() の1か所 */
async function ctx(): Promise<{ companyId: string; owUserId: string } | null> {
  const r = await checkBizAction("stories.edit");
  return r.ok ? { companyId: r.actor.companyId, owUserId: r.actor.owUserId } : null;
}

const NO_AUTH = { ok: false as const, error: "ログインし直すか、権限を確かめてください。" };

export async function saveStoryAction(id: string | null, f: StoryFields): Promise<ActionResult<{ id: string; hasDraft: boolean; savedAt: string }>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  const r = await saveStory(c.companyId, c.owUserId, id, {
    title: String(f.title ?? ""), body: String(f.body ?? ""), category: String(f.category ?? ""),
    coverImageUrl: f.coverImageUrl ? String(f.coverImageUrl) : null,
  });
  if (r.ok && !id) revalidatePath("/biz/posts");
  return r;
}

async function afterPublicChange(companyId: string) {
  await revalidateCompanyPages(companyId);
  revalidatePath("/biz/posts");
}

export async function publishStoryAction(id: string): Promise<ActionResult<StoryWithDraft>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  const r = await publishStory(c.companyId, id);
  if (r.ok) await afterPublicChange(c.companyId);
  return r;
}

export async function unpublishStoryAction(id: string): Promise<ActionResult<StoryWithDraft>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  const r = await unpublishStory(c.companyId, id);
  if (r.ok) await afterPublicChange(c.companyId);
  return r;
}

export async function discardStoryChangesAction(id: string): Promise<ActionResult<StoryWithDraft>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  const r = await discardStoryChanges(c.companyId, id);
  if (r.ok) revalidatePath("/biz/posts");
  return r;
}

export async function deleteStoryAction(id: string): Promise<ActionResult<null>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  const r = await deleteCompanyStory(c.companyId, id);
  if (r.ok) await afterPublicChange(c.companyId);
  return r;
}

export async function storyCoverUploadUrlAction(mime: string, size: number): Promise<ActionResult<{ signedUrl: string; publicUrl: string }>> {
  const c = await ctx();
  if (!c) return NO_AUTH;
  return createStoryCoverUploadUrl(c.companyId, String(mime), Number(size));
}

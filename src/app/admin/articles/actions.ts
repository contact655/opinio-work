"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildArticlePublishedRow } from "@/lib/feed/systemPosts";
import { revalidatePath } from "next/cache";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";


async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleArticlePublished(
  articleId: string,
  current: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  await assertAdmin();
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("ow_articles").update({
    is_published: !current,
    published_at: !current ? nowIso : null,
    updated_at: nowIso,
  }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };

  /* ⚠️★2026-09-07 追加。記事は企業ページの「取材記事」に出るので、公開状態を変えたら
        その企業のページも作り直す。⚠️ `getArticlesByCompanyCached`
        （unstable_cache 60秒）越しだが、**`revalidatePath` で一緒に落ちる**
        （2026-09-08 に本番でツールで実測）。 */
  {
    const { data: a } = await admin.from("ow_articles").select("company_id").eq("id", articleId).maybeSingle();
    if (a?.company_id) await revalidateCompanyPages(a.company_id as string);
  }

  // Feed: article_published (公開時のみ、best-effort, 重複は 23505 で無視)
  if (!current) {
    try {
      const { data: article } = await admin.from("ow_articles").select("title").eq("id", articleId).maybeSingle();
      if (article?.title) {
        // ⚠️ 本文と ref_* の埋め方は lib/feed/systemPosts に集約している。ここで組み立てない。
        const { error: feedErr } = await admin.from("ow_posts").insert(
          buildArticlePublishedRow(articleId, article),
        );
        if (feedErr && feedErr.code !== "23505") {
          console.error("[feed article_published]", feedErr.message);
        }
      }
    } catch (feedErr) {
      console.error("[feed article_published]", feedErr);
    }
  }

  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function linkArticleUser(
  articleId: string,
  userId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  if (userId !== null && !UUID_RE.test(userId)) return { ok: false, error: "Invalid userId" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("ow_articles").update({ user_id: userId || null }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };
  revalidatePath("/admin/articles");
  return { ok: true };
}

export async function linkArticleCompany(
  articleId: string,
  companyId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(articleId)) return { ok: false, error: "Invalid articleId" };
  if (companyId !== null && !UUID_RE.test(companyId)) return { ok: false, error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();
  /* ⚠️ 付け替え前の企業も作り直す必要があるので、更新前に控える */
  const { data: before } = await admin.from("ow_articles").select("company_id").eq("id", articleId).maybeSingle();
  const { error } = await admin.from("ow_articles").update({ company_id: companyId || null }).eq("id", articleId);
  if (error) return { ok: false, error: "更新に失敗しました" };
  /* ⚠️★2026-09-07 追加。**外した側と付けた側の両方**を作り直す。片方だけだと
        外したはずの企業ページに記事が残る（最大60秒だが、C で 3600 にすると1時間残る）。 */
  if (before?.company_id) await revalidateCompanyPages(before.company_id as string);
  if (companyId && companyId !== before?.company_id) await revalidateCompanyPages(companyId);
  revalidatePath("/admin/articles");
  return { ok: true };
}

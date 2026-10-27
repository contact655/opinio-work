import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { buildCompanyJoinedRow } from "@/lib/feed/systemPosts";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { publishedAtPatch } from "@/lib/companies/publishedAt";
import { checkPublishable } from "@/lib/companies/publishable";
import { applyCompanyDraft } from "@/lib/companies/applyDraft";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { greetingName } from "@/lib/constants/personName";
import { COMPANY_SUSPENDED_MESSAGE } from "@/lib/business/scoutGate";
import { emailOps } from "@/lib/notify/companyEmail";
import { companySelfListedAdminTemplate } from "@/lib/notify/templates";

/**
 * ★企業が自分で企業ページを公開する・非公開にする（2026-10-28 / 柴さんの判断。公開は企業、停止は運営）。
 *   それまでは「掲載を依頼する」→ 運営が掲載、だった（運営の承認 is_approved が掲載の条件）。
 *
 * ── 公開する ─────────────────────────────────────────────────────────────
 *   ① 停止中なら断る（「このページは運営により停止されています」。DB の guard_company_approval も同じ文で止める）
 *   ② 掲載規約の同意・必要な項目（下書きの値で判定。checkPublishable）
 *   ③ 下書きを反映する（企業名も。運営が掲載していたときと同じ）
 *   ④ listing_status = 'listed'（ページが開けない会社は is_published も true に）
 *   ⑤ フィードの「参加しました」・キャッシュ・運営へのメール（あとから確認するため。承認ではない）
 * ── 非公開にする ────────────────────────────────────────────────────────
 *   listing_status = 'draft' だけ。⚠️ is_published は触らない（職歴からの会社リンクを切らないため）
 *
 * ⚠️ 公開の書き込みは**セッションのクライアント**で行う。DB の停止のガード（trg_guard_company_approval）を効かせるため。
 *    下書きの反映とフィードの投稿は運営の掲載と同じく admin クライアント。
 * ⚠️ 呼び出し側で「その企業の管理者か」を確かめてから呼ぶこと。
 */

type Result = { ok: true } | { ok: false; status: number; error: string; missing?: string[] };

export async function setCompanyListedBySelf(p: {
  companyId: string;
  listed: boolean;
  session: SupabaseClient;
  authUserId: string;
  owUserId: string;
}): Promise<Result> {
  const admin = createAdminClient();
  const { data: cur, error: cErr } = await admin.from("ow_companies")
    .select("name, is_published, listing_status, published_at, suspended_at").eq("id", p.companyId).maybeSingle();
  if (cErr) {
    console.error("[listing] 企業の取得:", cErr.message);
    return { ok: false, status: 500, error: "企業情報を確認できませんでした。時間をおいてもう一度お試しください。" };
  }
  if (!cur) return { ok: false, status: 404, error: "企業が見つかりません" };
  if (cur.suspended_at && p.listed) return { ok: false, status: 403, error: COMPANY_SUSPENDED_MESSAGE };

  const now = new Date().toISOString();

  if (!p.listed) {
    if (cur.listing_status !== "listed") return { ok: true };
    const u = await mutateOne(
      p.session.from("ow_companies").update({ listing_status: "draft", updated_at: now }).eq("id", p.companyId),
      "企業ページを非公開にする",
    );
    if (!u.ok) return { ok: false, status: u.status, error: u.error };
    await revalidateCompanyPages(p.companyId);
    return { ok: true };
  }

  if (cur.is_published === true && cur.listing_status === "listed") return { ok: true };

  if (!(await hasAgreedTerms(p.authUserId, "listing"))) {
    return { ok: false, status: 400, error: "先に掲載利用規約へ同意してください。", missing: ["TERMS_REQUIRED"] };
  }
  const gate = await checkPublishable(p.companyId, { kind: "company", authUserId: p.authUserId }, { useDraft: true, forListing: true });
  if (!gate.ok) return { ok: false, status: 400, error: `入力が足りない項目があります。${gate.missing.join(" ")}`, missing: gate.missing };

  const applied = await applyCompanyDraft(p.companyId, { client: admin, label: "企業の公開", writeName: true });
  if (!applied.ok) return { ok: false, status: applied.status ?? 500, error: applied.message ?? applied.error ?? "下書きを反映できませんでした" };

  const u = await mutateOne(
    p.session.from("ow_companies").update({
      listing_status: "listed",
      is_published: true,
      ...publishedAtPatch(cur.published_at as string | null, true, now),
      updated_at: now,
    }).eq("id", p.companyId),
    "企業ページを公開する",
  );
  if (!u.ok) {
    /* DB のガード（停止中）に当たったときは同じ文を返す */
    if (u.error.includes("停止されています")) return { ok: false, status: 403, error: COMPANY_SUSPENDED_MESSAGE };
    return { ok: false, status: u.status, error: u.error };
  }

  await insertCompanyJoined(p.companyId);
  await revalidateCompanyPages(p.companyId);
  const { data: who } = await admin.from("ow_users").select("name, email").eq("id", p.owUserId).maybeSingle();
  await emailOps("company-self-listed", companySelfListedAdminTemplate({
    companyId: p.companyId, companyName: (cur.name as string | null) ?? "（社名不明）",
    actorName: greetingName(who?.name as string | null | undefined), actorEmail: (who?.email as string | null) ?? null, listedAt: now,
  }));
  return { ok: true };
}

/**
 * フィードの「◯◯ が参加しました」（company_joined）。**掲載にしたとき**に出す（運営の掲載・企業の公開の両方）。
 * ⚠️ 本文と ref_* の埋め方は lib/feed/systemPosts に集約している。ここで組み立てない。
 * ⚠️ best-effort。部分UNIQUE（idx_ow_posts_unique_company）があるので、非公開→公開を往復しても2回目は作られない（23505 は無視）。
 */
export async function insertCompanyJoined(companyId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: co } = await admin.from("ow_companies").select("name, brand_name, tagline").eq("id", companyId).maybeSingle();
    if (!co) return;
    const { error } = await admin.from("ow_posts").insert(buildCompanyJoinedRow(companyId, co));
    if (error && error.code !== "23505") console.error("[feed company_joined]", error.message);
  } catch (e) {
    console.error("[feed company_joined]", e);
  }
}

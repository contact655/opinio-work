/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentJobs, loadAdminPeople, type AdminHostExperience, type UserRow } from "@/lib/careerRoutes/server";
import { consultantBlockers, sortRouteTalkTags, type RouteTalkTag } from "@/lib/constants/careerRoutes";

/**
 * ★相談できる人（/people の左サイドバー。2026-11-12 / 柴さんの決定）の読み込み。
 *   表 ow_featured_consultants は anon / authenticated に権限が無いので、読むのはここ（admin クライアント）だけ。
 *
 * ⚠️★出す条件は lib/constants/careerRoutes.ts の consultantBlockers の1か所。ここに書き写さない。
 * ⚠️ サイドバーは失敗しても /people 全体を落とさない（空配列。ログは出す）。運営画面は null（0件と見せない）。
 * ⚠️ サイドバーに渡す形にメールアドレスを入れない。
 */

export type ConsultantCard = {
  userId: string;
  /** /u/ の URL に使う（username があれば username） */
  profileKey: string;
  name: string;
  avatarUrl: string | null;
  /** 今の会社（会社名を出してよい職歴だけ。出せなければ null） */
  currentCompany: string | null;
  currentRole: string | null;
  isCurrent: boolean;
  talkTags: RouteTalkTag[];
  message: string | null;
};

const COLS = "id, user_id, talk_tags, message, display_order, is_listed, approved_at, consent_confirmed_at, consent_method, created_at" as const;
const USER_COLS = "id, name, username, avatar_url, visibility, auth_id, is_test, is_system" as const;

function blockersOf(c: Record<string, unknown>, u: UserRow | undefined): string[] {
  return consultantBlockers({
    visibility: u?.visibility, authId: u?.auth_id, isTest: u?.is_test, isSystem: u?.is_system,
    isListed: c.is_listed as boolean | null, approvedAt: c.approved_at as string | null,
    consentConfirmedAt: c.consent_confirmed_at as string | null, consentMethod: c.consent_method as string | null,
  });
}

/** サイドバーに出す人（表示順 → 登録順）。⚠️ 失敗したら空配列 */
export async function getFeaturedConsultants(): Promise<ConsultantCard[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_featured_consultants").select(COLS)
    .eq("is_listed", true).order("display_order").order("created_at");
  if (error) { console.error("[featuredConsultants] list:", error.message); return []; }
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];
  const { data: users, error: uErr } = await db.from("ow_users").select(USER_COLS).in("id", rows.map((r) => r.user_id as string));
  if (uErr) { console.error("[featuredConsultants] users:", uErr.message); return []; }
  const userById = new Map(((users ?? []) as UserRow[]).map((u) => [u.id, u]));
  const listable = rows.filter((r) => blockersOf(r, userById.get(r.user_id as string)).length === 0);
  const jobs = await currentJobs(listable.map((r) => r.user_id as string));
  if (!jobs) return [];
  return listable.map((r) => {
    const u = userById.get(r.user_id as string) as UserRow;
    const job = jobs.get(u.id);
    return {
      userId: u.id, profileKey: u.username || u.id, name: u.name, avatarUrl: u.avatar_url,
      currentCompany: job?.company ?? null, currentRole: job?.role ?? null, isCurrent: job?.isCurrent ?? false,
      talkTags: sortRouteTalkTags(Array.isArray(r.talk_tags) ? (r.talk_tags as unknown[]) : []),
      message: (r.message as string | null) ?? null,
    };
  });
}

/* ── 運営画面 ─────────────────────────────────────────────────────────── */

export type AdminConsultant = {
  id: string; userId: string; profileKey: string; name: string; email: string | null;
  visibility: string | null; isTest: boolean;
  talkTags: RouteTalkTag[]; message: string | null; displayOrder: number;
  isListed: boolean; approvedAt: string | null;
  consentConfirmedAt: string | null; consentMethod: string | null;
  /** サイドバーに出ない理由（空なら出ている） */
  blockers: string[];
  experiences: AdminHostExperience[];
};

/** 運営画面の一覧。⚠️ 失敗したら null（0件と見せない） */
export async function getAdminConsultants(): Promise<AdminConsultant[] | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_featured_consultants").select(COLS).order("display_order").order("created_at");
  if (error) { console.error("[featuredConsultants] admin list:", error.message); return null; }
  const rows = (data ?? []) as Record<string, unknown>[];
  const loaded = await loadAdminPeople(Array.from(new Set(rows.map((r) => r.user_id as string))));
  if (!loaded) return null;
  return rows.map((r) => {
    const u = loaded.userById.get(r.user_id as string);
    return {
      id: r.id as string, userId: r.user_id as string, profileKey: u?.username || (r.user_id as string),
      name: u?.name ?? "（見つからない利用者）", email: u?.email ?? null,
      visibility: u?.visibility ?? null, isTest: u?.is_test === true,
      talkTags: sortRouteTalkTags(Array.isArray(r.talk_tags) ? (r.talk_tags as unknown[]) : []),
      message: (r.message as string | null) ?? null, displayOrder: (r.display_order as number) ?? 0,
      isListed: r.is_listed === true, approvedAt: (r.approved_at as string | null) ?? null,
      consentConfirmedAt: (r.consent_confirmed_at as string | null) ?? null, consentMethod: (r.consent_method as string | null) ?? null,
      blockers: blockersOf(r, u),
      experiences: loaded.experiencesOf(r.user_id as string),
    };
  });
}

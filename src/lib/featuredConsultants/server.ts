/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { currentJobs, loadAdminPeople, type AdminHostExperience, type UserRow } from "@/lib/careerRoutes/server";
import {
  CONSULTANTS_LIMIT, CONSULTANT_STOPPED_MESSAGE, consultantBlockers, sortRouteTalkTags, type RouteTalkTag,
} from "@/lib/constants/careerRoutes";

/**
 * ★相談可能なユーザー（ホームの右の列・/people の左サイドバー）の読み書き。
 *   表 ow_featured_consultants は anon / authenticated に権限が無いので、読み書きはここ（admin クライアント）だけ。
 *
 * ★2026-11-12 から本人がマイページでオンにする（setMyConsultantSetting）。運営は止めるだけ（admin/consultants/actions.ts）。
 * ⚠️★載せる条件は lib/constants/careerRoutes.ts の consultantBlockers の1か所。ここに書き写さない。
 * ⚠️ 箱に出す側は失敗しても画面を落とさない（空配列。ログは出す）。運営画面は null（0件と見せない）。
 * ⚠️ 箱に渡す形にメールアドレスを入れない。
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

const COLS = "id, user_id, talk_tags, message, display_order, is_listed, consent_confirmed_at, consent_method, stopped_at, stop_reason, created_at" as const;
const USER_COLS = "id, name, username, avatar_url, visibility, auth_id, is_test, is_system" as const;

function blockersOf(c: Record<string, unknown>, u: UserRow | undefined): string[] {
  return consultantBlockers({
    visibility: u?.visibility, authId: u?.auth_id, isTest: u?.is_test, isSystem: u?.is_system,
    isListed: c.is_listed as boolean | null, stoppedAt: c.stopped_at as string | null,
    consentConfirmedAt: c.consent_confirmed_at as string | null, consentMethod: c.consent_method as string | null,
  });
}

/** 載せられる人の行（表示順 → オンにした日時が新しい順）。⚠️ 失敗したら null */
async function listableRows(): Promise<{ rows: Record<string, unknown>[]; userById: Map<string, UserRow> } | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_featured_consultants").select(COLS)
    .eq("is_listed", true).is("stopped_at", null)
    .order("display_order").order("consent_confirmed_at", { ascending: false });
  if (error) { console.error("[featuredConsultants] list:", error.message); return null; }
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return { rows: [], userById: new Map() };
  const { data: users, error: uErr } = await db.from("ow_users").select(USER_COLS).in("id", rows.map((r) => r.user_id as string));
  if (uErr) { console.error("[featuredConsultants] users:", uErr.message); return null; }
  const userById = new Map(((users ?? []) as UserRow[]).map((u) => [u.id, u]));
  return { rows: rows.filter((r) => blockersOf(r, userById.get(r.user_id as string)).length === 0), userById };
}

/**
 * ★/people の「相談可能なユーザー」の絞り込み（?consult=1）に使う、載せられる人全員の ow_users.id。⚠️ 失敗したら null
 * ⚠️ 箱（getFeaturedConsultants）と同じ条件（listableRows）。条件を書き写さないこと
 */
export async function getConsultantUserIds(): Promise<string[] | null> {
  const l = await listableRows();
  return l ? l.rows.map((r) => r.user_id as string) : null;
}

/**
 * 箱に出す人。表示順が小さい順 → オンにした日時が新しい順に、CONSULTANTS_LIMIT 人まで。⚠️ 失敗したら空配列
 * ⚠️ excludeOwUserId: 見ている本人を外す（自分に相談するボタンは出ない。自分の行を並べても意味が無い）
 */
export async function getFeaturedConsultants(opts: { excludeOwUserId?: string | null } = {}): Promise<ConsultantCard[]> {
  const l = await listableRows();
  if (!l) return [];
  const userById = l.userById;
  const listable = l.rows.filter((r) => r.user_id !== opts.excludeOwUserId).slice(0, CONSULTANTS_LIMIT);
  if (listable.length === 0) return [];
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

/* ── 本人の設定（マイページ） ────────────────────────────────────────────── */

export type MyConsultantSetting = {
  listed: boolean;
  talkTags: RouteTalkTag[];
  message: string | null;
  /** 運営が止めているか（止めている間はオンにできない） */
  stopped: boolean;
  /** オンにしても載らない理由（公開範囲が「非公開」など）。オフ・止められていることは含めない */
  notShownReasons: string[];
};

/** 本人の設定を読む。行が無ければオフ。⚠️ 失敗したら null（オフと見せない） */
export async function getMyConsultantSetting(owUserId: string): Promise<MyConsultantSetting | null> {
  const db = createAdminClient();
  const [cRes, uRes] = await Promise.all([
    db.from("ow_featured_consultants").select(COLS).eq("user_id", owUserId).maybeSingle(),
    db.from("ow_users").select(USER_COLS).eq("id", owUserId).maybeSingle(),
  ]);
  if (cRes.error) { console.error("[featuredConsultants] my setting:", cRes.error.message); return null; }
  if (uRes.error || !uRes.data) { console.error("[featuredConsultants] my user:", uRes.error?.message ?? "not found"); return null; }
  const row = cRes.data as Record<string, unknown> | null;
  const u = uRes.data as UserRow;
  /* 「オンにしたら載るか」を見るため、オン・同意ありの形で判定し、本人の操作で直せないものだけ残す */
  const reasons = consultantBlockers({
    visibility: u.visibility, authId: u.auth_id, isTest: u.is_test, isSystem: u.is_system,
    isListed: true, stoppedAt: null, consentConfirmedAt: "x", consentMethod: "self",
  });
  return {
    listed: row?.is_listed === true,
    talkTags: sortRouteTalkTags(Array.isArray(row?.talk_tags) ? (row?.talk_tags as unknown[]) : []),
    message: (row?.message as string | null) ?? null,
    stopped: !!row?.stopped_at,
    notShownReasons: reasons,
  };
}

/**
 * 本人の設定を保存する。オンにしたときは同意の記録（日時・self）を入れ直す。
 * ⚠️ 運営が止めている間はオンにできない（オフ・内容の保存はできる）。
 */
export async function setMyConsultantSetting(owUserId: string, v: { listed: boolean; talkTags: RouteTalkTag[]; message: string | null }):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const { data: cur, error } = await db.from("ow_featured_consultants").select("id, stopped_at").eq("user_id", owUserId).maybeSingle();
  if (error) { console.error("[featuredConsultants] set read:", error.message); return { ok: false, status: 500, error: "保存に失敗しました" }; }
  if (v.listed && cur?.stopped_at) return { ok: false, status: 403, error: CONSULTANT_STOPPED_MESSAGE };
  const now = new Date().toISOString();
  const patch = {
    talk_tags: v.talkTags, message: v.message, is_listed: v.listed, updated_at: now,
    ...(v.listed ? { consent_confirmed_at: now, consent_method: "self" } : {}),
  };
  const r = cur
    ? await mutateOne(db.from("ow_featured_consultants").update(patch).eq("id", cur.id as string), "featuredConsultants self update")
    : await mutateOne(db.from("ow_featured_consultants").insert({ user_id: owUserId, ...patch }), "featuredConsultants self insert");
  if (!r.ok) return { ok: false, status: 500, error: "保存に失敗しました" };
  return { ok: true };
}

/* ── 運営画面 ─────────────────────────────────────────────────────────── */

export type AdminConsultant = {
  id: string; userId: string; profileKey: string; name: string; email: string | null;
  visibility: string | null; isTest: boolean;
  talkTags: RouteTalkTag[]; message: string | null; displayOrder: number;
  isListed: boolean;
  consentConfirmedAt: string | null; consentMethod: string | null;
  stoppedAt: string | null; stopReason: string | null;
  /** 載っていない理由（空なら載っている） */
  blockers: string[];
  experiences: AdminHostExperience[];
};

/** 運営画面の一覧（オンにした日時が新しい順）。⚠️ 失敗したら null（0件と見せない） */
export async function getAdminConsultants(): Promise<AdminConsultant[] | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("ow_featured_consultants").select(COLS)
    .order("consent_confirmed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
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
      isListed: r.is_listed === true,
      consentConfirmedAt: (r.consent_confirmed_at as string | null) ?? null, consentMethod: (r.consent_method as string | null) ?? null,
      stoppedAt: (r.stopped_at as string | null) ?? null, stopReason: (r.stop_reason as string | null) ?? null,
      blockers: blockersOf(r, u),
      experiences: loaded.experiencesOf(r.user_id as string),
    };
  });
}

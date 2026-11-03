/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, toCompanyRole } from "@/lib/auth/roles";
import { companyDisplayName } from "@/lib/companies/displayName";
import { recruiterCompanyIds } from "@/lib/talk/recruiter";
import {
  DEFAULT_TALK_CAPACITY,
  TALK_REQUEST_EXPIRE_DAYS,
  isTalkCapacity,
  isTalkStance,
  startOfMonthJst,
  talkAcceptsRequest,
  talkStanceLabel,
  type TalkCapacity,
  type TalkStance,
} from "@/lib/constants/talk";

/**
 * ★話す人の立場と話せる量（2026-11-03）。表 ow_talk_settings / ow_talk_requests の読み書きはこのファイルだけ。
 *   選択肢・判定は lib/constants/talk.ts。
 *
 * ⚠️★どちらの表も anon / authenticated に権限なし。誰が誰に依頼したかは当事者2人にしか見せない
 *    （依頼の一覧・件数を当事者以外に返す関数を作らないこと）。
 * ⚠️ 行が無い人は「今は話せない」。
 * ⚠️ 採用担当の立場は、読むたびに「いまもその会社で talk.asRecruiter が許されているか」を確かめる。
 *    担当者から外れた人を「採用担当」と出し続けない（そのときは話を受け付けない扱いにする）。
 */

export type TalkSettingsView = {
  stance: TalkStance | null;
  stanceCompanyId: string | null;
  capacity: TalkCapacity;
  /** 「採用担当」として選べる会社（いま有効な担当者で、管理者か採用担当の会社） */
  recruiterCompanies: { id: string; name: string }[];
};

/** talk.asRecruiter（lib/auth/roles.ts）。採用担当の判定は recruiterCompanyIds にこれを渡す */
const canRecruit = (permission: string | null) => can(toCompanyRole(permission), "talk.asRecruiter");

type SettingsRow = { user_id: string; stance: string | null; stance_company_id: string | null; capacity: string };

/** 「採用担当」として選べる会社 */
async function recruiterCompaniesOf(db: SupabaseClient, owUserId: string): Promise<{ id: string; name: string }[] | null> {
  const { data, error } = await db
    .from("ow_company_admins")
    .select("company_id, permission, is_active, ow_companies!company_id(id, name, name_en)")
    .eq("user_id", owUserId);
  if (error) {
    console.error("[talk] recruiter companies:", error.message);
    return null;
  }
  const rows = (data ?? []) as unknown as { company_id: string; permission: string | null; is_active: boolean | null; ow_companies: { id: string; name: string; name_en: string | null } | null }[];
  const allowed = recruiterCompanyIds(rows, canRecruit);
  const out: { id: string; name: string }[] = [];
  for (const id of allowed) {
    const c = rows.find((r) => r.company_id === id)?.ow_companies;
    if (c) out.push({ id, name: companyDisplayName(c.name, c.name_en).displayName });
  }
  return out;
}

export async function getMyTalkSettings(owUserId: string): Promise<TalkSettingsView | null> {
  const db = createAdminClient();
  const [{ data, error }, companies] = await Promise.all([
    db.from("ow_talk_settings").select("user_id, stance, stance_company_id, capacity").eq("user_id", owUserId).maybeSingle(),
    recruiterCompaniesOf(db, owUserId),
  ]);
  if (error) {
    console.error("[talk] settings:", error.message);
    return null;
  }
  if (!companies) return null;
  const row = data as SettingsRow | null;
  return {
    stance: isTalkStance(row?.stance) ? row!.stance as TalkStance : null,
    stanceCompanyId: row?.stance_company_id ?? null,
    capacity: isTalkCapacity(row?.capacity) ? row!.capacity as TalkCapacity : DEFAULT_TALK_CAPACITY,
    recruiterCompanies: companies,
  };
}

export async function saveTalkSettings(
  owUserId: string,
  v: { stance: TalkStance | null; stanceCompanyId: string | null; capacity: TalkCapacity },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  if (v.stance === "recruiter") {
    const companies = await recruiterCompaniesOf(db, owUserId);
    if (!companies) return { ok: false, status: 500, error: "保存できませんでした。時間をおいてお試しください。" };
    if (!companies.some((c) => c.id === v.stanceCompanyId)) {
      return { ok: false, status: 403, error: "「採用担当」は、所属企業の管理画面で管理者か採用担当になっている人だけが選べます。" };
    }
  }
  const { error } = await db.from("ow_talk_settings").upsert({
    user_id: owUserId,
    stance: v.stance,
    stance_company_id: v.stance === "recruiter" ? v.stanceCompanyId : null,
    capacity: v.capacity,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    console.error("[talk] save:", error.message);
    return { ok: false, status: 500, error: "保存できませんでした。時間をおいてお試しください。" };
  }
  return { ok: true };
}

export type TalkProfile = {
  /** いま「話を聞く」を受け付けるか（ボタンを出すか・最初の1通を通すか） */
  accepts: boolean;
  /** 画面に出す立場（「採用担当（◯◯）」など）。立場が無い・確かめられないときは null */
  stanceLabel: string | null;
  /** 話せる設定にしているか（今は話せない以外）。プロフィールに立場を出すかの判定に使う。⚠️ 月の上限に届いていても true */
  open: boolean;
  /** 検証用アカウントか（ボタンの出し分け talkButtonVisible に渡す） */
  isTest: boolean;
};

/**
 * ★相手ごとの「話を聞けるか」と立場。ボタンの出し分けと、最初の1通の送信の検証が同じ関数を見る。
 * ⚠️ 返すのは受け付けるか・立場だけ。今月の依頼の件数は返さない（誰かが依頼したことが分かるため）。
 * ⚠️ 取得に失敗したら null（呼び出し側は送らせない向きに倒す）。
 */
export async function talkProfiles(owUserIds: readonly string[], now: Date = new Date()): Promise<Map<string, TalkProfile> | null> {
  const ids = Array.from(new Set(owUserIds)).filter(Boolean);
  const out = new Map<string, TalkProfile>();
  if (ids.length === 0) return out;
  const db = createAdminClient();
  const monthStart = startOfMonthJst(now).toISOString();
  const [{ data: rows, error }, { data: reqs, error: rErr }, { data: users, error: uErr }] = await Promise.all([
    db.from("ow_talk_settings").select("user_id, stance, stance_company_id, capacity").in("user_id", ids),
    db.from("ow_talk_requests").select("target_user_id").in("target_user_id", ids).gte("created_at", monthStart),
    db.from("ow_users").select("id, is_test").in("id", ids),
  ]);
  if (error || rErr || uErr) {
    console.error("[talk] profiles:", error?.message ?? rErr?.message ?? uErr?.message);
    return null;
  }
  const testIds = new Set(((users ?? []) as { id: string; is_test: boolean | null }[]).filter((u) => u.is_test === true).map((u) => u.id));
  const received = new Map<string, number>();
  for (const r of (reqs ?? []) as { target_user_id: string }[]) received.set(r.target_user_id, (received.get(r.target_user_id) ?? 0) + 1);

  const settings = (rows ?? []) as SettingsRow[];
  /* 採用担当の立場は、いまもその会社で許されているかを確かめる */
  const recruiterRows = settings.filter((s) => s.stance === "recruiter" && s.stance_company_id);
  const allowedRecruiter = new Map<string, string>(); // user_id → 会社の表示名
  if (recruiterRows.length > 0) {
    const { data: admins, error: aErr } = await db
      .from("ow_company_admins")
      .select("user_id, company_id, permission, is_active, ow_companies!company_id(name, name_en)")
      .in("user_id", recruiterRows.map((r) => r.user_id));
    if (aErr) {
      console.error("[talk] profiles admins:", aErr.message);
      return null;
    }
    for (const a of (admins ?? []) as unknown as { user_id: string; company_id: string; permission: string | null; is_active: boolean | null; ow_companies: { name: string; name_en: string | null } | null }[]) {
      const want = recruiterRows.find((r) => r.user_id === a.user_id)?.stance_company_id;
      if (a.company_id !== want || !a.ow_companies || recruiterCompanyIds([a], canRecruit).length === 0) continue;
      allowedRecruiter.set(a.user_id, companyDisplayName(a.ow_companies.name, a.ow_companies.name_en).displayName);
    }
  }

  for (const id of ids) {
    const s = settings.find((x) => x.user_id === id);
    const capacity: TalkCapacity = isTalkCapacity(s?.capacity) ? s!.capacity as TalkCapacity : DEFAULT_TALK_CAPACITY;
    const stance = isTalkStance(s?.stance) ? s!.stance as TalkStance : null;
    const recruiterOk = stance !== "recruiter" || allowedRecruiter.has(id);
    out.set(id, {
      accepts: recruiterOk && stance !== null && talkAcceptsRequest({ capacity, receivedThisMonth: received.get(id) ?? 0 }),
      stanceLabel: recruiterOk ? talkStanceLabel(stance, allowedRecruiter.get(id) ?? null) : null,
      open: recruiterOk && stance !== null && capacity !== "none",
      isTest: testIds.has(id),
    });
  }
  return out;
}

export async function talkProfileOf(owUserId: string): Promise<TalkProfile | null> {
  const m = await talkProfiles([owUserId]);
  return m ? (m.get(owUserId) ?? null) : null;
}

/** ★依頼を記録する（最初の1通を送ったあと）。⚠️ best-effort にしない：失敗したら呼び出し側がログを出す */
export async function recordTalkRequest(p: { conversationId: string; requesterId: string; targetId: string }): Promise<boolean> {
  const { error } = await createAdminClient().from("ow_talk_requests").insert({
    conversation_id: p.conversationId, requester_user_id: p.requesterId, target_user_id: p.targetId,
  });
  if (error && error.code !== "23505") {
    console.error("[talk] record request:", error.message);
    return false;
  }
  return true;
}

/** 受け手が返信したら、依頼を「返事あり」にする */
export async function markTalkRequestAnswered(conversationId: string): Promise<void> {
  const { error } = await createAdminClient().from("ow_talk_requests")
    .update({ status: "answered", resolved_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).eq("status", "pending");
  if (error) console.error("[talk] answered:", error.message);
}

/** その会話の依頼が、自動で辞退になっているか（取得に失敗したら null） */
export async function isTalkRequestAutoDeclined(conversationId: string): Promise<boolean | null> {
  const { data, error } = await createAdminClient().from("ow_talk_requests")
    .select("status").eq("conversation_id", conversationId).maybeSingle();
  if (error) {
    console.error("[talk] status:", error.message);
    return null;
  }
  return data?.status === "auto_declined";
}

/**
 * ★送った人から見た、自分の依頼のうち自動で辞退になったもの（会話 id の集合）。
 * ⚠️ requester_user_id で必ず絞る（受け手には出さない）。
 */
export async function autoDeclinedForRequester(requesterId: string, conversationIds: readonly string[]): Promise<Set<string>> {
  if (conversationIds.length === 0) return new Set();
  const { data, error } = await createAdminClient().from("ow_talk_requests")
    .select("conversation_id").eq("requester_user_id", requesterId).eq("status", "auto_declined")
    .in("conversation_id", Array.from(conversationIds));
  if (error) {
    console.error("[talk] auto declined for requester:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.conversation_id as string));
}

/**
 * ★返事の無いまま14日たった依頼を、自動で辞退にする（毎日の cron）。
 *   受け手の一覧からは消し（今ある「見送り」と同じ ow_message_request_declines に入れる）、
 *   送った側には「今回はお話しできないようです」とだけ出す（会話の画面と一覧）。
 * ⚠️ 返信済みの会話（request_status = 'accepted'）は「返事あり」にする。辞退にしない。
 * ⚠️ cron から呼ぶので、キャッシュしないクライアントを渡すこと（noStore）。
 */
export async function expireTalkRequests(db: SupabaseClient, now: Date = new Date()): Promise<{ expired: number; answered: number } | { error: string }> {
  const cutoff = new Date(now.getTime() - TALK_REQUEST_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("ow_talk_requests")
    .select("id, conversation_id, ow_conversations!conversation_id(request_status)")
    .eq("status", "pending").lte("created_at", cutoff);
  if (error) return { error: error.message };
  let expired = 0;
  let answered = 0;
  const stamp = now.toISOString();
  for (const r of (data ?? []) as unknown as { id: string; conversation_id: string; ow_conversations: { request_status: string | null } | null }[]) {
    if (r.ow_conversations?.request_status === "accepted") {
      const { error: uErr } = await db.from("ow_talk_requests").update({ status: "answered", resolved_at: stamp }).eq("id", r.id).eq("status", "pending");
      if (uErr) return { error: uErr.message };
      answered++;
      continue;
    }
    const { error: dErr } = await db.from("ow_message_request_declines").insert({ conversation_id: r.conversation_id });
    if (dErr && dErr.code !== "23505") return { error: dErr.message };
    const { error: uErr } = await db.from("ow_talk_requests").update({ status: "auto_declined", resolved_at: stamp }).eq("id", r.id).eq("status", "pending");
    if (uErr) return { error: uErr.message };
    expired++;
  }
  return { expired, answered };
}

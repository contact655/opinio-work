/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyDisplayName } from "@/lib/companies/displayName";
import { mutateOne, mutateMany } from "@/lib/supabase/mutate";
import type { HiringBadge, MatchPatch, MatchResult } from "./constants";
export type { HiringBadge } from "./constants";

/**
 * ★Next Manager（2026-11-13）。採用中の設定・マッチングの記録・引き継ぎの**入口はここだけ**。
 *
 * ⚠️★表（ow_manager_matches / ow_manager_match_handovers）はクライアントのロールに権限が無い。
 *    ow_company_admins の採用中の列は、同じ会社のメンバーには読める（RLS）が、書き換えはトリガー
 *    （trg_guard_company_admin_hiring）がサーバー以外を止める。admin クライアントで読み書きするので、
 *    **呼び出す前に、誰が何をしてよいかをここ（または呼び出し側の requireBizAction）で必ず確かめる。**
 * ⚠️★メッセージ本文を読まない・写さない。会話は id と「返信で始まったか」だけを見る。
 * ⚠️★DM の会話に company_id を書かない（書くと RLS が会社の担当者に会話を開く）。
 */

type Db = ReturnType<typeof createAdminClient>;

// ─── 採用中の設定（本人） ─────────────────────────────────────────────────

export type MyHiringRow = {
  companyId: string;
  companyName: string;
  isHiring: boolean;
  note: string | null;
  /** 本人に紐づいている募集（ow_job_hiring_managers） */
  jobIds: string[];
  /** その会社の募集（紐付けの選択肢）。公開中と下書き */
  jobs: { id: string; title: string; status: string }[];
};

/** 本人が有効な担当者になっている会社と、その採用中の設定。⚠️ 取れなければ null */
export async function getMyHiringRows(owUserId: string, db: Db = createAdminClient()): Promise<MyHiringRow[] | null> {
  const { data: rows, error } = await db.from("ow_company_admins")
    .select("company_id, is_hiring, hiring_note")
    .eq("user_id", owUserId).eq("is_active", true);
  if (error) { console.error("[nextManager] my rows:", error.message); return null; }
  const ids = Array.from(new Set((rows ?? []).map((r) => r.company_id as string)));
  if (ids.length === 0) return [];
  const [{ data: cos, error: cErr }, { data: jobs, error: jErr }, { data: links, error: lErr }] = await Promise.all([
    db.from("ow_companies").select("id, name, name_en").in("id", ids),
    db.from("ow_jobs").select("id, company_id, title, status").in("company_id", ids)
      .in("status", ["published", "draft"]).order("created_at", { ascending: false }),
    db.from("ow_job_hiring_managers").select("job_id").eq("user_id", owUserId),
  ]);
  if (cErr || jErr || lErr) { console.error("[nextManager] my rows:", cErr?.message ?? jErr?.message ?? lErr?.message); return null; }
  const nameOf = new Map((cos ?? []).map((c) => [c.id as string, companyDisplayName(c.name as string, (c.name_en as string | null) ?? null).displayName]));
  const linked = new Set((links ?? []).map((l) => l.job_id as string));
  const seen = new Set<string>();
  const out: MyHiringRow[] = [];
  for (const r of rows ?? []) {
    const cid = r.company_id as string;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const coJobs = (jobs ?? []).filter((j) => j.company_id === cid).map((j) => ({ id: j.id as string, title: j.title as string, status: j.status as string }));
    out.push({
      companyId: cid,
      companyName: nameOf.get(cid) ?? "（会社名を取得できません）",
      isHiring: r.is_hiring === true,
      note: (r.hiring_note as string | null) ?? null,
      jobIds: coJobs.filter((j) => linked.has(j.id)).map((j) => j.id),
      jobs: coJobs,
    });
  }
  return out;
}

/**
 * ★採用中を切り替える（本人だけ）。⚠️ 本人がその会社の有効な担当者であることをここで確かめる。
 *   jobIds はその会社の募集のうち本人に紐づけるもの（入れ替え）。⚠️ 他の会社の募集の紐付けは触らない。
 */
export async function setHiring(params: { owUserId: string; companyId: string; isHiring: boolean; note: string | null; jobIds: string[] }):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const failed = { ok: false as const, status: 500, error: "保存できませんでした" };
  const { data: row, error } = await db.from("ow_company_admins")
    .select("id").eq("user_id", params.owUserId).eq("company_id", params.companyId).eq("is_active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) { console.error("[nextManager] setHiring load:", error.message); return failed; }
  if (!row) return { ok: false, status: 403, error: "この会社の担当者ではありません" };
  const { data: coJobs, error: jErr } = await db.from("ow_jobs").select("id").eq("company_id", params.companyId);
  if (jErr) { console.error("[nextManager] setHiring jobs:", jErr.message); return failed; }
  const coJobIds = new Set((coJobs ?? []).map((j) => j.id as string));
  if (params.jobIds.some((id) => !coJobIds.has(id))) return { ok: false, status: 400, error: "この会社の募集ではありません" };

  /* ⚠️ 同じ会社に有効な行が2つある場合（実データでは起きないはず）も、本人の有効な行はすべて揃える */
  const r = await mutateMany(
    db.from("ow_company_admins").update({
      is_hiring: params.isHiring,
      hiring_note: params.note,
      hiring_updated_at: new Date().toISOString(),
    }).eq("user_id", params.owUserId).eq("company_id", params.companyId).eq("is_active", true),
    "nextManager setHiring",
  );
  if (!r.ok) return failed;

  /* 紐付けの入れ替え（この会社の募集の範囲だけ）。⚠️ 先に本体を保存してから */
  const linkErr = await replaceLinks(db, {
    scopeJobIds: Array.from(coJobIds), userIds: [params.owUserId], want: params.jobIds.map((j) => ({ jobId: j, userId: params.owUserId })),
    createdBy: params.owUserId,
  });
  if (linkErr) return failed;
  return { ok: true };
}

/**
 * 紐付けの入れ替え。scopeJobIds × userIds の範囲にある行を want に揃える（足りないものを入れ、余分を消す）。
 * ⚠️ 失敗したら true を返す（ログは出す）
 */
async function replaceLinks(db: Db, p: { scopeJobIds: string[]; userIds: string[]; want: { jobId: string; userId: string }[]; createdBy: string }): Promise<boolean> {
  if (p.scopeJobIds.length === 0 || p.userIds.length === 0) return false;
  const { data: cur, error } = await db.from("ow_job_hiring_managers").select("job_id, user_id")
    .in("job_id", p.scopeJobIds).in("user_id", p.userIds);
  if (error) { console.error("[nextManager] links load:", error.message); return true; }
  const key = (j: string, u: string) => `${j}|${u}`;
  const wantKeys = new Set(p.want.map((w) => key(w.jobId, w.userId)));
  const curKeys = new Set((cur ?? []).map((c) => key(c.job_id as string, c.user_id as string)));
  const toAdd = p.want.filter((w) => !curKeys.has(key(w.jobId, w.userId)));
  const toDel = (cur ?? []).filter((c) => !wantKeys.has(key(c.job_id as string, c.user_id as string)));
  if (toAdd.length) {
    const { error: iErr } = await db.from("ow_job_hiring_managers").upsert(
      toAdd.map((w) => ({ job_id: w.jobId, user_id: w.userId, created_by: p.createdBy })),
      { onConflict: "job_id,user_id", ignoreDuplicates: true },
    );
    if (iErr) { console.error("[nextManager] links insert:", iErr.message); return true; }
  }
  for (const d of toDel) {
    const { error: dErr } = await db.from("ow_job_hiring_managers").delete().eq("job_id", d.job_id as string).eq("user_id", d.user_id as string);
    if (dErr) { console.error("[nextManager] links delete:", dErr.message); return true; }
  }
  return false;
}

// ─── 募集の Hiring Manager（/biz の求人編集） ─────────────────────────────

export type JobManagerOption = { userId: string; name: string; isHiring: boolean; selected: boolean };

/** 求人編集で選べる人（その会社の有効な担当者）と、いま紐づいている人。⚠️ 取れなければ null */
export async function getJobManagerOptions(companyId: string, jobId: string, db: Db = createAdminClient()): Promise<JobManagerOption[] | null> {
  const [{ data: admins, error: aErr }, { data: links, error: lErr }] = await Promise.all([
    db.from("ow_company_admins").select("user_id, is_hiring, ow_users!user_id(name)")
      .eq("company_id", companyId).eq("is_active", true).not("user_id", "is", null),
    db.from("ow_job_hiring_managers").select("user_id").eq("job_id", jobId),
  ]);
  if (aErr || lErr) { console.error("[nextManager] job options:", aErr?.message ?? lErr?.message); return null; }
  const linked = new Set((links ?? []).map((l) => l.user_id as string));
  const byUser = new Map<string, JobManagerOption>();
  for (const a of admins ?? []) {
    const uid = a.user_id as string;
    const u = a.ow_users as unknown as { name: string | null } | null;
    const prev = byUser.get(uid);
    byUser.set(uid, { userId: uid, name: u?.name?.trim() || "（名前未設定）", isHiring: (prev?.isHiring ?? false) || a.is_hiring === true, selected: linked.has(uid) });
  }
  return Array.from(byUser.values()).sort((x, y) => Number(y.isHiring) - Number(x.isHiring) || x.name.localeCompare(y.name, "ja"));
}

/**
 * ★募集の Hiring Manager を入れ替える（/biz・jobs.edit の権限は呼び出し側の requireBizAction）。
 *   ⚠️ 募集がその会社のものか・選んだ人がその会社の有効な担当者かをここで確かめる。
 *   ⚠️ いまその会社の担当者でない人の古い行は、この操作では触らない（範囲は有効な担当者だけ）。
 */
export async function setJobHiringManagers(params: { companyId: string; jobId: string; userIds: string[]; actorOwUserId: string }):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const failed = { ok: false as const, status: 500, error: "保存できませんでした" };
  const { data: job, error: jErr } = await db.from("ow_jobs").select("id").eq("id", params.jobId).eq("company_id", params.companyId).maybeSingle();
  if (jErr) { console.error("[nextManager] setJobManagers job:", jErr.message); return failed; }
  if (!job) return { ok: false, status: 404, error: "募集が見つかりません" };
  const { data: admins, error: aErr } = await db.from("ow_company_admins").select("user_id")
    .eq("company_id", params.companyId).eq("is_active", true).not("user_id", "is", null);
  if (aErr) { console.error("[nextManager] setJobManagers admins:", aErr.message); return failed; }
  const active = Array.from(new Set((admins ?? []).map((a) => a.user_id as string)));
  if (params.userIds.some((u) => !active.includes(u))) return { ok: false, status: 400, error: "この会社の担当者ではない人が含まれています" };
  const linkErr = await replaceLinks(db, {
    scopeJobIds: [params.jobId], userIds: active, want: params.userIds.map((u) => ({ jobId: params.jobId, userId: u })),
    createdBy: params.actorOwUserId,
  });
  return linkErr ? failed : { ok: true };
}

// ─── 求人ページの Hiring Manager（公開） ──────────────────────────────────

export type PublicJobManager = { userId: string; name: string; avatarUrl: string | null; headline: string | null; note: string | null };

/**
 * ★求人ページに出す Hiring Manager。**本人が採用中にしている有効な担当者だけ**（会社が紐づけただけでは出さない）。
 *   ⚠️ 本人が登録していない・システム・非公開の人は出さない。検証用と実在は混ぜない。⚠️ 取れなければ []（ページは出す）
 */
export async function getPublicJobManagers(jobId: string, companyId: string, db: Db = createAdminClient()): Promise<PublicJobManager[]> {
  const { data: links, error } = await db.from("ow_job_hiring_managers").select("user_id").eq("job_id", jobId);
  if (error) { console.error("[nextManager] public managers:", error.message); return []; }
  const uids = Array.from(new Set((links ?? []).map((l) => l.user_id as string)));
  if (uids.length === 0) return [];
  const [{ data: admins, error: aErr }, { data: users, error: uErr }, { data: co, error: cErr }] = await Promise.all([
    db.from("ow_company_admins").select("user_id, hiring_note").eq("company_id", companyId)
      .eq("is_active", true).eq("is_hiring", true).in("user_id", uids),
    db.from("ow_users").select("id, name, avatar_url, headline, auth_id, is_test, is_system, visibility").in("id", uids),
    db.from("ow_companies").select("is_test").eq("id", companyId).maybeSingle(),
  ]);
  if (aErr || uErr || cErr) { console.error("[nextManager] public managers:", aErr?.message ?? uErr?.message ?? cErr?.message); return []; }
  const noteOf = new Map((admins ?? []).map((a) => [a.user_id as string, (a.hiring_note as string | null) ?? null]));
  /* ⚠️ 検証用と実在は混ぜない（実在の会社の求人に検証用アカウントを出さない。検証用の会社の求人には検証用の人だけ） */
  const companyIsTest = co?.is_test === true;
  return (users ?? [])
    .filter((u) => noteOf.has(u.id as string) && !!u.auth_id && (u.is_test === true) === companyIsTest && u.is_system !== true && u.visibility !== "private")
    .map((u) => ({
      userId: u.id as string,
      name: (u.name as string | null)?.trim() || "",
      avatarUrl: (u.avatar_url as string | null) ?? null,
      headline: (u.headline as string | null) ?? null,
      note: noteOf.get(u.id as string) ?? null,
    }))
    .filter((u) => u.name);
}

// ─── ユーザー一覧のバッジ ─────────────────────────────────────────────────

/**
 * ★採用中のマネージャー（ow_users.id → 会社と募集）。/people のバッジと「採用中のマネージャー」の絞り込みに使う。
 *   ⚠️ 毎リクエスト引く（/people の一覧のキャッシュ 1800秒に混ぜない。切り替えをすぐ出すため）。
 *   ⚠️ 検証用の会社は、検証用の閲覧者にだけ出す。⚠️ 取れなければ null（絞り込みを出さない）
 */
export async function getHiringBadges(viewerIsTest: boolean, db: Db = createAdminClient()): Promise<Record<string, HiringBadge> | null> {
  const { data: rows, error } = await db.from("ow_company_admins")
    .select("user_id, company_id, hiring_note")
    .eq("is_active", true).eq("is_hiring", true).not("user_id", "is", null);
  if (error) { console.error("[nextManager] badges:", error.message); return null; }
  if (!rows || rows.length === 0) return {};
  const cids = Array.from(new Set(rows.map((r) => r.company_id as string)));
  const uids = Array.from(new Set(rows.map((r) => r.user_id as string)));
  const [{ data: cos, error: cErr }, { data: links, error: lErr }] = await Promise.all([
    db.from("ow_companies").select("id, name, name_en, is_test, suspended_at").in("id", cids),
    db.from("ow_job_hiring_managers").select("user_id, ow_jobs!job_id(company_id, title, status, is_test)").in("user_id", uids),
  ]);
  if (cErr || lErr) { console.error("[nextManager] badges:", cErr?.message ?? lErr?.message); return null; }
  const coOf = new Map((cos ?? []).map((c) => [c.id as string, c]));
  /* ⚠️ 公開中の募集だけ名前を出す（下書きの題名を一覧に出さない） */
  const titlesOf = new Map<string, string[]>();
  for (const l of links ?? []) {
    const j = l.ow_jobs as unknown as { company_id: string; title: string; status: string; is_test: boolean } | null;
    if (!j || j.status !== "published") continue;
    const k = `${l.user_id as string}|${j.company_id}`;
    titlesOf.set(k, [...(titlesOf.get(k) ?? []), j.title]);
  }
  const out: Record<string, HiringBadge> = {};
  for (const r of rows) {
    const co = coOf.get(r.company_id as string);
    if (!co) continue;
    if ((co.is_test === true) !== viewerIsTest) continue;
    if (co.suspended_at) continue;
    const uid = r.user_id as string;
    if (out[uid]) continue;
    out[uid] = {
      companyName: companyDisplayName(co.name as string, (co.name_en as string | null) ?? null).displayName,
      note: (r.hiring_note as string | null) ?? null,
      jobTitles: titlesOf.get(`${uid}|${r.company_id as string}`) ?? [],
    };
  }
  return out;
}

/** 送り手が採用中のマネージャーか（送る画面の注意書きの出し分け） */
export async function isHiringManager(owUserId: string, db: Db = createAdminClient()): Promise<boolean> {
  const { count, error } = await db.from("ow_company_admins").select("id", { count: "exact", head: true })
    .eq("user_id", owUserId).eq("is_active", true).eq("is_hiring", true);
  if (error) { console.error("[nextManager] isHiring:", error.message); return false; }
  return (count ?? 0) > 0;
}

// ─── マッチングの記録を作る ───────────────────────────────────────────────

/**
 * ★マッチングしたら記録を作る（2026-11-13 / 論点C）。**呼ぶのは返信の成功直後（replyToMessageRequest）だけ。**
 *
 *   マッチング＝個人どうしのメッセージで、相手が返信して始まった会話。どちらかが返信の時点で
 *   **採用中のマネージャー**（有効な担当者・is_hiring）なら、そのマネージャーの会社に1件作る。
 *   マネージャーが送った場合も、受け取った場合も同じ扱い（両方の向きを見る）。
 *
 *   作らない:
 *     ・相手がその会社の有効な担当者（同僚どうし）
 *     ・その会社から見て相手に連絡してはいけない（can_contact_without_stance が false：在籍歴・ブロック・
 *       転職勧奨禁止・検証用と実在の不一致）
 *     ・停止中の会社
 *
 * ⚠️ best-effort。失敗しても返信は成功のまま（ログは出す）。同じ会話・同じ会社は1件（unique）。
 * ⚠️★本文は読まない。
 */
export async function recordMatchOnReply(conversationId: string): Promise<number> {
  const db = createAdminClient();
  try {
    const { data: conv, error } = await db.from("ow_conversations")
      .select("id, kind, request_status, candidate_user_id, partner_user_id, responded_at")
      .eq("id", conversationId).maybeSingle();
    if (error) { console.error("[nextManager] match conv:", error.message); return 0; }
    if (!conv || conv.kind !== "direct_message" || conv.request_status !== "accepted") return 0;
    const a = conv.candidate_user_id as string | null;
    const b = conv.partner_user_id as string | null;
    if (!a || !b) return 0;

    const { data: admins, error: aErr } = await db.from("ow_company_admins")
      .select("user_id, company_id, is_hiring").eq("is_active", true).in("user_id", [a, b]);
    if (aErr) { console.error("[nextManager] match admins:", aErr.message); return 0; }
    const activeAt = (uid: string, cid: string) => (admins ?? []).some((r) => r.user_id === uid && r.company_id === cid);

    const { data: users, error: uErr } = await db.from("ow_users").select("id, auth_id").in("id", [a, b]);
    if (uErr) { console.error("[nextManager] match users:", uErr.message); return 0; }
    const authOf = new Map((users ?? []).map((u) => [u.id as string, (u.auth_id as string | null) ?? null]));

    const plans: { companyId: string; manager: string; candidate: string }[] = [];
    for (const [manager, candidate] of [[a, b], [b, a]] as const) {
      const cids = Array.from(new Set((admins ?? []).filter((r) => r.user_id === manager && r.is_hiring === true).map((r) => r.company_id as string)));
      for (const cid of cids) {
        if (activeAt(candidate, cid)) continue;
        plans.push({ companyId: cid, manager, candidate });
      }
    }
    if (plans.length === 0) return 0;

    const { data: cos, error: cErr } = await db.from("ow_companies").select("id, suspended_at").in("id", Array.from(new Set(plans.map((p) => p.companyId))));
    if (cErr) { console.error("[nextManager] match companies:", cErr.message); return 0; }
    const suspended = new Set((cos ?? []).filter((c) => c.suspended_at).map((c) => c.id as string));

    let made = 0;
    const matchedAt = (conv.responded_at as string | null) ?? new Date().toISOString();
    for (const p of plans) {
      if (suspended.has(p.companyId)) continue;
      const auth = authOf.get(p.candidate);
      if (!auth) continue;
      const { data: can, error: rErr } = await db.rpc("can_contact_without_stance", { p_company_id: p.companyId, p_candidate_id: auth });
      if (rErr) { console.error("[nextManager] match can_contact:", rErr.message); continue; }
      if (can !== true) continue;
      const { data: ins, error: iErr } = await db.from("ow_manager_matches").upsert({
        company_id: p.companyId,
        manager_user_id: p.manager,
        candidate_user_id: p.candidate,
        conversation_id: conversationId,
        matched_at: matchedAt,
        created_by: p.manager,
        updated_by: p.manager,
      }, { onConflict: "company_id,conversation_id", ignoreDuplicates: true }).select("id");
      if (iErr) { console.error("[nextManager] match insert:", iErr.message); continue; }
      made += (ins ?? []).length;
    }
    return made;
  } catch (e) {
    console.error("[nextManager] match:", e instanceof Error ? e.message : e);
    return 0;
  }
}

// ─── マネージャー側：面談の記録 ───────────────────────────────────────────

export type ManagerPanelData = {
  id: string;
  companyName: string;
  candidateName: string;
  matchedAt: string;
  jobId: string | null;
  metOn: string | null;
  result: MatchResult | null;
  memo: string | null;
  jobs: { id: string; title: string; status: string }[];
};

/**
 * ★この会話の記録を、担当マネージャー本人にだけ返す。⚠️ 本人がいまもその会社の有効な担当者であること。
 *   それ以外（求職者・会社を外れたマネージャー・他人）には null（＝欄を出さない）。
 */
export async function getPanelForConversation(conversationId: string, viewerOwUserId: string): Promise<ManagerPanelData | null> {
  const db = createAdminClient();
  const { data: rows, error } = await db.from("ow_manager_matches")
    .select("id, company_id, candidate_user_id, matched_at, job_id, met_on, result, memo")
    .eq("conversation_id", conversationId).eq("manager_user_id", viewerOwUserId)
    .order("matched_at", { ascending: true }).limit(1);
  if (error) { console.error("[nextManager] panel:", error.message); return null; }
  const m = rows?.[0];
  if (!m) return null;
  const cid = m.company_id as string;
  const [{ count, error: aErr }, { data: co, error: cErr }, { data: cand, error: uErr }, { data: jobs, error: jErr }] = await Promise.all([
    db.from("ow_company_admins").select("id", { count: "exact", head: true }).eq("user_id", viewerOwUserId).eq("company_id", cid).eq("is_active", true),
    db.from("ow_companies").select("name, name_en").eq("id", cid).maybeSingle(),
    db.from("ow_users").select("name").eq("id", m.candidate_user_id as string).maybeSingle(),
    db.from("ow_jobs").select("id, title, status").eq("company_id", cid).in("status", ["published", "draft", "private"]).order("created_at", { ascending: false }),
  ]);
  if (aErr || cErr || uErr || jErr) { console.error("[nextManager] panel:", aErr?.message ?? cErr?.message ?? uErr?.message ?? jErr?.message); return null; }
  if ((count ?? 0) === 0) return null;
  return {
    id: m.id as string,
    companyName: co ? companyDisplayName(co.name as string, (co.name_en as string | null) ?? null).displayName : "",
    candidateName: (cand?.name as string | null) ?? "（名前を取得できません）",
    matchedAt: m.matched_at as string,
    jobId: (m.job_id as string | null) ?? null,
    metOn: (m.met_on as string | null) ?? null,
    result: (m.result as MatchResult | null) ?? null,
    memo: (m.memo as string | null) ?? null,
    jobs: (jobs ?? []).map((j) => ({ id: j.id as string, title: j.title as string, status: j.status as string })),
  };
}

/** ★面談の記録を保存する（担当マネージャー本人だけ）。⚠️ 募集はその会社のものに限る */
export async function updateMatchByManager(matchId: string, viewerOwUserId: string, patch: MatchPatch):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const db = createAdminClient();
  const { data: m, error } = await db.from("ow_manager_matches").select("id, company_id, manager_user_id").eq("id", matchId).maybeSingle();
  if (error) { console.error("[nextManager] update load:", error.message); return { ok: false, status: 500, error: "保存できませんでした" }; }
  /* ⚠️ 存在しない・他人の記録は同じ答え（404） */
  if (!m || m.manager_user_id !== viewerOwUserId) return { ok: false, status: 404, error: "記録が見つかりません" };
  const { count, error: aErr } = await db.from("ow_company_admins").select("id", { count: "exact", head: true })
    .eq("user_id", viewerOwUserId).eq("company_id", m.company_id as string).eq("is_active", true);
  if (aErr) { console.error("[nextManager] update admin:", aErr.message); return { ok: false, status: 500, error: "保存できませんでした" }; }
  if ((count ?? 0) === 0) return { ok: false, status: 404, error: "記録が見つかりません" };
  if (patch.jobId) {
    const { data: job, error: jErr } = await db.from("ow_jobs").select("id").eq("id", patch.jobId).eq("company_id", m.company_id as string).maybeSingle();
    if (jErr) { console.error("[nextManager] update job:", jErr.message); return { ok: false, status: 500, error: "保存できませんでした" }; }
    if (!job) return { ok: false, status: 400, error: "この会社の募集ではありません" };
  }
  const values: Record<string, unknown> = { updated_by: viewerOwUserId, updated_at: new Date().toISOString() };
  if (patch.jobId !== undefined) values.job_id = patch.jobId;
  if (patch.metOn !== undefined) values.met_on = patch.metOn;
  if (patch.result !== undefined) values.result = patch.result;
  if (patch.memo !== undefined) values.memo = patch.memo;
  const r = await mutateOne(db.from("ow_manager_matches").update(values).eq("id", matchId), "nextManager update");
  if (!r.ok) return { ok: false, status: 500, error: "保存できませんでした" };
  return { ok: true };
}

// ─── 会社側：候補者管理 ───────────────────────────────────────────────────

export type CompanyMatchRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  managerId: string | null;
  managerName: string | null;
  /** いまの担当がこの会社の有効な担当者でない（退職など） */
  managerLeft: boolean;
  /** 直近の引き継ぎ元（「退職済み → ◯◯が引き継ぎ」の◯◯の前の人） */
  handedOverFromName: string | null;
  /** 引き継ぎ元がいまこの会社の有効な担当者でない（「退職済み」と出す） */
  handedOverFromLeft: boolean;
  matchedAt: string;
  metOn: string | null;
  result: MatchResult | null;
  memo: string | null;
  jobTitle: string | null;
};

export type CompanyManagerRow = {
  userId: string;
  name: string;
  department: string | null;
  /** 採用中（有効な担当者で is_hiring） */
  hiring: boolean;
  /** 有効な担当者でない（記録だけが残っている人） */
  left: boolean;
  matchCount: number;
  /** 退職した人の記録の引き継ぎ先（全部引き継ぎ済みのとき） */
  handedOverToName: string | null;
};

export type CompanyMatchesView = {
  rows: CompanyMatchRow[];
  managers: CompanyManagerRow[];
  /** 引き継ぎ先に選べる人（この会社の有効な担当者） */
  successors: { userId: string; name: string }[];
};

/**
 * ★候補者管理の中身。⚠️ 呼ぶ前に所属と権限を確かめること（ページ・API の requireBizAction）。
 *   onlyManagerId を渡すと、その人の担当分だけ（全件を見る権限が無い人）。
 *   ⚠️ 取れなければ null（「0件」と区別する）
 */
export async function listCompanyMatches(companyId: string, onlyManagerId: string | null): Promise<CompanyMatchesView | null> {
  const db = createAdminClient();
  let q = db.from("ow_manager_matches")
    .select("id, candidate_user_id, manager_user_id, matched_at, met_on, result, memo, job_id")
    .eq("company_id", companyId).order("matched_at", { ascending: false });
  if (onlyManagerId) q = q.eq("manager_user_id", onlyManagerId);
  const [{ data: matches, error }, { data: admins, error: aErr }] = await Promise.all([
    q,
    db.from("ow_company_admins").select("user_id, is_active, is_hiring, department").eq("company_id", companyId).not("user_id", "is", null),
  ]);
  if (error || aErr) { console.error("[nextManager] list:", error?.message ?? aErr?.message); return null; }
  const ms = matches ?? [];
  const matchIds = ms.map((m) => m.id as string);
  const { data: hos, error: hErr } = matchIds.length
    ? await db.from("ow_manager_match_handovers").select("match_id, from_user_id, to_user_id, handed_over_at").in("match_id", matchIds).order("handed_over_at", { ascending: false })
    : { data: [], error: null };
  if (hErr) { console.error("[nextManager] list handovers:", hErr.message); return null; }
  const latestHo = new Map<string, { from: string | null; to: string | null }>();
  for (const h of hos ?? []) if (!latestHo.has(h.match_id as string)) latestHo.set(h.match_id as string, { from: (h.from_user_id as string | null) ?? null, to: (h.to_user_id as string | null) ?? null });

  const activeIds = new Set((admins ?? []).filter((r) => r.is_active).map((r) => r.user_id as string));
  const hiringIds = new Set((admins ?? []).filter((r) => r.is_active && r.is_hiring).map((r) => r.user_id as string));
  const deptOf = new Map<string, string | null>();
  for (const r of admins ?? []) if (r.is_active || !deptOf.has(r.user_id as string)) deptOf.set(r.user_id as string, (r.department as string | null) ?? null);

  const userIds = new Set<string>();
  for (const m of ms) { userIds.add(m.candidate_user_id as string); if (m.manager_user_id) userIds.add(m.manager_user_id as string); }
  for (const h of hos ?? []) { if (h.from_user_id) userIds.add(h.from_user_id as string); if (h.to_user_id) userIds.add(h.to_user_id as string); }
  activeIds.forEach((id) => userIds.add(id));
  const jobIds = Array.from(new Set(ms.map((m) => m.job_id as string | null).filter((x): x is string => !!x)));
  const [{ data: users, error: uErr }, jobsRes] = await Promise.all([
    userIds.size ? db.from("ow_users").select("id, name").in("id", Array.from(userIds)) : Promise.resolve({ data: [], error: null }),
    jobIds.length ? db.from("ow_jobs").select("id, title").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (uErr || jobsRes.error) { console.error("[nextManager] list names:", uErr?.message ?? jobsRes.error?.message); return null; }
  const nameOf = new Map((users ?? []).map((u) => [u.id as string, (u.name as string | null) ?? ""]));
  const jobOf = new Map((jobsRes.data ?? []).map((j) => [j.id as string, j.title as string]));

  const rows: CompanyMatchRow[] = ms.map((m) => {
    const mid = (m.manager_user_id as string | null) ?? null;
    const ho = latestHo.get(m.id as string);
    return {
      id: m.id as string,
      candidateId: m.candidate_user_id as string,
      candidateName: nameOf.get(m.candidate_user_id as string) || "（名前を取得できません）",
      managerId: mid,
      managerName: mid ? nameOf.get(mid) || null : null,
      managerLeft: !mid || !activeIds.has(mid),
      handedOverFromName: ho && ho.to === mid && ho.from ? nameOf.get(ho.from) || null : null,
      handedOverFromLeft: !!(ho && ho.to === mid && ho.from && !activeIds.has(ho.from)),
      matchedAt: m.matched_at as string,
      metOn: (m.met_on as string | null) ?? null,
      result: (m.result as MatchResult | null) ?? null,
      memo: (m.memo as string | null) ?? null,
      jobTitle: m.job_id ? jobOf.get(m.job_id as string) ?? null : null,
    };
  });

  /* サイド: 採用中の人と、記録が残っている人（会社を外れた人を含む）。⚠️ 自分の分だけのときも、
     マネージャーの一覧は自分の行だけに絞る（他人のマッチング人数を見せない） */
  const countOf = new Map<string, number>();
  for (const r of rows) if (r.managerId) countOf.set(r.managerId, (countOf.get(r.managerId) ?? 0) + 1);
  const leftWithHandover = new Map<string, string | null>();
  for (const h of hos ?? []) {
    const from = h.from_user_id as string | null;
    if (from && !activeIds.has(from) && !leftWithHandover.has(from)) leftWithHandover.set(from, (h.to_user_id as string | null) ?? null);
  }
  const managerIds = new Set<string>([...Array.from(hiringIds), ...Array.from(countOf.keys()), ...Array.from(leftWithHandover.keys())]);
  const managers: CompanyManagerRow[] = Array.from(managerIds)
    .filter((id) => !onlyManagerId || id === onlyManagerId)
    .map((id) => {
      const left = !activeIds.has(id);
      const toId = leftWithHandover.get(id) ?? null;
      return {
        userId: id,
        name: nameOf.get(id) || "（名前を取得できません）",
        department: deptOf.get(id) ?? null,
        hiring: hiringIds.has(id),
        left,
        matchCount: countOf.get(id) ?? 0,
        handedOverToName: left && (countOf.get(id) ?? 0) === 0 && toId ? nameOf.get(toId) || null : null,
      };
    })
    .sort((x, y) => Number(x.left) - Number(y.left) || y.matchCount - x.matchCount || x.name.localeCompare(y.name, "ja"));

  const successors = Array.from(activeIds).map((id) => ({ userId: id, name: nameOf.get(id) || "" })).filter((s) => s.name)
    .sort((x, y) => x.name.localeCompare(y.name, "ja"));
  return { rows, managers, successors };
}

/**
 * ★引き継ぎ（管理者だけ。⚠️ 権限は呼び出し側の requireBizAction("managerMatches.handover")）。
 *   fromUserId の担当になっているこの会社の記録を、まとめて toUserId に付け替える。
 *   ⚠️ 引き継ぎ先はこの会社の有効な担当者に限る。引き継ぎ元が有効な担当者でも付け替えられる（異動など）。
 */
export async function handoverMatches(params: { companyId: string; fromUserId: string; toUserId: string; byUserId: string }):
  Promise<{ ok: true; count: number } | { ok: false; status: number; error: string }> {
  const { companyId, fromUserId, toUserId, byUserId } = params;
  if (fromUserId === toUserId) return { ok: false, status: 400, error: "同じ人には引き継げません" };
  const db = createAdminClient();
  const { count: active, error: aErr } = await db.from("ow_company_admins").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("user_id", toUserId).eq("is_active", true);
  if (aErr) { console.error("[nextManager] handover admin:", aErr.message); return { ok: false, status: 500, error: "引き継げませんでした" }; }
  if ((active ?? 0) === 0) return { ok: false, status: 400, error: "引き継ぎ先は、この会社の有効なメンバーから選んでください" };
  const { data: ms, error } = await db.from("ow_manager_matches").select("id, candidate_user_id")
    .eq("company_id", companyId).eq("manager_user_id", fromUserId);
  if (error) { console.error("[nextManager] handover load:", error.message); return { ok: false, status: 500, error: "引き継げませんでした" }; }
  const targets = (ms ?? []).filter((m) => m.candidate_user_id !== toUserId);
  if (targets.length === 0) return { ok: false, status: 404, error: "引き継ぐ記録がありません" };
  const ids = targets.map((m) => m.id as string);
  const r = await mutateMany(
    db.from("ow_manager_matches").update({ manager_user_id: toUserId, updated_by: byUserId, updated_at: new Date().toISOString() })
      .in("id", ids).eq("company_id", companyId).eq("manager_user_id", fromUserId),
    "nextManager handover",
  );
  if (!r.ok) return { ok: false, status: 500, error: "引き継げませんでした" };
  const { error: hErr } = await db.from("ow_manager_match_handovers").insert(ids.map((id) => ({
    match_id: id, from_user_id: fromUserId, to_user_id: toUserId, handed_over_by: byUserId,
  })));
  if (hErr) console.error("[nextManager] handover history:", hErr.message);
  return { ok: true, count: ids.length };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { greetingName } from "@/lib/constants/personName";
import { emailCompanyAdmins, emailOps } from "@/lib/notify/companyEmail";
import { scoutAccessCompanyTemplate, scoutAccessRequestAdminTemplate } from "@/lib/notify/templates";
import type { ScoutAccessState } from "./scoutGate";

/**
 * ★スカウト機能（候補者を探す・メッセージを送る）の企業ごとの利用許可（2026-10-28 / 柴さんの判断）。
 *   **ow_company_scout_access と ow_scout_access_requests を読み書きするのはこのファイルだけ。**
 * ⚠️ 2つの表は RLS 有効・ポリシー0本・anon / authenticated に権限なし。admin クライアントで読む。
 *    呼び出し側で「その企業の担当者か」「運営か」を確かめてから呼ぶこと。
 * ⚠️ 取れなかったら state は "none"（使えない側に倒す）。error を true にして呼び出し側が区別できるようにする。
 */

export const SCOUT_REQUEST_MESSAGE_MAX = 500;
export const SCOUT_REASON_MAX = 1000;

export type ScoutAccessInfo = {
  state: ScoutAccessState;
  /** 未対応の依頼（申請中のとき） */
  openRequest: { id: string; createdAt: string; message: string | null } | null;
  /** 直近に見送られた依頼（未申請に戻ったときに理由を出す） */
  lastDeclined: { reason: string | null; at: string } | null;
  revokeReason: string | null;
  error: boolean;
};

const EMPTY: ScoutAccessInfo = { state: "none", openRequest: null, lastDeclined: null, revokeReason: null, error: false };

export async function getScoutAccess(companyId: string): Promise<ScoutAccessInfo> {
  const db = createAdminClient();
  const [{ data: access, error: aErr }, { data: reqs, error: rErr }] = await Promise.all([
    db.from("ow_company_scout_access").select("status, revoke_reason").eq("company_id", companyId).maybeSingle(),
    db.from("ow_scout_access_requests").select("id, created_at, message, resolved_at, outcome, decline_reason")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (aErr || rErr) {
    console.error("[scoutAccess] 取得:", aErr?.message ?? rErr?.message);
    return { ...EMPTY, error: true };
  }
  const open = (reqs ?? []).find((r) => r.resolved_at == null) ?? null;
  const declined = (reqs ?? []).find((r) => r.outcome === "declined") ?? null;
  const state: ScoutAccessState = access?.status === "granted" ? "granted"
    : open ? "requested"
    : access?.status === "revoked" ? "revoked" : "none";
  return {
    state,
    openRequest: open ? { id: open.id as string, createdAt: open.created_at as string, message: (open.message as string | null) ?? null } : null,
    lastDeclined: state === "none" && declined ? { reason: (declined.decline_reason as string | null) ?? null, at: declined.resolved_at as string } : null,
    revokeReason: access?.status === "revoked" ? ((access.revoke_reason as string | null) ?? null) : null,
    error: false,
  };
}

/** 複数社ぶん（運営の一覧用）。取れなければ null */
export async function getScoutAccessMap(companyIds: string[]): Promise<Map<string, ScoutAccessState> | null> {
  const out = new Map<string, ScoutAccessState>();
  if (companyIds.length === 0) return out;
  const db = createAdminClient();
  const [{ data: access, error: aErr }, { data: open, error: rErr }] = await Promise.all([
    db.from("ow_company_scout_access").select("company_id, status").in("company_id", companyIds),
    db.from("ow_scout_access_requests").select("company_id").in("company_id", companyIds).is("resolved_at", null),
  ]);
  if (aErr || rErr) {
    console.error("[scoutAccess] 一覧:", aErr?.message ?? rErr?.message);
    return null;
  }
  const openSet = new Set((open ?? []).map((r) => r.company_id as string));
  const accessBy = new Map((access ?? []).map((r) => [r.company_id as string, r.status as string]));
  for (const id of companyIds) {
    const s = accessBy.get(id);
    out.set(id, s === "granted" ? "granted" : openSet.has(id) ? "requested" : s === "revoked" ? "revoked" : "none");
  }
  return out;
}

type Result = { ok: true } | { ok: false; status: number; error: string };

/** 企業の「スカウト機能の利用を依頼する」 */
export async function requestScoutAccess(p: { companyId: string; owUserId: string; message: string | null }): Promise<Result> {
  const message = p.message?.trim() ? p.message.trim() : null;
  if (message && message.length > SCOUT_REQUEST_MESSAGE_MAX) return { ok: false, status: 400, error: `メッセージは${SCOUT_REQUEST_MESSAGE_MAX}文字以内で入力してください` };
  const cur = await getScoutAccess(p.companyId);
  if (cur.error) return { ok: false, status: 500, error: "状態を確認できませんでした。時間をおいてもう一度お試しください。" };
  if (cur.state === "granted") return { ok: false, status: 400, error: "すでにスカウト機能を使えます。" };
  if (cur.state === "requested") return { ok: false, status: 409, error: "すでに依頼を受け付けています。" };

  const db = createAdminClient();
  const { error } = await db.from("ow_scout_access_requests").insert({ company_id: p.companyId, requested_by: p.owUserId, message });
  if (error) {
    /* 二重送信（未対応は1社1件の一意索引） */
    if (error.code === "23505") return { ok: false, status: 409, error: "すでに依頼を受け付けています。" };
    console.error("[scoutAccess] 依頼:", error.message);
    return { ok: false, status: 500, error: "依頼できませんでした。時間をおいてもう一度お試しください。" };
  }
  const [{ data: co }, { data: u }] = await Promise.all([
    db.from("ow_companies").select("name").eq("id", p.companyId).maybeSingle(),
    db.from("ow_users").select("name, email").eq("id", p.owUserId).maybeSingle(),
  ]);
  await emailOps("scout-access-request", scoutAccessRequestAdminTemplate({
    companyName: (co?.name as string | null) ?? "（社名不明）",
    requesterName: greetingName(u?.name as string | null | undefined),
    requesterEmail: (u?.email as string | null) ?? null,
    message,
  }));
  return { ok: true };
}

/** 運営: 使えるようにする（依頼への許可・依頼が無い企業への直接の付与） */
export async function grantScoutAccess(companyId: string, adminOwUserId: string | null): Promise<Result> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data: open, error: oErr } = await db.from("ow_scout_access_requests").select("id").eq("company_id", companyId).is("resolved_at", null).maybeSingle();
  if (oErr) {
    console.error("[scoutAccess] 許可の前:", oErr.message);
    return { ok: false, status: 500, error: "状態を確認できませんでした" };
  }
  const { error } = await db.from("ow_company_scout_access").upsert({
    company_id: companyId, status: "granted", source: open ? "request" : "admin",
    granted_at: now, granted_by: adminOwUserId, revoked_at: null, revoked_by: null, revoke_reason: null, updated_at: now,
  }, { onConflict: "company_id" });
  if (error) {
    console.error("[scoutAccess] 許可:", error.message);
    return { ok: false, status: 500, error: "許可できませんでした" };
  }
  if (open) {
    const { error: rErr } = await db.from("ow_scout_access_requests")
      .update({ resolved_at: now, resolved_by: adminOwUserId, outcome: "granted" }).eq("id", open.id as string);
    if (rErr) console.error("[scoutAccess] 依頼の片付け:", rErr.message);
  }
  await emailCompanyAdmins(companyId, "scout-access-granted", (to, companyName) =>
    scoutAccessCompanyTemplate({ to, companyName, kind: "granted", reason: null }));
  return { ok: true };
}

/** 運営: 依頼を見送る（理由は任意。企業に送る） */
export async function declineScoutRequest(companyId: string, adminOwUserId: string | null, reason: string | null): Promise<Result> {
  const text = reason?.trim() ? reason.trim().slice(0, SCOUT_REASON_MAX) : null;
  const db = createAdminClient();
  const { data, error } = await db.from("ow_scout_access_requests")
    .update({ resolved_at: new Date().toISOString(), resolved_by: adminOwUserId, outcome: "declined", decline_reason: text })
    .eq("company_id", companyId).is("resolved_at", null).select("id");
  if (error || !data || data.length !== 1) {
    console.error("[scoutAccess] 見送り:", error?.message ?? `rows=${data?.length ?? 0}`);
    return { ok: false, status: error ? 500 : 404, error: error ? "見送れませんでした" : "未対応の依頼がありません" };
  }
  await emailCompanyAdmins(companyId, "scout-access-declined", (to, companyName) =>
    scoutAccessCompanyTemplate({ to, companyName, kind: "declined", reason: text }));
  return { ok: true };
}

/** 運営: 取り消す（理由は任意。企業に送る） */
export async function revokeScoutAccess(companyId: string, adminOwUserId: string | null, reason: string | null): Promise<Result> {
  const text = reason?.trim() ? reason.trim().slice(0, SCOUT_REASON_MAX) : null;
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("ow_company_scout_access")
    .update({ status: "revoked", revoked_at: now, revoked_by: adminOwUserId, revoke_reason: text, updated_at: now })
    .eq("company_id", companyId).eq("status", "granted").select("company_id");
  if (error || !data || data.length !== 1) {
    console.error("[scoutAccess] 取り消し:", error?.message ?? `rows=${data?.length ?? 0}`);
    return { ok: false, status: error ? 500 : 404, error: error ? "取り消せませんでした" : "スカウト機能を使える状態ではありません" };
  }
  await emailCompanyAdmins(companyId, "scout-access-revoked", (to, companyName) =>
    scoutAccessCompanyTemplate({ to, companyName, kind: "revoked", reason: text }));
  return { ok: true };
}

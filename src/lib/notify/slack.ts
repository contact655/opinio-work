import "server-only";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import {
  SLACK_PAUSE_AFTER_FAILURES,
  SLACK_WINDOW_MINUTES,
  buildSlackText,
  isValidSlackWebhookUrl,
  maskSlackWebhookUrl,
  type SlackNotifyKind,
} from "./slackText";

/**
 * ★会社ごとの Slack 通知（2026-10-12 / 柴さんの指示）。**サーバー専用。**
 *
 * ⚠️★Webhook の URL は秘密。**ブラウザには返さない**（`getSlackSettingsView` は末尾だけ）。
 * ⚠️ 表（ow_company_slack_settings / ow_company_slack_sends）は RLS 有効・ポリシー0本・GRANT なし。
 *    読み書きはここの admin クライアントだけ。**会社の管理者かどうかは呼び出し側（API）が確かめる。**
 * ⚠️ no-store のクライアントを使う（設定と送信時刻が Next の fetch キャッシュに残らないように。
 *    メールの30分まとめで 2026-10-11 に踏んだのと同じ理由）。
 * ⚠️ 本文・連絡先は送らない（`buildSlackText`）。
 *
 * ── 送る場所（★経路を足したら `notifyCompanySlack` を呼ぶこと。条件を書き写さない）──
 *   reply       … 求職者が企業との会話で送った（api/dm/message）／声かけに返信した（lib/approaches/server.ts）
 *   meeting     … カジュアル面談の申込（api/casual-meetings）
 *   application … 応募（api/applications）
 */

const SITE = "https://opinio.jp";

export type SlackSettingsView = {
  /** 末尾だけ。未登録は null */
  maskedUrl: string | null;
  notifyReply: boolean;
  notifyMeeting: boolean;
  notifyApplication: boolean;
  includeCandidateName: boolean;
  consecutiveFailures: number;
  lastErrorAt: string | null;
  lastErrorStatus: number | null;
  lastSuccessAt: string | null;
  pausedAt: string | null;
};

const DEFAULT_VIEW: SlackSettingsView = {
  maskedUrl: null, notifyReply: true, notifyMeeting: true, notifyApplication: true, includeCandidateName: false,
  consecutiveFailures: 0, lastErrorAt: null, lastErrorStatus: null, lastSuccessAt: null, pausedAt: null,
};

/** 画面に出す形。⚠️ 取れなかったときは null（「未登録」と区別する） */
export async function getSlackSettingsView(companyId: string): Promise<SlackSettingsView | null> {
  const { data, error } = await createNoStoreAdminClient().from("ow_company_slack_settings")
    .select("webhook_url, notify_reply, notify_meeting, notify_application, include_candidate_name, consecutive_failures, last_error_at, last_error_status, last_success_at, paused_at")
    .eq("company_id", companyId).maybeSingle();
  if (error) { console.error("[slack] settings:", error.message); return null; }
  if (!data) return DEFAULT_VIEW;
  return {
    maskedUrl: data.webhook_url ? maskSlackWebhookUrl(data.webhook_url as string) : null,
    notifyReply: data.notify_reply as boolean,
    notifyMeeting: data.notify_meeting as boolean,
    notifyApplication: data.notify_application as boolean,
    includeCandidateName: data.include_candidate_name as boolean,
    consecutiveFailures: data.consecutive_failures as number,
    lastErrorAt: (data.last_error_at as string | null) ?? null,
    lastErrorStatus: (data.last_error_status as number | null) ?? null,
    lastSuccessAt: (data.last_success_at as string | null) ?? null,
    pausedAt: (data.paused_at as string | null) ?? null,
  };
}

type Result = { ok: true } | { ok: false; status: number; error: string };

/**
 * 設定を保存する。`webhookUrl` は undefined なら触らない（末尾しか見えていないので、画面は変えるときだけ送る）、
 * null なら消す。⚠️ URL を変えたら失敗の記録と一時停止を消す（新しい URL で始め直す）。
 */
export async function saveSlackSettings(companyId: string, owUserId: string, input: {
  webhookUrl?: string | null;
  notifyReply: boolean; notifyMeeting: boolean; notifyApplication: boolean; includeCandidateName: boolean;
}): Promise<Result> {
  if (typeof input.webhookUrl === "string" && !isValidSlackWebhookUrl(input.webhookUrl)) {
    return { ok: false, status: 400, error: "URL は https://hooks.slack.com/ で始まるものを入れてください。" };
  }
  const row: Record<string, unknown> = {
    company_id: companyId,
    notify_reply: input.notifyReply, notify_meeting: input.notifyMeeting, notify_application: input.notifyApplication,
    include_candidate_name: input.includeCandidateName,
    updated_by_ow_user_id: owUserId, updated_at: new Date().toISOString(),
  };
  if (input.webhookUrl !== undefined) {
    row.webhook_url = input.webhookUrl === null ? null : input.webhookUrl.trim();
    row.consecutive_failures = 0; row.last_error_at = null; row.last_error_status = null; row.paused_at = null;
  }
  const { error } = await createNoStoreAdminClient().from("ow_company_slack_settings").upsert(row, { onConflict: "company_id" });
  if (error) { console.error("[slack] save:", error.message); return { ok: false, status: 500, error: "保存できませんでした。" }; }
  return { ok: true };
}

/** Slack に送る。⚠️ 5秒で打ち切る（呼び出し元の応答を止めない） */
async function post(url: string, text: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** 結果を記録する。失敗が続いたら一時停止。⚠️ 成功したら失敗の記録と一時停止を消す */
async function record(companyId: string, r: { ok: boolean; status: number }, prevFailures: number): Promise<void> {
  const now = new Date().toISOString();
  const patch = r.ok
    ? { consecutive_failures: 0, last_success_at: now, paused_at: null }
    : {
        consecutive_failures: prevFailures + 1, last_error_at: now, last_error_status: r.status,
        ...(prevFailures + 1 >= SLACK_PAUSE_AFTER_FAILURES ? { paused_at: now } : {}),
      };
  const { error } = await createNoStoreAdminClient().from("ow_company_slack_settings").update(patch).eq("company_id", companyId);
  if (error) console.error("[slack] record:", error.message);
}

/**
 * ★テスト送信。一時停止中でも送る（URL を直したかを確かめるため）。成功したら一時停止を解く。
 */
export async function sendSlackTest(companyId: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const { data, error } = await createNoStoreAdminClient().from("ow_company_slack_settings")
    .select("webhook_url, consecutive_failures").eq("company_id", companyId).maybeSingle();
  if (error) { console.error("[slack] test lookup:", error.message); return { ok: false, status: 500, error: "設定を読み込めませんでした。" }; }
  if (!data?.webhook_url) return { ok: false, status: 400, error: "先に Webhook の URL を保存してください。" };
  const r = await post(data.webhook_url as string, `OPINIO からのテスト送信です。このチャンネルに通知が届きます。\n<${SITE}/biz/members|OPINIO の設定を開く>`);
  await record(companyId, r, data.consecutive_failures as number);
  return r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, error: "通知が届いていません。URL を確認してください。" };
}

/**
 * ★通知する。best-effort（失敗しても呼び出し元の処理は止めない・投げない）。
 *   ・設定が無い／URL が無い／一時停止中／その種類がオフ → 送らない
 *   ・同じ件（threadKey）について 30分以内に送っていれば送らない（メールと同じまとめ方）
 */
export async function notifyCompanySlack(params: {
  companyId: string;
  kind: SlackNotifyKind;
  /** まとめの単位。返信は会話ごと（`reply:<会話id>`）、面談・応募は会社ごと（`meeting` / `application`） */
  threadKey: string;
  /** ★`ow_users.id` 空間。名前を含める設定のときだけ使う */
  candidateOwUserId: string | null;
  /** /biz の該当画面（パスだけ。例: `/biz/applications`） */
  path: string;
  source: string;
}): Promise<void> {
  const tag = `[slack:${params.source}]`;
  try {
    const db = createNoStoreAdminClient();
    const { data: s, error } = await db.from("ow_company_slack_settings")
      .select("webhook_url, notify_reply, notify_meeting, notify_application, include_candidate_name, consecutive_failures, paused_at")
      .eq("company_id", params.companyId).maybeSingle();
    if (error) { console.error(`${tag} settings:`, error.message); return; }
    if (!s?.webhook_url || s.paused_at) return;
    const on = params.kind === "reply" ? s.notify_reply : params.kind === "meeting" ? s.notify_meeting : s.notify_application;
    if (!on) return;

    /* 30分まとめ。⚠️ 送る前に時刻を取る（同時に2本来ても1通にする） */
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - SLACK_WINDOW_MINUTES * 60_000).toISOString();
    const { data: upd, error: uErr } = await db.from("ow_company_slack_sends").update({ last_sent_at: now })
      .eq("company_id", params.companyId).eq("thread_key", params.threadKey).lt("last_sent_at", cutoff).select("thread_key");
    if (uErr) { console.error(`${tag} sends update:`, uErr.message); return; }
    if (!upd || upd.length === 0) {
      const { error: iErr } = await db.from("ow_company_slack_sends")
        .insert({ company_id: params.companyId, thread_key: params.threadKey, last_sent_at: now });
      if (iErr) {
        if (iErr.code === "23505") return; // 30分以内に送っている
        console.error(`${tag} sends insert:`, iErr.message); return;
      }
    }

    let name: string | null = null;
    if (s.include_candidate_name && params.candidateOwUserId) {
      const { data: u, error: nErr } = await db.from("ow_users").select("name").eq("id", params.candidateOwUserId).maybeSingle();
      if (nErr) console.error(`${tag} name:`, nErr.message);
      name = (u?.name as string | null) ?? null;
    }
    const r = await post(s.webhook_url as string, buildSlackText({ kind: params.kind, candidateName: name, url: `${SITE}${params.path}` }));
    await record(params.companyId, r, s.consecutive_failures as number);
    if (!r.ok) console.error(`${tag} 送れなかった company=${params.companyId} status=${r.status}`);
  } catch (e) {
    console.error(tag, e instanceof Error ? e.message : e);
  }
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { isValidSlackWebhookUrl } from "@/lib/notify/slackText";
import type { SlackSettingsView } from "@/lib/notify/slack";

/**
 * ★Slack 通知の設定（2026-10-12 / 柴さんの指示）。「メンバーと権限」の採用担当タブ、通知の宛先の下。
 * ⚠️ Webhook の URL は末尾だけ見える（全体はサーバーから返ってこない）。変えるときだけ入力欄を開く。
 * ⚠️ 管理者だけが操作できる（API も 403 で断る）。管理者でない人には何も出さない（呼び出し側）。
 * ⚠️ 保存ボタン方式（URL と種類をまとめて保存）。テスト送信は保存済みの URL に送る。
 */
export function SlackNotificationCard({ initial }: { initial: SlackSettingsView }) {
  const [view, setView] = useState(initial);
  const [editingUrl, setEditingUrl] = useState(!initial.maskedUrl);
  const [url, setUrl] = useState("");
  const [reply, setReply] = useState(initial.notifyReply);
  const [meeting, setMeeting] = useState(initial.notifyMeeting);
  const [application, setApplication] = useState(initial.notifyApplication);
  const [withName, setWithName] = useState(initial.includeCandidateName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const urlTyped = url.trim();
  const urlInvalid = editingUrl && urlTyped !== "" && !isValidSlackWebhookUrl(urlTyped);
  const dirty = (editingUrl && urlTyped !== "") || reply !== view.notifyReply || meeting !== view.notifyMeeting
    || application !== view.notifyApplication || withName !== view.includeCandidateName;
  /* 失敗のほうが新しいときだけ警告を出す */
  const failing = !!view.lastErrorAt && (!view.lastSuccessAt || view.lastErrorAt > view.lastSuccessAt);

  async function save(removeUrl = false) {
    setBusy(true); setMsg(null);
    const body: Record<string, unknown> = { notifyReply: reply, notifyMeeting: meeting, notifyApplication: application, includeCandidateName: withName };
    if (removeUrl) body.webhookUrl = null;
    else if (editingUrl && urlTyped) body.webhookUrl = urlTyped;
    try {
      const res = await fetch("/api/biz/slack", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ kind: "error", text: j.error ?? "保存できませんでした。" }); return; }
      setView(j as SlackSettingsView);
      setUrl(""); setEditingUrl(!(j as SlackSettingsView).maskedUrl);
      setMsg({ kind: "ok", text: removeUrl ? "Slack 通知を解除しました。" : "保存しました。" });
    } catch {
      setMsg({ kind: "error", text: "通信に失敗しました。" });
    } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/biz/slack/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      const g = await fetch("/api/biz/slack").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (g) setView(g as SlackSettingsView);
      setMsg(res.ok ? { kind: "ok", text: "テスト送信しました。Slack のチャンネルを確認してください。" } : { kind: "error", text: j.error ?? "送れませんでした。" });
    } catch {
      setMsg({ kind: "error", text: "通信に失敗しました。" });
    } finally { setBusy(false); }
  }

  const check = (label: string, value: boolean, set: (v: boolean) => void, state: string) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} data-state={state} style={{ accentColor: "var(--royal)" }} />
      {label}
    </label>
  );
  const btn: React.CSSProperties = { height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "pointer", fontFamily: "inherit" };

  return (
    <section data-state="slack-card" aria-label="Slack 通知" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Slack 通知</h2>
        <Link href="/biz/help/slack" style={{ fontSize: 12.5, color: "var(--royal)", fontWeight: 600 }}>Slack の設定方法</Link>
      </div>
      <p style={{ margin: "4px 0 14px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        返信・面談の申込・応募があったら、Slack のチャンネルにお知らせします。メッセージの本文や連絡先は送りません。
      </p>

      {view.pausedAt ? (
        <p role="alert" data-state="slack-paused" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "var(--warm-soft)", border: "1px solid #FDE68A", fontSize: 12.5, color: "var(--warm-ink)" }}>
          通知が届いていません。続けて届かなかったため、Slack 通知を一時停止しています。URL を確認し、登録し直すかテスト送信が届くと再開します。
        </p>
      ) : failing ? (
        <p role="alert" data-state="slack-failing" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "var(--warm-soft)", border: "1px solid #FDE68A", fontSize: 12.5, color: "var(--warm-ink)" }}>
          通知が届いていません。URL を確認してください。
        </p>
      ) : null}

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Incoming Webhook の URL</div>
      {!editingUrl && view.maskedUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <code data-state="slack-masked-url" style={{ fontSize: 12.5, color: "var(--ink-soft)", background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "4px 8px" }}>{view.maskedUrl}</code>
          <button type="button" style={btn} onClick={() => setEditingUrl(true)} disabled={busy}>変更する</button>
          <button type="button" style={{ ...btn, color: "var(--ink-mute)" }} disabled={busy}
            onClick={() => { if (confirm("Slack 通知を解除します。登録した URL を消します。")) void save(true); }}>解除</button>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/…" autoComplete="off" spellCheck={false}
            data-state="slack-url-input" aria-label="Incoming Webhook の URL"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1.5px solid ${urlInvalid ? "var(--error)" : "var(--line)"}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
          {urlInvalid && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--error-ink)" }}>https://hooks.slack.com/ で始まる URL を入れてください。</p>}
          {view.maskedUrl && <button type="button" style={{ ...btn, marginTop: 6, height: 28, fontSize: 12 }} onClick={() => { setEditingUrl(false); setUrl(""); }}>変更をやめる</button>}
        </div>
      )}

      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>通知する内容</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {check("新しい返信", reply, setReply, "slack-notify-reply")}
        {check("面談の申込", meeting, setMeeting, "slack-notify-meeting")}
        {check("応募", application, setApplication, "slack-notify-application")}
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} data-state="slack-include-name" style={{ accentColor: "var(--royal)", marginTop: 3 }} />
        <span>候補者の名前を通知に含める
          <span style={{ display: "block", fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>人事の担当者だけが入っているチャンネルを指定してください。</span>
        </span>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" data-state="slack-save" disabled={busy || !dirty || urlInvalid || (editingUrl && !urlTyped && !view.maskedUrl)} onClick={() => void save()}
          style={{ ...btn, background: "var(--royal)", color: "#fff", border: "none", opacity: busy || !dirty || urlInvalid ? 0.45 : 1 }}>保存</button>
        <button type="button" data-state="slack-test" disabled={busy || !view.maskedUrl || dirty} onClick={() => void test()}
          title={dirty ? "先に保存してください" : undefined} style={{ ...btn, opacity: busy || !view.maskedUrl || dirty ? 0.45 : 1 }}>テスト送信</button>
        {msg && <span role={msg.kind === "error" ? "alert" : "status"} data-state={`slack-msg-${msg.kind}`} style={{ fontSize: 12.5, color: msg.kind === "error" ? "var(--error-ink)" : "var(--ink-soft)" }}>{msg.text}</span>}
      </div>
    </section>
  );
}

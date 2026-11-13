"use client";

import { useEffect, useId, useState } from "react";
import { MATCH_RESULTS, MATCH_MEMO_MAX, type MatchResult } from "@/lib/nextManager/constants";

export type ManagerPanelSample = Panel;

type Panel = {
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

type Draft = { jobId: string; metOn: string; result: string; memo: string };
const draftOf = (p: Panel): Draft => ({ jobId: p.jobId ?? "", metOn: p.metOn ?? "", result: p.result ?? "", memo: p.memo ?? "" });

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * ★面談の記録（Next Manager / 2026-11-13）。メッセージ画面の会話の上部に出す。
 *
 *   出すのは、この会話にマッチングの記録があり、見ている人がその担当マネージャー（いまも会社の有効な担当者）のときだけ。
 *   判定はサーバー（GET /api/manager-matches → lib/nextManager/server.ts の getPanelForConversation）。
 *   それ以外（求職者・会社を外れたマネージャー）には何も描かない。
 *
 * ⚠️★メッセージ本文をこの欄に写さない・送らない。保存するのは募集・面談日・結果・メモだけ。
 * ⚠️ 変更あり（dirty）は「いま保存されている値」と比べる（ui-debugging ⑦）。開いた直後は「記録する」を押せない。
 * ⚠️ モックでは右の列だったが、マイページのメッセージ画面は幅が足りないため、会話の上部に畳める形で置いた。
 */
export function ManagerMatchPanel({ conversationId, sample = null }: {
  conversationId: string;
  /** ★見本（/dev/preview）。渡すとサーバーに問い合わせず、保存もしない */
  sample?: Panel | null;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = useId();

  useEffect(() => {
    let alive = true;
    setPanel(null); setDraft(null); setMsg(null);
    if (sample) { setPanel(sample); setDraft(draftOf(sample)); return; }
    void fetch(`/api/manager-matches?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.panel) return;
        setPanel(d.panel as Panel);
        setDraft(draftOf(d.panel as Panel));
      })
      .catch(() => { /* 欄を出さないだけ（会話そのものは使える） */ });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  if (!panel || !draft) return null;

  const saved = draftOf(panel);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const tooLong = draft.memo.length > MATCH_MEMO_MAX;

  const save = async () => {
    if (!dirty || busy || tooLong) return;
    setBusy(true); setMsg(null);
    if (sample) { setBusy(false); setMsg({ ok: true, text: "（見本なので保存しません）" }); return; }
    try {
      const r = await fetch(`/api/manager-matches/${panel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: draft.jobId || null, metOn: draft.metOn || null, result: draft.result || null, memo: draft.memo }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setMsg({ ok: false, text: d?.error ?? "保存できませんでした" }); return; }
      const next: Panel = { ...panel, jobId: draft.jobId || null, metOn: draft.metOn || null, result: (draft.result || null) as MatchResult | null, memo: draft.memo.trim() || null };
      setPanel(next);
      setDraft(draftOf(next));
      setMsg({ ok: true, text: "候補者管理に記録しました" });
    } catch {
      setMsg({ ok: false, text: "保存できませんでした" });
    } finally {
      setBusy(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--ink)" };
  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", background: "#fff", color: "var(--ink)", minWidth: 0 };

  return (
    <section aria-label="面談の記録" data-state="manager-match-panel"
      style={{ borderBottom: "1px solid var(--line)", background: "#fff", flexShrink: 0, maxHeight: "40vh", overflowY: "auto" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>面談の記録</span>
        <span style={{ fontSize: 12, color: "var(--ink-mute)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {panel.companyName ? `${panel.companyName}の候補者管理に残ります` : "候補者管理に残ります"}
        </span>
        <span aria-hidden style={{ fontSize: 12, color: "var(--ink-mute)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, background: "var(--bg-tint, #F6F7F9)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>求職者</div>
              <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{panel.candidateName}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>マッチング日</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(panel.matchedAt)}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <label htmlFor={`${base}-job`} style={label}>募集</label>
              <select id={`${base}-job`} value={draft.jobId} onChange={(e) => setDraft({ ...draft, jobId: e.target.value })} disabled={busy} style={field}>
                <option value="">まだ決めていない</option>
                {panel.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.status !== "published" ? "（非公開）" : ""}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <label htmlFor={`${base}-date`} style={label}>面談日</label>
              <input id={`${base}-date`} type="date" value={draft.metOn} onChange={(e) => setDraft({ ...draft, metOn: e.target.value })} disabled={busy} style={field} />
            </div>
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <label htmlFor={`${base}-result`} style={label}>結果</label>
              <select id={`${base}-result`} value={draft.result} onChange={(e) => setDraft({ ...draft, result: e.target.value })} disabled={busy} style={field}>
                <option value="">面談前</option>
                {MATCH_RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label htmlFor={`${base}-memo`} style={label}>メモ</label>
            <textarea id={`${base}-memo`} rows={3} value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} disabled={busy}
              style={{ ...field, lineHeight: 1.7, resize: "vertical", borderColor: tooLong ? "var(--error)" : "var(--line)" }} />
            <div style={{ fontSize: 11.5, color: tooLong ? "var(--error)" : "var(--ink-mute)", textAlign: "right" }}>{draft.memo.length} / {MATCH_MEMO_MAX}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void save()} disabled={!dirty || busy || tooLong} data-action="save-manager-match" className="tap-min-h"
              style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                background: dirty && !tooLong ? "var(--ink)" : "var(--line)", color: dirty && !tooLong ? "#fff" : "var(--ink-mute)", cursor: dirty && !busy && !tooLong ? "pointer" : "default" }}>
              {busy ? "記録中…" : "候補者管理に記録する"}
            </button>
            {msg && <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#17633F" : "var(--error)" }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CANDIDATE_NOTE_MAX, CANDIDATE_NOTES_NOTICE, CANDIDATE_STAGES, type CandidateStage } from "@/lib/constants/candidateNotes";

/**
 * ★社内メモと候補者の社内の状態（2026-10-10 / 声かけまわり 段5）。/u/[id] を企業の担当者が開いたときだけ出す。
 * ⚠️ フラグ（CANDIDATE_NOTES_ENABLED）がオフなら、呼び出し側がこの部品を描かない（API も 404）。
 * ⚠️ 注記の文言は柴さんの指示どおり（CANDIDATE_NOTES_NOTICE）。消さないこと。
 */
type Note = { id: string; body: string; createdAt: string; authorName: string | null };
type Tracking = { stage: CandidateStage | null; ownerId: string | null; ownerName: string | null };

export function CandidateNotesPanel({ candidateUserId, admins }: { candidateUserId: string; admins: { id: string; name: string }[] }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [tracking, setTracking] = useState<Tracking>({ stage: null, ownerId: null, ownerName: null });
  /* ★書けない相手（検索で見られない・応募も会話も無い）でも読める。そのときは入力欄と状態の変更を出さない */
  const [writable, setWritable] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/biz/candidates/${candidateUserId}`;

  const load = useCallback(async () => {
    const res = await fetch(`${base}/notes`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "読み込めませんでした"); return; }
    setNotes(json.notes); setTracking(json.tracking); setWritable(json.writable !== false);
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<Response>) => {
    setBusy(true); setError(null);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "保存できませんでした");
      await load();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); return false; } finally { setBusy(false); }
  };
  const saveTracking = (stage: CandidateStage | null, ownerId: string | null) =>
    run(() => fetch(`${base}/tracking`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, ownerId }) }));

  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const sel: React.CSSProperties = { height: 34, borderRadius: 8, border: "1px solid var(--line)", fontFamily: "inherit", fontSize: 13, padding: "0 8px", background: "#fff" };

  return (
    <section data-state="candidate-notes" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>社内メモ</div>
      <p style={{ margin: "6px 0 12px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)" }}>{CANDIDATE_NOTES_NOTICE}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>状態
          <select value={tracking.stage ?? ""} disabled={busy || !writable} style={{ ...sel, marginLeft: 6 }}
            onChange={(e) => void saveTracking((e.target.value || null) as CandidateStage | null, tracking.ownerId)}>
            <option value="">なし</option>
            {(Object.keys(CANDIDATE_STAGES) as CandidateStage[]).map((s) => <option key={s} value={s}>{CANDIDATE_STAGES[s]}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>担当
          <select value={tracking.ownerId ?? ""} disabled={busy || !writable} style={{ ...sel, marginLeft: 6 }}
            onChange={(e) => void saveTracking(tracking.stage, e.target.value || null)}>
            <option value="">なし</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>

      {!writable && (
        <p data-state="notes-readonly" style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-mute)" }}>
          いまはこの方に新しくメモを残したり、状態を変えたりできません（これまでのメモは読めます）。
        </p>
      )}
      {writable && (<>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={CANDIDATE_NOTE_MAX} rows={3} aria-label="社内メモ"
        placeholder="事実（いつ・何があったか）と評価を分けて書いてください"
        style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{body.length} / {CANDIDATE_NOTE_MAX}</span>
        <button type="button" disabled={busy || !body.trim()} className="tap-min-h"
          onClick={async () => { if (await run(() => fetch(`${base}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }))) setBody(""); }}
          style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 14px", borderRadius: 8, border: "none", background: body.trim() ? "var(--royal)" : "var(--line)", color: body.trim() ? "#fff" : "var(--ink-mute)", cursor: "pointer" }}>
          メモを残す
        </button>
      </div>
      </>)}
      {error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6 }}>{error}</div>}

      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {notes === null ? <li style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>読み込み中…</li>
          : notes.length === 0 ? <li style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>まだメモはありません</li>
          : notes.map((n) => (
            <li key={n.id} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11.5, color: "var(--ink-mute)" }}>
                <span>{n.authorName ?? "担当者"}・{fmt(n.createdAt)}</span>
                <button type="button" disabled={busy} onClick={() => { if (confirm("このメモを消します。よろしいですか？")) void run(() => fetch(`${base}/notes/${n.id}`, { method: "DELETE" })); }}
                  style={{ marginLeft: "auto", fontSize: 11.5, fontFamily: "inherit", border: "none", background: "none", color: "var(--ink-soft)", cursor: "pointer", textDecoration: "underline" }}>消す</button>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }}>{n.body}</div>
            </li>
          ))}
      </ul>
    </section>
  );
}

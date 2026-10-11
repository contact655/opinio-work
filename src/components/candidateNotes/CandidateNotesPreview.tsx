"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CANDIDATE_NOTE_MAX } from "@/lib/constants/candidateNotes";

/**
 * ★候補者検索の右のプレビューに置く社内メモ（2026-10-11 / 柴さんの指示）。
 *
 * ⚠️★データと権限は候補者の詳細（`CandidateNotesPanel`）と**同じ API**（/api/biz/candidates/[id]/notes）。
 *    読み書きの条件をここに書かない。フラグ（CANDIDATE_NOTES_ENABLED）がオフなら呼び出し側が描かない（API も 404）。
 * ⚠️ 出すのは最新の1件だけ。全部と「消す」・状態・担当は詳細のメモ欄（/u/[id]#candidate-notes）。
 */
type Note = { id: string; body: string; createdAt: string; authorName: string | null };

export function CandidateNotesPreview({ candidateUserId, candidateName, onCountChange }: {
  candidateUserId: string;
  candidateName: string;
  /** メモを残したあと、カードの「社内メモ 〇」を合わせるため */
  onCountChange?: (count: number) => void;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [writable, setWritable] = useState(true);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/biz/candidates/${candidateUserId}/notes`;

  const load = useCallback(async () => {
    const res = await fetch(base);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "読み込めませんでした"); return null; }
    setNotes(json.notes); setWritable(json.writable !== false);
    return (json.notes as Note[]).length;
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "保存できませんでした");
      setBody("");
      const n = await load();
      if (n !== null) onCountChange?.(n);
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); } finally { setBusy(false); }
  };

  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" }).format(new Date(iso));
  const latest = notes?.[0] ?? null;

  return (
    <section data-state="preview-notes" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>社内メモ</h3>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>{candidateName}さんには見えません</span>
      </div>

      {notes === null && !error ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-mute)" }}>読み込み中…</p>
      ) : latest ? (
        <div data-state="preview-note-latest" style={{ fontSize: 12.5, lineHeight: 1.6, padding: "8px 10px", borderRadius: 8, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{latest.authorName ?? "担当者"}・{fmt(latest.createdAt)}</div>
          <div style={{ color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 2 }}>{latest.body}</div>
        </div>
      ) : null}
      {notes && notes.length > 0 && (
        <Link href={`/u/${candidateUserId}#candidate-notes`} data-state="preview-notes-all"
          style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>
          すべて見る（{notes.length}件）
        </Link>
      )}

      {writable ? (
        <div style={{ marginTop: 8 }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={CANDIDATE_NOTE_MAX} rows={2} aria-label="社内メモ"
            placeholder="メモを書く（チームの担当者だけが見られます）"
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" disabled={busy || !body.trim()} onClick={() => void add()} className="btn-fixed-size"
              style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 16px", borderRadius: 8, border: "none", background: body.trim() ? "var(--royal)" : "var(--line)", color: body.trim() ? "#fff" : "var(--ink-mute)", cursor: body.trim() && !busy ? "pointer" : "default" }}>
              {busy ? "保存中…" : "残す"}
            </button>
          </div>
        </div>
      ) : notes !== null && (
        <p data-state="preview-notes-readonly" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>いまはこの方に新しくメモを残せません（これまでのメモは読めます）。</p>
      )}
      {error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6 }}>{error}</div>}
    </section>
  );
}

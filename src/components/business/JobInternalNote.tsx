"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JOB_INTERNAL_NOTE_MAX } from "@/lib/constants/jobInternalNote";

/**
 * ★求人の社内メモ（2026-10-12 / 柴さんの指示）。求職者には表示しない。
 *   入力は自動保存（入力が止まって約1秒後）。下にグレーで「柴 久人・10月12日 15:21 更新」。
 *   `variant="panel"` … 編集画面の右の固定の枠（1280px 以上） ／ `"collapsible"` … フォームの上の折りたたみ（1279px 以下）
 *   `"readonly"` … 選考管理の応募者の詳細（読むだけ。開閉で出す）
 * ⚠️ 求人の下書きがまだ無い（タイトル未入力）ときは書けない（保存先の求人が無い）。
 * ⚠️ 保存は PUT /api/biz/jobs/[id]/internal-note（RLS：その会社の現役の担当者だけ）。
 */
type Note = { body: string; updatedAt: string; updatedByName: string | null } | null;

function fmtUpdated(n: NonNullable<Note>): string {
  const d = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(n.updatedAt));
  const v = (t: string) => d.find((p) => p.type === t)?.value ?? "";
  return `${n.updatedByName ? `${n.updatedByName}・` : ""}${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")} 更新`;
}

export function JobInternalNote({ jobId, variant, fixed }: { jobId: string | null; variant: "panel" | "collapsible" | "readonly";
  /** ★/dev/preview 用の固定データ。渡したら読み込まない（DB を読まない） */
  fixed?: Note }) {
  const [note, setNote] = useState<Note>(fixed ?? null);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef("");

  useEffect(() => {
    if (fixed !== undefined) { setText(fixed?.body ?? ""); setLoaded(true); return; }
    if (!jobId) { setLoaded(true); return; }
    let alive = true;
    fetch(`/api/biz/jobs/${jobId}/internal-note`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!alive) return; const n = (j?.note ?? null) as Note; setNote(n); setText(n?.body ?? ""); lastSaved.current = n?.body ?? ""; setLoaded(true); })
      .catch(() => { if (alive) { setLoaded(true); setState("error"); } });
    return () => { alive = false; };
  }, [jobId, fixed]);

  const save = useCallback(async (value: string) => {
    if (!jobId || value.trim() === lastSaved.current.trim()) return;
    setState("saving");
    const res = await fetch(`/api/biz/jobs/${jobId}/internal-note`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: value }) }).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok) { setState("error"); return; }
    lastSaved.current = value;
    setNote((j?.note ?? null) as Note);
    setState("saved");
  }, [jobId]);

  const onChange = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(v), 1000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const over = text.length > JOB_INTERNAL_NOTE_MAX;
  const meta = state === "saving" ? "保存中…" : state === "error" ? "保存できませんでした。もう一度お試しください。" : note ? fmtUpdated(note) : null;

  if (variant === "readonly") {
    if (!loaded || !note) return null;
    return (
      <details data-state="job-internal-note-readonly" style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}>
        <summary style={{ cursor: "pointer", padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>この求人の社内メモ</summary>
        <div style={{ padding: "0 14px 12px" }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note.body}</p>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-mute)" }}>{fmtUpdated(note)}</div>
        </div>
      </details>
    );
  }

  const body = (
    <>
      {!jobId ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>タイトルを入れて下書きを作ると書けます。</p>
      ) : (
        <>
          <textarea value={text} onChange={(e) => onChange(e.target.value)} disabled={!loaded} rows={variant === "panel" ? 12 : 5}
            aria-label="社内メモ" data-state="job-internal-note-input"
            placeholder="採用の背景・社内の事情・面接官への申し送りなど（求職者には表示されません）"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${over ? "var(--error)" : "var(--line)"}`, borderRadius: 8, padding: "8px 10px",
              fontSize: 13, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical", background: "#fff" }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4, fontSize: 12, color: state === "error" || over ? "var(--error)" : "var(--ink-mute)" }}>
            <span data-state="job-internal-note-meta">{over ? `${JOB_INTERNAL_NOTE_MAX.toLocaleString()}字までです` : meta}</span>
            <span>{text.length.toLocaleString()} / {JOB_INTERNAL_NOTE_MAX.toLocaleString()}</span>
          </div>
        </>
      )}
    </>
  );

  if (variant === "collapsible") {
    return (
      <details className="jef-note-collapsible" data-state="job-internal-note-collapsible" style={{ marginBottom: 16, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}>
        <summary style={{ cursor: "pointer", padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          社内メモ<span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>（求職者には表示されません）</span>{note ? <span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>・あり</span> : null}
        </summary>
        <div style={{ padding: "0 14px 12px" }}>{body}</div>
      </details>
    );
  }
  return (
    <aside className="jef-note-panel" data-state="job-internal-note-panel" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
        社内メモ<span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>求職者には表示されません</span>
      </h2>
      {body}
    </aside>
  );
}

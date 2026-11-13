"use client";

import { useEffect, useId, useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { HIRING_NOTE_MAX } from "@/lib/nextManager/constants";

type Row = {
  companyId: string;
  companyName: string;
  isHiring: boolean;
  note: string | null;
  jobId: string | null;
  jobs: { id: string; title: string; status: string }[];
};

/**
 * ★Next Manager「採用中」（2026-11-13）。会社の担当者になっている人だけに出す（担当者でなければ何も描かない）。
 *   オンにすると、ユーザー一覧の名前の横に「採用中」が出て、「採用中のマネージャー」で絞り込める。
 *   採用中のあいだに個人どうしのメッセージで相手が返信すると、会社の候補者管理にマッチングの記録が1件残る。
 * ⚠️ オンにできるのは本人だけ（API が本人の有効な担当者の行かを確かめる）。
 * ⚠️ 読み込みに失敗したら操作させない。表示は保存済みの値（ui-debugging ⑦）。
 */
export default function HiringManagerSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobseeker/hiring", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { rows: Row[] }) => { if (alive) setRows(d.rows); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  if (loadError) {
    return (
      <FormSection title="採用中のマネージャー">
        <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>設定を読み込めませんでした。時間をおいて開き直してください。</p>
      </FormSection>
    );
  }
  /* ⚠️ 担当者でない人（0件）には欄ごと出さない */
  if (!rows || rows.length === 0) return null;

  return (
    <div id="hiring-manager-setting">
      <FormSection title="採用中のマネージャー"
        desc="自分のチームの仲間を探しているときにオンにします。ユーザー一覧で名前の横に「採用中」が出ます。メッセージは相手とあなたの2人だけのもので、会社には共有されません。相手が返信してやり取りが始まると、マッチングした事実だけが会社の候補者管理に残ります。">
        <div style={{ display: "grid", gap: 16 }}>
          {rows.map((r) => <HiringRow key={r.companyId} initial={r} onSaved={(next) => setRows((cur) => (cur ?? []).map((x) => (x.companyId === next.companyId ? next : x)))} />)}
        </div>
      </FormSection>
    </div>
  );
}

function HiringRow({ initial, onSaved }: { initial: Row; onSaved: (r: Row) => void }) {
  const [note, setNote] = useState(initial.note ?? "");
  const [jobId, setJobId] = useState(initial.jobId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const base = useId();
  const tooLong = note.trim().length > HIRING_NOTE_MAX;
  const dirty = note.trim() !== (initial.note ?? "") || jobId !== (initial.jobId ?? "");

  async function save(isHiring: boolean) {
    if (saving || tooLong) return;
    setSaving(true); setError(null); setDone(null);
    try {
      const res = await fetch("/api/jobseeker/hiring", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: initial.companyId, isHiring, note: note.trim() || null, jobId: jobId || null }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error((d && d.error) || "保存できませんでした。もう一度お試しください。");
      onSaved({ ...initial, isHiring, note: note.trim() || null, jobId: jobId || null });
      setDone(isHiring === initial.isHiring ? "保存しました" : isHiring ? "採用中にしました" : "採用中をやめました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-state={initial.isHiring ? "hiring-on" : "hiring-off"} style={{ display: "grid", gap: 10, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{initial.companyName}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: initial.isHiring ? "#17633F" : "var(--ink-mute)" }}>いま：{initial.isHiring ? "採用中" : "採用中ではありません"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <label htmlFor={`${base}-note`} style={{ fontSize: 12.5, fontWeight: 700 }}>チームで募集している内容（任意）</label>
          <input id={`${base}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：フィールドセールス・2名" disabled={saving}
            style={{ border: `1px solid ${tooLong ? "var(--error)" : "var(--line)"}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0 }} />
          <span style={{ fontSize: 11.5, color: tooLong ? "var(--error)" : "var(--ink-mute)" }}>{note.trim().length} / {HIRING_NOTE_MAX}</span>
        </div>
        {initial.jobs.length > 0 && (
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <label htmlFor={`${base}-job`} style={{ fontSize: 12.5, fontWeight: 700 }}>募集との紐付け（任意）</label>
            <select id={`${base}-job`} value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={saving}
              style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", background: "#fff", minWidth: 0 }}>
              <option value="">紐付けない</option>
              {initial.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.status !== "published" ? "（下書き）" : ""}</option>)}
            </select>
            <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>一覧に出るのは公開中の募集の名前だけです。</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {initial.isHiring ? (
          <>
            <button type="button" onClick={() => void save(true)} disabled={saving || !dirty || tooLong} className="tap-min-h"
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", background: dirty && !tooLong ? "var(--ink)" : "var(--line)", color: dirty && !tooLong ? "#fff" : "var(--ink-mute)", cursor: dirty && !saving ? "pointer" : "default" }}>
              内容を保存する
            </button>
            <button type="button" onClick={() => void save(false)} disabled={saving} data-action="hiring-off" className="tap-min-h"
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", background: "#fff", color: "var(--ink-soft)", cursor: saving ? "default" : "pointer" }}>
              採用中をやめる
            </button>
          </>
        ) : (
          <button type="button" onClick={() => void save(true)} disabled={saving || tooLong} data-action="hiring-on" className="tap-min-h"
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", background: "var(--ink)", color: "#fff", cursor: saving ? "default" : "pointer" }}>
            採用中にする
          </button>
        )}
        {done && <span role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "#17633F" }}>{done}</span>}
        {error && <span role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--error)" }}>{error}</span>}
      </div>
    </div>
  );
}

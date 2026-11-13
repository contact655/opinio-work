"use client";

import { useEffect, useState } from "react";

type Option = { userId: string; name: string; isHiring: boolean; selected: boolean };

/**
 * ★募集の Hiring Manager を選ぶ（Next Manager / 2026-11-13）。求人編集の「確認」の段に置く。
 *   選んだ瞬間に保存する（求人本体の保存とは別。GET/PUT /api/biz/jobs/[id]/hiring-managers）。
 * ⚠️ 求人ページに名前が出るのは、本人が設定画面で「採用中」にしている人だけ。会社が選んだだけでは公開しない
 *    （公開は本人の同意で）。その旨を画面にも出す。
 * ⚠️ まだ保存していない新しい求人（jobId が無い）では選べない。
 * ⚠️ 表示は保存済みの値（失敗したら元に戻す）。
 */
export function JobHiringManagersPicker({ jobId }: { jobId: string | null }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    setLoadError(false);
    fetch(`/api/biz/jobs/${jobId}/hiring-managers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { options: Option[] }) => { if (alive) setOptions(d.options); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [jobId]);

  if (!jobId) return <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>求人を一度保存すると選べるようになります。</p>;
  if (loadError) return <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>読み込めませんでした。時間をおいて開き直してください。</p>;
  if (!options) return <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>;
  if (options.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9 }}>
        選べる人がいません。<a href="/biz/members" style={{ color: "var(--royal)", fontWeight: 600 }}>メンバーと権限</a> でメンバーを招待すると選べるようになります。
      </p>
    );
  }

  const toggle = async (userId: string) => {
    if (busy) return;
    const next = options.map((o) => (o.userId === userId ? { ...o, selected: !o.selected } : o));
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/biz/jobs/${jobId}/hiring-managers`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: next.filter((o) => o.selected).map((o) => o.userId) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setMsg({ ok: false, text: d?.error ?? "保存できませんでした" }); return; }
      setOptions(next);
      setMsg({ ok: true, text: "保存しました" });
    } catch {
      setMsg({ ok: false, text: "保存できませんでした" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-state="job-hiring-managers" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <button key={o.userId} type="button" aria-pressed={o.selected} disabled={busy} onClick={() => void toggle(o.userId)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: "inherit",
              fontWeight: o.selected ? 700 : 500, cursor: busy ? "default" : "pointer",
              border: `1px solid ${o.selected ? "var(--ink)" : "var(--line)"}`, background: o.selected ? "var(--ink)" : "#fff", color: o.selected ? "#fff" : "var(--ink)",
            }}>
            {o.selected && <span aria-hidden>✓</span>}{o.name}
            {o.isHiring && <span style={{ fontSize: 11, fontWeight: 700, color: o.selected ? "#BFE8D0" : "#17633F" }}>採用中</span>}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8 }}>
        選んだ瞬間に保存します。求人ページに「この募集の Hiring Manager」として名前が出るのは、本人が設定画面で「採用中」にしている人だけです。
      </p>
      {msg && <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#17633F" : "var(--error)" }}>{msg.text}</span>}
    </div>
  );
}

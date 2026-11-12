"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CAREER_STANCES } from "@/lib/constants/careerPreferences";
import {
  STANCE_RECONFIRM_LEAD, STANCE_RECONFIRM_NOTES, STANCE_RECONFIRM_STORAGE_PREFIX, STANCE_RECONFIRM_TITLE,
  isStanceReconfirmHidden, stanceReconfirmAction, stanceReconfirmHiddenUntil,
} from "@/lib/profile/stanceReconfirm";

/**
 * ★転職意欲の「変わりありませんか？」（2026-11-12）。/home に出す。
 *   出すかどうかはサーバーが決める（shouldAskStanceReconfirm）。ここは「閉じた記録」（localStorage）だけを見る。
 * 「更新する」: 同じ値なら POST /api/jobseeker/career-stance/confirm（確かめた日時だけ打つ）、
 *               違う値なら PUT /api/jobseeker/career-preferences（値を変える。日時もそこで打たれる）。
 * 「閉じる」: 30日は出さない（端末に覚える）。
 * ⚠️ localStorage はマウント後の effect で読む（初期化子で読むとハイドレーションが割れる）。
 * ⚠️ preview は /dev/preview 用。通信せず、閉じた記録も読み書きしない。
 */
export function StanceReconfirmDialog({
  ownerKey,
  currentStance,
  preview = false,
}: {
  /** 閉じた記録を利用者ごとに分けるためのキー（ow_users.id） */
  ownerKey: string;
  currentStance: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(preview);
  const [selected, setSelected] = useState(currentStance);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const storageKey = STANCE_RECONFIRM_STORAGE_PREFIX + ownerKey;

  useEffect(() => {
    if (preview) return;
    let hidden = false;
    try { hidden = isStanceReconfirmHidden(window.localStorage.getItem(storageKey), Date.now()); } catch { /* 読めなければ出す */ }
    if (!hidden) setOpen(true);
  }, [preview, storageKey]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    if (saving) return;
    if (!preview) {
      try { window.localStorage.setItem(storageKey, String(stanceReconfirmHiddenUntil(Date.now()))); } catch { /* 覚えられなくても閉じる */ }
    }
    setOpen(false);
  }

  async function submit() {
    if (preview) { setOpen(false); return; }
    setSaving(true);
    setError(null);
    try {
      const action = stanceReconfirmAction(currentStance, selected);
      const res = action === "confirm"
        ? await fetch("/api/jobseeker/career-stance/confirm", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ career_stance: selected }),
          })
        : await fetch("/api/jobseeker/career-preferences", {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ career_stance: selected }),
          });
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        setError(j?.error ?? "保存できませんでした。時間をおいてもう一度お試しください。");
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      router.refresh();
    } catch (e) {
      console.error("[StanceReconfirmDialog] submit", e);
      setError("保存できませんでした。時間をおいてもう一度お試しください。");
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div data-state="stance-reconfirm" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="stance-reconfirm-title"
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, maxHeight: "calc(100vh - 32px)", overflowY: "auto", padding: "22px 20px 18px", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <h2 id="stance-reconfirm-title" style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>{STANCE_RECONFIRM_TITLE}</h2>
        <p style={{ fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.8, margin: "6px 0 0" }}>{STANCE_RECONFIRM_LEAD}</p>

        <fieldset style={{ border: "none", padding: 0, margin: "14px 0 0" }}>
          <legend style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>転職意欲</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CAREER_STANCES.map((o) => {
              const checked = selected === o.value;
              return (
                <label key={o.value} data-state={checked ? "stance-option-selected" : "stance-option"}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${checked ? "var(--royal)" : "var(--line)"}`, background: checked ? "var(--royal-50, #eef2fb)" : "#fff" }}>
                  <input ref={o.value === currentStance ? firstRef : undefined} type="radio" name="stance-reconfirm" value={o.value} checked={checked}
                    disabled={saving} onChange={() => setSelected(o.value)} style={{ accentColor: "var(--royal)" }} />
                  <span style={{ fontSize: 14, fontWeight: checked ? 700 : 500, color: "var(--ink)" }}>{o.label}</span>
                  {o.value === currentStance && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-mute)" }}>いまの設定</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {STANCE_RECONFIRM_NOTES.map((n) => (
            <li key={n} style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>・{n}</li>
          ))}
        </ul>

        {error && <p role="alert" style={{ fontSize: 12.5, color: "#b42318", margin: "10px 0 0" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={close} disabled={saving} data-action="stance-reconfirm-close"
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            閉じる
          </button>
          <button type="button" onClick={submit} disabled={saving} data-action="stance-reconfirm-submit"
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "保存中…" : "更新する"}
          </button>
        </div>
      </div>
    </div>
  );
}

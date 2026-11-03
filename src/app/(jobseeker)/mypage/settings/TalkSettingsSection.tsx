"use client";

import { useEffect, useRef, useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { TALK_CAPACITIES, TALK_REQUEST_EXPIRE_DAYS, TALK_STANCES, type TalkCapacity, type TalkStance } from "@/lib/constants/talk";

type Loaded = {
  stance: TalkStance | null;
  stanceCompanyId: string | null;
  capacity: TalkCapacity;
  recruiterCompanies: { id: string; name: string }[];
};

/**
 * ★話す人の立場と、話せる量（2026-11-03 / 柴さんの指示）。いつでも変えられる。初期値は「今は話せない」。
 * ⚠️「採用担当」は、所属企業で管理者か採用担当になっている人だけが選べる（選べない人には理由を添えて押せなくする）。
 * ⚠️ 読み込みに失敗したら操作させない。保存済みの値だけを画面の状態にする（押して失敗したら元に戻す）。
 */
export default function TalkSettingsSection() {
  const [saved, setSaved] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<{ stance: TalkStance | null; stanceCompanyId: string | null; capacity: TalkCapacity } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobseeker/talk-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Loaded) => {
        if (!alive) return;
        setSaved(d);
        setDraft({ stance: d.stance, stanceCompanyId: d.stanceCompanyId, capacity: d.capacity });
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  /* ★ホームの左のカードの「設定する」（/mypage/settings#talk-settings）から来たら、読み込みが済んだところで1回だけこの欄へ寄せる
        （2026-11-04）。ページの中身が後から伸びるので、ブラウザ任せのハッシュの移動では届かない。
     ⚠️ requestAnimationFrame に載せない（描画されていないと動かない。ui-debugging ⑪） */
  const scrolledToHash = useRef(false);
  const ready = !!saved || loadError;
  useEffect(() => {
    if (!ready || scrolledToHash.current || window.location.hash !== "#talk-settings") return;
    /* ⚠️ 印は寄せたときに付ける（effect の先頭で付けると、開発時の二重実行で片付けられて一度も動かない） */
    const t = setTimeout(() => {
      scrolledToHash.current = true;
      document.getElementById("talk-settings")?.scrollIntoView({ block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [ready]);

  const canRecruit = (saved?.recruiterCompanies.length ?? 0) > 0;
  const dirty = !!saved && !!draft && (draft.stance !== saved.stance || draft.stanceCompanyId !== saved.stanceCompanyId || draft.capacity !== saved.capacity);

  async function save() {
    if (!draft || saving) return;
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/jobseeker/talk-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMessage({ text: j.error ?? "保存できませんでした。もう一度お試しください。", error: true }); return; }
      setSaved((s) => (s ? { ...s, ...draft } : s));
      setMessage({ text: "保存しました。", error: false });
    } catch {
      setMessage({ text: "保存できませんでした。もう一度お試しください。", error: true });
    } finally {
      setSaving(false);
    }
  }

  const radio = (name: string, checked: boolean, disabled: boolean, onChange: () => void, label: string, hint: string, state: string) => (
    <label key={state} data-state={state} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: disabled ? "var(--ink-mute)" : "var(--ink)", cursor: disabled ? "default" : "pointer" }}>
      <input type="radio" name={name} checked={checked} disabled={disabled || saving} onChange={onChange} style={{ marginTop: 4 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>{hint}</span>
      </span>
    </label>
  );

  return (
    <FormSection title="話を聞かれることについて"
      desc={`あなたにつながっていない人が「話を聞く」を送れるかどうかと、あなたの立場です。返事のない依頼は${TALK_REQUEST_EXPIRE_DAYS}日で自動で辞退になり、送った方には「今回はお話しできないようです」とだけ伝わります（理由は伝わりません）。誰から依頼が来たかは、あなたと送った方にしか見えません。`}>
      {loadError ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>設定を読み込めませんでした。時間をおいて開き直してください。</p>
      ) : !saved || !draft ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</p>
      ) : (
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            <legend style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>話せる量</legend>
            {TALK_CAPACITIES.map((c) => radio("talk-capacity", draft.capacity === c.value, false,
              () => setDraft({ ...draft, capacity: c.value }), c.label, c.hint, `talk-capacity-${c.value}`))}
          </fieldset>
          <fieldset style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            <legend style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>話すときの立場</legend>
            {TALK_STANCES.map((s) => {
              const disabled = s.value === "recruiter" && !canRecruit;
              return radio("talk-stance", draft.stance === s.value, disabled,
                () => setDraft({ ...draft, stance: s.value, stanceCompanyId: s.value === "recruiter" ? (draft.stanceCompanyId ?? saved.recruiterCompanies[0]?.id ?? null) : null }),
                s.label, s.hint, `talk-stance-${s.value}`);
            })}
            {draft.stance === "recruiter" && saved.recruiterCompanies.length > 1 && (
              <select aria-label="どの会社の採用担当か" value={draft.stanceCompanyId ?? ""} disabled={saving}
                onChange={(e) => setDraft({ ...draft, stanceCompanyId: e.target.value || null })}
                style={{ marginLeft: 26, maxWidth: "calc(100% - 26px)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontFamily: "inherit" }}>
                {saved.recruiterCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {draft.stance === "recruiter" && saved.recruiterCompanies.length === 1 && (
              <p style={{ margin: "0 0 0 26px", fontSize: 12.5, color: "var(--ink-soft)" }}>{saved.recruiterCompanies[0].name} の採用担当として表示します。</p>
            )}
          </fieldset>
          {draft.capacity !== "none" && !draft.stance && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>話せる設定にするときは、立場を1つ選んでください。</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void save()} disabled={!dirty || saving || (draft.capacity !== "none" && !draft.stance)}
              data-action="talk-settings-save"
              style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: !dirty || saving ? "var(--line)" : "var(--royal)", color: !dirty || saving ? "var(--ink-mute)" : "#fff", fontSize: 13.5, fontWeight: 700, cursor: !dirty || saving ? "default" : "pointer" }}>
              {saving ? "保存しています…" : "保存する"}
            </button>
            {message && <span role="status" style={{ fontSize: 12.5, color: message.error ? "var(--error)" : "var(--ink-soft)" }}>{message.text}</span>}
          </div>
        </div>
      )}
    </FormSection>
  );
}

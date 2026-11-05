"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  CONSULT_DECLINE_REPLY,
  CONSULT_FORMATS,
  CONSULT_LABEL,
  CONSULT_NOTE_MAX,
  CONSULT_POINTS,
  CONSULT_PURPOSE_NOTE,
  consultAboutLabel,
  consultFormatLabel,
  consultPointLabel,
  type ConsultAboutOption,
  type ConsultFormat,
  type ConsultPayload,
  type ConsultPoint,
} from "@/lib/constants/careerConsult";

/**
 * ★キャリア相談の部品（2026-11-05 / 柴さんの指示）。
 *   - ConsultFields   … 聞きたい話（必須）・特に聞きたいこと（複数・任意）・希望する話し方（任意）・ひとこと（任意）
 *   - ConsultDialog   … 会話の中の「相談する」で開く画面（ConsultLauncher が使う）
 *   - ConsultLauncher … 入力欄の横に常に出す「相談する」ボタン（/api/dm/message に consult を付けて送る）
 *   - ConsultCard     … 送った相談の表示（チャットの中。ふつうのメッセージと見分けがつく枠）
 *   - CommonPointsLine… 受け取った人に出す「送った人との共通点」
 * ⚠️ 選択肢・検証・文言は lib/constants/careerConsult.ts の1か所。ここに書き写さない。
 * ⚠️ 「聞きたい話」の選択肢はサーバーが相手の職歴から作る（GET /api/dm/start・/api/dm/consult-options）。送るときも同じ関数で確かめる。
 */

export type ConsultDraft = { about: string | null; points: ConsultPoint[]; format: ConsultFormat | null; note: string };

export function emptyConsultDraft(about: string | null = null): ConsultDraft {
  return { about, points: [], format: null, note: "" };
}

/** API に渡す形 */
export function consultDraftBody(d: ConsultDraft): Record<string, unknown> {
  return { about: d.about, points: d.points, format: d.format, note: d.note.trim() };
}

export function isConsultDraftReady(d: ConsultDraft): boolean {
  return !!d.about && d.note.trim().length <= CONSULT_NOTE_MAX;
}

const chip = (on: boolean): React.CSSProperties => ({
  padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: "inherit", cursor: "pointer",
  border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)",
  maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
});
const legend: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "var(--ink)", padding: 0, marginBottom: 8 };
const optional = <span style={{ fontWeight: 500, color: "var(--ink-mute)", fontSize: 12 }}>（任意）</span>;

/** 聞きたい話の選択肢だけ（最初の画面では入力欄の近くにこれだけを出す） */
export function ConsultAboutChips({ options, value, onChange, disabled = false, label = "聞きたい話" }: {
  options: ConsultAboutOption[]; value: string | null; onChange: (key: string | null) => void; disabled?: boolean; label?: string;
}) {
  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={legend}>{label}</legend>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
        {options.map((o) => {
          const on = value === o.key;
          return (
            <button key={o.key} type="button" role="radio" aria-checked={on} data-about={o.key} className="btn-fixed-size" disabled={disabled}
              onClick={() => onChange(on ? null : o.key)} style={chip(on)} title={o.label}>
              {o.kind === "career" ? o.label : `${o.label}での経験`}
              {o.period && <span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>（{o.period}）</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** 聞きたい話のあとに続く3つ（特に聞きたいこと・話し方・ひとこと） */
export function ConsultDetailFields({ draft, onChange, disabled = false }: {
  draft: ConsultDraft; onChange: (d: ConsultDraft) => void; disabled?: boolean;
}) {
  const noteId = useId();
  const tooLong = draft.note.length > CONSULT_NOTE_MAX;
  return (
    <>
      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={legend}>特に聞きたいこと{optional}</legend>
        <div role="group" aria-label="特に聞きたいこと" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CONSULT_POINTS.map((p) => {
            const on = draft.points.includes(p.value);
            return (
              <button key={p.value} type="button" aria-pressed={on} data-point={p.value} className="btn-fixed-size" disabled={disabled}
                onClick={() => onChange({ ...draft, points: on ? draft.points.filter((x) => x !== p.value) : [...draft.points, p.value] })} style={chip(on)}>
                {p.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={legend}>希望する話し方{optional}</legend>
        <div role="radiogroup" aria-label="希望する話し方" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CONSULT_FORMATS.map((f) => {
            const on = draft.format === f.value;
            return (
              <button key={f.value} type="button" role="radio" aria-checked={on} data-format={f.value} className="btn-fixed-size" disabled={disabled}
                onClick={() => onChange({ ...draft, format: on ? null : f.value })} style={chip(on)}>
                {f.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div style={{ minWidth: 0 }}>
        <label htmlFor={noteId} style={{ display: "block", ...legend, marginBottom: 6 }}>ひとこと{optional}</label>
        <textarea id={noteId} value={draft.note} rows={3} disabled={disabled} onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="なぜ聞きたいかを、ひとことで（例: 来年マネージャーになる予定で、最初の1年のことを伺いたいです）"
          style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${tooLong ? "var(--error)" : "var(--line)"}`, fontSize: 14, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, color: tooLong ? "var(--error)" : "var(--ink-mute)", marginTop: 4 }}>{draft.note.length} / {CONSULT_NOTE_MAX}</div>
      </div>
    </>
  );
}

/** 送る画面の注意（採用・スカウトに使わない） */
export function ConsultPurposeNote() {
  return <p data-state="consult-purpose-note" style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>{CONSULT_PURPOSE_NOTE}</p>;
}

type OptionsResult = { options: ConsultAboutOption[]; selectedAbout: string | null } | { error: string };

/**
 * ★相談の画面（モーダル）。聞きたい話〜ひとことの4つと「相談を送る」。
 *   ⚠️ 選択肢は開いたときに読み込む（相手の職歴が変わっていてもその時点の値になる）
 */
export function ConsultDialog({ recipientName, loadOptions, initialAbout = null, onSend, onClose }: {
  recipientName: string | null;
  loadOptions: () => Promise<OptionsResult>;
  initialAbout?: string | null;
  /** エラーの文言を返す（成功なら null） */
  onSend: (d: ConsultDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<ConsultAboutOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConsultDraft>(emptyConsultDraft(initialAbout));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  useEffect(() => {
    let alive = true;
    void loadOptions().then((r) => {
      if (!alive) return;
      if ("error" in r) { setLoadError(r.error); return; }
      setOptions(r.options);
      setDraft((d) => ({ ...d, about: d.about && r.options.some((o) => o.key === d.about) ? d.about : (r.selectedAbout ?? (r.options.length === 1 ? r.options[0].key : null)) }));
    });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const ready = isConsultDraftReady(draft);
  const send = async () => {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try { const e = await onSend(draft); if (e) setError(e); } finally { setBusy(false); }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div data-state="consult-dialog" style={{ width: "100%", maxWidth: 560, maxHeight: "100%", overflowY: "auto", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.2)", background: "#fff", padding: "16px 18px", display: "grid", gap: 16, boxSizing: "border-box", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{recipientName ? `${recipientName}さんに相談する` : "相談する"}</div>
          <div style={{ marginTop: 4 }}><ConsultPurposeNote /></div>
        </div>
        {loadError && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>{loadError}</p>}
        {!options && !loadError && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>}
        {options && (
          <>
            <ConsultAboutChips options={options} value={draft.about} onChange={(about) => setDraft({ ...draft, about })} disabled={busy} />
            <ConsultDetailFields draft={draft} onChange={setDraft} disabled={busy} />
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!draft.about && options && <span data-state="consult-missing" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>聞きたい話を1つ選んでください。</span>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} disabled={busy} className="tap-min-h"
            style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
            やめる
          </button>
          <button type="button" onClick={() => void send()} disabled={!ready || busy} data-action="send-consult" className="tap-min-h"
            style={{ padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
              background: ready ? "var(--royal)" : "var(--line)", color: ready ? "#fff" : "var(--ink-mute)", cursor: ready && !busy ? "pointer" : "default" }}>
            {busy ? "送信中…" : "相談を送る"}
          </button>
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--error)" }}>{error}</p>}
      </div>
    </div>,
    document.body,
  );
}

/** 会話の相手の選択肢を読む（GET /api/dm/consult-options） */
export async function loadConversationConsultOptions(conversationId: string, aboutExperienceId?: string | null): Promise<OptionsResult> {
  try {
    const q = new URLSearchParams({ conversationId });
    if (aboutExperienceId) q.set("aboutExperienceId", aboutExperienceId);
    const r = await fetch(`/api/dm/consult-options?${q.toString()}`, { cache: "no-store" });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || !Array.isArray(d.options)) return { error: d?.error ?? "選択肢を読み込めませんでした" };
    if (d.options.length === 0) return { error: "この会話では相談を送れません" };
    return { options: d.options as ConsultAboutOption[], selectedAbout: (d.selectedAbout as string | null) ?? null };
  } catch {
    return { error: "選択肢を読み込めませんでした" };
  }
}

/**
 * ★入力欄の横に常に出す「相談する」（2026-11-05）。押すと ConsultDialog が開き、送ると /api/dm/message に consult を付けて送る。
 *   autoOpenExperienceId … 「この経験について聞く」から既にある会話へ来たとき、その職歴を選んだ状態で1回だけ開く
 */
export function ConsultLauncher({ conversationId, recipientName, onSent, disabled = false, autoOpenExperienceId = null }: {
  conversationId: string;
  recipientName: string | null;
  onSent: () => void | Promise<void>;
  disabled?: boolean;
  autoOpenExperienceId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [expId, setExpId] = useState<string | null>(null);
  useEffect(() => {
    if (!autoOpenExperienceId) return;
    setExpId(autoOpenExperienceId);
    setOpen(true);
  }, [autoOpenExperienceId]);
  const send = async (d: ConsultDraft): Promise<string | null> => {
    try {
      const r = await fetch("/api/dm/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, consult: consultDraftBody(d) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return data.error ?? "送信に失敗しました";
      setOpen(false);
      setExpId(null);
      await onSent();
      return null;
    } catch {
      return "送信に失敗しました";
    }
  };
  return (
    <>
      <button type="button" onClick={() => { setExpId(null); setOpen(true); }} disabled={disabled} data-action="open-consult"
        title="キャリアについて相談する（聞きたい話を選んで送ります）"
        style={{ padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--royal-100)", background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer" }}>
        相談する
      </button>
      {open && (
        <ConsultDialog recipientName={recipientName} initialAbout={null}
          loadOptions={() => loadConversationConsultOptions(conversationId, expId)}
          onSend={send} onClose={() => { setOpen(false); setExpId(null); }} />
      )}
    </>
  );
}

/** 一覧の「キャリア相談」のラベル */
export function ConsultLabel() {
  return (
    <span data-state="consult-label" style={{ display: "inline-block", padding: "1px 8px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", fontSize: 11.5, fontWeight: 700, lineHeight: 1.6, whiteSpace: "nowrap", flexShrink: 0 }}>
      {CONSULT_LABEL}
    </span>
  );
}

/** 受け取った人に出す共通点。無ければ何も出さない */
export function CommonPointsLine({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <div data-state="consult-common-points" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>共通点</span>
      {points.map((p) => (
        <span key={p} style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", background: "var(--line-soft)", border: "1px solid var(--line)", borderRadius: 999, padding: "1px 8px", maxWidth: "100%", overflowWrap: "anywhere" }}>{p}</span>
      ))}
    </div>
  );
}

/**
 * ★送った相談の表示（チャットの中）。ふつうのメッセージと見分けがつくよう、見出し「キャリア相談」と枠を持つ。
 *   表示項目: 聞きたい話・特に聞きたいこと・希望する話し方・ひとこと（payload から描く。body は読まない）
 *   onDecline … 受け取った側だけ。「今回は難しいです」をワンタップで返す（理由は求めない・相手をブロックしない）
 */
export function ConsultCard({ payload, commonPoints = [], onDecline }: {
  payload: ConsultPayload;
  commonPoints?: string[];
  onDecline?: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "baseline", minWidth: 0 }}>
      <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--ink)", minWidth: 0, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
  return (
    <div data-state="consult-card" style={{ border: "1.5px solid var(--royal-100)", borderRadius: 12, background: "#fff", padding: "12px 14px", display: "grid", gap: 8, minWidth: 0, maxWidth: "min(460px, 100%)", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><ConsultLabel /></div>
      {row("聞きたい話", <strong style={{ fontWeight: 700 }}>{consultAboutLabel(payload.about)}{payload.about.kind === "company" && payload.about.period ? <span style={{ fontWeight: 500, color: "var(--ink-mute)" }}>（{payload.about.period}）</span> : null}</strong>)}
      {payload.points.length > 0 && row("特に聞きたいこと", payload.points.map(consultPointLabel).join("・"))}
      {payload.format && row("希望する話し方", consultFormatLabel(payload.format))}
      {payload.note && <p style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.8, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{payload.note}</p>}
      <CommonPointsLine points={commonPoints} />
      {onDecline && !sent && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" data-action="consult-decline" disabled={busy}
            onClick={async () => { setBusy(true); setError(null); try { const e = await onDecline(); if (e) setError(e); else setSent(true); } finally { setBusy(false); } }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
            {busy ? "送信中…" : `「${CONSULT_DECLINE_REPLY}」と返す`}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>理由は書かなくて大丈夫です。相手をブロックはしません。</span>
        </div>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>{error}</p>}
    </div>
  );
}

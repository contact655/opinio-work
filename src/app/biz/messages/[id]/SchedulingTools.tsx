"use client";

import { useEffect, useState } from "react";
import { OPEN_MEETING_SLOTS_EVENT } from "@/components/meetings/MeetingMessageCard";
import { useRouter } from "next/navigation";
import { MAX_MEETING_SLOTS, MEETING_DURATIONS, MEETING_FORMATS, MEETING_SLOT_STEP_MINUTES, type MeetingDuration, type MeetingFormat } from "@/lib/constants/meetings";

/**
 * ★会話の入力欄の「候補日」（2026-10-10 / 段4）。「候補日を送る」と「日程調整リンクを送る」を選べる。
 * ⚠️ 日時は日本時間として送る（入力値に +09:00 を付ける。ブラウザの時間帯に左右されない）。
 * ⚠️ 判定（未来・15分単位・3つまで・同席者は自社の担当者）はサーバー（lib/meetings/server.ts）でもう一度見る。
 */
export function SchedulingTools({
  conversationId, admins, myUserId, initialSchedulingUrl,
}: {
  conversationId: string;
  admins: { id: string; name: string }[];
  myUserId: string;
  initialSchedulingUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "menu" | "slots" | "link">(null);
  const [slots, setSlots] = useState<string[]>([""]);
  const [format, setFormat] = useState<MeetingFormat>("online");
  const [duration, setDuration] = useState<MeetingDuration>(30);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [url, setUrl] = useState(initialSchedulingUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialSchedulingUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ★候補日がすべて過ぎたカードの「新しい候補日を送る」から開く */
  useEffect(() => {
    const open = () => setOpen("slots");
    window.addEventListener(OPEN_MEETING_SLOTS_EVENT, open);
    return () => window.removeEventListener(OPEN_MEETING_SLOTS_EVENT, open);
  }, []);

  const call = async (path: string, method: string, body?: unknown) => {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "うまくいきませんでした");
    return json;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "うまくいきませんでした"); } finally { setBusy(false); }
  };

  const sendSlots = () => run(async () => {
    const filled = slots.filter((s) => s);
    await call(`/api/biz/conversations/${conversationId}/meeting-slots`, "POST", {
      slots: filled.map((s) => `${s}:00+09:00`), format, duration, attendeeUserIds: attendees,
    });
    setOpen(null); setSlots([""]); setAttendees([]);
    router.refresh();
  });
  const saveUrl = () => run(async () => {
    const j = await call("/api/biz/scheduling-url", "PUT", { url: url.trim() || null });
    setSavedUrl(j.url ?? null);
  });
  const sendLink = () => run(async () => {
    await call(`/api/biz/conversations/${conversationId}/scheduling-link`, "POST");
    setOpen(null);
    router.refresh();
  });

  const btn = (primary: boolean): React.CSSProperties => ({
    fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 12px", borderRadius: 8, cursor: "pointer",
    border: primary ? "none" : "1px solid var(--line)", background: primary ? "var(--royal)" : "#fff", color: primary ? "#fff" : "var(--ink)",
  });

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(open ? null : "menu")} style={btn(false)} aria-expanded={!!open}>候補日</button>
      {open && (
        <div role="dialog" aria-label="日程調整" style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 20, width: "min(360px, calc(100vw - 48px))",
          background: "#fff", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 14,
        }}>
          {open === "menu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={btn(false)} onClick={() => setOpen("slots")}>候補日を送る</button>
              <button type="button" style={btn(false)} onClick={() => setOpen("link")}>日程調整リンクを送る</button>
            </div>
          )}

          {open === "slots" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 800 }}>候補日を送る</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>日本時間・{MEETING_SLOT_STEP_MINUTES}分単位・{MAX_MEETING_SLOTS}つまで。相手が1つ選ぶと決まります。</div>
              {slots.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="datetime-local" step={MEETING_SLOT_STEP_MINUTES * 60} value={v} aria-label={`候補${i + 1}`}
                    onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}
                    style={{ flex: 1, height: 36, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit", fontSize: 13 }} />
                  {slots.length > 1 && <button type="button" aria-label={`候補${i + 1}を外す`} onClick={() => setSlots(slots.filter((_, j) => j !== i))} style={btn(false)}>×</button>}
                </div>
              ))}
              {slots.length < MAX_MEETING_SLOTS && <button type="button" style={{ ...btn(false), alignSelf: "flex-start" }} onClick={() => setSlots([...slots, ""])}>＋ 候補を足す</button>}
              <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", gap: 12 }}>
                <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>形式</legend>
                {(Object.keys(MEETING_FORMATS) as MeetingFormat[]).map((f) => (
                  <label key={f} style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="radio" checked={format === f} onChange={() => setFormat(f)} />{MEETING_FORMATS[f]}</label>
                ))}
              </fieldset>
              <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", gap: 12 }}>
                <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>時間</legend>
                {MEETING_DURATIONS.map((d) => (
                  <label key={d} style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="radio" checked={duration === d} onChange={() => setDuration(d)} />{d}分</label>
                ))}
              </fieldset>
              {admins.filter((a) => a.id !== myUserId).length > 0 && (
                <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>同席する人</legend>
                  {admins.filter((a) => a.id !== myUserId).map((a) => (
                    <label key={a.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input type="checkbox" checked={attendees.includes(a.id)} onChange={() => setAttendees(attendees.includes(a.id) ? attendees.filter((x) => x !== a.id) : [...attendees, a.id])} />{a.name}
                    </label>
                  ))}
                </fieldset>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" style={btn(false)} onClick={() => setOpen("menu")}>戻る</button>
                <button type="button" style={btn(true)} disabled={busy || !slots.some((s) => s)} onClick={() => void sendSlots()}>{busy ? "送信中…" : "候補日を送る"}</button>
              </div>
            </div>
          )}

          {open === "link" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 800 }}>日程調整リンクを送る</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>あなたの日程調整ツールの URL（https）。担当者ごとに1つ登録できます。</div>
              <input type="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} aria-label="日程調整リンク"
                style={{ height: 36, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit", fontSize: 13 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" style={btn(false)} onClick={() => setOpen("menu")}>戻る</button>
                <button type="button" style={btn(false)} disabled={busy || url.trim() === (savedUrl ?? "")} onClick={() => void saveUrl()}>登録する</button>
                <button type="button" style={btn(true)} disabled={busy || !savedUrl || url.trim() !== savedUrl} onClick={() => void sendLink()}>リンクを送る</button>
              </div>
            </div>
          )}

          {error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

/** ★「面談日が決まったら記録する」（日程調整リンクを送った会話で出す）。確定と同じ扱い */
export function RecordMeetingButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [format, setFormat] = useState<MeetingFormat>("online");
  const [duration, setDuration] = useState<MeetingDuration>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/biz/conversations/${conversationId}/meetings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: `${when}:00+09:00`, format, duration }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "記録できませんでした");
      setOpen(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "記録できませんでした"); } finally { setBusy(false); }
  };
  return (
    <div data-state="record-meeting">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--royal-100)", background: "#fff", color: "var(--royal)", cursor: "pointer" }}>
          面談日が決まったら記録する
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
          <input type="datetime-local" step={MEETING_SLOT_STEP_MINUTES * 60} value={when} onChange={(e) => setWhen(e.target.value)} aria-label="面談の日時（日本時間）"
            style={{ height: 34, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit" }} />
          <select value={format} onChange={(e) => setFormat(e.target.value as MeetingFormat)} aria-label="形式" style={{ height: 34, borderRadius: 8, border: "1px solid var(--line)" }}>
            {(Object.keys(MEETING_FORMATS) as MeetingFormat[]).map((f) => <option key={f} value={f}>{MEETING_FORMATS[f]}</option>)}
          </select>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as MeetingDuration)} aria-label="時間" style={{ height: 34, borderRadius: 8, border: "1px solid var(--line)" }}>
            {MEETING_DURATIONS.map((d) => <option key={d} value={d}>{d}分</option>)}
          </select>
          <button type="button" disabled={busy || !when} onClick={() => void save()} style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", cursor: "pointer" }}>{busy ? "記録中…" : "記録する"}</button>
          <button type="button" onClick={() => setOpen(false)} style={{ fontSize: 12.5, fontFamily: "inherit", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}>やめる</button>
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 6 }}>{error}</div>}
    </div>
  );
}

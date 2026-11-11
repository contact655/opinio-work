"use client";

import { useEffect, useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { CONSULTANTS_TITLE, ROUTE_HOST_MESSAGE_MAX, ROUTE_TALK_TAGS, type RouteTalkTag } from "@/lib/constants/careerRoutes";

type Setting = { listed: boolean; talkTags: RouteTalkTag[]; message: string | null; stopped: boolean; notShownReasons: string[] };

/**
 * ★相談可能なユーザーとして載せる（2026-11-12 / 柴さんの決定「誰でも」）。初期値はオフ。
 *   オンにすると、ホームの右の列と /people の左サイドバーに載る（ログインしている人に見える）。
 * ⚠️ 読み込みに失敗したら操作させない（オフに見せると、オンの人が誤って押し直す）。
 * ⚠️ 保存済みの値だけを「載っている」として見せる（押して失敗したら元に戻す）。
 * ⚠️ 「話を聞ける」「面談OK」の語は使わない。
 */
export default function ConsultantSettingSection() {
  const [saved, setSaved] = useState<Setting | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tags, setTags] = useState<RouteTalkTag[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobseeker/consultant-setting", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Setting) => { if (!alive) return; setSaved(d); setTags(d.talkTags); setMessage(d.message ?? ""); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  async function save(listed: boolean) {
    if (saving || !saved) return;
    setSaving(true); setError(null); setDone(null);
    try {
      const res = await fetch("/api/jobseeker/consultant-setting", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listed, talkTags: tags, message }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error((d && d.error) || "保存できませんでした。もう一度お試しください。");
      if (d && typeof d.listed === "boolean") setSaved(d as Setting);
      setDone(listed ? "載せました" : "保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  const toggleTag = (t: RouteTalkTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div id="consultant-setting">
      <FormSection title={CONSULTANTS_TITLE}
        desc="オンにすると、ホームとユーザー一覧に「相談にのれる人」として載ります。見えるのは OPINIO にログインしている人だけです。相談はメッセージで届き、受けるかどうかはあなたが決められます。いつでもオフにできます。">
        {loadError ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>設定を読み込めませんでした。時間をおいて開き直してください。</p>
        ) : !saved ? (
          <p data-state="consultant-setting-loading" style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div data-state={saved.listed ? "consultant-on" : "consultant-off"} style={{ fontSize: 14, fontWeight: 700, color: saved.listed ? "var(--royal)" : "var(--ink-soft)" }}>
              いま：{saved.listed ? "載っています" : "載っていません"}
            </div>
            {saved.stopped && (
              <p data-state="consultant-stopped" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>運営により掲載を止めています。オンにできません。</p>
            )}
            {!saved.stopped && saved.notShownReasons.length > 0 && (
              <p data-state="consultant-not-shown" style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                オンにしても、いまは載りません（{saved.notShownReasons.join("・")}）。
              </p>
            )}
            <div style={{ fontSize: 13 }}>話せること（任意）
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {ROUTE_TALK_TAGS.map((t) => {
                  const on = tags.includes(t.value);
                  return (
                    <button key={t.value} type="button" aria-pressed={on} onClick={() => toggleTag(t.value)}
                      style={{ minHeight: 36, padding: "4px 12px", borderRadius: 999, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                        border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`, background: on ? "var(--royal-50)" : "#fff",
                        color: on ? "var(--royal)" : "var(--ink-soft)", fontWeight: on ? 700 : 500 }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>ひとこと（任意・{message.length} / {ROUTE_HOST_MESSAGE_MAX}）
              <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={ROUTE_HOST_MESSAGE_MAX}
                placeholder="例: 人材業界の法人営業から外資SaaSに移りました。転職の進め方を一緒に考えます。"
                style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 16, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", width: "100%" }} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {saved.listed ? (
                <>
                  <button type="button" data-action="consultant-save" disabled={saving} onClick={() => void save(true)}
                    style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "none", background: "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                    内容を保存
                  </button>
                  <button type="button" data-action="consultant-off" disabled={saving} onClick={() => void save(false)}
                    style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "1.5px solid var(--line)", background: "#fff", color: "var(--ink)", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                    載せるのをやめる
                  </button>
                </>
              ) : (
                <button type="button" data-action="consultant-on" disabled={saving || saved.stopped} onClick={() => void save(true)}
                  style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "none", background: saved.stopped ? "var(--line)" : "var(--royal)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: saved.stopped ? "default" : "pointer" }}>
                  相談可能なユーザーとして載せる
                </button>
              )}
              {done && <span role="status" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>{done}</span>}
              {error && <span role="alert" style={{ fontSize: 13, color: "var(--error)", fontWeight: 600 }}>{error}</span>}
            </div>
          </div>
        )}
      </FormSection>
    </div>
  );
}

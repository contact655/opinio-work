"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROFILE_VISIBILITY_OPTIONS, type ProfileVisibility } from "@/lib/constants/profileVisibility";
import { FormSection } from "@/components/profile/editor/formKit";

/**
 * `/mypage/settings` の「公開範囲」と「ブロック中の企業」（2026-08-20 / B-2）。
 *
 * ── なぜここに置くか ───────────────────────────────────────────────────────
 * ⚠️ **公開範囲は「未ログインから見えるか」を決める唯一のスイッチ。** 消さない。
 *    隠すと「なぜ自分は誰にも見つからないのか」が本人に分からなくなる。
 * ⚠️ **ブロック中の企業を出す画面が、2026-08-17 以降どこにも無かった**
 *    （`SettingsTab` がタブごと外れたため）。`get_blocked_companies` は
 *    2026-08-20 に直したが、**見る場所が無いままだった**。ここが置き場。
 *
 * ⚠️ **同じ列を触る画面を2つにしない。** 公開範囲は `IntentCard`（右カラムの
 *    「転職の希望」）から外してある。戻さないこと。
 */

type Block = {
  id: string | null;
  company_id: string | null;
  company_name: string;
  block_reason: "experience" | "manual";
};

type Suggestion = { id: string; name: string };

export default function PrivacySettings({ initialVisibility }: { initialVisibility: ProfileVisibility }) {
  /* ★保存済みの値だけを見る（ルール⑦） */
  const [saved, setSaved] = useState<ProfileVisibility>(initialVisibility);
  const [visibility, setVisibility] = useState<ProfileVisibility>(initialVisibility);
  const [savingVis, setSavingVis] = useState(false);
  const [visError, setVisError] = useState<string | null>(null);
  const [visDone, setVisDone] = useState(false);

  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetch("/api/jobseeker/scout-settings");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { blocks?: Block[] };
      setBlocks(data.blocks ?? []);
      setBlocksError(null);
    } catch {
      /* ⚠️ 失敗を空リストにしない。「0件」と「取れなかった」を区別する
            （CLAUDE.md「★403 は『0件』として静かに素通りする」）。 */
      setBlocks(null);
      setBlocksError("ブロック中の企業を取得できませんでした。");
    }
  }, []);

  useEffect(() => { void loadBlocks(); }, [loadBlocks]);

  async function saveVisibility() {
    if (savingVis || visibility === saved) return;
    setSavingVis(true); setVisError(null); setVisDone(false);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) throw new Error();
      setSaved(visibility);
      setVisDone(true);
      setTimeout(() => setVisDone(false), 2000);
    } catch {
      setVisError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSavingVis(false);
    }
  }

  function onQueryChange(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    if (v.trim().length < 2) { setSuggestions([]); return; }
    qTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(v.trim())}&limit=8`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(data.results ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  async function addBlock(c: Suggestion) {
    setBusyCompanyId(c.id);
    try {
      const res = await fetch("/api/jobseeker/scout-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: c.id }),
      });
      if (!res.ok) throw new Error();
      setQ(""); setSuggestions([]);
      await loadBlocks();
    } catch {
      setBlocksError("追加できませんでした。");
    } finally {
      setBusyCompanyId(null);
    }
  }

  async function removeBlock(b: Block) {
    if (!b.id) return;
    setBusyCompanyId(b.company_id);
    try {
      const res = await fetch(`/api/jobseeker/scout-settings?id=${b.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadBlocks();
    } catch {
      setBlocksError("解除できませんでした。");
    } finally {
      setBusyCompanyId(null);
    }
  }

  const alreadyBlocked = new Set((blocks ?? []).map((b) => b.company_id));

  return (
    <>
      {/* ── 公開範囲 ───────────────────────────────────────────────────── */}
      <FormSection title="公開範囲">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PROFILE_VISIBILITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                border: `1.5px solid ${visibility === o.value ? "var(--royal)" : "var(--line)"}`,
                background: visibility === o.value ? "var(--royal-50)" : "#fff",
                borderRadius: 10, padding: "12px 14px",
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility === o.value}
                onChange={() => setVisibility(o.value)}
                style={{ marginTop: 2, accentColor: "var(--royal)" }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.label}</span>
                {/* ⚠️ `desc` は**同意の範囲そのもの**。ここで言い換えない
                       （lib/constants/profileVisibility.ts のコメント参照）。 */}
                <span style={{ display: "block", fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)", marginTop: 3 }}>
                  {o.desc}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void saveVisibility()}
            disabled={savingVis || visibility === saved}
            className="tap-min-h"
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              border: "none", cursor: visibility === saved ? "default" : "pointer",
              background: visibility === saved ? "var(--line)" : "var(--royal)",
              color: visibility === saved ? "var(--ink-mute)" : "#fff",
            }}
          >
            {savingVis ? "保存中…" : "保存する"}
          </button>
          {visDone && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)" }}>保存しました</span>}
          {visError && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{visError}</span>}
        </div>
      </FormSection>

      {/* ── ブロック中の企業 ───────────────────────────────────────────── */}
      <FormSection title="ブロック中の企業">
        <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          ここに入っている企業からは声がかかりません。
          <br />
          <strong style={{ color: "var(--ink)" }}>現在お勤めの会社は自動的に含まれます。</strong>
          職歴の「現職」から判定しているので、ここで外すことはできません。
        </p>

        {blocksError && (
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{blocksError}</p>
        )}

        {blocks === null ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>
        ) : blocks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {blocks.map((b) => (
              <div
                key={`${b.company_id}-${b.block_reason}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0, flex: 1 }}>
                  {b.company_name}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, whiteSpace: "nowrap",
                    background: b.block_reason === "experience" ? "var(--royal-50)" : "var(--line-soft)",
                    color: b.block_reason === "experience" ? "var(--royal)" : "var(--ink-soft)",
                  }}
                >
                  {b.block_reason === "experience" ? "現職（自動）" : "自分で追加"}
                </span>
                {/* ⚠️ **在籍由来の行に解除ボタンを出さない。**
                       `can_send_scout()` は在籍を無条件で弾くので、ここで消せるようにしても
                       **消えたように見えるだけで結果は変わらない**（届かないまま）。
                       「解除したのに届かない」を作らないため、最初から出さない。 */}
                {b.block_reason === "manual" && b.id && (
                  <button
                    type="button"
                    onClick={() => void removeBlock(b)}
                    disabled={busyCompanyId === b.company_id}
                    className="tap-min-h"
                    style={{
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", color: "var(--ink-soft)",
                      background: "none", border: "1px solid var(--line)", borderRadius: 8,
                      padding: "5px 10px", cursor: "pointer",
                    }}
                  >
                    解除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>
            企業を追加する
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="企業名で検索（2文字以上）"
            style={{
              width: "100%", height: 40, padding: "0 12px", borderRadius: 10,
              border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((c) => {
                const already = alreadyBlocked.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { if (!already) void addBlock(c); }}
                    disabled={already || busyCompanyId === c.id}
                    className="tap-min-h"
                    style={{
                      textAlign: "left", fontSize: 13, fontFamily: "inherit",
                      border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px",
                      background: already ? "var(--line-soft)" : "#fff",
                      color: already ? "var(--ink-mute)" : "var(--ink)",
                      cursor: already ? "default" : "pointer",
                    }}
                  >
                    {c.name}{already && "（追加済み）"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </FormSection>
    </>
  );
}

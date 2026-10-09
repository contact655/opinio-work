"use client";

import { useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { useCompanyLookup } from "@/components/companies/useCompanyLookup";
import { APPROACH_RANGE_EXCLUDED_NOTE, MAX_APPROACH_BLOCKED_COMPANIES } from "@/lib/constants/approachRange";
import { PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";
import type { ApproachBlockedCompany, ApproachRange, ApproachRangeOptions } from "@/lib/approaches/range";

/**
 * ★`/mypage/settings` の「声かけを受け取る範囲」（2026-10-10 / 声かけまわり 段2）。
 *
 * ⚠️ 空の項目は「こだわらない」。選んだ項目の情報が企業に登録されていないと、その企業からは届かない
 *    （判定は DB 関数 `can_send_company_approach()`。画面では組み立てない）。
 * ⚠️ 「この範囲で声かけを送れる企業：N社」は**保存済みの範囲**で数える。選び直したあとは「保存すると更新されます」。
 * ⚠️ 「受け取らない企業」は「ブロック中の企業」（候補者検索にも出なくなる）とは別。こちらは声かけだけを止める。
 */
const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: "inherit", padding: "6px 12px", borderRadius: 100,
  border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`,
  background: on ? "var(--royal-50)" : "#fff", color: on ? "var(--royal)" : "var(--ink-soft)", cursor: "pointer",
});
const groupLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", margin: "14px 0 6px" };

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const same = (a: ApproachRange, b: ApproachRange) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = (r: ApproachRange) => ({
  j: [...r.jobCategories].sort(), i: [...r.industries].sort(), s: [...r.sizeGroups].sort(), p: [...r.prefectures].sort(), r: r.remoteOk,
});

export function ApproachRangeSection({
  options, initialRange, initialBlocks, initialCount,
}: {
  options: ApproachRangeOptions;
  initialRange: ApproachRange;
  initialBlocks: ApproachBlockedCompany[];
  initialCount: number | null;
}) {
  const [saved, setSaved] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const [count, setCount] = useState<number | null>(initialCount);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState(initialBlocks);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const { results: suggestions, search, clear } = useCompanyLookup({ debounceMs: 250 });

  const dirty = !same(range, saved);
  const set = (patch: (r: ApproachRange) => Partial<ApproachRange>) => { setRange((r) => ({ ...r, ...patch(r) })); setDone(false); };

  const save = async () => {
    setSaving(true); setError(null); setDone(false);
    try {
      const res = await fetch("/api/jobseeker/approach-range", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(range),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "保存できませんでした");
      setSaved(json.range); setRange(json.range); setCount(json.count ?? null); setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  const changeBlock = async (method: "POST" | "DELETE", companyId: string) => {
    setBusy(companyId); setBlockError(null);
    try {
      const res = await fetch(
        method === "POST" ? "/api/jobseeker/approach-range/blocks" : `/api/jobseeker/approach-range/blocks?companyId=${companyId}`,
        { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ companyId }) : undefined },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? (method === "POST" ? "追加できませんでした" : "解除できませんでした"));
      setBlocks(json.blocks ?? []); setCount(json.count ?? null);
      if (method === "POST") { setQ(""); clear(); }
    } catch (e) {
      setBlockError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(null);
    }
  };

  const blockedIds = new Set(blocks.map((b) => b.companyId));
  const prefSet = new Set(range.prefectures);

  return (
    <FormSection title="声かけを受け取る範囲">
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        選んだ条件に合う企業からだけ、声かけが届きます。何も選んでいない項目は「こだわらない」として扱います。
        選んだ項目の情報が企業側に登録されていない場合、その企業からは届きません。
      </p>

      <span style={groupLabel}>職種（企業が募集している・登録している職種）</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.jobCategories.map((o) => (
          <button key={o.value} type="button" style={chip(range.jobCategories.includes(o.value))}
            aria-pressed={range.jobCategories.includes(o.value)}
            onClick={() => set((r) => ({ jobCategories: toggle(r.jobCategories, o.value) }))}>{o.label}</button>
        ))}
      </div>

      <span style={groupLabel}>業種</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.industries.map((o) => (
          <button key={o.value} type="button" style={chip(range.industries.includes(o.value))}
            aria-pressed={range.industries.includes(o.value)}
            onClick={() => set((r) => ({ industries: toggle(r.industries, o.value) }))}>{o.label}</button>
        ))}
      </div>

      <span style={groupLabel}>会社規模</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.sizeGroups.map((o) => (
          <button key={o.value} type="button" style={chip(range.sizeGroups.includes(o.value))}
            aria-pressed={range.sizeGroups.includes(o.value)}
            onClick={() => set((r) => ({ sizeGroups: toggle(r.sizeGroups, o.value) }))}>{o.label}</button>
        ))}
      </div>

      <span style={groupLabel}>勤務地（本社または拠点がある都道府県）</span>
      <select
        value=""
        onChange={(e) => { if (e.target.value) { const v = e.target.value; set((r) => ({ prefectures: [...r.prefectures, v] })); } }}
        style={{ height: 38, padding: "0 10px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", background: "#fff", maxWidth: "100%" }}
      >
        <option value="">都道府県を追加…</option>
        {PREFECTURE_FILTER_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.prefectures.map((p) => <option key={`${g.group}-${p}`} value={p} disabled={prefSet.has(p)}>{p}</option>)}
          </optgroup>
        ))}
      </select>
      {range.prefectures.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {range.prefectures.map((p) => (
            <button key={p} type="button" style={chip(true)} aria-label={`${p}を外す`}
              onClick={() => set((r) => ({ prefectures: r.prefectures.filter((x) => x !== p) }))}>{p} ×</button>
          ))}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
        <input type="checkbox" checked={range.remoteOk} onChange={(e) => { const v = e.target.checked; set(() => ({ remoteOk: v })); }} style={{ accentColor: "var(--royal)" }} />
        リモートワークができる企業だけにする
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button" onClick={() => void save()} disabled={saving || !dirty} className="tap-min-h"
          style={{
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit", border: "none",
            cursor: dirty ? "pointer" : "default", background: dirty ? "var(--royal)" : "var(--line)", color: dirty ? "#fff" : "var(--ink-mute)",
          }}
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        {done && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)" }}>保存しました</span>}
        {error && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</span>}
      </div>

      <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "var(--line-soft)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }} data-testid="approach-range-count">
          この範囲で声かけを送れる企業：{count == null ? "—" : `${count}社`}
        </div>
        {dirty && <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>保存すると更新されます。</div>}
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)", marginTop: 4 }}>{APPROACH_RANGE_EXCLUDED_NOTE}。</div>
      </div>

      <span style={{ ...groupLabel, marginTop: 20 }}>声かけを受け取らない企業</span>
      <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
        ここに入れた企業からは声かけが届きません。届いている承認待ちの声かけも表示されなくなります。
        企業の候補者検索に出なくしたいときは、上の「ブロック中の企業」を使ってください。
      </p>
      {blockError && <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{blockError}</p>}
      {blocks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {blocks.map((b) => (
            <div key={b.companyId} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{b.name}</span>
              <button type="button" disabled={busy === b.companyId} className="tap-min-h" onClick={() => void changeBlock("DELETE", b.companyId)}
                style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", color: "var(--ink-soft)", background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                解除
              </button>
            </div>
          ))}
        </div>
      )}
      {blocks.length < MAX_APPROACH_BLOCKED_COMPANIES && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text" value={q} placeholder="企業名で検索（2文字以上）"
            onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) clear(); else search(e.target.value); }}
            style={{ width: "100%", height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--ink)" }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((c) => {
                const already = blockedIds.has(c.id);
                return (
                  <button key={c.id} type="button" disabled={already || busy === c.id} className="tap-min-h"
                    onClick={() => { if (!already) void changeBlock("POST", c.id); }}
                    style={{
                      textAlign: "left", fontSize: 13, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px",
                      background: already ? "var(--line-soft)" : "#fff", color: already ? "var(--ink-mute)" : "var(--ink)", cursor: already ? "default" : "pointer",
                    }}>
                    {c.name}{already && "（追加済み）"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </FormSection>
  );
}

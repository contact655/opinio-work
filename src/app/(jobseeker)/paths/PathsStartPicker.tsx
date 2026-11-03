"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Option = { slug: string; name: string };

/**
 * ★「行き先」の起点を選ぶ欄（2026-11-04）。職種・業界・会社。組み合わせは2つまで（職種×業界・職種×会社）。
 * ⚠️ 会社を選んだら業界は外す（会社が業界を決めるので）。業界の欄は会社を選んでいる間は使えない。
 * ⚠️ 起点は URL だけが持つ（画面の state に持たない）。選ぶと /paths?… へ移る。
 * ⚠️ 本人の直近の職歴から自動で入れたときは、その起点を URL にも書く（共有・戻るで同じ起点になるように）。
 */
export default function PathsStartPicker({
  options, selected, autoStartLabel,
}: {
  options: { roles: Option[]; industries: Option[]; companies: Option[] };
  selected: { role: string | null; industry: string | null; company: string | null };
  autoStartLabel: string | null;
}) {
  const router = useRouter();

  const hrefOf = (next: { role: string | null; industry: string | null; company: string | null }) => {
    const q = new URLSearchParams();
    if (next.role) q.set("role", next.role);
    if (next.company) q.set("company", next.company);
    else if (next.industry) q.set("industry", next.industry);
    const s = q.toString();
    return s ? `/paths?${s}` : "/paths";
  };

  useEffect(() => {
    /* ⚠️ /paths の画面にいるときだけ書く（/dev/preview に同じ部品を並べると、その URL を書き換えてしまうため） */
    if (autoStartLabel && window.location.pathname === "/paths") window.history.replaceState(null, "", hrefOf(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartLabel]);

  const go = (next: typeof selected) => router.push(hrefOf(next), { scroll: false });

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 14, color: "var(--ink)",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 };

  return (
    <div data-state="paths-picker">
      {autoStartLabel && (
        <p data-state="paths-auto-start" style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink-soft)" }}>
          あなたの直近の職歴から：<strong style={{ color: "var(--ink)" }}>{autoStartLabel}</strong>
        </p>
      )}
      <div className="paths-picker-grid" style={{ display: "grid", gap: 12 }}>
        <label>
          <span style={labelStyle}>職種</span>
          <select aria-label="職種" value={selected.role ?? ""} onChange={(e) => go({ ...selected, role: e.target.value || null })} style={selectStyle}>
            <option value="">指定しない</option>
            {options.roles.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
        <label>
          <span style={labelStyle}>業界</span>
          <select aria-label="業界" value={selected.industry ?? ""} disabled={!!selected.company}
            onChange={(e) => go({ ...selected, industry: e.target.value || null })} style={{ ...selectStyle, opacity: selected.company ? 0.5 : 1 }}>
            <option value="">指定しない</option>
            {options.industries.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
        <label>
          <span style={labelStyle}>会社</span>
          <select aria-label="会社" value={selected.company ?? ""} onChange={(e) => go({ ...selected, company: e.target.value || null, industry: e.target.value ? null : selected.industry })} style={selectStyle}>
            <option value="">指定しない</option>
            {options.companies.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        </label>
      </div>
      {selected.company && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>会社を選んでいるあいだは、業界はその会社の業界になります。</p>
      )}
      <style>{`
        @media (min-width: 768px) { .paths-picker-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      `}</style>
    </div>
  );
}

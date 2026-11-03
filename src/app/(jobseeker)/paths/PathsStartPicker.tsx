"use client";

import { useRouter } from "next/navigation";
import type { PathsOption } from "@/lib/paths/server";
import { pathsHref } from "@/lib/people/prevCareer";

/**
 * ★未ログイン向けの /paths の起点を選ぶ欄（2026-11-03 に戻した）。職種・業界・会社。
 * ⚠️ 会社を選んだら業界は外す（会社が業界を決める）。業界の欄は会社を選んでいる間は使えない。
 * ⚠️ 値は URL（?role= / ?industry= / ?company=）だけが持つ。ログイン中の人は middleware が /people の「前の経歴」へ送る。
 */
export default function PathsStartPicker({ options, selected }: {
  options: { roles: PathsOption[]; industries: PathsOption[]; companies: PathsOption[] };
  selected: { role: string | null; industry: string | null; company: string | null };
}) {
  const router = useRouter();
  const go = (next: typeof selected) => {
    const opt = (list: PathsOption[], slug: string | null) => (slug ? list.find((o) => o.slug === slug) ?? null : null);
    router.push(pathsHref({ role: opt(options.roles, next.role), industry: opt(options.industries, next.industry), company: opt(options.companies, next.company) }), { scroll: false });
  };

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", fontSize: 14, color: "var(--ink)",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 };

  return (
    <div data-state="paths-picker">
      <div className="paths-picker-grid">
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
        .paths-picker-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 768px) { .paths-picker-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      `}</style>
    </div>
  );
}

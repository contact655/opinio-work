"use client";

import { useEffect, useRef, useState } from "react";
import { flattenTree } from "@/lib/business/orgTree";
import type { Department } from "./DepartmentsEditor";

/**
 * ★職種の「所属する部門」（2026-09-22 / 柴さんの指示）。職種タブの各行の下に出す。
 *
 * ・任意の多対多。付けなくてよいし、複数付けてよい
 * ・チェックを付け外しした時点で保存する（PUT /api/biz/job-roles/[id]/departments）
 * ⚠️ 失敗したら画面の選択を元に戻し、理由を出す（保存できていないのに付いて見える状態を作らない）
 * ⚠️ 閲覧だけの人には、付いている部門を出すだけ（0件なら何も出さない）
 */
export function RoleDepartmentsField({
  roleId, departments, initial, readOnly,
}: {
  roleId: string;
  departments: Department[];
  initial: string[];
  readOnly: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  /* ⚠️ 並びは部門タブと同じ（木の順）。選んだ順にしない */
  const ordered = flattenTree(departments);
  const chips = ordered.filter(({ node }) => selected.includes(node.id)).map(({ node }) => node);

  async function save(next: string[]) {
    const prev = selected;
    setSelected(next);
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/biz/job-roles/${roleId}/departments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentIds: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSelected(prev);
        /* ⚠️ 401 は API が英語（"Unauthorized"）で返すので、ここで言い換える */
        setError(res.status === 401 ? "ログインが切れています。ページを読み込み直してください" : (j.error ?? "保存できませんでした"));
      }
    } catch {
      setSelected(prev);
      setError("通信エラーで保存できませんでした");
    } finally {
      setPending(false);
    }
  }

  if (readOnly && chips.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>所属する部門</span>
      {chips.map((d) => (
        <span key={d.id} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
          background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 999,
          padding: readOnly ? "2px 10px" : "2px 4px 2px 10px",
        }}>
          {d.name}
          {!readOnly && (
            <button type="button" disabled={pending} onClick={() => save(selected.filter((x) => x !== d.id))}
              aria-label={`${d.name} を外す`} className="btn-fixed-size"
              style={{ width: 18, height: 18, border: "none", background: "none", color: "var(--ink-mute)", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }}>
              ✕
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        departments.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>（部門タブで部門を登録すると選べます）</span>
        ) : (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={pending}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", background: "none", border: "1px dashed var(--royal-100)", borderRadius: 999, padding: "2px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            {chips.length === 0 ? "＋ 部門を選ぶ" : "＋ 変更"}
          </button>
        )
      )}
      {error && <span role="alert" style={{ fontSize: 12, color: "var(--error-ink)" }}>{error}</span>}

      {open && !readOnly && (
        <div role="dialog" aria-label="所属する部門を選ぶ" style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
          width: 280, maxWidth: "calc(100vw - 48px)", maxHeight: 300, overflowY: "auto",
          background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(15,23,42,0.12)", padding: 6,
        }}>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", padding: "4px 8px 6px" }}>いくつでも選べます</div>
          {ordered.map(({ node, depth }) => {
            const checked = selected.includes(node.id);
            return (
              <label key={node.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6,
                paddingLeft: 8 + (depth - 1) * 16, cursor: pending ? "default" : "pointer", fontSize: 13, color: "var(--ink)",
              }}>
                <input type="checkbox" checked={checked} disabled={pending}
                  onChange={() => save(checked ? selected.filter((x) => x !== node.id) : [...selected, node.id])}
                  style={{ accentColor: "var(--royal)" }} />
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{node.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

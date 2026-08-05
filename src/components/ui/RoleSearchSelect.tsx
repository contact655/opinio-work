"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * 職種の検索セレクト。
 *
 * ── なぜ作ったか（2026-08-06）──────────────────────────────────────────────
 * 職種マスタは105件あるのに、入力UIが親→子の2段 <select> しかなく、
 * 求人20件が大分類11件と孫7件に偏り、**中間の子職種が1件も使われていなかった**。
 * 105件から目視で探させるUIが機能していない。検索で選べるようにする。
 *
 * ⚠️ 検索語が空のときは全件を大分類ごとにグループ化して出すこと。
 *    何と検索していいか分からない人がブラウズできる必要があり、
 *    ここが2段セレクトの代替になっている。空のとき何も出さないと後退する。
 *
 * ⚠️ 別名（ow_role_aliases）も検索対象にする。「法人営業」で
 *    フィールドセールスに当たらないと、標準職種の名前を知らない人が辿り着けない。
 *    どの別名で当たったかを候補行に出す（当たった理由が見えないと不安になる）。
 *
 * ⚠️ 候補の配列は「絞り込み済み＋現在選択中の職種を足し戻し済み」のものを渡すこと。
 *    この部品は渡された配列をそのまま出すだけで、is_active / is_it_saas を見ない。
 *    足し戻しを呼び出し側が落とすと、統合・無効化のたびに保存時に職種が失われる。
 */

export type RoleOption = {
  id: string;
  name: string;
  parent_id: string | null;
};

type Row =
  /** グループ見出し。selectable=false のとき、クリックできない */
  | { kind: "header"; id: string; label: string; selectable: false }
  /** 選択できる行 */
  | { kind: "item"; id: string; label: string; parentName: string | null; matchedAlias: string | null; selectable: true };

export function RoleSearchSelect({
  roles,
  aliases,
  value,
  onSelect,
  selectableParent,
  placeholder = "職種名で検索（例: 法人営業、AE）",
  disabled = false,
  ariaLabel,
  /** 選択後に入力を空に戻す。複数選択のフォームで使う */
  clearOnSelect = false,
}: {
  roles: RoleOption[];
  aliases?: Record<string, string[]>;
  value: string;
  onSelect: (roleId: string) => void;
  /** 子を持つ大分類を選べるか。求人フォームは false（2段セレクト時代の制約を維持） */
  selectableParent: boolean;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  clearOnSelect?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // aria-controls は listbox の id を指す。id はフォーム内で一意にする必要があるので
  // ariaLabel から作る（同一フォームに職種欄は1つずつしか無い）
  const listId = `role-listbox-${ariaLabel}`;
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const roots = useMemo(() => roles.filter((r) => !r.parent_id), [roles]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, RoleOption[]>();
    for (const r of roles) {
      if (!r.parent_id) continue;
      if (!m.has(r.parent_id)) m.set(r.parent_id, []);
      m.get(r.parent_id)!.push(r);
    }
    return m;
  }, [roles]);

  const selected = value ? byId.get(value) ?? null : null;
  const selectedLabel = selected
    ? selected.parent_id
      ? `${byId.get(selected.parent_id)?.name ?? "—"} > ${selected.name}`
      : selected.name
    : "";

  // ── 外側クリックで閉じる ────────────────────────────────────────────────
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /** name か別名に部分一致するか。当たった別名を返す */
  function match(r: RoleOption, q: string): { hit: boolean; alias: string | null } {
    const needle = q.trim().toLowerCase();
    if (!needle) return { hit: true, alias: null };
    if (r.name.toLowerCase().includes(needle)) return { hit: true, alias: null };
    const hitAlias = (aliases?.[r.id] ?? []).find((a) => a.toLowerCase().includes(needle));
    return { hit: !!hitAlias, alias: hitAlias ?? null };
  }

  const rows: Row[] = useMemo(() => {
    const q = query.trim();
    const out: Row[] = [];

    for (const root of roots) {
      const kids = childrenOf.get(root.id) ?? [];
      const rootMatch = match(root, q);
      const hitKids = kids.map((k) => ({ k, m: match(k, q) })).filter((x) => x.m.hit);

      // 子を持たない大分類（非IT7件など）は、それ自体が1つの選択肢
      if (kids.length === 0) {
        if (rootMatch.hit) {
          out.push({ kind: "item", id: root.id, label: root.name, parentName: null, matchedAlias: rootMatch.alias, selectable: true });
        }
        continue;
      }

      // 子を持つ大分類。自分も子もヒットしなければ丸ごと出さない
      if (!rootMatch.hit && hitKids.length === 0) continue;

      if (selectableParent) {
        // 大分類そのものも選べる（職歴側）。過去の非IT職は「営業」で十分なケースがある
        out.push({ kind: "item", id: root.id, label: root.name, parentName: null, matchedAlias: rootMatch.alias, selectable: true });
      } else {
        // 求人側は大分類を選ばせない。見出しとしてだけ出す
        out.push({ kind: "header", id: `h-${root.id}`, label: root.name, selectable: false });
      }

      // 大分類自体がヒットしたときは配下を全部出す（絞り込みで子が消えると選べなくなる）
      const shown = rootMatch.alias === null && rootMatch.hit && q ? kids.map((k) => ({ k, m: match(k, q) })) : hitKids;
      for (const { k, m } of (q ? shown : kids.map((k) => ({ k, m: { hit: true, alias: null } })))) {
        out.push({ kind: "item", id: k.id, label: k.name, parentName: root.name, matchedAlias: m.alias, selectable: true });
      }
    }
    return out;
  }, [roots, childrenOf, query, selectableParent, aliases]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectableRows = useMemo(() => rows.filter((r) => r.selectable), [rows]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function commit(id: string) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); setQuery(""); return; }
    if (!open) { if (e.key === "ArrowDown") setOpen(true); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, selectableRows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = selectableRows[activeIndex];
      if (row) commit(row.id);
    }
  }

  // 選択中の行が見えるようにスクロール
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-active="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const inputValue = open ? query : (clearOnSelect ? "" : selectedLabel);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        autoComplete="off"
        value={inputValue}
        disabled={disabled}
        placeholder={selectedLabel && !clearOnSelect ? selectedLabel : placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        // ⚠️ onClick も要る。フォーカス済みの入力を押し直したときに再度開くため。
        //    onFocus だけだと、一度閉じたあと同じ欄をクリックしても開かない。
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", height: 40, padding: "0 12px",
          border: `1.5px solid ${open ? "var(--royal)" : "var(--line)"}`,
          borderRadius: 8, fontSize: 14, fontFamily: "inherit",
          color: "var(--ink)", background: disabled ? "var(--bg-tint)" : "#fff",
          outline: "none",
        }}
      />

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40,
            maxHeight: 320, overflowY: "auto",
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(14,33,72,.14)",
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: "14px 14px", fontSize: 13, color: "var(--ink-mute)" }}>
              該当する職種がありません
            </div>
          ) : (
            rows.map((row) => {
              if (row.kind === "header") {
                return (
                  <div key={row.id} style={{
                    padding: "7px 12px 4px", fontSize: 11, fontWeight: 700,
                    color: "var(--ink-mute)", letterSpacing: "0.04em",
                    background: "var(--bg-tint)", borderTop: "1px solid var(--line-soft)",
                  }}>
                    {row.label}
                  </div>
                );
              }
              const idx = selectableRows.findIndex((r) => r.id === row.id);
              const active = idx === activeIndex;
              const isSelected = row.id === value;
              return (
                <button
                  key={row.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={active ? "true" : undefined}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(row.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: row.parentName ? "8px 12px 8px 22px" : "8px 12px",
                    border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
                    background: active ? "var(--royal-50)" : "#fff",
                    color: isSelected ? "var(--royal)" : "var(--ink)",
                    fontWeight: isSelected ? 700 : 400,
                  }}
                >
                  {row.parentName && (
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", marginRight: 6 }}>
                      {row.parentName} ›
                    </span>
                  )}
                  {row.label}
                  {row.matchedAlias && (
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 6 }}>
                      （{row.matchedAlias} でヒット）
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

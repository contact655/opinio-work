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
 * ── ★2段セレクトを併設した（2026-08-26 / 柴さんの指示）────────────────────
 * 検索欄の下に「大分類 → 小分類」の2つの <select> を並べる。**検索は残す。**
 *   名前を知っている人 … 検索で一発（「法人営業」→ フィールドセールス）
 *   名前を知らない人   … 大分類18件から辿る（1階層あたり最大14件）
 *
 * ⚠️ **検索欄を消して2段セレクトだけに戻さないこと。** 2026-08-06 まで2段 select
 *    だけだったが、当時「求人20件が大分類11件と孫7件に偏り、**中間の子職種が
 *    1件も使われていなかった**」。2段だけに戻すとこれが再発する。
 *
 * ⚠️ 2段セレクトは **`clearOnSelect` が false のときだけ出す**（＝1つの値を持つ欄）。
 *    `clearOnSelect` は「選んだら一覧に足して入力を空に戻す」追加用の使い方で、
 *    そこに2段セレクトを置くと「選んだ瞬間に追加される」のか
 *    「大分類を選んでから小分類を選ぶ」のかが決まらない（追加ボタンが要る）。
 *    追加用（求人の職種・希望職種）は検索のままにしてある。
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
  | { kind: "item"; id: string; label: string; parentName: string | null; matchedAlias: string | null; selectable: true }
  /* ★開閉できる大分類（2026-08-25 / 柴さんの指示）。**検索欄が空のときだけ出る。**
        ⚠️ それまでは空のときに大分類17件＋子126件を**全部フラットに**出しており、
           「事業開発」の子6件を抜けないと「営業」に届かなかった。
        ⚠️ `selectable` は `selectableParent` に従う。求人側（false）は
           大分類を選べないので、行そのものが開閉ボタンとして働く。 */
  | { kind: "group"; id: string; label: string; childCount: number; expanded: boolean; selectable: boolean };

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
  /** 開いている大分類の id。⚠️ 検索を打ったら意味が無くなるので畳む */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /* 2段セレクトで「大分類だけ選んだ」状態を覚える。
     ⚠️ `value` からは復元できない。小分類が未選択のとき `value` は
        大分類の id か空で、どちらも「大分類を選んだ直後」と区別できないため。 */
  const [pickedParentId, setPickedParentId] = useState<string | null>(null);
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

      /* ★検索欄が空のときは**大分類だけ**を並べる（2026-08-25 / 柴さんの指示）。
            子は開いたときにだけ出す。⚠️ ここで子まで出すと143行の一覧に戻る。 */
      if (!q) {
        const isOpen = expanded.has(root.id);
        out.push({
          kind: "group", id: root.id, label: root.name,
          childCount: kids.length, expanded: isOpen,
          /* 大分類そのものも選べる（職歴側）。過去の非IT職は「営業」で十分なケースがある。
             求人側は選ばせないので、行は開閉だけを担う。 */
          selectable: selectableParent,
        });
        if (isOpen) {
          for (const k of kids) {
            out.push({ kind: "item", id: k.id, label: k.name, parentName: root.name, matchedAlias: null, selectable: true });
          }
        }
        continue;
      }

      // 子を持つ大分類。自分も子もヒットしなければ丸ごと出さない
      if (!rootMatch.hit && hitKids.length === 0) continue;

      if (selectableParent) {
        out.push({ kind: "item", id: root.id, label: root.name, parentName: null, matchedAlias: rootMatch.alias, selectable: true });
      } else {
        // 求人側は大分類を選ばせない。見出しとしてだけ出す
        out.push({ kind: "header", id: `h-${root.id}`, label: root.name, selectable: false });
      }

      // 大分類自体がヒットしたときは配下を全部出す（絞り込みで子が消えると選べなくなる）
      const shown = rootMatch.alias === null && rootMatch.hit ? kids.map((k) => ({ k, m: match(k, q) })) : hitKids;
      for (const { k, m } of shown) {
        out.push({ kind: "item", id: k.id, label: k.name, parentName: root.name, matchedAlias: m.alias, selectable: true });
      }
    }
    return out;
  }, [roots, childrenOf, query, selectableParent, aliases, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectableRows = useMemo(() => rows.filter((r) => r.selectable), [rows]);

  useEffect(() => { setActiveIndex(0); }, [query]);
  /* ⚠️ 検索中は大分類の開閉に意味が無い（ヒットした子が直接出る）ので畳む。
        畳まないと、検索を消したときに前回開いた大分類が開いたまま戻る。 */
  useEffect(() => { if (query.trim()) setExpanded(new Set()); }, [query]);

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

  /* 2段セレクトの現在値。
     ⚠️ **`value` を正として導く。** 検索で選んでも2段セレクトが追随する必要がある。
        `pickedParentId` は「大分類だけ選んで小分類がまだ」のときだけ効かせる。 */
  const twoStepParentId =
    selected ? (selected.parent_id ?? selected.id) : (pickedParentId ?? "");
  const twoStepChildren = twoStepParentId ? (childrenOf.get(twoStepParentId) ?? []) : [];

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
              /* ★大分類の行（検索欄が空のときだけ出る）。
                    ⚠️ ボタンを入れ子にしない。**横並びの兄弟**にする
                       （`<button>` の中に `<button>` は不正な HTML）。
                    ⚠️ 選べる側（職歴）は「左＝選ぶ / 右＝開く」に分ける。
                       選べない側（求人）は行ごと開閉ボタンにする。 */
              if (row.kind === "group") {
                const gIdx = selectableRows.findIndex((r) => r.id === row.id);
                const gActive = gIdx >= 0 && gIdx === activeIndex;
                const gSelected = row.id === value;
                const toggle = () => setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                  return next;
                });
                const chevron = (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                       style={{ transform: row.expanded ? "rotate(90deg)" : "none", transition: "transform 0.12s", flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                );
                return (
                  <div key={row.id} style={{
                    display: "flex", alignItems: "stretch",
                    background: gActive ? "var(--royal-50)" : "#fff",
                    borderTop: "1px solid var(--line-soft)",
                  }}>
                    <button
                      type="button"
                      role={row.selectable ? "option" : undefined}
                      aria-selected={row.selectable ? gSelected : undefined}
                      aria-expanded={row.selectable ? undefined : row.expanded}
                      data-active={gActive ? "true" : undefined}
                      onMouseEnter={() => { if (gIdx >= 0) setActiveIndex(gIdx); }}
                      onClick={() => { if (row.selectable) commit(row.id); else toggle(); }}
                      style={{
                        flex: 1, minWidth: 0, textAlign: "left",
                        padding: "9px 8px 9px 12px", border: "none", background: "none",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
                        color: gSelected ? "var(--royal)" : "var(--ink)",
                        fontWeight: gSelected ? 700 : 600,
                      }}
                    >
                      {row.label}
                      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6 }}>
                        {row.childCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={row.expanded}
                      aria-label={`${row.label}の職種を${row.expanded ? "閉じる" : "開く"}`}
                      className="btn-fixed-size"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 40, border: "none", background: "none", cursor: "pointer",
                        color: "var(--ink-mute)", padding: 0,
                      }}
                    >
                      {chevron}
                    </button>
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

      {/* ★大分類 → 小分類 の2段セレクト（検索の代わりではなく**併用**）
          ⚠️ `clearOnSelect`（追加用）のときは出さない。理由は冒頭のメモ。 */}
      {!clearOnSelect && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
              または一覧から選ぶ
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {/* 大分類 */}
            <select
              aria-label={`${ariaLabel}（大分類）`}
              disabled={disabled}
              value={twoStepParentId}
              onChange={(e) => {
                const pid = e.target.value;
                setPickedParentId(pid || null);
                setQuery("");
                setOpen(false);
                if (!pid) {
                  onSelect("");
                  return;
                }
                /* ⚠️ 大分類だけで確定してよいのは `selectableParent` のときだけ。
                      求人側（false）は小分類を選ぶまで確定させない。
                   ⚠️ 子が無い大分類は、選べる側なら即確定でよい。 */
                if (selectableParent) onSelect(pid);
                else onSelect("");
              }}
              style={selectStyle(disabled)}
            >
              <option value="">大分類を選ぶ</option>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {/* 小分類 */}
            <select
              aria-label={`${ariaLabel}（小分類）`}
              disabled={disabled || twoStepChildren.length === 0}
              value={selected?.parent_id ? selected.id : ""}
              onChange={(e) => {
                const cid = e.target.value;
                setQuery("");
                setOpen(false);
                /* 空に戻したら大分類まで戻す。⚠️ `onSelect("")` にしない。
                      選べる側では「大分類だけ」が正当な状態なので、そこへ落とす。 */
                onSelect(cid || (selectableParent ? twoStepParentId : ""));
              }}
              style={selectStyle(disabled || twoStepChildren.length === 0)}
            >
              <option value="">
                {twoStepParentId === ""
                  ? "先に大分類を選ぶ"
                  : twoStepChildren.length === 0
                    ? "小分類なし"
                    : selectableParent ? "小分類を選ぶ（任意）" : "小分類を選ぶ"}
              </option>
              {twoStepChildren.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* ⚠️ 「大分類だけでも保存できる」ことを画面に書く。書かないと
                 小分類が必須だと思われて、当てはまる子が無い人が止まる。 */}
          {selectableParent && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
              大分類だけでも保存できます。当てはまる小分類があるときだけ選んでください。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 2段セレクトの見た目。⚠️ 検索欄（高さ40）と揃える */
function selectStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", height: 40, padding: "0 10px",
    border: "1.5px solid var(--line)", borderRadius: 8,
    fontSize: 14, fontFamily: "inherit",
    color: disabled ? "var(--ink-mute)" : "var(--ink)",
    background: disabled ? "var(--bg-tint)" : "#fff",
    outline: "none",
  };
}

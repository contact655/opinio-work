"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ORG_DEPTH, depthOf, flattenTree, subtreeHeight, wouldCycle } from "@/lib/business/orgTree";
import { StandardRoleCombobox, type StandardRole } from "./StandardRoleCombobox";
import type { CompanyJobRole } from "./JobRolesEditor";

/**
 * ★部門タブ（2026-10-12 / 柴さんの指示で作り直した）。左に部門の一覧、行を押すと右に編集パネル。
 *
 *   一覧の行 … ドラッグの取っ手（キーボードでも ↑↓ で並べ替え）・部門名・求人 N件・⋯（下に部門を追加 / 削除）
 *              2行目に「この部門の職種：…」と、灰色で「標準の職種が未設定（n）」
 *   パネル   … 部門名（必須）・親の部門・この部門の職種（標準の職種は必須、社内での呼び方は任意）
 *              ★**保存ボタン方式**（自動保存にしない）。部門と職種をまとめて1回で保存する
 *              ——職種の新規作成と紐付けを途中で分けて保存すると、「作ったのにどの部門にも付いていない職種」が残るため
 *   幅       … 1280px 以上は左右に並べる。未満はパネルを一覧の上に全幅で出す
 *
 * ⚠️ 並べ替えは**同じ親の中だけ**。親を変えるのはパネルの「親の部門」で行う（ドラッグで階層を変えない）。
 * ⚠️★深さと循環の規則は `lib/business/orgTree.ts` の1箇所。サーバー（PATCH）も同じ関数で弾く。
 * ⚠️ 職種の付け外しは**ここだけ**。職種タブは読むだけの一覧で、行から該当の部門のパネルへ飛ぶ。
 */

export type Department = { id: string; parent_id: string | null; name: string; display_order: number };

type Props = {
  initialDepartments: Department[];
  initialRoles: CompanyJobRole[];
  standardRoles: StandardRole[];
  /** 職種 id → 所属する部門 id。⚠️ 読めなかったときは undefined（職種の欄を編集させない） */
  initialRoleDepartments?: Record<string, string[]>;
  /** 部門 id → 求人の件数 */
  usage?: Record<string, number>;
  readOnly?: boolean;
  /** `?dept=<id>`（職種タブから飛んできたとき）。最初からその部門のパネルを開く */
  initialSelectedId?: string | null;
};

type Selection = { mode: "edit"; id: string } | { mode: "new"; parentId: string | null } | null;

type TreeNode = Department & { children: TreeNode[] };

function buildTree(rows: Department[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((n) => {
    const p = n.parent_id ? map.get(n.parent_id) : undefined;
    if (p) p.children.push(n); else roots.push(n);
  });
  const sort = (l: TreeNode[]) => { l.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ja")); l.forEach((n) => sort(n.children)); };
  sort(roots);
  return roots;
}

async function call(url: string, method: string, body?: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: res.status === 401 ? "ログインが切れています。ページを読み込み直してください" : ((data as { error?: string }).error ?? "保存できませんでした") };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, error: "通信エラーで保存できませんでした" };
  }
}

export function DepartmentsWorkspace({ initialDepartments, initialRoles, standardRoles, initialRoleDepartments, usage, readOnly = false, initialSelectedId = null }: Props) {
  const [depts, setDepts] = useState<Department[]>(initialDepartments);
  const [roles, setRoles] = useState<CompanyJobRole[]>(initialRoles);
  const [links, setLinks] = useState<Record<string, string[]> | undefined>(initialRoleDepartments);
  const [selection, setSelection] = useState<Selection>(
    initialSelectedId && initialDepartments.some((d) => d.id === initialSelectedId) ? { mode: "edit", id: initialSelectedId } : null,
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; after: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* ★保存のたびにパネルを作り直す（比べる元＝保存済みの値を新しくするため）。直後だけ「保存しました」 */
  const [saveVersion, setSaveVersion] = useState(0);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const tree = useMemo(() => buildTree(depts), [depts]);
  const stdById = useMemo(() => new Map(standardRoles.map((r) => [r.id, r])), [standardRoles]);

  /** 部門 id → その部門の職種 */
  const rolesByDept = useMemo(() => {
    const m = new Map<string, CompanyJobRole[]>();
    if (!links) return m;
    for (const r of roles) for (const d of links[r.id] ?? []) m.set(d, [...(m.get(d) ?? []), r]);
    return m;
  }, [roles, links]);

  /* ★パネルを開いたら、1280px 未満では一覧の上のパネルまで戻す（パネルが一覧の上に出るため） */
  useEffect(() => {
    if (!selection) return;
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setTimeout(() => panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    }
  }, [selection]);

  /* ⋯ の外を押したら閉じる */
  useEffect(() => {
    if (!menuId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(`[data-menu-for="${menuId}"]`)) { setMenuId(null); setConfirmDeleteId(null); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuId(null); setConfirmDeleteId(null); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuId]);

  const select = useCallback((next: Selection) => {
    if (dirtyRef.current && !window.confirm("保存していない変更があります。変更を破棄して移動しますか？")) return;
    dirtyRef.current = false;
    setError(null);
    setJustSavedId(null);
    setSelection(next);
  }, []);

  const siblingsOf = useCallback((parentId: string | null, list: Department[] = depts) => (
    list.filter((d) => (d.parent_id ?? null) === parentId)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ja"))
  ), [depts]);

  // ── 並べ替え（同じ親の中だけ）────────────────────────────────────────────
  async function reorder(id: string, targetIndex: number) {
    const node = depts.find((d) => d.id === id);
    if (!node) return;
    const sibs = siblingsOf(node.parent_id ?? null).filter((d) => d.id !== id);
    const clamped = Math.max(0, Math.min(targetIndex, sibs.length));
    const ordered = [...sibs.slice(0, clamped), node, ...sibs.slice(clamped)];
    /* ⚠️ 番号を 0.. で振り直し、変わった行だけ送る。1本でも失敗したら止めて画面は動かさない */
    const changes = ordered.map((d, i) => ({ id: d.id, from: d.display_order, to: i })).filter((c) => c.from !== c.to);
    if (changes.length === 0) return;
    setBusy(true); setError(null);
    for (const c of changes) {
      const r = await call(`/api/biz/departments/${c.id}`, "PATCH", { display_order: c.to });
      if (!r.ok) { setError(r.error === "保存できませんでした" ? "並べ替えできませんでした" : r.error); setBusy(false); return; }
    }
    const to = new Map(changes.map((c) => [c.id, c.to]));
    setDepts((prev) => prev.map((d) => (to.has(d.id) ? { ...d, display_order: to.get(d.id)! } : d)));
    setBusy(false);
  }

  function indexInSiblings(id: string): number {
    const node = depts.find((d) => d.id === id);
    if (!node) return -1;
    return siblingsOf(node.parent_id ?? null).findIndex((d) => d.id === id);
  }

  // ── 削除 ─────────────────────────────────────────────────────────────────
  async function remove(id: string) {
    setBusy(true); setError(null);
    const r = await call(`/api/biz/departments/${id}`, "DELETE");
    setBusy(false);
    if (!r.ok) { setError(r.error === "保存できませんでした" ? "削除できませんでした" : r.error); return; }
    const gone = new Set<string>();
    const collect = (x: string) => { if (gone.has(x)) return; gone.add(x); depts.filter((d) => d.parent_id === x).forEach((c) => collect(c.id)); };
    collect(id);
    setDepts((prev) => prev.filter((d) => !gone.has(d.id)));
    /* 消えた部門への紐付けは画面からも外す（サーバーは論理削除なので行は残るが、読むときに落としている） */
    setLinks((prev) => prev ? Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.filter((d) => !gone.has(d))])) : prev);
    if (selection?.mode === "edit" && gone.has(selection.id)) { dirtyRef.current = false; setSelection(null); }
    setMenuId(null); setConfirmDeleteId(null);
  }

  // ── 行 ───────────────────────────────────────────────────────────────────
  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const isSelected = selection?.mode === "edit" && selection.id === node.id;
    const deptRoles = rolesByDept.get(node.id) ?? [];
    const missing = deptRoles.filter((r) => !r.standard_role_id).length;
    const used = usage?.[node.id] ?? 0;
    const sameParentDrag = dragId && dragId !== node.id && depts.find((d) => d.id === dragId)?.parent_id === node.parent_id;
    const hint = dropHint?.id === node.id ? dropHint : null;

    return (
      <div key={node.id}>
        <div
          className={`orgws-row${isSelected ? " is-selected" : ""}`}
          data-state={isSelected ? "dept-row-selected" : "dept-row"}
          data-dept-id={node.id}
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          aria-label={`${node.name} を編集する`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-no-select]")) return;
            select({ mode: "edit", id: node.id });
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select({ mode: "edit", id: node.id }); }
          }}
          onDragOver={(e) => {
            if (!sameParentDrag) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDropHint({ id: node.id, after: e.clientY > r.top + r.height / 2 });
          }}
          onDragLeave={() => { if (dropHint?.id === node.id) setDropHint(null); }}
          onDrop={(e) => {
            if (!sameParentDrag || !dragId) return;
            e.preventDefault();
            const sibs = siblingsOf(node.parent_id ?? null).filter((d) => d.id !== dragId);
            const i = sibs.findIndex((d) => d.id === node.id);
            void reorder(dragId, hint?.after ? i + 1 : i);
            setDragId(null); setDropHint(null);
          }}
          style={{
            boxShadow: hint ? (hint.after ? "inset 0 -2px 0 var(--royal)" : "inset 0 2px 0 var(--royal)") : undefined,
            opacity: dragId === node.id ? 0.5 : 1,
          }}
        >
          <div className="orgws-line">
            {!readOnly && (
              <button
                type="button"
                data-no-select
                draggable={!busy}
                onDragStart={(e) => { setDragId(node.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", node.id); }}
                onDragEnd={() => { setDragId(null); setDropHint(null); }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const i = indexInSiblings(node.id);
                  void reorder(node.id, e.key === "ArrowUp" ? i - 1 : i + 1).then(() => {
                    setTimeout(() => (document.querySelector(`[data-handle-for="${node.id}"]`) as HTMLElement | null)?.focus(), 0);
                  });
                }}
                data-handle-for={node.id}
                aria-label={`${node.name} の並び順を変える（↑ ↓ キーで移動、またはドラッグ）`}
                title="ドラッグで並べ替え（↑ ↓ キーでも動かせます）"
                disabled={busy}
                className="btn-fixed-size orgws-handle"
              >
                <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden fill="currentColor">
                  <circle cx="2.5" cy="2.5" r="1.3" /><circle cx="7.5" cy="2.5" r="1.3" />
                  <circle cx="2.5" cy="7" r="1.3" /><circle cx="7.5" cy="7" r="1.3" />
                  <circle cx="2.5" cy="11.5" r="1.3" /><circle cx="7.5" cy="11.5" r="1.3" />
                </svg>
              </button>
            )}
            {hasChildren ? (
              <button type="button" data-no-select className="btn-fixed-size orgws-caret"
                onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; })}
                aria-label={isCollapsed ? `${node.name} を開く` : `${node.name} を畳む`} aria-expanded={!isCollapsed}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            ) : <span aria-hidden className="orgws-caret-space" />}
            <span className="orgws-name" style={{ fontWeight: depth === 0 ? 700 : 500, color: depth === 0 ? "var(--ink)" : "var(--ink-soft)" }}>
              {node.name}
              {isCollapsed && hasChildren && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>（下に{node.children.length}件）</span>}
              {used > 0 && <span className="orgws-count">求人 {used}件</span>}
            </span>
            {!readOnly && (
              <div data-no-select data-menu-for={node.id} style={{ position: "relative", flexShrink: 0 }}>
                <button type="button" className="btn-fixed-size orgws-more" aria-haspopup="menu" aria-expanded={menuId === node.id}
                  aria-label={`${node.name} の操作`} disabled={busy}
                  onClick={() => { setMenuId(menuId === node.id ? null : node.id); setConfirmDeleteId(null); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
                {menuId === node.id && (
                  <div role="menu" className="orgws-menu" data-state="dept-menu">
                    {confirmDeleteId === node.id ? (
                      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.6 }}>
                          「{node.name}」を削除しますか？
                          {hasChildren && <><br />下の部門も一緒に削除されます。</>}
                          {used > 0 && <><br />求人{used}件で使われています（求人の記録は残ります）。</>}
                        </span>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="orgws-btn-ghost">やめる</button>
                          <button type="button" onClick={() => void remove(node.id)} disabled={busy} className="orgws-btn-danger" data-state="dept-delete-confirm">削除する</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" role="menuitem" className="orgws-menuitem"
                          disabled={depthOf(node.id, new Map(depts.map((d) => [d.id, d]))) + 1 > MAX_ORG_DEPTH}
                          title={depthOf(node.id, new Map(depts.map((d) => [d.id, d]))) + 1 > MAX_ORG_DEPTH ? `部門は${MAX_ORG_DEPTH}階層までです` : undefined}
                          onClick={() => { setMenuId(null); setCollapsed((p) => { const n = new Set(p); n.delete(node.id); return n; }); select({ mode: "new", parentId: node.id }); }}>
                          下に部門を追加
                        </button>
                        <button type="button" role="menuitem" className="orgws-menuitem" style={{ color: "var(--error)" }}
                          onClick={() => setConfirmDeleteId(node.id)}>
                          削除
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {(deptRoles.length > 0 || missing > 0) && (
            <div className="orgws-sub">
              {deptRoles.length > 0 && <span>この部門の職種：<span style={{ color: "var(--ink-soft)" }}>{deptRoles.map((r) => r.name).join("、")}</span></span>}
              {missing > 0 && <span data-state="dept-standard-missing" style={{ marginLeft: deptRoles.length > 0 ? 10 : 0 }}>標準の職種が未設定（{missing}）</span>}
            </div>
          )}
        </div>
        {hasChildren && !isCollapsed && (
          <div className="orgws-children">{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  }

  const selectedDept = selection?.mode === "edit" ? depts.find((d) => d.id === selection.id) ?? null : null;
  const panelOpen = selection !== null && (selection.mode === "new" || selectedDept !== null);

  return (
    <div>
      <style>{`
        .orgws { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
        .orgws-panel { order: -1; }
        @media (min-width: 1280px) {
          .orgws.has-panel { grid-template-columns: minmax(0, 1fr) 440px; }
          .orgws-panel { order: 0; position: sticky; top: 76px; max-height: calc(100vh - 96px); overflow-y: auto; }
        }
        .orgws-row { padding: 6px 10px; border-radius: 8px; cursor: pointer; outline: none; }
        .orgws-row:hover { background: var(--bg-tint); }
        .orgws-row:focus-visible { box-shadow: 0 0 0 2px var(--royal-100); }
        .orgws-row.is-selected { background: var(--royal-50); }
        .orgws-line { display: flex; align-items: center; gap: 6px; min-height: 34px; }
        .orgws-handle { width: 22px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--ink-mute); cursor: grab; border-radius: 6px; padding: 0; flex-shrink: 0; }
        .orgws-handle:hover, .orgws-handle:focus-visible { background: #fff; color: var(--ink-soft); }
        .orgws-caret { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--ink-mute); cursor: pointer; padding: 0; flex-shrink: 0; }
        .orgws-caret-space { width: 18px; flex-shrink: 0; }
        .orgws-name { flex: 1; min-width: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
        .orgws-count { margin-left: 10px; font-size: 11px; font-weight: 600; color: var(--ink-soft); background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px; white-space: nowrap; }
        .orgws-more { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: transparent; color: var(--ink-mute); cursor: pointer; padding: 0; }
        .orgws-more:hover, .orgws-more:focus-visible { background: #fff; color: var(--ink); }
        .orgws-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 40; min-width: 200px; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,0.12); padding: 4px; }
        .orgws-menuitem { display: block; width: 100%; text-align: left; padding: 8px 10px; font-size: 13px; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-family: inherit; color: var(--ink); }
        .orgws-menuitem:hover:not(:disabled) { background: var(--bg-tint); }
        .orgws-menuitem:disabled { color: var(--ink-mute); cursor: default; }
        .orgws-sub { padding: 0 0 4px 52px; font-size: 12px; color: var(--ink-mute); overflow-wrap: anywhere; }
        .orgws-children { margin-left: 30px; padding-left: 8px; border-left: 1px solid var(--line); }
        .orgws-btn-ghost { padding: 5px 12px; font-size: 12.5px; border: 1px solid var(--line); border-radius: 7px; background: #fff; color: var(--ink-soft); cursor: pointer; font-family: inherit; }
        .orgws-btn-danger { padding: 5px 12px; font-size: 12.5px; font-weight: 700; border: none; border-radius: 7px; background: var(--error); color: #fff; cursor: pointer; font-family: inherit; }
        @media (max-width: 720px) {
          .orgws-sub { padding-left: 30px; }
          .orgws-children { margin-left: 14px; }
        }
      `}</style>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error-ink)", fontWeight: 600 }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: 12, fontSize: 11, color: "var(--error)", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div className={`orgws${panelOpen ? " has-panel" : ""}`}>
        <div style={{ minWidth: 0 }}>
          {/* ⚠️ overflow: hidden を付けないこと。⋯ のメニューが箱の下端で切れる（いちばん下の行で実際に切れた） */}
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>部門<span style={{ marginLeft: 6, fontWeight: 500, color: "var(--ink-mute)" }}>{depts.length}件</span></span>
              {!readOnly && (
                <button type="button" onClick={() => select({ mode: "new", parentId: null })} data-state="dept-add-top"
                  style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                  ＋ 部門を追加
                </button>
              )}
            </div>
            <div style={{ padding: "6px 6px 8px" }}>
              {tree.length === 0 ? (
                <p style={{ margin: 0, padding: "18px 12px", fontSize: 13, color: "var(--ink-mute)" }}>
                  {readOnly ? "部門はまだ登録されていません。" : "部門はまだありません。「＋ 部門を追加」から登録できます（例：営業部）。"}
                </p>
              ) : tree.map((n) => renderNode(n, 0))}
            </div>
          </div>
          {!readOnly && (
            <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8 }}>
              行を押すと右で編集できます。左の取っ手をドラッグ（または取っ手を選んで ↑ ↓ キー）で同じ階層の中を並べ替えます。階層を変えるときは「親の部門」を選び直してください（最大{MAX_ORG_DEPTH}階層）。
              ここで登録した部門と職種は、求人作成の「所属部門」「職種」から選べます。
            </p>
          )}
        </div>

        {panelOpen && (
          <div ref={panelRef} className="orgws-panel">
            <DeptPanel
              key={selection.mode === "edit" ? `e:${selection.id}:${saveVersion}` : `n:${selection.parentId ?? ""}`}
              justSaved={selection.mode === "edit" && justSavedId === selection.id}
              selection={selection}
              dept={selectedDept}
              depts={depts}
              roles={roles}
              links={links}
              standardRoles={standardRoles}
              stdById={stdById}
              readOnly={readOnly}
              onDirtyChange={(d) => { dirtyRef.current = d; }}
              onClose={() => select(null)}
              onSaved={(next) => {
                setDepts(next.depts); setRoles(next.roles); setLinks(next.links);
                dirtyRef.current = false;
                setSaveVersion((v) => v + 1);
                setJustSavedId(next.ok ? next.deptId : null);
                /* ⚠️ 途中で失敗したときは、パネルを作り直すので理由を上の帯に出す（消さない） */
                setError(next.ok ? null : `${next.error ?? "保存できませんでした"}（ここまでの変更は保存されています）`);
                setSelection({ mode: "edit", id: next.deptId });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 編集パネル ───────────────────────────────────────────────────────────────

type RoleItem = {
  key: string;
  /** 既存の職種なら id。新しく作るものは null */
  roleId: string | null;
  standardRoleId: string;
  /** 社内での呼び方（空なら標準の職種名で保存） */
  alias: string;
};

function DeptPanel({ selection, dept, depts, roles, links, standardRoles, stdById, readOnly, justSaved = false, onDirtyChange, onClose, onSaved }: {
  selection: NonNullable<Selection>;
  dept: Department | null;
  depts: Department[];
  roles: CompanyJobRole[];
  links: Record<string, string[]> | undefined;
  standardRoles: StandardRole[];
  stdById: Map<string, StandardRole>;
  readOnly: boolean;
  justSaved?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  /** ok=false は途中で失敗したとき（そこまで保存できたものを画面に反映する） */
  onSaved: (next: { depts: Department[]; roles: CompanyJobRole[]; links: Record<string, string[]> | undefined; deptId: string; ok: boolean; error?: string }) => void;
}) {
  const isNew = selection.mode === "new";
  const initialParent = isNew ? selection.parentId : (dept?.parent_id ?? null);
  const aliasOf = (r: CompanyJobRole) => (r.standard_role_id && stdById.get(r.standard_role_id)?.name === r.name ? "" : r.name);
  const initialItems: RoleItem[] = useMemo(() => (isNew || !dept || !links) ? [] : roles
    .filter((r) => (links[r.id] ?? []).includes(dept.id))
    .map((r) => ({ key: r.id, roleId: r.id, standardRoleId: r.standard_role_id ?? "", alias: aliasOf(r) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const [name, setName] = useState(dept?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(initialParent);
  const [items, setItems] = useState<RoleItem[]>(initialItems);
  const [pickExisting, setPickExisting] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (isNew) setTimeout(() => nameRef.current?.focus(), 30); }, [isNew]);

  const snapshot = JSON.stringify({ name: dept?.name ?? "", parentId: initialParent, items: initialItems.map(({ roleId, standardRoleId, alias }) => ({ roleId, standardRoleId, alias })) });
  const current = JSON.stringify({ name: name.trim(), parentId, items: items.map(({ roleId, standardRoleId, alias }) => ({ roleId, standardRoleId, alias: alias.trim() })) });
  const dirty = isNew ? true : snapshot !== current;
  useEffect(() => { onDirtyChange(isNew ? name.trim() !== "" || items.length > 0 : dirty); }, [dirty, isNew, name, items.length, onDirtyChange]);

  const missingStd = items.filter((i) => !i.standardRoleId).length;
  const canSave = !readOnly && !saving && name.trim() !== "" && missingStd === 0 && (isNew || dirty);

  /* 親の候補。⚠️ 自分と自分の下の部門は選べない。深さの上限を超える先も選べない（サーバーも同じ判定で弾く） */
  const byId = useMemo(() => new Map(depts.map((d) => [d.id, d])), [depts]);
  const parentOptions = useMemo(() => flattenTree(depts).map(({ node, depth }) => {
    let disabled = false;
    if (dept) {
      if (node.id === dept.id || wouldCycle(dept.id, node.id, byId)) disabled = true;
      else if (depthOf(node.id, byId) + subtreeHeight(dept.id, byId) > MAX_ORG_DEPTH) disabled = true;
    } else if (depthOf(node.id, byId) + 1 > MAX_ORG_DEPTH) disabled = true;
    return { id: node.id, label: `${"　".repeat(depth - 1)}${node.name}`, disabled };
  }), [depts, dept, byId]);

  const linkedIds = new Set(items.map((i) => i.roleId).filter(Boolean) as string[]);
  const otherRoles = roles.filter((r) => !linkedIds.has(r.id));

  async function save() {
    if (!canSave) return;
    setSaving(true); setError(null);
    let nDepts = [...depts];
    let nRoles = [...roles];
    const nLinks: Record<string, string[]> | undefined = links ? Object.fromEntries(Object.entries(links).map(([k, v]) => [k, [...v]])) : undefined;
    let deptId = dept?.id ?? null;
    const fail = (msg: string) => {
      setError(msg); setSaving(false);
      /* ⚠️ 途中まで保存できたものは画面にも反映する（作った部門が消えて見えないように） */
      if (deptId) onSaved({ depts: nDepts, roles: nRoles, links: nLinks, deptId, ok: false, error: msg });
    };
    const nextOrder = (pid: string | null) => nDepts.filter((d) => (d.parent_id ?? null) === pid).reduce((m, d) => Math.max(m, d.display_order), -1) + 1;

    // 1) 部門
    if (!deptId) {
      const r = await call("/api/biz/departments", "POST", { name: name.trim(), parent_id: parentId, display_order: nextOrder(parentId) });
      if (!r.ok) return fail(r.status === 409 ? "同じ名前の部門が、この階層にすでにあります" : r.error);
      const created = r.data.department as Department;
      deptId = created.id;
      nDepts = [...nDepts, created];
    } else {
      const patch: Record<string, unknown> = {};
      if (name.trim() !== dept!.name) patch.name = name.trim();
      if (parentId !== (dept!.parent_id ?? null)) { patch.parent_id = parentId; patch.display_order = nextOrder(parentId); }
      if (Object.keys(patch).length > 0) {
        const r = await call(`/api/biz/departments/${deptId}`, "PATCH", patch);
        if (!r.ok) return fail(r.status === 409 ? "同じ名前の部門が、この階層にすでにあります" : r.error);
        nDepts = nDepts.map((d) => (d.id === deptId ? { ...d, ...(patch as Partial<Department>) } : d));
      }
    }

    // 2) 職種（標準の職種・呼び方の変更と、新しい職種の作成）
    const finalIds: string[] = [];
    for (const it of items) {
      const stdName = stdById.get(it.standardRoleId)?.name ?? "";
      const resolvedName = it.alias.trim() || stdName;
      if (it.roleId) {
        const orig = nRoles.find((r) => r.id === it.roleId);
        if (orig && (orig.standard_role_id !== it.standardRoleId || orig.name !== resolvedName)) {
          const r = await call(`/api/biz/job-roles/${it.roleId}`, "PATCH", { name: it.alias.trim(), standard_role_id: it.standardRoleId });
          if (!r.ok) return fail(r.status === 409 ? `「${resolvedName}」という職種がすでにあります` : r.error);
          nRoles = nRoles.map((x) => (x.id === it.roleId ? { ...x, name: resolvedName, standard_role_id: it.standardRoleId } : x));
        }
        finalIds.push(it.roleId);
      } else {
        const order = nRoles.filter((r) => !r.parent_id).reduce((m, r) => Math.max(m, r.display_order), -1) + 1;
        const r = await call("/api/biz/job-roles", "POST", { name: it.alias.trim(), standard_role_id: it.standardRoleId, parent_id: null, display_order: order });
        if (!r.ok) return fail(r.status === 409 ? `「${resolvedName}」という職種がすでにあります。「既存の職種から選ぶ」で追加してください` : r.error);
        const created = r.data.jobRole as CompanyJobRole;
        nRoles = [...nRoles, created];
        if (nLinks) nLinks[created.id] = [];
        finalIds.push(created.id);
      }
    }

    // 3) この部門との紐付け（増えた職種・外した職種だけ）
    if (nLinks) {
      const before = new Set(Object.entries(nLinks).filter(([, v]) => v.includes(deptId!)).map(([k]) => k));
      const after = new Set(finalIds);
      const changed = [...Array.from(after).filter((x) => !before.has(x)), ...Array.from(before).filter((x) => !after.has(x))];
      for (const roleId of changed) {
        const cur = nLinks[roleId] ?? [];
        const next = after.has(roleId) ? Array.from(new Set([...cur, deptId!])) : cur.filter((d) => d !== deptId);
        const r = await call(`/api/biz/job-roles/${roleId}/departments`, "PUT", { departmentIds: next });
        if (!r.ok) return fail(r.error);
        nLinks[roleId] = next;
      }
    }

    setSaving(false);
    onSaved({ depts: nDepts, roles: nRoles, links: nLinks, deptId: deptId!, ok: true });
  }

  const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", fontSize: 14, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", color: "var(--ink)", background: "#fff" };
  const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6 };

  return (
    <section data-state={isNew ? "dept-panel-new" : "dept-panel"} aria-label={isNew ? "部門を追加" : `${dept?.name} を編集`}
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", minWidth: 0, overflowWrap: "anywhere" }}>
          {isNew ? "部門を追加" : readOnly ? dept?.name : "部門を編集"}
        </h2>
        <button type="button" onClick={onClose} aria-label="閉じる" className="btn-fixed-size"
          style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "transparent", color: "var(--ink-mute)", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
      </div>

      {error && <div role="alert" style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 12.5, color: "var(--error-ink)", fontWeight: 600 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="dept-name" style={label}>部門名<span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "var(--error)" }}>必須</span></label>
          <input id="dept-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} readOnly={readOnly}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            placeholder="例：営業部" maxLength={100} style={inputStyle} data-state="dept-name-input" />
        </div>

        <div>
          <label htmlFor="dept-parent" style={label}>親の部門</label>
          <select id="dept-parent" value={parentId ?? ""} disabled={readOnly} onChange={(e) => setParentId(e.target.value || null)} style={inputStyle} data-state="dept-parent-select">
            <option value="">（なし・いちばん上の階層）</option>
            {parentOptions.map((o) => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <div style={label}>この部門の職種</div>
          {!links ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-mute)" }}>職種との紐付けを読み込めませんでした。ページを読み込み直してください。</p>
          ) : (
            <>
              {items.length === 0 && <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--ink-mute)" }}>まだありません。</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it, idx) => {
                  const shared = it.roleId ? (links[it.roleId] ?? []).filter((d) => d !== dept?.id).length : 0;
                  return (
                    <div key={it.key} data-state="dept-panel-role" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: it.roleId ? "#fff" : "var(--bg-tint)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{it.roleId ? (shared > 0 ? `ほかの${shared}部門にも所属` : "") : "新しい職種"}</span>
                        {!readOnly && (
                          <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                            style={{ fontSize: 12, border: "none", background: "none", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                            {it.roleId ? "この部門から外す" : "取り消す"}
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>標準の職種<span style={{ marginLeft: 4, color: "var(--error)" }}>必須</span></span>
                        {readOnly ? (
                          <span style={{ fontSize: 13, color: it.standardRoleId ? "var(--ink)" : "var(--ink-mute)" }}>{stdById.get(it.standardRoleId)?.name ?? "未設定"}</span>
                        ) : (
                          <StandardRoleCombobox value={it.standardRoleId} required placeholder="標準の職種を選ぶ（必須）" roles={standardRoles}
                            onChange={(v) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, standardRoleId: v } : x)))} />
                        )}
                        <span style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4 }}>社内での呼び方（任意）</span>
                        <input value={it.alias} readOnly={readOnly} maxLength={100}
                          onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, alias: e.target.value } : x)))}
                          placeholder={stdById.get(it.standardRoleId)?.name ? `空なら「${stdById.get(it.standardRoleId)!.name}」と表示` : "例：PDM、FS"}
                          style={{ ...inputStyle, fontSize: 13, padding: "6px 9px" }} />
                        {!it.standardRoleId && <span data-state="role-standard-missing" style={{ fontSize: 12, color: "var(--ink-mute)" }}>標準の職種を選んでください</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!readOnly && (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <button type="button" data-state="dept-panel-add-role"
                    onClick={() => setItems((p) => [...p, { key: `new-${Date.now()}`, roleId: null, standardRoleId: "", alias: "" }])}
                    style={{ fontSize: 12.5, fontWeight: 700, color: "var(--royal)", background: "#fff", border: "1px dashed var(--royal-100)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                    ＋ 新しい職種を追加
                  </button>
                  {otherRoles.length > 0 && (
                    <select value={pickExisting} aria-label="既存の職種から選ぶ" data-state="dept-panel-pick-existing"
                      onChange={(e) => {
                        const r = roles.find((x) => x.id === e.target.value);
                        if (r) setItems((p) => [...p, { key: r.id, roleId: r.id, standardRoleId: r.standard_role_id ?? "", alias: aliasOf(r) }]);
                        setPickExisting("");
                      }}
                      style={{ fontSize: 12.5, fontFamily: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", color: "var(--ink-soft)", background: "#fff", maxWidth: "100%" }}>
                      <option value="">既存の職種から選ぶ…</option>
                      {otherRoles.map((r) => <option key={r.id} value={r.id}>{r.name}{(links[r.id] ?? []).length === 0 ? "（部門なし）" : ""}</option>)}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--ink-mute)" }} data-state="dept-panel-status">
            {saving ? "保存中…" : missingStd > 0 ? "標準の職種を選ぶと保存できます" : !isNew && !dirty && justSaved ? "保存しました" : ""}
          </span>
          <button type="button" onClick={onClose} className="orgws-btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>{isNew ? "やめる" : "閉じる"}</button>
          <button type="button" onClick={() => void save()} disabled={!canSave} data-state="dept-panel-save"
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, background: "var(--royal)", color: "#fff", cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.45, fontFamily: "inherit" }}>
            {isNew ? "追加する" : "保存"}
          </button>
        </div>
      )}
    </section>
  );
}

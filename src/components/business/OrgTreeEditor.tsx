"use client";

import { useState, useTransition, useRef, useCallback, useMemo } from "react";
/* ⚠️★深さと循環の規則は `lib/business/orgTree.ts` の1箇所。**ここに書き写さないこと。**
      同じ関数をサーバー（`validateMove`）も通している。 */
import { MAX_ORG_DEPTH, depthOf, subtreeHeight } from "@/lib/business/orgTree";

/**
 * 部門・職種（部門 / 自社職種）の木の編集。**部門タブと職種タブが同じ部品を使う。**
 *
 * ── なぜ1つにまとめたか（2026-09-20 / 柴さんの指示）─────────────────────────
 * それまで `DepartmentsEditor`(550行) と `JobRolesEditor`(737行) が
 * **同じ仕組みを別々に実装**しており、実際にヒントの文面も揃っていなかった。
 * 人事担当者は部門から作る人も職種から作る人もいるので、片方だけ挙動が違う状態を作らない。
 *
 * ⚠️★**違いは「行に1列足せるか」だけ。** 職種の「標準職種」は `extra` で渡す。
 *    **タブごとの分岐をこのファイルに書かないこと**（`unit === "職種"` のような条件）。
 *    足したい振る舞いがあれば props にする。
 *
 * ── 出している操作 ─────────────────────────────────────────────────────────
 *   追加   … 下の入力欄。Enter で続けて打てる（Tab で一段下、Shift+Tab で一段上）
 *   移動   … 行の ↑ ↓ ← →。**2026-09-20 に足した**（それまで打ち間違えると
 *            消して打ち直すしかなかった）
 *   改名   … 名前をダブルクリック、または ✎
 *   削除   … 🗑 → その場で確認
 *
 * ⚠️★**移動の判定はサーバーにもある**（`lib/business/orgTree.ts` の `validateMove`）。
 *    画面側で先に弾くのは操作感のためで、**担保はサーバー側**。
 *    画面の条件だけを緩めないこと。
 */

export type OrgRow = {
  id: string;
  parent_id: string | null;
  name: string;
  display_order: number;
};

/**
 * 行に足す1列（職種の「標準職種」だけが使う）。
 *
 * ⚠️ `toBody` が返すものが POST / PATCH の body に混ざる。
 *    **キー名は API の受け口と揃えること**（`standard_role_id`）。
 */
export type OrgExtra<T extends OrgRow> = {
  /** 行に出す（読み取り時）。値が無ければ null を返す */
  view: (row: T) => React.ReactNode;
  /** 追加欄・改名時に出す入力 */
  input: (value: string, onChange: (v: string) => void) => React.ReactNode;
  /** 行の現在値を文字列にする（"" ＝ 未設定） */
  valueOf: (row: T) => string;
  /** body に混ぜる */
  toBody: (value: string) => Record<string, unknown>;
};

type Props<T extends OrgRow> = {
  /** 画面に出す語。「部門」「職種」 */
  unit: string;
  /** "/api/biz/departments" など。`${endpoint}/${id}` で PATCH / DELETE する */
  endpoint: string;
  /** POST の戻りに入っているキー。"department" / "jobRole" */
  createdKey: string;
  initialRows: T[];
  /** 追加欄の placeholder に使う短い例。「営業部」など */
  example: string;
  extra?: OrgExtra<T>;
  /** 「使い方」を開いたときに出す行 */
  hints: React.ReactNode[];
};

const INDENT = 22;

const kbd: React.CSSProperties = {
  display: "inline-block", padding: "1px 5px", margin: "0 2px",
  fontSize: 10, fontFamily: "inherit", fontWeight: 700,
  border: "1px solid var(--line)", borderRadius: 4,
  background: "#fff", color: "var(--ink-soft)",
};

type TreeNode<T extends OrgRow> = T & { children: TreeNode<T>[] };

/**
 * 木に組む。**`display_order` → `name` の順に並べる。**
 *
 * ⚠️★**並べ替えを自前でやること。** 配列の順（サーバーが返した順）に頼ると、
 *    移動した直後だけ並びが崩れる（`display_order` を書き換えても配列の位置は動かないため）。
 */
function buildTree<T extends OrgRow>(rows: T[]): TreeNode<T>[] {
  const map = new Map<string, TreeNode<T>>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode<T>[] = [];
  map.forEach((node) => {
    const parent = node.parent_id ? map.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    /* ⚠️ 親が見つからない行（孤児）も最上位として出す。
          出さないと**画面から消えて直せなくなる**（`flattenTree` と同じ考え方）。 */
    else roots.push(node);
  });
  const sort = (list: TreeNode<T>[]) => {
    list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ja"));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

// ── 行 ────────────────────────────────────────────────────────────────────────

function Row<T extends OrgRow>({
  node, depth, unit, extra, pending,
  collapsedIds, onToggleCollapse,
  onAddChild, onRename, onDelete, onMove, canMove,
}: {
  node: TreeNode<T>;
  depth: number;
  unit: string;
  extra?: OrgExtra<T>;
  pending: boolean;
  /* ⚠️★**集合をそのまま渡す。** 子に `collapsed={false}` を渡す形にすると、
        **2階層目から畳めなくなる**（押しても親の状態が切り替わる）。 */
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onRename: (id: string, name: string, extraValue?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, dir: "up" | "down" | "left" | "right") => Promise<void>;
  canMove: (id: string, dir: "up" | "down" | "left" | "right") => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [editExtra, setEditExtra] = useState(extra ? extra.valueOf(node) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hover, setHover] = useState(false);

  const hasChildren = node.children.length > 0;
  const collapsed = collapsedIds.has(node.id);

  async function commitRename() {
    const name = editName.trim();
    if (!name) { setEditing(false); setEditName(node.name); return; }
    const extraChanged = extra ? editExtra !== extra.valueOf(node) : false;
    if (name === node.name && !extraChanged) { setEditing(false); return; }
    await onRename(node.id, name, extra ? editExtra : undefined);
    setEditing(false);
  }

  return (
    <div>
      <div
        className="org-row"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 7 }}
      >
        {/* 開閉。⚠️ 子が無い行でも**同じ幅を空ける**（名前の左端が階層ごとに揃う） */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            aria-label={collapsed ? `${node.name} を開く` : `${node.name} を畳む`}
            aria-expanded={!collapsed}
            className="btn-fixed-size"
            style={{
              width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-mute)",
              flexShrink: 0, padding: 0,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden
              style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span aria-hidden style={{ width: 18, flexShrink: 0 }} />
        )}

        {editing ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setEditing(false); setEditName(node.name); }
              }}
              style={{
                flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                border: "1px solid var(--accent)", borderRadius: 6, padding: "3px 8px",
                outline: "none", color: "var(--ink)",
              }}
            />
            {extra && extra.input(editExtra, setEditExtra)}
            <button
              type="button" onClick={commitRename} disabled={pending}
              style={{ padding: "3px 12px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 6, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              保存
            </button>
            <button
              type="button" onClick={() => { setEditing(false); setEditName(node.name); setEditExtra(extra ? extra.valueOf(node) : ""); }}
              style={{ padding: "3px 8px", fontSize: 12, border: "none", borderRadius: 6, background: "transparent", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              やめる
            </button>
          </div>
        ) : (
          <>
            <span
              onDoubleClick={() => { setEditing(true); setConfirmDelete(false); }}
              title="ダブルクリックで名前を変更"
              style={{
                flex: 1, minWidth: 0, fontSize: 13,
                fontWeight: depth === 0 ? 700 : 500,
                color: depth === 0 ? "var(--ink)" : "var(--ink-soft)",
                cursor: "text", overflowWrap: "anywhere",
              }}
            >
              {node.name}
              {/* ⚠️ 畳んでいるときだけ件数を出す。中身が見えているときは数えるまでもない */}
              {collapsed && hasChildren && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: "var(--ink-mute)" }}>
                  {node.children.length}
                </span>
              )}
            </span>
            {extra?.view(node)}
          </>
        )}

        {/* 操作。⚠️★**hover と focus のときだけ出す。** 常時出していた頃は、
               行が増えるほど名前より記号のほうが目立っていた。
            ⚠️ `visibility` で消す（`display:none` にすると Tab で辿れなくなる）。 */}
        {!editing && (
          <div
            className="org-actions"
            style={{
              display: "flex", alignItems: "center", gap: 2, flexShrink: 0,
              visibility: hover || confirmDelete ? "visible" : "hidden",
            }}
          >
            {confirmDelete ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--error-soft)", border: "1px solid #FCA5A5", borderRadius: 7, padding: "2px 8px" }}>
                <span style={{ fontSize: 11, color: "var(--error)" }}>
                  {hasChildren ? `下の${unit}も一緒に消えます` : "削除しますか？"}
                </span>
                <button
                  type="button" disabled={pending} onClick={() => onDelete(node.id)}
                  style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 5, background: "var(--error)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                >
                  削除
                </button>
                <button
                  type="button" onClick={() => setConfirmDelete(false)}
                  style={{ padding: "2px 4px", fontSize: 11, fontWeight: 700, border: "none", background: "transparent", color: "var(--error)", cursor: "pointer", fontFamily: "inherit" }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <MoveButton dir="up"    label="上へ"       disabled={pending || !canMove(node.id, "up")}    onClick={() => onMove(node.id, "up")} />
                <MoveButton dir="down"  label="下へ"       disabled={pending || !canMove(node.id, "down")}  onClick={() => onMove(node.id, "down")} />
                <MoveButton dir="left"  label="一段上げる" disabled={pending || !canMove(node.id, "left")}  onClick={() => onMove(node.id, "left")} />
                <MoveButton dir="right" label="一段下げる" disabled={pending || !canMove(node.id, "right")} onClick={() => onMove(node.id, "right")} />
                <span aria-hidden style={{ width: 1, height: 16, background: "var(--line)", margin: "0 4px" }} />
                <IconButton label={`${node.name} の下に${unit}を追加`} onClick={() => onAddChild(node.id)} disabled={pending}>
                  <path d="M12 5v14M5 12h14" />
                </IconButton>
                <IconButton label={`${node.name} の名前を変更`} onClick={() => { setEditing(true); setConfirmDelete(false); }} disabled={pending}>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </IconButton>
                <IconButton label={`${node.name} を削除`} onClick={() => setConfirmDelete(true)} disabled={pending} danger>
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>

      {/* 子。⚠️★縦の罫線はこの容器の border-left。**行ごとに引かないこと**
             （深い階層で線が途切れて親子が追えなくなる）。 */}
      {hasChildren && !collapsed && (
        <div style={{ marginLeft: INDENT / 2, paddingLeft: INDENT / 2, borderLeft: "1px solid var(--line)" }}>
          {node.children.map((child) => (
            <Row
              key={child.id}
              node={child}
              depth={depth + 1}
              unit={unit}
              extra={extra}
              pending={pending}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              canMove={canMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className="btn-fixed-size org-icon-btn"
      style={{
        width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--line)", borderRadius: 6, background: "#fff",
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, padding: 0, flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

const ARROW: Record<string, string> = {
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M19 12l-7 7-7-7",
  left: "M19 12H5M12 19l-7-7 7-7",
  right: "M5 12h14M12 5l7 7-7 7",
};

function MoveButton({ dir, label, disabled, onClick }: {
  dir: "up" | "down" | "left" | "right"; label: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <IconButton label={label} onClick={onClick} disabled={disabled}>
      <path d={ARROW[dir]} />
    </IconButton>
  );
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function OrgTreeEditor<T extends OrgRow>({
  unit, endpoint, createdKey, initialRows, example, extra, hints,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>(initialRows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showHints, setShowHints] = useState(false);

  /* ★追加欄。⚠️★**何も無いときは最初から開いておく**（2026-09-20）。
        それまでは空状態の箱と「追加する」ボタンとヒントで画面が埋まり、
        **最初の1件を打ち始めるまでにクリックが1回要った。** */
  const [adding, setAdding] = useState(initialRows.length === 0);
  const [draftName, setDraftName] = useState("");
  const [draftExtra, setDraftExtra] = useState("");
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  /* ⚠️ 毎描画で作り直すと `useCallback` の依存が毎回変わる（lint が指摘する）。
        木も同じ行から組むので、まとめて memo しておく。 */
  const tree = useMemo(() => buildTree(rows), [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  /** 同じ親を持つ行を、画面の並び（display_order → 名前）で返す */
  const siblingsOf = useCallback((parentId: string | null): T[] => (
    rows
      .filter((r) => (r.parent_id ?? null) === parentId)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "ja"))
  ), [rows]);

  // ── 追加 ──────────────────────────────────────────────────────────────────
  async function createRow(parentId: string | null, name: string, extraValue: string): Promise<T | null> {
    setError(null);
    const order = siblingsOf(parentId).reduce((m, r) => Math.max(m, r.display_order), -1) + 1;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, parent_id: parentId, display_order: order,
        ...(extra ? extra.toBody(extraValue) : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      /* ⚠️★**409 を黙って飲み込まないこと。** 飲み込むと
            「打って Enter を押したのに何も起きない」になる。
         ⚠️ 制約は (company_id, name, parent_id) なので、**同じ階層の同名**だけが重複。 */
      setError(res.status === 409
        ? `同じ名前の${unit}が、この階層にすでにあります`
        : (data.error ?? "追加できませんでした"));
      return null;
    }
    const created = data[createdKey] as T;
    startTransition(() => setRows((prev) => [...prev, created]));
    return created;
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("削除できませんでした"); return; }
    startTransition(() => {
      setRows((prev) => {
        const gone = new Set<string>();
        const collect = (rid: string) => {
          if (gone.has(rid)) return;          // ⚠️ 壊れたデータで返らなくならないように
          gone.add(rid);
          prev.filter((r) => r.parent_id === rid).forEach((c) => collect(c.id));
        };
        collect(id);
        return prev.filter((r) => !gone.has(r.id));
      });
    });
  }

  async function handleRename(id: string, name: string, extraValue?: string) {
    setError(null);
    const body: Record<string, unknown> = { name };
    if (extra && extraValue !== undefined) Object.assign(body, extra.toBody(extraValue));
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "変更できませんでした");
      return;
    }
    startTransition(() => setRows((prev) => prev.map((r) => (
      r.id === id ? { ...r, name, ...(extra && extraValue !== undefined ? extra.toBody(extraValue) : {}) } as T : r
    ))));
  }

  // ── 移動 ──────────────────────────────────────────────────────────────────
  /**
   * 行を動かす。**アウトライナと同じ規則**にしてある。
   *
   *   ↑ ↓ … 兄弟の中で前後と入れ替える
   *   →   … **直前の兄弟の下**へ入る（一段深くなる）
   *   ←   … 親の**次の兄弟**になる（一段浅くなる）
   *
   * ⚠️★**追加欄の Tab / Shift+Tab と同じ向きに揃えてある。** 片方だけ変えないこと
   *    （打ち込むときと直すときで意味が逆になる）。
   */
  const canMove = useCallback((id: string, dir: "up" | "down" | "left" | "right"): boolean => {
    const node = byId.get(id);
    if (!node) return false;
    const sibs = siblingsOf(node.parent_id ?? null);
    const i = sibs.findIndex((r) => r.id === id);
    if (dir === "up") return i > 0;
    if (dir === "down") return i >= 0 && i < sibs.length - 1;
    if (dir === "left") return node.parent_id !== null;
    /* → は直前の兄弟が要る。深さの上限はサーバーも見るが、押せないほうが分かりやすい */
    if (i <= 0) return false;
    return depthOf(sibs[i - 1].id, byId) + subtreeHeight(id, byId) <= MAX_ORG_DEPTH;
  }, [byId, siblingsOf]);

  async function patchMove(id: string, patch: { parent_id?: string | null; display_order?: number }) {
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "移動できませんでした");
      return false;
    }
    return true;
  }

  async function handleMove(id: string, dir: "up" | "down" | "left" | "right") {
    setError(null);
    const node = byId.get(id);
    if (!node) return;
    const sibs = siblingsOf(node.parent_id ?? null);
    const i = sibs.findIndex((r) => r.id === id);

    if (dir === "up" || dir === "down") {
      const other = sibs[dir === "up" ? i - 1 : i + 1];
      if (!other) return;
      /* ⚠️★**入れ替えは2本の PATCH。** 片方だけ通ると並びが壊れるので、
            1本目が失敗したら2本目を投げない（画面の state も動かさない）。
         ⚠️ 同値のときは入れ替えても動かないので、**番号を振り直す。** */
      const a = node.display_order;
      const b = other.display_order;
      const [newA, newB] = a === b ? [dir === "up" ? b - 1 : b + 1, b] : [b, a];
      if (!(await patchMove(id, { display_order: newA }))) return;
      if (!(await patchMove(other.id, { display_order: newB }))) return;
      startTransition(() => setRows((prev) => prev.map((r) => (
        r.id === id ? { ...r, display_order: newA }
        : r.id === other.id ? { ...r, display_order: newB } : r
      ))));
      return;
    }

    if (dir === "left") {
      const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
      if (!parent) return;
      const newParentId = parent.parent_id ?? null;
      /* 親のすぐ下（次の兄弟）に置く。⚠️ 既存の兄弟と同値にならないよう +0.5 を使い、
            サーバーには整数で送らない —— `display_order` は `Number` で受けるので小数でよい。 */
      const order = parent.display_order + 0.5;
      if (!(await patchMove(id, { parent_id: newParentId, display_order: order }))) return;
      startTransition(() => setRows((prev) => prev.map((r) => (
        r.id === id ? { ...r, parent_id: newParentId, display_order: order } : r
      ))));
      return;
    }

    // right
    const prevSib = sibs[i - 1];
    if (!prevSib) return;
    const order = siblingsOf(prevSib.id).reduce((m, r) => Math.max(m, r.display_order), -1) + 1;
    if (!(await patchMove(id, { parent_id: prevSib.id, display_order: order }))) return;
    startTransition(() => setRows((prev) => prev.map((r) => (
      r.id === id ? { ...r, parent_id: prevSib.id, display_order: order } : r
    ))));
    /* ⚠️ 移した先が畳まれていると**行ごと見えなくなる。** 開いておく。 */
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(prevSib.id); return next; });
  }

  // ── 追加欄 ────────────────────────────────────────────────────────────────
  function draftPath(): string[] {
    const path: string[] = [];
    let cur = pendingParentId;
    for (let guard = 0; guard < MAX_ORG_DEPTH + 1; guard++) {
      if (!cur) break;
      const node = byId.get(cur);
      if (!node) break;
      path.unshift(node.name);
      cur = node.parent_id;
    }
    return path;
  }
  const draftDepth = draftPath().length + 1;

  async function commitDraft() {
    const name = draftName.trim();
    if (!name) return;
    const created = await createRow(pendingParentId, name, draftExtra);
    if (!created) return;               // ⚠️ 失敗時は入力を残す（打ち直さずに済む）
    setDraftName("");
    setDraftExtra("");
    setLastCreatedId(created.id);
    /* ⚠️★**欄は閉じない。続けて打てることがこの欄の目的。** */
    draftRef.current?.focus();
  }

  function openDraftUnder(parentId: string) {
    setAdding(true);
    setPendingParentId(parentId);
    setLastCreatedId(null);
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(parentId); return next; });
    setTimeout(() => draftRef.current?.focus(), 0);
  }

  function closeDraft() {
    setAdding(false);
    setDraftName("");
    setDraftExtra("");
    setPendingParentId(null);
    setLastCreatedId(null);
  }

  const empty = rows.length === 0;

  /* ⚠️★**外側の余白（maxWidth / padding）はここに書かない。** ページ側が持つ。
        書くと `/dev/preview` に置いたときに 80px の余白が入り込む。 */
  return (
    <div>
      <style>{`
        .org-row:hover { background: var(--bg-tint); }
        .org-icon-btn:hover:not(:disabled) { border-color: var(--royal-100); color: var(--royal); }
        .org-actions:focus-within { visibility: visible !important; }
        /* ⚠️★狭い画面では操作を**常に出して、名前の下に折り返す**（2026-09-20）。
              理由は2つあり、どちらも外せない:
                ① 390px では操作の列（ボタン7つ）が親より 23px はみ出していた
                ② **触る画面には hover が無い。** 隠したままだと操作に一生たどり着けない
              ⚠️ hover で出す形は「広い画面で行を静かに保つ」ためのもの。
                 狭い画面にまで広げない。 */
        @media (max-width: 720px) {
          .org-row { flex-wrap: wrap; }
          .org-actions { visibility: visible !important; width: 100%; justify-content: flex-end; }
        }
      `}</style>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: "9px 14px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error-ink)", fontWeight: 600 }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: 12, fontSize: 11, color: "var(--error)", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* 木。⚠️★**空のときに大きな箱を出さない**（2026-09-20）。
             以前は「まだ登録されていません」の箱・追加ボタン・ヒントの3段で
             画面がほぼ埋まっていた。いまは下の追加欄が最初から開いている。 */}
      {!empty && (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
          {tree.map((node) => (
            <Row
              key={node.id}
              node={node}
              depth={0}
              unit={unit}
              extra={extra}
              pending={isPending}
              collapsedIds={collapsedIds}
              onToggleCollapse={(id) => setCollapsedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              })}
              onAddChild={openDraftUnder}
              onRename={handleRename}
              onDelete={handleDelete}
              onMove={handleMove}
              canMove={canMove}
            />
          ))}
        </div>
      )}

      {adding ? (
        <div style={{ background: "#fff", border: "1px solid var(--accent)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, color: "var(--ink-mute)", flexWrap: "wrap" }}>
            {/* ⚠️ いまどこに足すか。出さないと**打ち込んだ先が分からなくなる** */}
            <span style={{ fontWeight: 700, color: "var(--royal)" }}>{draftDepth}階層目に追加</span>
            {draftPath().length > 0 && <span>{draftPath().join(" › ")} の下</span>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 字下げで深さを目で見せる。⚠️ 幅は行の INDENT と揃える */}
            <span aria-hidden style={{ width: (draftDepth - 1) * INDENT, flexShrink: 0 }} />
            <input
              ref={draftRef}
              autoFocus
              placeholder={`${unit}名を入力して Enter（例：${example}）`}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitDraft(); return; }
                /* ⚠️★**Tab は既定だとフォーカスが飛ぶ。** preventDefault が要る。
                      そのぶんキーボードだけで欄から出られないので、Esc を下に書いてある。 */
                if (e.key === "Tab") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    if (!pendingParentId) return;
                    setPendingParentId(byId.get(pendingParentId)?.parent_id ?? null);
                    /* ⚠️ 浅くしたら「直前に作った行」はもう親候補ではない。**消す**
                          （残すと Tab で元の深さに戻り、行き来が噛み合わない）。 */
                    setLastCreatedId(null);
                  } else {
                    if (!lastCreatedId || draftDepth >= MAX_ORG_DEPTH) return;
                    setPendingParentId(lastCreatedId);
                  }
                  return;
                }
                if (e.key === "Escape") { e.preventDefault(); closeDraft(); }
              }}
              style={{
                flex: 1, minWidth: 0, fontSize: 14, fontFamily: "inherit", border: "none",
                outline: "none", color: "var(--ink)", background: "transparent",
              }}
            />
            {extra && extra.input(draftExtra, setDraftExtra)}
            <button
              type="button" onClick={commitDraft} disabled={!draftName.trim() || isPending}
              style={{ padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, opacity: !draftName.trim() || isPending ? 0.5 : 1 }}
            >
              追加
            </button>
            {/* ⚠️ 1件も無いうちは閉じる先が無い（空の箱に戻るだけ）ので出さない */}
            {!empty && (
              <button
                type="button" onClick={closeDraft}
                style={{ padding: "6px 12px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
              >
                閉じる
              </button>
            )}
          </div>

          {/* ⚠️ キーの説明は欄の中に置く。**下のヒントまで読みに行かせない** */}
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            <kbd style={kbd}>Enter</kbd> で追加して続けて入力／
            <kbd style={kbd}>Tab</kbd> で直前の{unit}の下へ（{MAX_ORG_DEPTH}階層まで）／
            <kbd style={kbd}>Shift</kbd>+<kbd style={kbd}>Tab</kbd> で一段戻る
            {!empty && <>／<kbd style={kbd}>Esc</kbd> で閉じる</>}
            {lastCreatedId === null && pendingParentId === null && (
              <span>　※ Tab は1件目を追加したあとから使えます</span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setAdding(true); setPendingParentId(null); setLastCreatedId(null); }}
          className="org-add-btn"
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
            fontSize: 13, fontWeight: 600, border: "2px dashed var(--line)", borderRadius: 10,
            background: "transparent", color: "var(--ink-soft)", cursor: "pointer",
            fontFamily: "inherit", width: "100%", transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          {unit}を追加する
        </button>
      )}

      {/* ★使い方は畳んでおく（2026-09-20）。⚠️★**常設に戻さないこと。**
             追加欄の中に同じキー説明があり、以前は**同じことを2箇所で言っていた。**
             10件作ったあとも5行の説明が残り続ける状態でもあった。 */}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => setShowHints((v) => !v)}
          aria-expanded={showHints}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 2px",
            fontSize: 12, fontWeight: 600, border: "none", background: "none",
            color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden
            style={{ transform: showHints ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {unit}の使い方
        </button>
        {showHints && (
          <ul style={{ margin: "4px 0 0", paddingLeft: 26, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.9 }}>
            {hints.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

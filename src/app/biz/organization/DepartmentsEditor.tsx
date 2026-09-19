"use client";

import { useState, useTransition, useRef } from "react";
import { MAX_ORG_DEPTH } from "@/lib/business/orgTree";

export type Department = {
  id: string;
  parent_id: string | null;
  name: string;
  display_order: number;
};

type Props = {
  initialDepartments: Department[];
};

type TreeNode = Department & { children: TreeNode[] };

const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "1px 5px", margin: "0 2px",
  fontSize: 10, fontFamily: "inherit", fontWeight: 700,
  border: "1px solid var(--line)", borderRadius: 4,
  background: "#fff", color: "var(--ink-soft)",
};

// ── ツリー構築 ────────────────────────────────────────────────────────────────

function buildTree(deps: Department[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  deps.forEach((d) => map.set(d.id, { ...d, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ── DeptNode ──────────────────────────────────────────────────────────────────

function DeptNode({
  node,
  depth,
  allFlat,
  onAdd,
  onDelete,
  onRename,
  pending,
}: {
  node: TreeNode;
  depth: number;
  allFlat: Department[];
  onAdd: (parentId: string | null, name: string) => Promise<Department | null>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  pending: boolean;
}) {
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const indentLeft = depth * 20;
  /* ★何階層まで入れ子にできるか（2026-09-19 に 2階層 → MAX_ORG_DEPTH 階層へ）。
        ⚠️★**数字を直書きしないこと。** 規則は `lib/business/orgTree.ts` の1箇所で、
           API（/api/biz/departments）も同じ定数を見る。
           深さは DB で縛っていないので、**定数が1つであることが唯一の担保。**
        ⚠️ `depth` はここでは0起点（最上位が0）。`orgTree.ts` の `depthOf` は
           1起点なので、**そのまま比べないこと。** */
  const canNest = depth < MAX_ORG_DEPTH - 1;

  async function handleAddChild() {
    if (!childName.trim()) return;
    await onAdd(node.id, childName);
    setChildName("");
    setAddingChild(false);
  }

  async function handleRename() {
    if (!editName.trim() || editName === node.name) { setEditing(false); return; }
    await onRename(node.id, editName);
    setEditing(false);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px 7px 0",
          marginLeft: indentLeft,
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        {depth > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 0, color: "var(--line)", flexShrink: 0 }}>
            <div style={{ width: 16, height: 1, background: "var(--line)" }} />
          </div>
        )}

        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditing(false); setEditName(node.name); } }}
            onBlur={handleRename}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              border: "1px solid var(--accent)",
              borderRadius: 5,
              padding: "2px 8px",
              outline: "none",
              color: "var(--ink)",
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: depth === 0 ? 700 : 500,
              color: depth === 0 ? "var(--ink)" : "var(--ink-soft)",
              cursor: "pointer",
            }}
            onDoubleClick={() => setEditing(true)}
            title="ダブルクリックで編集"
          >
            {depth === 0 ? "▸ " : "  "}{node.name}
          </span>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {canNest && (
            <button
              type="button"
              disabled={pending}
              onClick={() => { setAddingChild(true); setConfirmDelete(false); }}
              title="子部門を追加"
              style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}
            >
              + サブ
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => { setEditing(true); setConfirmDelete(false); }}
            title="名前を変更"
            style={{ padding: "2px 6px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
          >
            編集
          </button>
          {confirmDelete ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ background: "var(--error-soft)", border: "1px solid #FCA5A5", borderRadius: 7, padding: "4px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--error)" }}>
                  削除しても求人・社員の記録は残ります
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(node.id)}
                  style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 5, background: "var(--error)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                >
                  削除
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  style={{ padding: "2px 6px", fontSize: 11, border: "none", borderRadius: 5, background: "transparent", color: "var(--error)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "2px 6px", fontSize: 11, border: "1px solid #FCA5A5", borderRadius: 5, background: "#FEF2F2", color: "var(--error)", cursor: "pointer", fontFamily: "inherit" }}
            >
              削除
            </button>
          )}
        </div>
      </div>

      {addingChild && (
        <div style={{ marginLeft: indentLeft + 36, padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            autoFocus
            placeholder="サブ部門名を入力"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddChild(); if (e.key === "Escape") { setAddingChild(false); setChildName(""); } }}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: "inherit",
              border: "1px solid var(--accent)",
              borderRadius: 5,
              padding: "4px 10px",
              outline: "none",
              color: "var(--ink)",
            }}
          />
          <button
            type="button"
            onClick={handleAddChild}
            disabled={!childName.trim() || pending}
            style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 5, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => { setAddingChild(false); setChildName(""); }}
            style={{ padding: "4px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
          >
            キャンセル
          </button>
        </div>
      )}

      {node.children.map((child) => (
        <DeptNode
          key={child.id}
          node={child}
          depth={depth + 1}
          allFlat={allFlat}
          onAdd={onAdd}
          onDelete={onDelete}
          onRename={onRename}
          pending={pending}
        />
      ))}
    </div>
  );
}

// ── DepartmentsEditor ─────────────────────────────────────────────────────────

export function DepartmentsEditor({ initialDepartments }: Props) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isPending, startTransition] = useTransition();
  /* ── ★キーボードで続けて打てる追加欄（2026-09-19 / 柴さんの指示）──────────
     人事担当者が組織図を**上から順に打ち込める**ようにするためのもの。
     テンプレートを外した代わりがこれ。

       Enter      … いまの階層に1件作って、欄はそのまま次の入力を待つ
       Tab        … **直前に作った行の下**へ入る（一段深くなる）
       Shift+Tab  … 一段浅くなる
       Esc        … 閉じる

     ⚠️★**階層は「作る前」に決める。** 作ってから親を付け替える形にしなかったのは、
        付け替えには循環の判定（`wouldCycle`）と移動の API が要るため。
        ここでは**常に既存の行の下に足すだけ**なので、循環は原理的に起きない。
     ⚠️ `pendingParentId` は「次に作る行の親」。`lastCreatedId` は「直前に作った行」。
        **Tab は後者を親にする**ので、1件も作っていないときは効かない。 */
  const [draftName, setDraftName] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | null>(null);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const tree = buildTree(departments);

  async function handleAdd(parentId: string | null, name: string, displayOrder?: number) {
    setError(null);
    /* displayOrder が未指定のときは state から計算する。
       ⚠️ 呼び出し側が渡せる口を残してあるのは、**続けて何件も足すとき**に
          `startTransition` のバッチ遅延で state が更新されず、全部同じ値になるため。
          （テンプレート機能が使っていた口。2026-09-19 にテンプレートは削除したが、
          連続入力で同じ問題を踏みうるので口は残してある。） */
    const order = displayOrder !== undefined
      ? displayOrder
      : departments
          .filter((d) => d.parent_id === parentId)
          .reduce((m, d) => Math.max(m, d.display_order), -1) + 1;

    const res = await fetch("/api/biz/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId, display_order: order }),
    });
    const data = await res.json();
    if (!res.ok) {
      /* ⚠️★**409 を黙って飲み込まないこと**（2026-09-19 に直した）。
            テンプレートが同じ名前を何度も投げる作りだったので握り潰していたが、
            テンプレートを消した今は「**打って Enter を押したのに何も起きない**」に
            なる。理由を画面に出す。
         ⚠️ 制約は `(company_id, name, parent_id)` なので、**同じ階層の同名**だけが重複。
            別の親の下なら同じ名前を作れる（営業 > マネージャー と CS > マネージャー）。 */
      if (res.status === 409) {
        setError("同じ名前の部門が、この階層にすでにあります");
        return null;
      }
      setError(data.error ?? "追加に失敗しました");
      return null;
    }
    startTransition(() => {
      setDepartments((prev) => [...prev, data.department]);
    });
    return data.department as Department;
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/biz/departments/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("削除に失敗しました"); return; }
    startTransition(() => {
      setDepartments((prev) => {
        const toRemove = new Set<string>();
        function collect(rid: string) {
          toRemove.add(rid);
          prev.filter((d) => d.parent_id === rid).forEach((c) => collect(c.id));
        }
        collect(id);
        return prev.filter((d) => !toRemove.has(d.id));
      });
    });
  }

  async function handleRename(id: string, name: string) {
    setError(null);
    const res = await fetch(`/api/biz/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) { setError("更新に失敗しました"); return; }
    startTransition(() => {
      setDepartments((prev) => prev.map((d) => d.id === id ? { ...d, name } : d));
    });
  }

  /** 追加欄の「いまどこに足すか」を組み立てる。画面に出して迷わせないため */
  function draftPath(): string[] {
    const path: string[] = [];
    let cur = pendingParentId;
    for (let guard = 0; guard < MAX_ORG_DEPTH + 1; guard++) {
      if (!cur) break;
      const node = departments.find((d) => d.id === cur);
      if (!node) break;
      path.unshift(node.name);
      cur = node.parent_id;
    }
    return path;
  }

  /** いま追加欄が居る階層（最上位＝1）。上限に達したら Tab を効かせない */
  const draftDepth = draftPath().length + 1;

  async function commitDraft() {
    const name = draftName.trim();
    if (!name) return;
    const created = await handleAdd(pendingParentId, name);
    if (!created) return;               // 失敗時は入力を残す（打ち直さずに済む）
    setDraftName("");
    setLastCreatedId(created.id);
    /* ⚠️ 欄は閉じない。**続けて打てることがこの機能の主目的。** */
    draftRef.current?.focus();
  }

  /** Tab: 直前に作った行の下へ入る */
  function indentDraft() {
    if (!lastCreatedId) return;
    if (draftDepth >= MAX_ORG_DEPTH) return;
    setPendingParentId(lastCreatedId);
  }

  /** Shift+Tab: 一段浅くする */
  function outdentDraft() {
    if (!pendingParentId) return;
    const parent = departments.find((d) => d.id === pendingParentId);
    setPendingParentId(parent?.parent_id ?? null);
    /* ⚠️ 浅くしたら「直前に作った行」はもう親候補ではない。**消しておく**
          （残すと Tab で元の深さに戻ってしまい、行き来が噛み合わない）。 */
    setLastCreatedId(null);
  }

  function closeDraft() {
    setAdding(false);
    setDraftName("");
    setPendingParentId(null);
    setLastCreatedId(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 80px" }}>

      {/* エラー */}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error-ink)", fontWeight: 600 }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: 12, fontSize: 11, color: "var(--error)", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ツリー本体 */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {tree.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>部門がまだ登録されていません</div>
            <div style={{ marginBottom: 16 }}>「部門を追加する」から最初の部門を登録してください</div>
          </div>
        ) : (
          <div style={{ padding: "8px 16px" }}>
            {tree.map((node) => (
              <DeptNode
                key={node.id}
                node={node}
                depth={0}
                allFlat={departments}
                onAdd={handleAdd}
                onDelete={handleDelete}
                onRename={handleRename}
                pending={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ★キーボードで続けて打てる追加欄（2026-09-19）────────────────────────
             ⚠️★**「追加して閉じる」に戻さないこと。** 組織図を上から順に打ち込めることが
                この欄の目的で、1件ごとに開き直す形だと元の使い勝手に戻る。 */}
      {adding ? (
        <div style={{ background: "#fff", border: "1px solid var(--accent)", borderRadius: 10, padding: "10px 14px" }}>
          {/* いまどこに足すか。⚠️ 出さないと**打ち込んだ先が分からなくなる** */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, color: "var(--ink-mute)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, color: "var(--royal)" }}>{draftDepth}階層目に追加</span>
            {draftPath().length > 0 && (
              <span>{draftPath().join(" › ")} の下</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 字下げで深さを目で見せる。⚠️ 幅は DeptNode の indentLeft（20px）と揃える */}
            <span style={{ width: (draftDepth - 1) * 20, flexShrink: 0 }} />
            <input
              ref={draftRef}
              autoFocus
              placeholder="部門名を入力して Enter"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitDraft(); return; }
                /* ⚠️★**Tab は既定だとフォーカスが飛ぶ。** preventDefault が要る。
                      ⚠️ そのぶん**この欄からキーボードだけで出られなくなる**ので、
                         Esc で閉じられることを下の行に書いてある。 */
                if (e.key === "Tab") {
                  e.preventDefault();
                  if (e.shiftKey) outdentDraft(); else indentDraft();
                  return;
                }
                if (e.key === "Escape") { e.preventDefault(); closeDraft(); }
              }}
              style={{
                flex: 1, fontSize: 14, fontFamily: "inherit", border: "none",
                outline: "none", color: "var(--ink)", background: "transparent",
              }}
            />
            <button
              type="button"
              onClick={commitDraft}
              disabled={!draftName.trim() || isPending}
              style={{ padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0, opacity: !draftName.trim() || isPending ? 0.5 : 1 }}
            >
              追加
            </button>
            <button
              type="button"
              onClick={closeDraft}
              style={{ padding: "6px 12px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              閉じる
            </button>
          </div>

          {/* ⚠️ キーの説明は欄の中に置く。ヒント欄まで読みに行かせない */}
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            <kbd style={kbdStyle}>Enter</kbd> で追加して続けて入力／
            <kbd style={kbdStyle}>Tab</kbd> で直前の部門の下へ（{MAX_ORG_DEPTH}階層まで）／
            <kbd style={kbdStyle}>Shift</kbd>+<kbd style={kbdStyle}>Tab</kbd> で一段戻る／
            <kbd style={kbdStyle}>Esc</kbd> で閉じる
            {lastCreatedId === null && pendingParentId === null && (
              <span>　※ Tab は1件目を追加したあとから使えます</span>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            border: "2px dashed var(--line)",
            borderRadius: 10,
            background: "transparent",
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          部門を追加する
        </button>
      )}

      {/* 使い方ヒント */}
      <div style={{ marginTop: 24, padding: "12px 16px", background: "var(--royal-50)", borderRadius: 10, border: "1px solid var(--royal-100)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 6 }}>使い方のヒント</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          <li>「部門を追加する」を開くと、<b>Enter で続けて打ち込めます</b>（Tab で一段下、Shift+Tab で一段上）</li>
          <li>部門名をダブルクリックすると名前を変更できます</li>
          <li>「+ サブ」ボタンでもその部門の下に追加できます（{/* ⚠️ 数字を直書きしない */}
            最大{MAX_ORG_DEPTH}階層まで）</li>
          <li>部門を削除すると<b>その下の部門も一緒に削除されます</b>。紐づいている求人・社員の記録は残ります</li>
          {/* ⚠️★2026-09-19 に「社員登録」を外した。社員登録の「部署」は**自由入力**で、
                 部門マスタと繋がっていない。**守れない約束を画面に出さない。**
                 社員登録をマスタから選ぶ形にするなら、ここも戻すこと。 */}
          <li>ここで登録した部門は、求人作成の「所属部門」から選べます</li>
        </ul>
      </div>
    </div>
  );
}

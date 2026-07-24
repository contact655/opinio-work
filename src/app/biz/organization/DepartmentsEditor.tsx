"use client";

import { useState, useTransition } from "react";

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

// ── テンプレート ─────────────────────────────────────────────────────────────

type TemplateEntry = { name: string; children?: string[] };

const DEPT_TEMPLATES: { key: string; label: string; items: TemplateEntry[] }[] = [
  {
    key: "saas",
    label: "SaaS（営業・CS）",
    items: [
      { name: "営業", children: ["インサイドセールス", "フィールドセールス", "エンタープライズ営業"] },
      { name: "カスタマーサクセス", children: ["オンボーディング", "リニューアル・拡大"] },
      { name: "マーケティング", children: ["フィールドマーケ", "プロダクトマーケ"] },
      { name: "プロダクト・開発", children: ["エンジニアリング", "プロダクトマネジメント"] },
      { name: "コーポレート" },
    ],
  },
  {
    key: "sier",
    label: "SIer（受託開発）",
    items: [
      { name: "開発本部", children: ["アプリケーション開発", "インフラ・SRE"] },
      { name: "営業・PMO", children: ["営業", "プロジェクトマネジメント"] },
      { name: "デリバリー・CS", children: ["導入支援", "カスタマーサポート"] },
      { name: "コーポレート" },
    ],
  },
  {
    key: "hr",
    label: "人材（HR）",
    items: [
      { name: "事業部", children: ["コンサルティング", "リクルーティング", "採用代行"] },
      { name: "プロダクト・テクノロジー" },
      { name: "マーケティング" },
      { name: "コーポレート" },
    ],
  },
  {
    key: "general",
    label: "スタートアップ（汎用）",
    items: [
      { name: "プロダクト", children: ["エンジニアリング", "デザイン"] },
      { name: "ビジネス", children: ["営業", "マーケティング"] },
      { name: "コーポレート" },
    ],
  },
];

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
  const canNest = depth < 2;

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

// ── テンプレートモーダル ──────────────────────────────────────────────────────

function TemplateModal({
  onApply,
  onClose,
}: {
  onApply: (items: TemplateEntry[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const template = DEPT_TEMPLATES.find((t) => t.key === selected);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, padding: 28, width: 500, maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>テンプレートから追加</div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 20 }}>
          業種に合ったテンプレートを選択してください。既存の部門に追加されます。
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {DEPT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected(t.key)}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: selected === t.key ? "2px solid var(--royal)" : "1px solid var(--line)",
                background: selected === t.key ? "var(--royal-50)" : "#fff",
                color: selected === t.key ? "var(--royal)" : "var(--ink)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: selected === t.key ? 700 : 500,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {template && (
          <div style={{ marginBottom: 20, padding: "12px 14px", background: "var(--bg-tint)", borderRadius: 8, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>追加される部門</div>
            {template.items.map((item) => (
              <div key={item.name} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>▸ {item.name}</div>
                {item.children?.map((c) => (
                  <div key={c} style={{ fontSize: 12, color: "var(--ink-soft)", paddingLeft: 20, lineHeight: 1.8 }}>  {c}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={!template}
            onClick={() => template && onApply(template.items)}
            style={{
              padding: "8px 20px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8,
              background: template ? "var(--royal)" : "var(--line)",
              color: template ? "#fff" : "var(--ink-mute)",
              cursor: template ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            このテンプレートを追加
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DepartmentsEditor ─────────────────────────────────────────────────────────

export function DepartmentsEditor({ initialDepartments }: Props) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [isPending, startTransition] = useTransition();
  const [newRootName, setNewRootName] = useState("");
  const [addingRoot, setAddingRoot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateProgress, setTemplateProgress] = useState<string | null>(null);

  const tree = buildTree(departments);

  async function handleAdd(parentId: string | null, name: string) {
    setError(null);
    const maxOrder = departments
      .filter((d) => d.parent_id === parentId)
      .reduce((m, d) => Math.max(m, d.display_order), -1);

    const res = await fetch("/api/biz/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId, display_order: maxOrder + 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      // 重複はスキップ（テンプレート適用時）
      if (res.status === 409) return null;
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

  async function handleAddRoot() {
    if (!newRootName.trim()) return;
    await handleAdd(null, newRootName);
    setNewRootName("");
    setAddingRoot(false);
  }

  async function applyTemplate(items: TemplateEntry[]) {
    setShowTemplateModal(false);
    setTemplateProgress("テンプレートを追加中...");
    for (const item of items) {
      const parent = await handleAdd(null, item.name);
      if (parent && item.children) {
        for (const childName of item.children) {
          await handleAdd(parent.id, childName);
        }
      }
    }
    setTemplateProgress(null);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 32px" }}>
      {/* テンプレートボタン（右上） */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowTemplateModal(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", fontSize: 12, fontWeight: 600,
            border: "1px solid var(--royal-100)", borderRadius: 7,
            background: "var(--royal-50)", color: "var(--royal)",
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          テンプレート
        </button>
      </div>


      {/* テンプレート進捗 */}
      {templateProgress && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--royal-50)", border: "1px solid var(--royal-100)", fontSize: 13, color: "var(--royal)", fontWeight: 600 }}>
          {templateProgress}
        </div>
      )}

      {/* エラー */}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error)", fontWeight: 600 }}>
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
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", fontSize: 12, fontWeight: 600,
                border: "1px solid var(--royal-100)", borderRadius: 7,
                background: "var(--royal-50)", color: "var(--royal)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              テンプレートから始める →
            </button>
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

      {/* ルート部門追加 */}
      {addingRoot ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--accent)", borderRadius: 10, padding: "10px 14px" }}>
          <input
            autoFocus
            placeholder="例：営業部、エンジニアリング部、コーポレート..."
            value={newRootName}
            onChange={(e) => setNewRootName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddRoot(); if (e.key === "Escape") { setAddingRoot(false); setNewRootName(""); } }}
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: "inherit",
              border: "none",
              outline: "none",
              color: "var(--ink)",
              background: "transparent",
            }}
          />
          <button
            type="button"
            onClick={handleAddRoot}
            disabled={!newRootName.trim() || isPending}
            style={{ padding: "6px 16px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => { setAddingRoot(false); setNewRootName(""); }}
            style={{ padding: "6px 12px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            キャンセル
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingRoot(true)}
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
          <li>部門名をダブルクリックすると名前を変更できます</li>
          <li>「+ サブ」ボタンでその部門の下に子部門を追加（最大2階層まで）</li>
          <li>部門を削除しても、紐づいている求人・社員の記録は残ります</li>
          <li>ここで登録した部門は、求人作成・社員登録の「所属部門」セレクトボックスに表示されます</li>
        </ul>
      </div>

      {/* テンプレートモーダル */}
      {showTemplateModal && (
        <TemplateModal
          onApply={applyTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
}

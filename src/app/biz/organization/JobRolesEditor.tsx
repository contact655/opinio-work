"use client";

import { useState, useTransition, useRef, useEffect } from "react";

export type CompanyJobRole = {
  id: string;
  name: string;
  standard_role_id: string | null;
  display_order: number;
};

export type StandardRole = {
  id: string;
  name: string;
  parent_id: string | null;
};

type Props = {
  initialRoles: CompanyJobRole[];
  standardRoles: StandardRole[];
};

function StandardRoleBadge({ roleId, roles }: { roleId: string | null; roles: StandardRole[] }) {
  if (!roleId) return null;
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "1px 7px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      background: "var(--royal-50)",
      color: "var(--royal)",
      border: "1px solid var(--royal-100)",
      flexShrink: 0,
    }}>
      {role.name}
    </span>
  );
}

function StandardRoleCombobox({
  value,
  onChange,
  roles,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  roles: StandardRole[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const parentMap = new Map(roles.filter((r) => !r.parent_id).map((r) => [r.id, r.name]));

  const getSelectedLabel = () => {
    if (!value) return "";
    const role = roles.find((r) => r.id === value);
    if (!role) return "";
    if (!role.parent_id) return role.name;
    return `${parentMap.get(role.parent_id) ?? ""} › ${role.name}`;
  };

  const filtered = roles.filter((r) => {
    if (!query) return true;
    if (!r.parent_id) {
      return r.name.includes(query);
    }
    const parent = parentMap.get(r.parent_id) ?? "";
    return parent.includes(query) || r.name.includes(query);
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 200 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`,
          borderRadius: 5,
          background: "#fff",
          cursor: "text",
          padding: "3px 6px 3px 8px",
          gap: 4,
        }}
        onClick={() => { if (!open) { setOpen(true); setQuery(""); } }}
      >
        <input
          value={open ? query : getSelectedLabel()}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (!open) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && filtered.length === 1) { handleSelect(filtered[0].id); }
          }}
          placeholder={open ? "検索…" : (placeholder ?? "標準職種（任意）")}
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: "inherit",
            border: "none",
            outline: "none",
            background: "transparent",
            color: (value && !open) ? "var(--ink)" : "var(--ink-soft)",
            minWidth: 0,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{ fontSize: 11, color: "var(--ink-mute)", border: "none", background: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: "var(--ink-mute)", pointerEvents: "none" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {open && (
        <ul
          ref={listRef}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            zIndex: 100,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
          }}
        >
          {/* 未設定に戻す */}
          <li
            onClick={() => handleSelect("")}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: "var(--ink-mute)",
              cursor: "pointer",
              borderBottom: "1px solid var(--line-soft)",
              marginBottom: 2,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            紐づけなし
          </li>

          {filtered.length === 0 ? (
            <li style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
              該当なし
            </li>
          ) : (
            <>
              {filtered.length > 20 && (
                <li style={{ padding: "4px 12px", fontSize: 11, color: "var(--ink-mute)" }}>
                  {filtered.length} 件 — 絞り込むと候補が減ります
                </li>
              )}
              {filtered.map((r) => {
                const isParent = !r.parent_id;
                const parentName = r.parent_id ? (parentMap.get(r.parent_id) ?? "") : "";
                return (
                  <li
                    key={r.id}
                    onClick={() => handleSelect(r.id)}
                    style={{
                      padding: isParent ? "6px 12px" : "5px 12px 5px 22px",
                      fontSize: 12,
                      fontWeight: isParent ? 700 : 400,
                      color: isParent ? "var(--ink)" : "var(--ink-soft)",
                      cursor: "pointer",
                      background: r.id === value ? "var(--royal-50)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                    onMouseLeave={(e) => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {isParent ? r.name : (query ? <>{parentName} › <strong>{r.name}</strong></> : r.name)}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

export function JobRolesEditor({ initialRoles, standardRoles }: Props) {
  const [roles, setRoles] = useState<CompanyJobRole[]>(initialRoles);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStdRoleId, setNewStdRoleId] = useState("");

  // 行編集
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStdRoleId, setEditStdRoleId] = useState("");

  // 削除確認
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    setError(null);
    const maxOrder = roles.reduce((m, r) => Math.max(m, r.display_order), -1);
    const res = await fetch("/api/biz/job-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        standard_role_id: newStdRoleId || null,
        display_order: maxOrder + 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "追加に失敗しました"); return; }
    startTransition(() => {
      setRoles((prev) => [...prev, data.jobRole]);
    });
    setNewName("");
    setNewStdRoleId("");
    setAddingNew(false);
  }

  function startEdit(role: CompanyJobRole) {
    setEditingId(role.id);
    setEditName(role.name);
    setEditStdRoleId(role.standard_role_id ?? "");
    setConfirmDeleteId(null);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    setError(null);
    const res = await fetch(`/api/biz/job-roles/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        standard_role_id: editStdRoleId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "更新に失敗しました");
      return;
    }
    startTransition(() => {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? { ...r, name: editName, standard_role_id: editStdRoleId || null }
            : r
        )
      );
    });
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/biz/job-roles/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("削除に失敗しました"); return; }
    startTransition(() => {
      setRoles((prev) => prev.filter((r) => r.id !== id));
    });
    setConfirmDeleteId(null);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 32px" }}>

      {/* エラー */}
      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", border: "1px solid #FCA5A5", fontSize: 13, color: "var(--error)", fontWeight: 600 }}>
          {error}
          <button type="button" onClick={() => setError(null)} style={{ marginLeft: 12, fontSize: 11, color: "var(--error)", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* 職種リスト */}
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {roles.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>職種がまだ登録されていません</div>
            <div>「職種を追加する」から自社の職種を登録してください</div>
          </div>
        ) : (
          <div>
            {/* テーブルヘッダー */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-tint)" }}>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>自社の呼び方</span>
              <span style={{ width: 200, fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>標準職種（マッチング用）</span>
              <span style={{ width: 120 }} />
            </div>

            {roles.map((role, idx) => (
              <div
                key={role.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  borderTop: idx > 0 ? "1px solid var(--line-soft)" : "none",
                  background: editingId === role.id ? "var(--royal-50)" : "#fff",
                }}
              >
                {/* 職種名（編集 or 表示） */}
                {editingId === role.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      border: "1px solid var(--accent)",
                      borderRadius: 5,
                      padding: "4px 10px",
                      outline: "none",
                      color: "var(--ink)",
                    }}
                  />
                ) : (
                  <span
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)", cursor: "default" }}
                    onDoubleClick={() => startEdit(role)}
                    title="ダブルクリックで編集"
                  >
                    {role.name}
                  </span>
                )}

                {/* 標準職種（編集 or バッジ） */}
                {editingId === role.id ? (
                  <div style={{ width: 200 }}>
                    <StandardRoleCombobox
                      value={editStdRoleId}
                      onChange={setEditStdRoleId}
                      roles={standardRoles}
                    />
                  </div>
                ) : (
                  <div style={{ width: 200 }}>
                    {role.standard_role_id
                      ? <StandardRoleBadge roleId={role.standard_role_id} roles={standardRoles} />
                      : <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>未設定</span>
                    }
                  </div>
                )}

                {/* アクション */}
                <div style={{ width: 120, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  {editingId === role.id ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={!editName.trim() || isPending}
                        style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 5, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{ padding: "3px 8px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        キャンセル
                      </button>
                    </>
                  ) : confirmDeleteId === role.id ? (
                    <>
                      <span style={{ fontSize: 11, color: "var(--error)", fontWeight: 600 }}>削除?</span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(role.id)}
                        style={{ padding: "3px 8px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 5, background: "var(--error)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        削除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: "3px 6px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => { startEdit(role); }}
                        style={{ padding: "3px 8px", fontSize: 11, border: "1px solid var(--line)", borderRadius: 5, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => { setConfirmDeleteId(role.id); setEditingId(null); }}
                        style={{ padding: "3px 6px", fontSize: 11, border: "1px solid #FCA5A5", borderRadius: 5, background: "#FEF2F2", color: "var(--error)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        削除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加フォーム */}
      {addingNew ? (
        <div style={{ background: "#fff", border: "1px solid var(--accent)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <input
              autoFocus
              placeholder="例：FS、フィールドセールス、AE..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); setNewStdRoleId(""); } }}
              style={{
                flex: 1,
                minWidth: 160,
                fontSize: 14,
                fontFamily: "inherit",
                border: "1px solid var(--line)",
                borderRadius: 7,
                padding: "7px 12px",
                outline: "none",
                color: "var(--ink)",
              }}
            />
            <StandardRoleCombobox
              value={newStdRoleId}
              onChange={setNewStdRoleId}
              roles={standardRoles}
              placeholder="標準職種に紐づける（任意）"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim() || isPending}
              style={{ padding: "7px 18px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, background: "var(--royal)", color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => { setAddingNew(false); setNewName(""); setNewStdRoleId(""); }}
              style={{ padding: "7px 12px", fontSize: 13, border: "1px solid var(--line)", borderRadius: 7, background: "#fff", color: "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
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
            marginBottom: 16,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal-100)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          職種を追加する
        </button>
      )}

      {/* ヒント */}
      <div style={{ marginTop: 8, padding: "12px 16px", background: "var(--royal-50)", borderRadius: 10, border: "1px solid var(--royal-100)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 6 }}>使い方のヒント</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
          <li>「自社の呼び方」は社内で使っている職種名を自由に入力してください（例：FS, AE, IC など略称も可）</li>
          <li>「標準職種」と紐づけると、OPINIOの求人検索・マッチングで正しく分類されます</li>
          <li>職種名をダブルクリックするとインライン編集できます</li>
          <li>削除しても、その職種に紐づいた求人の記録は残ります</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

/**
 * CategoriesEditor — 現役社員カテゴリ設定エディター
 *
 * QB-3: 一覧表示 + ページ枠組み ✅
 * QB-4: 追加・削除機能 ✅
 * QB-5: DnD 並べ替え ✅ (このバージョン)
 * QB-6: エッジケース・仕上げ (TODO)
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CompanyEmployeeCategoryItem, RoleForEditor } from "@/lib/supabase/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalCategory = CompanyEmployeeCategoryItem & {
  isNew: boolean; // true = 未保存の新規追加、id は temp 文字列
};

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  initialCategories: CompanyEmployeeCategoryItem[];
  allRoles: RoleForEditor[];
  companyId: string;
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// ─── 削除確認モーダル ─────────────────────────────────────────────────────────

function ConfirmDeleteModal({
  target,
  onConfirm,
  onCancel,
}: {
  target: LocalCategory;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: "#fff", borderRadius: 14, padding: "28px 28px 24px",
        width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
        <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 700,
          color: "var(--ink)", marginBottom: 10, marginTop: 0 }}>
          カテゴリを削除
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 24 }}>
          「<strong>{target.roleName}</strong>」を削除しますか？
          <br />
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            ※ このカテゴリに所属する現役社員データは変更されません。
            保存ボタンを押すまで反映されません。
          </span>
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid var(--line)",
            borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600,
            color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}>
            キャンセル
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 16px", border: "none",
            borderRadius: 8, background: "var(--error)", fontSize: 13, fontWeight: 700,
            color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── カテゴリ追加モーダル ────────────────────────────────────────────────────

function AddCategoryModal({
  allRoles,
  currentRoleIds,
  onAdd,
  onCancel,
}: {
  allRoles: RoleForEditor[];
  currentRoleIds: Set<string>;
  onAdd: (roles: RoleForEditor[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const parents = allRoles.filter((r) => r.parentId === null);
  const childrenByParent = new Map<string, RoleForEditor[]>();
  for (const role of allRoles) {
    if (role.parentId) {
      if (!childrenByParent.has(role.parentId)) childrenByParent.set(role.parentId, []);
      childrenByParent.get(role.parentId)!.push(role);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  const selectedRoles = allRoles.filter((r) => selected.has(r.id));
  const canAdd = selectedRoles.length > 0;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        {/* ヘッダー */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 700,
            color: "var(--ink)", margin: "0 0 4px" }}>
            カテゴリを追加
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
            追加したいカテゴリをチェックしてください。複数選択可。
            <br />グレー表示はすでに追加済みです。
          </p>
        </div>

        {/* ロール一覧 */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {parents.map((parent) => {
            const children = childrenByParent.get(parent.id) ?? [];
            const isParentAdded = currentRoleIds.has(parent.id);
            const isParentSelected = selected.has(parent.id);
            return (
              <div key={parent.id}>
                {/* 親カテゴリ行 */}
                <label
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 24px",
                    cursor: isParentAdded ? "default" : "pointer",
                    background: isParentSelected ? "var(--royal-50)" : "transparent" }}
                  onMouseEnter={(e) => {
                    if (!isParentAdded && !isParentSelected)
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isParentAdded && !isParentSelected)
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <input type="checkbox" checked={isParentAdded || isParentSelected}
                    disabled={isParentAdded}
                    onChange={() => !isParentAdded && toggle(parent.id)}
                    style={{ width: 15, height: 15, cursor: isParentAdded ? "default" : "pointer", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700,
                    color: isParentAdded ? "var(--ink-mute)" : "var(--ink)" }}>
                    {parent.name}
                  </span>
                  {children.length > 0 && !isParentAdded && (
                    <span style={{ fontSize: 10, color: "var(--ink-mute)", background: "var(--line-soft)",
                      border: "1px solid var(--line)", borderRadius: 4, padding: "1px 6px", marginLeft: "auto" }}>
                      親直として追加
                    </span>
                  )}
                  {isParentAdded && (
                    <span style={{ fontSize: 10, color: "var(--success)", marginLeft: "auto" }}>
                      追加済み
                    </span>
                  )}
                </label>

                {/* 子カテゴリ行 */}
                {children.map((child) => {
                  const isChildAdded = currentRoleIds.has(child.id);
                  const isChildSelected = selected.has(child.id);
                  return (
                    <label key={child.id}
                      style={{ display: "flex", alignItems: "center", gap: 10,
                        padding: "7px 24px 7px 52px",
                        cursor: isChildAdded ? "default" : "pointer",
                        background: isChildSelected ? "var(--royal-50)" : "transparent" }}
                      onMouseEnter={(e) => {
                        if (!isChildAdded && !isChildSelected)
                          (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isChildAdded && !isChildSelected)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      <input type="checkbox" checked={isChildAdded || isChildSelected}
                        disabled={isChildAdded}
                        onChange={() => !isChildAdded && toggle(child.id)}
                        style={{ width: 14, height: 14, cursor: isChildAdded ? "default" : "pointer", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, color: isChildAdded ? "var(--ink-mute)" : "var(--ink)" }}>
                        {child.name}
                      </span>
                      {isChildAdded && (
                        <span style={{ fontSize: 10, color: "var(--success)", marginLeft: "auto" }}>
                          追加済み
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            {selected.size > 0 ? `${selected.size} 件選択中` : "カテゴリを選択してください"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel}
              style={{ padding: "8px 16px", border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
                cursor: "pointer", fontFamily: "inherit" }}>
              キャンセル
            </button>
            <button onClick={() => canAdd && onAdd(selectedRoles)} disabled={!canAdd}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8,
                background: canAdd ? "var(--royal)" : "var(--line)",
                fontSize: 13, fontWeight: 700, color: "#fff",
                cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}>
              追加 ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CategoryRow (ドラッグハンドル付き) ─────────────────────────────────────

function CategoryRow({
  category,
  index,
  onDeleteClick,
  dragHandleProps,
  isDragging,
  isDragDisabled,
}: {
  category: LocalCategory;
  index: number;
  onDeleteClick: (cat: LocalCategory) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
  isDragDisabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: isDragging
          ? "var(--royal-50)"
          : category.isNew
            ? "var(--royal-50)"
            : "#fff",
        border: `1px solid ${
          isDragging ? "var(--royal)" : category.isNew ? "var(--royal-100)" : "var(--line)"
        }`,
        borderRadius: 10,
        marginBottom: 8,
        boxShadow: isDragging ? "0 4px 16px rgba(0,35,102,0.15)" : "none",
        opacity: isDragging ? 0.6 : 1,
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
      }}
    >
      {/* ドラッグハンドル */}
      <div
        {...dragHandleProps}
        style={{
          width: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          flexShrink: 0,
          opacity: isDragDisabled ? 0.2 : 0.45,
          cursor: isDragDisabled ? "not-allowed" : "grab",
          paddingTop: 2,
          touchAction: "none",
        }}
        aria-label="並べ替えハンドル"
      >
        {[0, 1, 2].map((i) => (
          <div key={i}
            style={{ width: 14, height: 2, background: "var(--ink-soft)", borderRadius: 1 }}
          />
        ))}
      </div>

      {/* 表示順バッジ */}
      <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--line-soft)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700,
        color: "var(--ink-mute)", flexShrink: 0 }}>
        {index + 1}
      </div>

      {/* カテゴリ名 + バッジ */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
          {category.roleName}
        </span>
        {category.parentName && (
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-mute)",
            background: "var(--line-soft)", border: "1px solid var(--line)",
            borderRadius: 4, padding: "1px 7px" }}>
            {category.parentName}
          </span>
        )}
        {!category.parentName && (
          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--ink-mute)",
            border: "1px solid var(--line)", borderRadius: 4, padding: "1px 6px" }}>
            親直
          </span>
        )}
        {category.isNew && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            borderRadius: 4, padding: "1px 7px" }}>
            未保存
          </span>
        )}
      </div>

      {/* 削除ボタン */}
      <button
        onClick={() => onDeleteClick(category)}
        style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--line)",
          background: "#fff", color: "var(--ink-mute)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.15s" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--error-soft)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mute)";
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
        }}
        title="削除"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── SortableCategoryRow (@dnd-kit useSortable ラッパー) ─────────────────────

function SortableCategoryRow({
  category,
  index,
  onDeleteClick,
  isDragDisabled,
}: {
  category: LocalCategory;
  index: number;
  onDeleteClick: (cat: LocalCategory) => void;
  isDragDisabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, disabled: isDragDisabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategoryRow
        category={category}
        index={index}
        onDeleteClick={onDeleteClick}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        isDragDisabled={isDragDisabled}
      />
    </div>
  );
}

// ─── CategoriesEditor (メインコンポーネント) ──────────────────────────────────

export function CategoriesEditor({ initialCategories, allRoles, companyId: _companyId }: Props) {
  const router = useRouter();

  // ── DnD Sensors (PointerSensor のみ、キーボードは今回スコープ外) ─────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px 動いてからドラッグ開始 (誤クリック防止)
    })
  );

  // ── State ──────────────────────────────────────────────────────────────────

  const [categories, setCategories] = useState<LocalCategory[]>(() =>
    initialCategories.map((c) => ({ ...c, isNew: false }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LocalCategory | null>(null);

  // サーバーリフレッシュ後に initialCategories が変わったら同期
  const prevInitialRef = useRef(initialCategories);
  useEffect(() => {
    if (prevInitialRef.current !== initialCategories) {
      prevInitialRef.current = initialCategories;
      setCategories(initialCategories.map((c) => ({ ...c, isNew: false })));
      setIsDirty(false);
      setSaveState("idle");
      setSaveError(null);
    }
  }, [initialCategories]);

  // ── 現在の roleId セット (追加済み判定用) ──────────────────────────────────

  const currentRoleIds = new Set(categories.map((c) => c.roleId));

  // ── DnD ハンドラ ─────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCategories((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setIsDirty(true);
  }

  // ── 追加ハンドラ ────────────────────────────────────────────────────────────

  function handleAdd(roles: RoleForEditor[]) {
    const startOrder = categories.length;
    const newCats: LocalCategory[] = roles.map((role, i) => ({
      id: `new-${Date.now()}-${i}`,
      roleId: role.id,
      roleName: role.name,
      parentId: role.parentId,
      parentName: role.parentId
        ? (allRoles.find((r) => r.id === role.parentId)?.name ?? null)
        : null,
      displayOrder: startOrder + i,
      isNew: true,
    }));
    setCategories((prev) => [...prev, ...newCats]);
    setIsDirty(true);
    setShowAddModal(false);
  }

  // ── 削除ハンドラ ────────────────────────────────────────────────────────────

  function handleDeleteClick(cat: LocalCategory) {
    if (cat.isNew) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setIsDirty(true);
    } else {
      setDeleteTarget(cat);
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setIsDirty(true);
    setDeleteTarget(null);
  }

  // ── 保存ハンドラ (DELETE → POST → PUT) ────────────────────────────────────

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);

    const toDelete = prevInitialRef.current.filter(
      (orig) => !categories.some((c) => !c.isNew && c.id === orig.id)
    );
    const toAdd = categories.filter((c) => c.isNew);

    try {
      // ── Step 1: DELETE + POST を並列実行 ─────────────────────────────────
      const deleteResults = await Promise.all(
        toDelete.map((c) =>
          fetch(`/api/biz/company/employee-categories/${c.id}`, { method: "DELETE" })
        )
      );
      const addResults = await Promise.all(
        toAdd.map((c) =>
          fetch("/api/biz/company/employee-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId: c.roleId, displayOrder: 0 }), // 仮順序、PUT で上書き
          })
        )
      );

      // エラーチェック (DELETE の 404 = 既に削除済みは成功扱い)
      const deleteFailed = deleteResults.filter(
        (r) => !r.ok && r.status !== 404
      );
      const addFailed = addResults.filter((r) => !r.ok);
      if (deleteFailed.length > 0 || addFailed.length > 0) {
        const errRes = addFailed[0] ?? deleteFailed[0];
        const errBody = await errRes.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error ?? "保存に失敗しました");
      }

      // ── Step 2: POST で得た実 ID を取得 ──────────────────────────────────
      const addBodies: { id: string }[] = await Promise.all(
        addResults.map((r) => r.json())
      );

      // temp ID → 実 ID マップ
      const tempToRealId = new Map<string, string>();
      toAdd.forEach((cat, i) => {
        if (addBodies[i]?.id) tempToRealId.set(cat.id, addBodies[i].id);
      });

      // ── Step 3: 順序変更の判定 ───────────────────────────────────────────
      // 現在の既存アイテムの順序
      const currentExistingIds = categories
        .filter((c) => !c.isNew)
        .map((c) => c.id);

      // 元データから削除分を除いた期待順序
      const expectedIds = prevInitialRef.current
        .filter((orig) => !toDelete.some((d) => d.id === orig.id))
        .map((c) => c.id);

      const existingOrderChanged = !arraysEqual(currentExistingIds, expectedIds);
      const needsPut = toAdd.length > 0 || existingOrderChanged;

      if (needsPut) {
        // ── Step 4: PUT で最終順序を確定 ───────────────────────────────────
        // 現在の categories 順 → temp ID を実 ID に置換
        const orderedIds = categories
          .map((c) => (c.isNew ? tempToRealId.get(c.id) : c.id))
          .filter((id): id is string => !!id);

        if (orderedIds.length > 0) {
          const reorderRes = await fetch("/api/biz/company/employee-categories", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderedIds }),
          });
          if (!reorderRes.ok) {
            const errBody = await reorderRes.json().catch(() => ({}));
            throw new Error(
              (errBody as { error?: string }).error ?? "順序の保存に失敗しました"
            );
          }
        }
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
      router.refresh(); // useEffect で categories が initialCategories から再同期
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "保存中にエラーが発生しました");
    }
  }

  // ── 変更破棄 ────────────────────────────────────────────────────────────────

  function handleDiscard() {
    setCategories(prevInitialRef.current.map((c) => ({ ...c, isNew: false })));
    setIsDirty(false);
    setSaveState("idle");
    setSaveError(null);
  }

  // ── DnD は 2 件以上の場合のみ有効 ──────────────────────────────────────────

  const isDragDisabled = categories.length <= 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 32px 80px" }}>

        {/* ページヘッダー */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--royal-50)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-noto-serif)", fontSize: 20,
              fontWeight: 700, color: "var(--ink)" }}>
              現役社員カテゴリ設定
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            求職者向けページの「現役社員」セクションで、職種カテゴリ別にグルーピング表示されます。
            <br />表示順の変更・カテゴリの追加・削除が可能です。
          </p>
        </div>

        {/* ヘルプテキスト */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 16px", background: "var(--royal-50)",
          border: "1px solid var(--royal-100)", borderRadius: 10, marginBottom: 28 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--royal)" strokeWidth="2.2" strokeLinecap="round"
            style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ margin: 0, fontSize: 12, color: "var(--royal)", lineHeight: 1.7 }}>
            初期カテゴリは現役社員データから自動生成されています。自由に編集してください。
            <br />0 名のカテゴリを設定しておくことで、今後の社員追加に備えた先行設定が可能です。
          </p>
        </div>

        {/* 未保存バナー */}
        {isDirty && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: "var(--warm-soft)", border: "1px solid #FCD34D",
            borderRadius: 10, marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--warm)" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--warm)", fontWeight: 600, flex: 1 }}>
              未保存の変更があります。保存ボタンを押して反映してください。
            </span>
          </div>
        )}

        {/* エラーバナー */}
        {saveState === "error" && saveError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: "var(--error-soft)", border: "1px solid #FECACA",
            borderRadius: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: "var(--error)", fontWeight: 600 }}>
              ⚠️ {saveError}
            </span>
          </div>
        )}

        {/* カテゴリリスト */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)",
              display: "flex", alignItems: "center", gap: 6 }}>
              表示中のカテゴリ
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12,
                fontWeight: 400, color: "var(--ink-mute)" }}>
                ({categories.length}件)
              </span>
              {!isDragDisabled && (
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400 }}>
                  · ドラッグで並べ替え可
                </span>
              )}
            </div>

            {/* カテゴリを追加ボタン */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: "var(--royal)", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer",
                fontFamily: "inherit", transition: "opacity 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              カテゴリを追加
            </button>
          </div>

          {categories.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center",
              background: "var(--bg-tint)", border: "1px dashed var(--line)",
              borderRadius: 12 }}>
              {/* アイコン */}
              <div style={{ width: 52, height: 52, borderRadius: 14,
                background: "#fff", border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--ink-mute)" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              {/* 見出し */}
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                カテゴリが設定されていません
              </div>
              {/* サブテキスト */}
              <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.75,
                margin: "0 0 20px", maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
                「カテゴリを追加」からカテゴリを選んでください。<br />
                0 名のカテゴリを先行設定しておくことも可能です。
              </p>
              {/* CTAボタン */}
              <button
                onClick={() => setShowAddModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", background: "var(--royal)", border: "none",
                  borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff",
                  cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                カテゴリを追加
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {categories.map((cat, i) => (
                  <SortableCategoryRow
                    key={cat.id}
                    category={cat}
                    index={i}
                    onDeleteClick={handleDeleteClick}
                    isDragDisabled={isDragDisabled}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* アクションエリア */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center",
          gap: 10, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
          {isDirty && saveState !== "saving" && (
            <button
              onClick={handleDiscard}
              style={{ padding: "9px 18px", border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", fontSize: 13, fontWeight: 600,
                color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}
            >
              変更を破棄
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={!isDirty || saveState === "saving"}
            style={{
              padding: "9px 20px", border: "none", borderRadius: 8,
              background: saveState === "saved"
                ? "var(--success)"
                : !isDirty ? "var(--line)" : "var(--royal)",
              fontSize: 13, fontWeight: 700, color: "#fff",
              cursor: !isDirty || saveState === "saving" ? "default" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
              opacity: saveState === "saving" ? 0.7 : 1,
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            {saveState === "saving" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {saveState === "saved"
              ? "✓ 保存しました"
              : saveState === "saving"
                ? "保存中…"
                : "変更を保存"}
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {showAddModal && (
        <AddCategoryModal
          allRoles={allRoles}
          currentRoleIds={currentRoleIds}
          onAdd={handleAdd}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          target={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

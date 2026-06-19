"use client";

/**
 * CategoriesEditor — 組織体制エディター
 *
 * QB-3: 一覧表示 + ページ枠組み ✅
 * QB-4: 追加・削除機能 ✅
 * QB-5: DnD 並べ替え ✅
 * QB-6: エッジケース・仕上げ ✅
 *   - 保存成功後ちらつき修正（router.refresh race condition）
 *   - AddCategoryModal 全件追加済み空状態
 *   - AddCategoryModal allRoles 0件空状態
 *   - 保存中のボタン無効化
 *   - エラー時は未保存バナーを非表示（error バナーのみ）
 *   - 両モーダルの Escape キー対応
 *   - ページ離脱時の未保存警告（beforeunload）
 */

import { useState, useEffect, useRef, useCallback } from "react";
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
  isCustom?: boolean; // true = 自由入力カテゴリ（roleId = null）
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

/** モーダル外クリック + Escape キー両対応のフック */
function useModalClose(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
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
  useModalClose(onCancel);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        style={{ background: "#fff", borderRadius: 14, padding: "28px 28px 24px",
          width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
      >
        <h2 id="confirm-delete-title" style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 700,
          color: "var(--ink)", marginBottom: 10, marginTop: 0 }}>
          カテゴリを削除
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 24 }}>
          「<strong style={{ wordBreak: "break-all" }}>{target.roleName}</strong>」を削除しますか？
          <br />
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            ※ このカテゴリに所属する現役社員データは変更されません。
            保存ボタンを押すまで反映されません。
          </span>
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{ padding: "8px 16px", border: "1px solid var(--line)",
            borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 600,
            color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}>
            キャンセル
          </button>
          <button type="button" onClick={onConfirm} style={{ padding: "8px 16px", border: "none",
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
  onAddCustom,
  onCancel,
}: {
  allRoles: RoleForEditor[];
  currentRoleIds: Set<string>;
  onAdd: (roles: RoleForEditor[]) => void;
  onAddCustom: (name: string, parentRoleId?: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState("");
  const [customParentRoleId, setCustomParentRoleId] = useState<string>("");
  useModalClose(onCancel);

  // 親候補: allRoles の親カテゴリ（parentId が null のもの）
  const parentOptions = allRoles.filter((r) => r.parentId === null);

  const parents = allRoles.filter((r) => r.parentId === null);
  const childrenByParent = new Map<string, RoleForEditor[]>();
  for (const role of allRoles) {
    if (role.parentId) {
      if (!childrenByParent.has(role.parentId)) childrenByParent.set(role.parentId, []);
      childrenByParent.get(role.parentId)!.push(role);
    }
  }

  // 追加可能なロールが 1 件でもあるか
  const hasAvailable = allRoles.some((r) => !currentRoleIds.has(r.id));
  // ロール定義が 0 件か
  const noRolesDefined = allRoles.length === 0;

  function toggle(id: string) {
    const role = allRoles.find((r) => r.id === id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (role?.parentId === null) {
          // 親を選択 → その子をすべて除去
          const children = childrenByParent.get(id) ?? [];
          for (const child of children) next.delete(child.id);
        } else if (role?.parentId) {
          // 子を選択 → その親を除去
          next.delete(role.parentId);
        }
      }
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
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-category-title"
        style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)", overflow: "hidden" }}
      >

        {/* ヘッダー */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <h2 id="add-category-title" style={{ fontFamily: "var(--font-noto-serif)", fontSize: 17, fontWeight: 700,
            color: "var(--ink)", margin: "0 0 4px" }}>
            カテゴリを追加
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
            {noRolesDefined
              ? "ロールが定義されていません。"
              : hasAvailable
                ? <>追加したいカテゴリをチェックしてください。複数選択可。<br />グレー表示はすでに追加済みです。</>
                : "すべてのカテゴリが追加済みです。"}
          </p>
        </div>

        {/* ロール一覧 / 空状態 */}
        <div style={{ overflowY: "auto", flex: 1, padding: noRolesDefined || !hasAvailable ? 0 : "8px 0" }}>
          {noRolesDefined ? (
            /* ロール定義が 0 件 */
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-tint)",
                border: "1px solid var(--line)", display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 14px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="var(--ink-mute)" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                ロールが定義されていません
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: 0 }}>
                管理者に連絡してロールマスターを設定してください。
              </p>
            </div>
          ) : !hasAvailable ? (
            /* 全件追加済み */
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12,
                background: "var(--success-soft)", border: "1px solid #A7F3D0",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="var(--success)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                すべてのカテゴリを追加済みです
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: 0 }}>
                既存のカテゴリを削除してから再追加できます。
              </p>
            </div>
          ) : (
            /* 通常リスト */
            parents.map((parent) => {
              const children = childrenByParent.get(parent.id) ?? [];
              const isParentAdded = currentRoleIds.has(parent.id);
              const isParentSelected = selected.has(parent.id);
              const isParentDisabledByChildren = children.length > 0 && children.some(
                (child) => selected.has(child.id) || currentRoleIds.has(child.id)
              );
              const isParentDisabled = isParentAdded || isParentDisabledByChildren;
              return (
                <div key={parent.id}>
                  {/* 親カテゴリ行 */}
                  <label
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 24px",
                      cursor: isParentDisabled ? "default" : "pointer",
                      background: isParentSelected ? "var(--royal-50)" : "transparent" }}
                    onMouseEnter={(e) => {
                      if (!isParentDisabled && !isParentSelected)
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isParentDisabled && !isParentSelected)
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <input type="checkbox" checked={isParentAdded || isParentSelected}
                      disabled={isParentDisabled}
                      onChange={() => !isParentDisabled && toggle(parent.id)}
                      style={{ width: 15, height: 15, cursor: isParentDisabled ? "default" : "pointer", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700,
                      color: isParentDisabled ? "var(--ink-mute)" : "var(--ink)" }}>
                      {parent.name}
                    </span>
                    {children.length > 0 && !isParentAdded && !isParentDisabledByChildren && (
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
                    const isChildDisabledByParent = selected.has(child.parentId!) || currentRoleIds.has(child.parentId!);
                    const isChildDisabled = isChildAdded || isChildDisabledByParent;
                    return (
                      <label key={child.id}
                        style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 24px 7px 52px",
                          cursor: isChildDisabled ? "default" : "pointer",
                          background: isChildSelected ? "var(--royal-50)" : "transparent" }}
                        onMouseEnter={(e) => {
                          if (!isChildDisabled && !isChildSelected)
                            (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isChildDisabled && !isChildSelected)
                            (e.currentTarget as HTMLElement).style.background = "transparent";
                        }}
                      >
                        <input type="checkbox" checked={isChildAdded || isChildSelected}
                          disabled={isChildDisabled}
                          onChange={() => !isChildDisabled && toggle(child.id)}
                          style={{ width: 14, height: 14, cursor: isChildDisabled ? "default" : "pointer", flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 13, color: isChildDisabled ? "var(--ink-mute)" : "var(--ink)" }}>
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
            })
          )}
        </div>

        {/* 自由入力セクション */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid var(--line)", flexShrink: 0,
          background: "var(--bg-tint)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
            または、独自のカテゴリ名を入力
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
            既存のカテゴリに当てはまらない場合（例: 法人営業・フロント職）
          </div>
          {/* 親カテゴリ選択 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>
              親カテゴリ（任意）
            </div>
            <select
              value={customParentRoleId}
              onChange={(e) => setCustomParentRoleId(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", border: "1px solid var(--line)",
                borderRadius: 8, fontSize: 12, fontFamily: "inherit",
                color: "var(--ink)", background: "#fff", cursor: "pointer",
              }}
            >
              <option value="">親カテゴリなし（独立したカテゴリ）</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {/* カテゴリ名入力 */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  onAddCustom(customName.trim(), customParentRoleId || undefined);
                }
              }}
              placeholder="例: 法人営業"
              maxLength={40}
              style={{
                flex: 1, padding: "8px 12px", border: "1px solid var(--line)",
                borderRadius: 8, fontSize: 13, fontFamily: "inherit",
                color: "var(--ink)", outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customName.trim()) onAddCustom(customName.trim(), customParentRoleId || undefined);
              }}
              disabled={!customName.trim()}
              style={{
                padding: "8px 14px", border: "none", borderRadius: 8, flexShrink: 0,
                background: customName.trim() ? "var(--accent)" : "var(--line)",
                fontSize: 13, fontWeight: 700, color: "#fff",
                cursor: customName.trim() ? "pointer" : "default", fontFamily: "inherit",
              }}
            >
              作成
            </button>
          </div>
        </div>

        {/* フッター */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            {noRolesDefined || !hasAvailable
              ? "追加できるカテゴリがありません"
              : selected.size > 0 ? `${selected.size} 件選択中` : "カテゴリを選択してください"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCancel}
              style={{ padding: "8px 16px", border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
                cursor: "pointer", fontFamily: "inherit" }}>
              {noRolesDefined || !hasAvailable ? "閉じる" : "キャンセル"}
            </button>
            {hasAvailable && !noRolesDefined && (
              <button type="button" onClick={() => canAdd && onAdd(selectedRoles)} disabled={!canAdd}
                style={{ padding: "8px 16px", border: "none", borderRadius: 8,
                  background: canAdd ? "var(--royal)" : "var(--line)",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}>
                追加 ({selected.size})
              </button>
            )}
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
        type="button"
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

  // ── DnD Sensors (PointerSensor のみ) ─────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px 動いてからドラッグ開始
    })
  );

  // ── State ──────────────────────────────────────────────────────────────────

  const [categories, setCategories] = useState<LocalCategory[]>(() =>
    initialCategories.map((c) => ({ ...c, isNew: false, isCustom: c.roleId === null }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LocalCategory | null>(null);

  // 保存成功後の "saved" 表示中フラグ（router.refresh との競合を防ぐ）
  const isSavedDisplayingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // サーバーリフレッシュ後に initialCategories が変わったら同期
  // ただし "saved" 表示中は saveState を上書きしない
  const prevInitialRef = useRef(initialCategories);
  useEffect(() => {
    if (prevInitialRef.current !== initialCategories) {
      prevInitialRef.current = initialCategories;
      setCategories(initialCategories.map((c) => ({ ...c, isNew: false, isCustom: c.roleId === null })));
      setIsDirty(false);
      setSaveError(null);
      // "saved" 表示中は saveState をそのままにする（ちらつき防止）
      if (!isSavedDisplayingRef.current) {
        setSaveState("idle");
      }
    }
  }, [initialCategories]);

  // ── ページ離脱警告（未保存変更あり） ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && saveState !== "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, saveState]);

  // ── クリーンアップ ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ── 現在の roleId セット (追加済み判定用) ──────────────────────────────────
  const currentRoleIds = new Set<string>(
    categories.filter((c) => c.roleId !== null).map((c) => c.roleId as string)
  );

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
      customName: null,
      parentRoleId: null,
      parentId: role.parentId,
      parentName: role.parentId
        ? (allRoles.find((r) => r.id === role.parentId)?.name ?? null)
        : null,
      displayOrder: startOrder + i,
      isNew: true,
      isCustom: false,
    }));
    setCategories((prev) => [...prev, ...newCats]);
    setIsDirty(true);
    setShowAddModal(false);
  }

  function handleAddCustom(name: string, parentRoleId?: string) {
    const parentRole = parentRoleId ? allRoles.find((r) => r.id === parentRoleId) : undefined;
    const newCat: LocalCategory = {
      id: `new-custom-${Date.now()}`,
      roleId: null,
      roleName: name,
      customName: name,
      parentRoleId: parentRoleId ?? null,
      parentId: parentRoleId ?? null,
      parentName: parentRole?.name ?? null,
      displayOrder: categories.length,
      isNew: true,
      isCustom: true,
    };
    setCategories((prev) => [...prev, newCat]);
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
            body: JSON.stringify(
              c.isCustom
                ? { customName: c.customName, parentRoleId: c.parentRoleId ?? undefined, displayOrder: 0 }
                : { roleId: c.roleId, displayOrder: 0 }
            ),
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
      const currentExistingIds = categories
        .filter((c) => !c.isNew)
        .map((c) => c.id);

      const expectedIds = prevInitialRef.current
        .filter((orig) => !toDelete.some((d) => d.id === orig.id))
        .map((c) => c.id);

      const existingOrderChanged = !arraysEqual(currentExistingIds, expectedIds);
      const needsPut = toAdd.length > 0 || existingOrderChanged;

      if (needsPut) {
        // ── Step 4: PUT で最終順序を確定 ───────────────────────────────────
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

      // ── 保存成功 ─────────────────────────────────────────────────────────
      isSavedDisplayingRef.current = true;
      setSaveState("saved");

      // 2.5s 後に idle へ戻す
      savedTimerRef.current = setTimeout(() => {
        isSavedDisplayingRef.current = false;
        setSaveState("idle");
      }, 2500);

      // router.refresh() は "saved" フラグ保護中に呼んでも useEffect で上書きされない
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "保存中にエラーが発生しました");
    }
  }

  // ── 変更破棄 ────────────────────────────────────────────────────────────────
  const handleDiscard = useCallback(() => {
    setCategories(prevInitialRef.current.map((c) => ({ ...c, isNew: false })));
    setIsDirty(false);
    setSaveState("idle");
    setSaveError(null);
  }, []);

  // ── DnD は 2 件以上の場合のみ有効 ──────────────────────────────────────────
  const isDragDisabled = categories.length <= 1;

  // ── 保存中はモーダル・操作を無効化 ──────────────────────────────────────────
  const isSaving = saveState === "saving";

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
              組織体制
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

        {/* 未保存バナー（エラー時は非表示） */}
        {isDirty && saveState !== "error" && (
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

        {/* エラーバナー（リトライ案内付き） */}
        {saveState === "error" && saveError && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px",
            background: "var(--error-soft)", border: "1px solid #FECACA",
            borderRadius: 10, marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--error)" strokeWidth="2.2" strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, color: "var(--error)", fontWeight: 600 }}>
                保存に失敗しました: {saveError}
              </span>
              <div style={{ fontSize: 11, color: "var(--error)", marginTop: 2, opacity: 0.8 }}>
                変更内容は保持されています。再度「変更を保存」を押してください。
              </div>
            </div>
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

            {/* カテゴリを追加ボタン（保存中は無効） */}
            <button
              type="button"
              onClick={() => !isSaving && setShowAddModal(true)}
              disabled={isSaving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: isSaving ? "var(--line)" : "var(--royal)", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: isSaving ? "default" : "pointer",
                fontFamily: "inherit", transition: "opacity 0.15s, background 0.15s" }}
              onMouseEnter={(e) => {
                if (!isSaving) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
              }}
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
                type="button"
                onClick={() => !isSaving && setShowAddModal(true)}
                disabled={isSaving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", background: "var(--royal)", border: "none",
                  borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff",
                  cursor: isSaving ? "default" : "pointer",
                  fontFamily: "inherit", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => {
                  if (!isSaving) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
                }}
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
          {isDirty && !isSaving && (
            <button
              type="button"
              onClick={handleDiscard}
              style={{ padding: "9px 18px", border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", fontSize: 13, fontWeight: 600,
                color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}
            >
              変更を破棄
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            style={{
              padding: "9px 20px", border: "none", borderRadius: 8,
              background: saveState === "saved"
                ? "var(--success)"
                : !isDirty ? "var(--line)" : "var(--royal)",
              fontSize: 13, fontWeight: 700, color: "#fff",
              cursor: !isDirty || isSaving ? "default" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
              opacity: isSaving ? 0.7 : 1,
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            {isSaving && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {saveState === "saved"
              ? "✓ 保存しました"
              : isSaving
                ? "保存中…"
                : "変更を保存"}
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* モーダル（保存中は表示しない） */}
      {showAddModal && !isSaving && (
        <AddCategoryModal
          allRoles={allRoles}
          currentRoleIds={currentRoleIds}
          onAdd={handleAdd}
          onAddCustom={handleAddCustom}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {deleteTarget && !isSaving && (
        <ConfirmDeleteModal
          target={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

"use client";

/**
 * 全ユーザーが使える企業カードDnD並び替えグリッド
 * - 順序は localStorage に保存（ブラウザ個人設定）
 * - カード左上の ⠿ ハンドルをドラッグして並び替え
 * - 「元の順序に戻す」ボタンでリセット可能
 */

import { useState, useEffect, useRef } from "react";
import type { CompanyForCarousel } from "@/types/genre";
import { CompanyCardCompact } from "./CompanyCardCompact";
import type { MemberPreview } from "./CompanyCardCompact";

const LS_KEY = "opinio_company_order_v1";

type Props = {
  companies: CompanyForCarousel[];
  membersMap: Record<string, MemberPreview[]>;
  topMargin?: number;
};

export function CompanyUserDndGrid({ companies: initial, membersMap, topMargin = 0 }: Props) {
  const [companies, setCompanies]       = useState<CompanyForCarousel[]>(initial);
  const [hasCustomOrder, setHasCustomOrder] = useState(false);
  const [dragOverId, setDragOverId]     = useState<string | null>(null);
  const [draggingId, setDraggingId]     = useState<string | null>(null);
  const draggedIdRef                    = useRef<string | null>(null);

  // マウント時に localStorage から保存済み順序を復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (!saved) return;
      const savedIds = JSON.parse(saved) as string[];
      if (!Array.isArray(savedIds) || savedIds.length === 0) return;

      const idMap = new Map(initial.map((c) => [c.id, c]));
      const reordered: CompanyForCarousel[] = [];
      for (const id of savedIds) {
        const c = idMap.get(id);
        if (c) reordered.push(c);
      }
      // 新しく追加された企業（保存時に存在しなかった）を末尾に追加
      for (const c of initial) {
        if (!reordered.find((r) => r.id === c.id)) reordered.push(c);
      }
      if (reordered.length > 0) {
        setCompanies(reordered);
        setHasCustomOrder(true);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── DnD ハンドラ ────────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    draggedIdRef.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id); // Firefox 対応
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIdRef.current !== id) setDragOverId(id);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const sourceId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const list = [...companies];
    const from = list.findIndex((c) => c.id === sourceId);
    const to   = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setCompanies(list);
    setHasCustomOrder(true);

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.map((c) => c.id)));
    } catch { /* ignore */ }
  }

  function onDragEnd() {
    draggedIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }

  function resetOrder() {
    setCompanies(initial);
    setHasCustomOrder(false);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }

  return (
    <>
      {/* カスタム順序バー */}
      {hasCustomOrder && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>✓ あなた専用の表示順</span>
          <button
            onClick={resetOrder}
            style={{ fontSize: 11, color: "var(--royal)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}
          >
            元の順序に戻す
          </button>
        </div>
      )}

      {/* カードグリッド */}
      <div
        className="companies-compact-grid"
        style={{ marginTop: topMargin }}
      >
        {companies.map((c) => (
          <div
            key={c.id}
            className="company-dnd-item"
            draggable
            onDragStart={(e) => onDragStart(e, c.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onDragOver(e, c.id)}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => onDrop(e, c.id)}
            style={{
              outline:      dragOverId === c.id ? "2px solid var(--royal)" : "none",
              outlineOffset: 2,
              borderRadius: 14,
              transition:   "outline 0.1s, opacity 0.15s",
              cursor:       draggingId === c.id ? "grabbing" : "grab",
              opacity:      draggingId === c.id ? 0.35 : 1,
              userSelect:   "none",
            }}
          >
            <CompanyCardCompact
              company={c}
              compact
              members={membersMap[c.id] ?? []}
            />
          </div>
        ))}
      </div>

      {/* カード全体ドラッグ用 CSS */}
      <style>{`
        .company-dnd-item .genre-card {
          cursor: grab !important;
        }
        .company-dnd-item .genre-card:hover {
          transform: translateY(-4px);
        }
        .company-dnd-item[style*="grabbing"] .genre-card {
          cursor: grabbing !important;
        }
      `}</style>
    </>
  );
}

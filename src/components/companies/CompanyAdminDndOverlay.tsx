"use client";

/**
 * 管理者専用: 企業の表示順をドラッグ&ドロップで変更するオーバーレイ
 * - ログイン管理者のみ表示（auth_is_admin RPC で判定）
 * - 右下の「⠿ 並び替え」ボタン → 右側ドロワーが開く
 * - ドラッグして並び替え → Supabase に即時保存
 * - 公開ページへの反映は最大5分（ISR キャッシュ）
 */

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type CompanyRow = { id: string; name: string; sort_order: number };

export function CompanyAdminDndOverlay() {
  const [isAdmin, setIsAdmin]     = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  // 管理者チェック（マウント時1回のみ）
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("auth_is_admin");
      setIsAdmin(!!data);
    })();
  }, []);

  // パネルを開くたびに最新の企業順序を取得
  useEffect(() => {
    if (!showPanel) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ow_companies")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      setCompanies(
        (data ?? []).map((c) => ({
          id:         c.id as string,
          name:       (c.name as string) ?? "—",
          sort_order: (c.sort_order as number) ?? 0,
        }))
      );
    })();
  }, [showPanel]);

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, id: string) {
    draggedIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id); // Firefox 対応
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIdRef.current !== id) setDragOverId(id);
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = draggedIdRef.current;
    draggedIdRef.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    // 配列を並び替え
    const list = [...companies];
    const from = list.findIndex((c) => c.id === sourceId);
    const to   = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const updated = list.map((c, i) => ({ ...c, sort_order: i }));
    setCompanies(updated);

    // Supabase に一括保存
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await Promise.all(
      updated.map((c) =>
        supabase.from("ow_companies").update({ sort_order: c.sort_order }).eq("id", c.id)
      )
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDragOverId(null);
  }

  if (!isAdmin) return null;

  return (
    <>
      {/* 右下フローティングボタン */}
      <button
        onClick={() => setShowPanel(true)}
        title="企業の表示順を変更（管理者専用）"
        style={{
          position:   "fixed",
          bottom:     80,
          right:      20,
          zIndex:     100,
          background: "#002366",
          color:      "#fff",
          border:     "none",
          borderRadius: 12,
          padding:    "10px 16px",
          fontSize:   13,
          fontWeight: 700,
          cursor:     "pointer",
          boxShadow:  "0 4px 16px rgba(0,35,102,0.35)",
          display:    "flex",
          alignItems: "center",
          gap:        6,
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⠿</span>
        並び替え
      </button>

      {/* バックドロップ */}
      {showPanel && (
        <div
          onClick={() => setShowPanel(false)}
          style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* 右側ドロワー */}
      {showPanel && (
        <div style={{
          position:   "fixed",
          top:        0,
          right:      0,
          bottom:     0,
          width:      300,
          background: "#fff",
          boxShadow:  "-4px 0 24px rgba(0,0,0,0.18)",
          zIndex:     200,
          display:    "flex",
          flexDirection: "column",
        }}>
          {/* ヘッダー */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", background: "var(--error)", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>ADMIN</span>
                企業の表示順
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 3 }}>
                ドラッグして並び替え・即時保存
              </div>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ink-mute)", padding: 4, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* 保存状態バー */}
          {saving && (
            <div style={{ padding: "7px 20px", background: "#FFFBEB", fontSize: 12, color: "#92400E", borderBottom: "1px solid #FDE68A", fontWeight: 600 }}>
              ⏳ 保存中...
            </div>
          )}
          {saved && !saving && (
            <div style={{ padding: "7px 20px", background: "#ECFDF5", fontSize: 12, color: "#059669", borderBottom: "1px solid #A7F3D0", fontWeight: 600 }}>
              ✓ 保存しました
            </div>
          )}

          {/* 企業リスト */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {companies.map((c, i) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => handleDragStart(e, c.id)}
                onDragOver={(e) => handleDragOver(e, c.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(e, c.id)}
                onDragEnd={handleDragEnd}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         10,
                  padding:     "9px 12px",
                  borderRadius: 8,
                  marginBottom: 4,
                  background:  dragOverId === c.id ? "var(--royal-50)" : "#f8fafc",
                  border:      dragOverId === c.id ? "2px solid var(--royal)" : "1px solid var(--line)",
                  cursor:      "grab",
                  transition:  "background 0.1s, border 0.1s",
                  userSelect:  "none",
                }}
              >
                <span style={{ color: "var(--ink-mute)", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>⠿</span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", flexShrink: 0, minWidth: 18, textAlign: "right" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {c.name}
                </span>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            公開ページへの反映は最大5分です（ISRキャッシュ）。
          </div>
        </div>
      )}
    </>
  );
}

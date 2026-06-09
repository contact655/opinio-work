"use client";

// #13: 企業比較バー（最大3社まで選択 → 比較ページへ）
// localStorage + CustomEvent でクロスコンポーネント状態同期

import React, { useState, useEffect } from "react";
import Link from "next/link";

export type CompareEntry = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
};

const STORAGE_KEY = "opinio-compare-companies";
const EVENT_NAME  = "opinio-compare-update";
const MAX_COMPARE = 3;

// ── グローバルヘルパー（カードコンポーネントから呼ぶ） ─────────────────────────

export function addToCompare(entry: CompareEntry): boolean {
  try {
    const stored: CompareEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (stored.length >= MAX_COMPARE) return false;
    if (stored.some((c) => c.id === entry.id)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...stored, entry]));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
    return true;
  } catch {
    return false;
  }
}

export function removeFromCompare(id: string): void {
  try {
    const stored: CompareEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((c) => c.id !== id)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* noop */ }
}

export function isInCompareList(id: string): boolean {
  try {
    const stored: CompareEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return stored.some((c) => c.id === id);
  } catch {
    return false;
  }
}

export function clearCompareList(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* noop */ }
}

// ── Compare Bar UI ─────────────────────────────────────────────────────────────

export function CompareBar() {
  const [selected, setSelected] = useState<CompareEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        setSelected(Array.isArray(stored) ? stored : []);
      } catch {
        setSelected([]);
      }
    };
    load();
    window.addEventListener(EVENT_NAME, load);
    return () => window.removeEventListener(EVENT_NAME, load);
  }, []);

  if (!mounted || selected.length === 0) return null;

  const compareUrl = `/companies/compare?ids=${selected.map((c) => c.id).join(",")}`;
  const canCompare = selected.length >= 2;

  return (
    <>
      <style>{`
        .compare-bar-enter { animation: compareBarSlide 0.25s ease; }
        @keyframes compareBarSlide { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .compare-entry-remove { opacity: 0; transition: opacity 0.15s; }
        .compare-entry:hover .compare-entry-remove { opacity: 1; }
        @media (max-width: 639px) {
          .compare-bar-entries { display: none !important; }
        }
      `}</style>
      <div
        className="compare-bar-enter"
        style={{
          position: "fixed",
          bottom: 64,      // モバイルボトムナビの上
          left: 0,
          right: 0,
          zIndex: 48,
          padding: "0 16px 12px",
          pointerEvents: "none",
        }}
      >
        <div style={{
          maxWidth: 860,
          margin: "0 auto",
          background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
          borderRadius: 14,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,35,102,0.35)",
          pointerEvents: "auto",
          border: "1px solid rgba(255,255,255,0.12)",
        }}>
          {/* ラベル */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 1 }}>
              比較リスト
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "Inter, sans-serif" }}>
              {selected.length} / {MAX_COMPARE}社
            </div>
          </div>

          {/* 区切り */}
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

          {/* 選択企業チップ */}
          <div className="compare-bar-entries" style={{ display: "flex", gap: 8, flex: 1, overflow: "hidden" }}>
            {selected.map((entry) => (
              <div
                key={entry.id}
                className="compare-entry"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "5px 10px 5px 6px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  maxWidth: 180,
                  position: "relative",
                }}
              >
                {/* ロゴ */}
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: entry.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                }}>
                  {entry.initial}
                </div>
                {/* 社名 */}
                <span style={{
                  fontSize: 12, fontWeight: 600, color: "#fff",
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}>
                  {entry.name}
                </span>
                {/* 削除ボタン */}
                <button
                  type="button"
                  className="compare-entry-remove"
                  onClick={() => removeFromCompare(entry.id)}
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "none",
                    borderRadius: "50%",
                    width: 16, height: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    color: "#fff",
                    fontSize: 10,
                    flexShrink: 0,
                    padding: 0,
                  }}
                  title={`${entry.name}を比較リストから削除`}
                >
                  ×
                </button>
              </div>
            ))}

            {/* 空スロット */}
            {Array.from({ length: MAX_COMPARE - selected.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  width: 140, height: 36, borderRadius: 8,
                  border: "1.5px dashed rgba(255,255,255,0.20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  ＋企業を選ぶ
                </span>
              </div>
            ))}
          </div>

          {/* アクションボタン */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {/* クリア */}
            <button
              type="button"
              onClick={clearCompareList}
              style={{
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                color: "rgba(255,255,255,0.65)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              クリア
            </button>

            {/* 比較ボタン */}
            {canCompare ? (
              <Link
                href={compareUrl}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "8px 18px", borderRadius: 8,
                  fontSize: 13, fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.40)",
                }}
              >
                比較する ({selected.length}社) →
              </Link>
            ) : (
              <div style={{
                display: "inline-flex", alignItems: "center",
                padding: "8px 18px", borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.40)",
                whiteSpace: "nowrap",
              }}>
                あと{2 - selected.length}社選ぶと比較できます
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

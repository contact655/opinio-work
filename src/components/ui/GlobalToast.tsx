"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT_NAME, type ToastEvent, type ToastVariant } from "@/lib/toast";

type ActiveToast = ToastEvent & { id: string };

const VARIANT_STYLES: Record<ToastVariant, { bg: string; color: string; icon: string }> = {
  default: { bg: "#0F172A",    color: "#fff",      icon: "✓" },
  success: { bg: "var(--success)",    color: "#fff",      icon: "✓" },
  error:   { bg: "#DC2626",    color: "#fff",      icon: "✕" },
  warm:    { bg: "#D97706",    color: "#fff",      icon: "♥" },
};

export function GlobalToast() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastEvent>).detail;
      const id = detail.id ?? `${Date.now()}`;
      setToasts((prev) => [...prev.slice(-3), { ...detail, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    };
    window.addEventListener(TOAST_EVENT_NAME, handler);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 88, // above mobile bottom nav (64px) + spacing
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const style = VARIANT_STYLES[t.variant ?? "default"];
        return (
          <div
            key={t.id}
            style={{
              background: style.bg,
              color: style.color,
              padding: "11px 22px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 7,
              animation: "toastIn 0.22s ease",
            }}
          >
            <span style={{ fontSize: 15 }}>{style.icon}</span>
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

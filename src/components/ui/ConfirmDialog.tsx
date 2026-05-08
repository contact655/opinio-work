"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** "danger" = var(--error) red / "primary" = var(--royal) blue */
  confirmVariant?: "danger" | "primary";
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Generic confirmation dialog.
 * Renders a backdrop + modal. Escape key triggers onCancel.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "実行する",
  confirmVariant = "danger",
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  const confirmBg = confirmVariant === "danger" ? "var(--error)" : "var(--royal)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={isSubmitting ? undefined : onCancel}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,42,0.4)",
          backdropFilter: "blur(2px)",
          cursor: isSubmitting ? "default" : "pointer",
        }}
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 24px",
          maxWidth: 400,
          width: "calc(100% - 48px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <p
          id="confirm-dialog-title"
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 10,
            fontFamily: "inherit",
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            marginBottom: 24,
            fontFamily: "inherit",
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={isSubmitting ? undefined : onConfirm}
            disabled={isSubmitting}
            style={{
              padding: "8px 18px",
              background: confirmBg,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: isSubmitting ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: isSubmitting ? 0.75 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {isSubmitting ? "処理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

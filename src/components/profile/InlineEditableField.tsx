"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Toast from "@/components/ui/Toast";

type InlineEditableFieldProps = {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  type?: "text" | "textarea" | "select";
  placeholder?: string;
  label?: string;
  maxLength?: number;
  options?: string[];
  disabled?: boolean;
  onCancel?: () => void;
};

type EditStatus = "display" | "editing" | "saving";

// Pencil icon SVG
function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function InlineEditableField({
  value,
  onSave,
  type = "text",
  placeholder,
  maxLength,
  disabled,
  onCancel,
}: InlineEditableFieldProps) {
  const [status, setStatus] = useState<EditStatus>("display");
  const [editValue, setEditValue] = useState(value);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

  // Track the last confirmed-good value for rollback
  const savedValueRef = useRef(value);

  // Sync external value changes while not in an active edit session
  useEffect(() => {
    if (status === "display") {
      savedValueRef.current = value;
    }
  }, [value, status]);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const startEdit = useCallback(() => {
    if (disabled || status !== "display") return;
    setEditValue(savedValueRef.current);
    setStatus("editing");
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled, status]);

  const cancel = useCallback(() => {
    setStatus("display");
    setEditValue(savedValueRef.current);
    onCancel?.();
  }, [onCancel]);

  const save = useCallback(async () => {
    const trimmed = editValue.trim();
    // No change → silent cancel
    if (trimmed === savedValueRef.current.trim()) {
      cancel();
      return;
    }
    setStatus("saving");
    try {
      await onSave(trimmed);
      savedValueRef.current = trimmed;
      setStatus("display");
    } catch {
      setEditValue(savedValueRef.current);
      setStatus("display");
      setToastVariant("error");
      setToastMsg("保存に失敗しました。もう一度お試しください。");
    }
  }, [editValue, onSave, cancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    },
    [cancel, save]
  );

  const isEmpty = !value;

  // ── Display mode ────────────────────────────────────────────────────
  if (status === "display") {
    return (
      <>
        <div
          className="ief-display"
          onClick={startEdit}
          role={disabled ? undefined : "button"}
          tabIndex={disabled ? undefined : 0}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              startEdit();
            }
          }}
          style={{
            cursor: disabled ? "default" : "text",
            position: "relative",
            borderRadius: 8,
            padding: "6px 8px",
            margin: "-6px -8px",
            transition: "background 0.15s",
          }}
        >
          {isEmpty ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                lineHeight: 1.7,
                fontStyle: "italic",
              }}
            >
              {placeholder ?? "クリックして入力"}
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--ink)",
                lineHeight: 1.85,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {value}
            </div>
          )}
          {!disabled && (
            <span
              className="ief-pencil"
              aria-hidden
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                color: "var(--ink-mute)",
                display: "flex",
                alignItems: "center",
                opacity: 0,
                transition: "opacity 0.15s",
                pointerEvents: "none",
              }}
            >
              <PencilIcon />
            </span>
          )}
        </div>

        {toastMsg && (
          <Toast
            message={toastMsg}
            variant={toastVariant}
            onDone={() => setToastMsg(null)}
          />
        )}

        <style>{`
          .ief-display:hover { background: var(--line-soft) !important; }
          @media (hover: hover) {
            .ief-display:hover .ief-pencil { opacity: 1 !important; }
          }
        `}</style>
      </>
    );
  }

  // ── Edit / Saving mode ──────────────────────────────────────────────
  const isSaving = status === "saving";
  const remaining = maxLength !== undefined ? maxLength - editValue.length : null;
  const isOverLimit = remaining !== null && remaining < 0;

  return (
    <>
      <div style={{ position: "relative" }}>
        {type === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            maxLength={maxLength}
            rows={5}
            style={{
              width: "100%",
              resize: "vertical",
              border: "1.5px solid var(--royal)",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.85,
              color: "var(--ink)",
              background: isSaving ? "var(--bg-tint)" : "#fff",
              outline: "none",
              fontFamily: "var(--font-noto-sans, sans-serif)",
              boxShadow: "0 0 0 3px rgba(0,35,102,0.08)",
              opacity: isSaving ? 0.6 : 1,
              transition: "opacity 0.15s",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            maxLength={maxLength}
            style={{
              width: "100%",
              border: "1.5px solid var(--royal)",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              color: "var(--ink)",
              background: isSaving ? "var(--bg-tint)" : "#fff",
              outline: "none",
              fontFamily: "var(--font-noto-sans, sans-serif)",
              boxShadow: "0 0 0 3px rgba(0,35,102,0.08)",
              opacity: isSaving ? 0.6 : 1,
              transition: "opacity 0.15s",
              boxSizing: "border-box",
            }}
          />
        )}

        {/* Char count */}
        {remaining !== null && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: isOverLimit ? "var(--error)" : "var(--ink-mute)",
              fontFamily: "Inter, sans-serif",
              textAlign: "right",
            }}
          >
            {remaining < 0 ? `${Math.abs(remaining)} 文字超過` : `残り ${remaining} 文字`}
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={cancel}
            disabled={isSaving}
            style={{
              padding: "6px 14px",
              background: "#fff",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: isSaving ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving || isOverLimit}
            style={{
              padding: "6px 16px",
              background:
                isSaving || isOverLimit
                  ? "var(--ink-mute)"
                  : "var(--royal)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: isSaving || isOverLimit ? "default" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {isSaving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </>
  );
}

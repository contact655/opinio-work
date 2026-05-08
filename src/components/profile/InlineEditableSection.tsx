"use client";

import { type ReactNode } from "react";

type InlineEditableSectionProps = {
  label: string;
  children: ReactNode;
  /**
   * Section-level edit mode (e.g. SNS links batch-save).
   * When true, a pencil icon appears next to the label.
   * The parent controls isEditing / isSaving / onEdit / onSave / onCancel.
   */
  sectionEditMode?: boolean;
  isEditing?: boolean;
  isSaving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
};

// Pencil icon for section header
function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
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

/**
 * Visual wrapper for an inline-editable area.
 * Provides the section label and an optional section-level edit mode
 * (pencil icon on label → click to edit entire section at once).
 */
export default function InlineEditableSection({
  label,
  children,
  sectionEditMode = false,
  isEditing = false,
  isSaving = false,
  onEdit,
  onSave,
  onCancel,
}: InlineEditableSectionProps) {
  // ── Section-level edit mode ──────────────────────────────────────────
  if (sectionEditMode) {
    return (
      <div style={{ marginTop: 14 }}>
        {/* Label row with pencil icon */}
        <div
          className={!isEditing ? "ies-header" : undefined}
          onClick={!isEditing ? onEdit : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: !isEditing ? "pointer" : "default",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {label}
          </span>
          {!isEditing && (
            <span
              className="ies-pencil"
              aria-hidden
              style={{
                color: "var(--ink-mute)",
                display: "flex",
                alignItems: "center",
                opacity: 0,
                transition: "opacity 0.15s",
              }}
            >
              <PencilIcon />
            </span>
          )}
        </div>

        {/* Children (parent controls display vs edit content) */}
        {children}

        {/* Section-level action buttons (shown only when editing) */}
        {isEditing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
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
              onClick={onSave}
              disabled={isSaving}
              style={{
                padding: "6px 16px",
                background: isSaving ? "var(--ink-mute)" : "var(--royal)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: isSaving ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              {isSaving ? "保存中…" : "保存"}
            </button>
          </div>
        )}

        <style>{`
          @media (hover: hover) {
            .ies-header:hover .ies-pencil { opacity: 1 !important; }
          }
          .ies-header:hover { opacity: 0.8; }
        `}</style>
      </div>
    );
  }

  // ── Default mode (field-level edit, like About Me) ──────────────────
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 6,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

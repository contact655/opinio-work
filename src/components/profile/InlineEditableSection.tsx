"use client";

import { type ReactNode } from "react";

type InlineEditableSectionProps = {
  label: string;
  children: ReactNode;
};

/**
 * Visual wrapper for an inline-editable area.
 * Provides the section label and a subtle border/background
 * that makes the editable zone visually distinct.
 */
export default function InlineEditableSection({
  label,
  children,
}: InlineEditableSectionProps) {
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

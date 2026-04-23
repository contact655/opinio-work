import React from "react";

export type StatusVariant =
  | "pending"      // 新規受信・保留中 — warm amber
  | "confirming"   // 確認中 — royal blue
  | "scheduling"   // 日程調整中 — purple
  | "scheduled"    // 予定確定 — pink
  | "completed"    // 完了 — muted gray
  | "declined"     // 辞退・却下 — error red
  | "published"    // 公開中 — success green
  | "draft"        // 下書き — light gray
  | "reviewing";   // 審査中 — warm amber (alias for pending)

type StatusSize = "sm" | "md";

interface StatusPillProps {
  variant: StatusVariant;
  size?: StatusSize;
  children?: React.ReactNode;
  className?: string;
}

const STYLES: Record<StatusVariant, { bg: string; color: string; label: string }> = {
  pending:    { bg: "#FEFCE8", color: "#B45309", label: "新規受信" },
  confirming: { bg: "#EFF3FC", color: "#002366", label: "確認中" },
  scheduling: { bg: "#F5F3FF", color: "#7C3AED", label: "日程調整中" },
  scheduled:  { bg: "#FDF2F8", color: "#DB2777", label: "予定確定" },
  completed:  { bg: "#F1F5F9", color: "#475569", label: "完了" },
  declined:   { bg: "#FEE2E2", color: "#DC2626", label: "辞退" },
  published:  { bg: "#ECFDF5", color: "#059669", label: "公開中" },
  draft:      { bg: "#F8FAFC", color: "#94A3B8", label: "下書き" },
  reviewing:  { bg: "#FEFCE8", color: "#B45309", label: "審査中" },
};

// sm → mini-tag style (sharp corners, compact)
// md → pill style (fully rounded)
const SIZE_STYLES: Record<StatusSize, React.CSSProperties> = {
  sm: { padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.03em" },
  md: { padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" },
};

export function StatusPill({ variant, size = "md", children, className }: StatusPillProps) {
  const { bg, color, label } = STYLES[variant];
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", background: bg, color, ...SIZE_STYLES[size] }}
      className={className}
    >
      {children ?? label}
    </span>
  );
}

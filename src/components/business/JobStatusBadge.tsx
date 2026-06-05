import type { JobStatus } from "@/lib/business/mockJobs";

const STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; color: string }> = {
  published:      { label: "公開中",     bg: "var(--success-soft)",  color: "var(--success)" },
  active:         { label: "公開中",     bg: "var(--success-soft)",  color: "var(--success)" }, // 旧ステータス
  pending_review: { label: "運営審査中", bg: "var(--purple-soft)",   color: "var(--purple)" },
  draft:          { label: "下書き",     bg: "var(--line-soft)",     color: "var(--ink-soft)" },
  rejected:       { label: "差し戻し",   bg: "var(--error-soft)",    color: "var(--error)" },
  private:        { label: "非公開",     bg: "#F1F5F9",              color: "#6b7280" },
};

type Props = {
  status: JobStatus;
  size?: "sm" | "md";
};

export function JobStatusBadge({ status, size = "md" }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      padding: size === "sm" ? "2px 7px" : "3px 10px",
      borderRadius: 100,
      fontFamily: "'Inter', sans-serif",
      fontSize: size === "sm" ? 9 : 10,
      fontWeight: 700,
      letterSpacing: "0.05em",
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {cfg.label}
    </span>
  );
}

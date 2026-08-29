import React from "react";

// ─── StatusVariant ────────────────────────────────────────────────────────────
// 全ドメイン（面談・求人・応募・メンター予約・受信リクエスト）の
// ステータス値を一元管理する。内部値は変えず、ここで色・ラベルを統一する。

export type StatusVariant =
  // ── カジュアル面談 ─────────────────────────────────────
  | "pending"            // 新規受信・保留中 — amber
  | "company_contacted"  // 確認中 — royal blue
  | "confirming"         // 確認中 — royal blue (alias)
  | "scheduled"          // 面談予定・日程確定 — purple (旧StatusPillのpink定義を廃止)
  | "scheduling"         // 日程調整中 — purple (alias)
  | "completed"          // 完了 — gray
  | "declined"           // 見送り — red (ラベルは「見送り」に統一: 企業が主語のため)
  // ── 求人掲載 ───────────────────────────────────────────
  | "published"          // 公開中 — green
  | "pending_review"     // 運営審査中 — purple
  | "draft"              // 下書き — gray
  | "rejected"           // 差し戻し / 不採用 — red
  | "private"            // 非公開 — gray
  // ── 求人応募 ───────────────────────────────────────────
  | "reviewing"          // 確認中 — royal blue
  | "interview"          // 面接中 — purple
  | "accepted"           // 採用 — green
  | "hired"              // 採用確定 — green
  // ── メンター予約 ────────────────────────────────────────
  | "approved"           // 承認済み — green
  | "cancelled"          // キャンセル — gray
  // ── 受信リクエスト（メンター側） ─────────────────────────
  | "pending_received"   // 未対応 — amber
  | "completed_received"; // 完了 — gray

type StatusSize = "sm" | "md";

interface StatusPillProps {
  variant: StatusVariant | (string & {}); // 未知の値も受け付けてフォールバック
  size?: StatusSize;
  children?: React.ReactNode;
  className?: string;
}

// ─── 6色相パレット（CSS変数のみ使用、ハードコード禁止） ────────────────────────
const STYLES: Record<StatusVariant, { bg: string; color: string; label: string }> = {
  // amber ─────────────────────────────────────────────────────────────────────
  pending:            { bg: "var(--warm-soft)",    color: "#B45309",       label: "新規受信" },
  pending_received:   { bg: "var(--warm-soft)",    color: "#B45309",       label: "未対応" },
  // royal blue ────────────────────────────────────────────────────────────────
  company_contacted:  { bg: "var(--royal-50)",     color: "var(--royal)",  label: "確認中" },
  confirming:         { bg: "var(--royal-50)",     color: "var(--royal)",  label: "確認中" },
  reviewing:          { bg: "var(--royal-50)",     color: "var(--royal)",  label: "確認中" },
  // purple ────────────────────────────────────────────────────────────────────
  scheduled:          { bg: "var(--purple-soft)",  color: "var(--purple)", label: "面談予定" },
  scheduling:         { bg: "var(--purple-soft)",  color: "var(--purple)", label: "日程調整中" },
  pending_review:     { bg: "var(--purple-soft)",  color: "var(--purple)", label: "運営審査中" },
  interview:          { bg: "var(--purple-soft)",  color: "var(--purple)", label: "面接中" },
  // green ─────────────────────────────────────────────────────────────────────
  published:          { bg: "var(--success-soft)", color: "var(--success)", label: "公開中" },
  accepted:           { bg: "var(--success-soft)", color: "var(--success)", label: "採用" },
  hired:              { bg: "var(--success)",      color: "#ffffff",        label: "採用確定" },
  approved:           { bg: "var(--success-soft)", color: "var(--success)", label: "承認済み" },
  // gray ──────────────────────────────────────────────────────────────────────
  completed:          { bg: "var(--line-soft)",    color: "var(--ink-soft)", label: "完了" },
  completed_received: { bg: "var(--line-soft)",    color: "var(--ink-soft)", label: "完了" },
  draft:              { bg: "var(--bg-tint)",      color: "var(--ink-mute)", label: "下書き" },
  private:            { bg: "var(--line-soft)",    color: "var(--ink-mute)", label: "非公開" },
  cancelled:          { bg: "var(--line-soft)",    color: "var(--ink-soft)", label: "キャンセル" },
  // red ───────────────────────────────────────────────────────────────────────
  declined:           { bg: "var(--error-soft)",   color: "var(--error)",  label: "見送り" },
  rejected:           { bg: "var(--error-soft)",   color: "var(--error)",  label: "差し戻し" },
};

const FALLBACK_STYLE = { bg: "var(--line-soft)", color: "var(--ink-soft)" };

// sm / md 両方とも全丸ピル（business badge との互換性を維持）
const SIZE_STYLES: Record<StatusSize, React.CSSProperties> = {
  sm: { padding: "2px 7px",  borderRadius: 100, fontSize: 12,  fontWeight: 700, letterSpacing: "0.05em" },
  md: { padding: "3px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" },
};

export function StatusPill({ variant, size = "md", children, className }: StatusPillProps) {
  const style = (STYLES as Record<string, { bg: string; color: string; label: string }>)[variant]
    ?? { ...FALLBACK_STYLE, label: variant };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        background: style.bg, color: style.color,
        fontFamily: "var(--font-inter), var(--font-noto)",
        whiteSpace: "nowrap",
        ...SIZE_STYLES[size],
      }}
      className={className}
    >
      {children ?? style.label}
    </span>
  );
}

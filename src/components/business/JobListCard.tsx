import type { BizJob, JobStatus } from "@/lib/business/mockJobs";
import { JobStatusBadge } from "./JobStatusBadge";

const LEFT_BORDER: Record<BizJob["status"], string> = {
  rejected:       "4px solid var(--error)",
  draft:          "4px solid var(--warm)",
  pending_review: "4px solid var(--purple)",
  published:      "4px solid var(--success)",
  private:        "none",
};

type Props = {
  job: BizJob;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void;
  onDelete?: (jobId: string) => void;
  onDuplicate?: (jobId: string) => void;
};

function ActionBtn({
  label,
  primary,
  danger,
  onClick,
}: {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick ?? (() => alert(`「${label}」は今後実装予定です。`))}
      style={{
        padding: "6px 12px",
        background: primary ? "var(--royal)" : danger ? "transparent" : "var(--bg-tint)",
        border: `1px solid ${primary ? "var(--royal)" : danger ? "var(--line)" : "var(--line)"}`,
        borderRadius: 6,
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 600,
        color: primary ? "#fff" : "var(--ink)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {label}
    </button>
  );
}

function IconBtn({ title, isDelete, onClick }: { title: string; isDelete?: boolean; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick ?? (() => alert(`「${title}」は今後実装予定です。`))}
      style={{
        width: 28, height: 28,
        background: "transparent",
        border: "1px solid var(--line)",
        borderRadius: 6,
        color: "var(--ink-mute)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s",
      }}
    >
      {isDelete ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      )}
    </button>
  );
}

function renderActions(
  job: BizJob,
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void,
  onDelete?: (jobId: string) => void,
  onDuplicate?: (jobId: string) => void,
) {
  const del = onDelete ? () => onDelete(job.id) : undefined;
  const dup = onDuplicate ? () => onDuplicate(job.id) : undefined;

  switch (job.status) {
    case "rejected":
      return (
        <>
          <ActionBtn label="複製" onClick={dup} />
          <IconBtn title="削除" isDelete onClick={del} />
          <ActionBtn label="修正して再申請" primary
            onClick={onStatusChange ? () => onStatusChange(job.id, "pending_review") : undefined} />
        </>
      );
    case "published":
      return (
        <>
          <ActionBtn label="公開ページを見る" />
          <ActionBtn label="複製" onClick={dup} />
          <IconBtn title="非公開にする"
            onClick={onStatusChange ? () => onStatusChange(job.id, "private") : undefined} />
          <ActionBtn label="編集" primary />
        </>
      );
    case "pending_review":
      return (
        <>
          <ActionBtn label="プレビュー" />
          <ActionBtn label="申請を取り下げる"
            onClick={onStatusChange ? () => onStatusChange(job.id, "draft") : undefined} />
        </>
      );
    case "draft":
      if (job.completionPercent === 100) {
        return (
          <>
            <ActionBtn label="複製" onClick={dup} />
            <IconBtn title="削除" isDelete onClick={del} />
            <ActionBtn label="編集 / 公開申請" primary
              onClick={onStatusChange ? () => onStatusChange(job.id, "pending_review") : undefined} />
          </>
        );
      }
      return (
        <>
          <ActionBtn label="複製" onClick={dup} />
          <IconBtn title="削除" isDelete onClick={del} />
          <ActionBtn label="編集を続ける" primary />
        </>
      );
    case "private":
      return (
        <>
          <ActionBtn label="複製" onClick={dup} />
          <IconBtn title="削除" isDelete onClick={del} />
          <ActionBtn label="公開を再開" primary
            onClick={onStatusChange ? () => onStatusChange(job.id, "pending_review") : undefined} />
        </>
      );
  }
}

function renderDateMeta(job: BizJob) {
  const clockIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  const calIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );

  switch (job.status) {
    case "published":
      return (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {calIcon}公開 <strong>{job.publishedAt}</strong>
        </span>
      );
    case "pending_review":
      return (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {clockIcon}申請 <strong>{job.submittedAt}</strong>
          <span style={{ color: "var(--ink-mute)" }}>· 2-3営業日で完了予定</span>
        </span>
      );
    case "rejected":
    case "draft":
      return (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {clockIcon}最終編集 <strong>{job.lastEditedAt}</strong>
        </span>
      );
    case "private":
      return (
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {clockIcon}非公開化 <strong>{job.publishedAt}</strong>
        </span>
      );
  }
}

export function JobListCard({ job, onStatusChange, onDelete, onDuplicate }: Props) {
  const isPrivate = job.status === "private";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderLeft: LEFT_BORDER[job.status],
      borderRadius: 12,
      padding: "18px 22px",
      transition: "all 0.15s",
      opacity: isPrivate ? 0.7 : 1,
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal-100)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 14px rgba(15,23,42,0.06)";
        // Preserve left border
        (e.currentTarget as HTMLDivElement).style.borderLeft = LEFT_BORDER[job.status];
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.borderLeft = LEFT_BORDER[job.status];
      }}
    >
      {/* 上段 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <JobStatusBadge status={job.status} />
            <span style={{
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--bg-tint)",
              color: "var(--ink-soft)",
              border: "1px solid var(--line)",
            }}>
              {job.employmentType}
            </span>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: "var(--ink)",
            marginBottom: 4, lineHeight: 1.5,
          }}>
            {job.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            <span style={{ color: "var(--royal)", fontWeight: 600 }}>{job.jobCategory}</span>
            {job.department && <span> · {job.department}</span>}
          </div>
        </div>

        {/* 給与 */}
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 18, fontWeight: 700, color: "var(--royal)",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {job.salaryMin && job.salaryMax
            ? `¥${job.salaryMin}-${job.salaryMax}万`
            : <span style={{ fontSize: 13, color: "var(--ink-mute)", fontFamily: "inherit" }}>未設定</span>
          }
        </div>
      </div>

      {/* 差し戻しインライン通知 */}
      {job.status === "rejected" && job.rejectionReason && (
        <div style={{
          marginBottom: 14,
          padding: "12px 14px",
          background: "var(--error-soft)",
          border: "1px solid #FCA5A5",
          borderRadius: 8,
          display: "flex",
          gap: 10,
        }}>
          <div style={{
            width: 24, height: 24,
            background: "var(--error)",
            color: "#fff",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "var(--error)",
              letterSpacing: "0.1em", marginBottom: 4,
            }}>
              運営からのフィードバック
            </div>
            <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.7 }}>
              {job.rejectionReason}
            </div>
            {job.rejectionDate && (
              <div style={{ fontSize: 10, color: "#991B1B", marginTop: 4 }}>
                {job.rejectionDate} · {job.rejectionReviewer}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 下段メタ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        paddingTop: 12,
        borderTop: "1px dashed var(--line)",
        fontSize: 11,
        color: "var(--ink-soft)",
        flexWrap: "wrap",
      }}>
        {renderDateMeta(job)}

        {/* 応募数 */}
        {job.meetingCount > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--royal)", fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <strong style={{ fontFamily: "'Inter', sans-serif" }}>{job.meetingCount}</strong> 件のカジュアル面談
          </span>
        )}

        {/* 下書き完成度 */}
        {job.status === "draft" && (
          <span style={{ color: job.completionPercent === 100 ? "var(--success)" : "var(--warm)" }}>
            {job.completionPercent === 100
              ? `✓ 全項目入力済み`
              : `⚠ ${Math.round((100 - job.completionPercent) / 10)}/${10}項目が未入力`
            }
          </span>
        )}

        {/* 担当者 */}
        {job.assigneeNames.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            </svg>
            担当: <strong>{job.assigneeNames.join(", ")}</strong>
          </span>
        )}

        {/* アクションボタン群 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          {renderActions(job, onStatusChange, onDelete, onDuplicate)}
        </div>
      </div>
    </div>
  );
}

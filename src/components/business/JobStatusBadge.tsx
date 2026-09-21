import type { JobStatus } from "@/lib/business/mockJobs";
import { StatusPill } from "@/components/common/StatusPill";
import type { StatusVariant } from "@/components/common/StatusPill";

const JOB_VARIANT_MAP: Record<JobStatus, StatusVariant> = {
  published:      "published",
  pending_review: "pending_review",
  draft:          "draft",
  rejected:       "rejected",
  private:        "private",
};

type Props = {
  status: JobStatus;
  size?: "sm" | "md";
};

export function JobStatusBadge({ status, size = "md" }: Props) {
  /* ★公開中は青にする（2026-09-22）。StatusPill の published は緑だが、求人管理では緑を使わない
        （緑はお金の条件だけ）。⚠️ StatusPill 自体は他の画面も使うので変えていない */
  if (status === "published") return <StatusPill variant="confirming" size={size}>公開中</StatusPill>;
  return <StatusPill variant={JOB_VARIANT_MAP[status]} size={size} />;
}

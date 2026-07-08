import type { JobStatus } from "@/lib/business/mockJobs";
import { StatusPill } from "@/components/common/StatusPill";
import type { StatusVariant } from "@/components/common/StatusPill";

const JOB_VARIANT_MAP: Record<JobStatus, StatusVariant> = {
  published:      "published",
  active:         "active",
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
  return <StatusPill variant={JOB_VARIANT_MAP[status]} size={size} />;
}

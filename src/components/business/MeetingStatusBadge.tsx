import type { MeetingStatus } from "@/lib/business/mockMeetings";
import { StatusPill } from "@/components/common/StatusPill";
import type { StatusVariant } from "@/components/common/StatusPill";

const MEETING_VARIANT_MAP: Record<MeetingStatus, StatusVariant> = {
  pending:           "pending",
  company_contacted: "company_contacted",
  scheduled:         "scheduled",
  completed:         "completed",
  declined:          "declined",
};

type Props = {
  status: MeetingStatus;
  size?: "sm" | "md";
};

export function MeetingStatusBadge({ status, size = "md" }: Props) {
  return <StatusPill variant={MEETING_VARIANT_MAP[status]} size={size} />;
}

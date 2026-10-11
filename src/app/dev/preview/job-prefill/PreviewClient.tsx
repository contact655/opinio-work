"use client";
import { JobPrefillPanel } from "@/components/business/JobPrefillPanel";
import type { JobPrefillDraft } from "@/lib/jobs/prefillFields";

export function JobPrefillPreviewClient({ draft }: { draft?: JobPrefillDraft }) {
  return (
    <JobPrefillPanel
      initialDraft={draft}
      currentText={(it) => (it.key === "title" ? "（前の入力）営業職" : "")}
      onApplyTop={() => {}}
      onApplyLabor={() => {}}
    />
  );
}

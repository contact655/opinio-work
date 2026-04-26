import { BusinessLayout } from "@/components/business/BusinessLayout";
import { JobEditForm } from "@/components/business/JobEditForm";
import { MOCK_JOBS } from "@/lib/business/mockJobs";
import { mockTenantContext } from "@/lib/business/mockTenantContext";

type Props = { jobId: string };

export function JobEditMockView({ jobId }: Props) {
  const ctx = mockTenantContext;
  const job = MOCK_JOBS.find((j) => j.id === jobId) ?? MOCK_JOBS[0];

  return (
    <BusinessLayout
      userName={ctx.userName}
      tenantName={ctx.tenantName}
      tenantLogoGradient={ctx.logoGradient}
      tenantLogoLetter={ctx.logoLetter}
      planType={ctx.planType}
      variant="fullBleed"
    >
      {/* Dev mock banner */}
      <div style={{
        padding: "6px 24px",
        background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>🧪</span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10, fontWeight: 700,
            color: "rgba(255,255,255,0.7)", letterSpacing: "0.15em",
            textTransform: "uppercase", marginRight: 8,
          }}>
            Development Mode
          </span>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
            モックデータ「{job.title}」を編集中
          </span>
        </div>
        <span style={{
          fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700,
          padding: "2px 8px", borderRadius: 100,
          background: "rgba(255,255,255,0.15)", color: "#fff", whiteSpace: "nowrap",
        }}>
          {job.id}
        </span>
      </div>

      <JobEditForm mode="edit" initialJob={job} />
    </BusinessLayout>
  );
}

import { BusinessLayout } from "@/components/business/BusinessLayout";
import { MeetingsClient } from "./MeetingsClient";
import { MOCK_MEETINGS } from "@/lib/business/mockMeetings";
import { mockTenantContext } from "@/lib/business/mockTenantContext";

export function MeetingsMockView() {
  const ctx = mockTenantContext;
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
        padding: "8px 20px",
        background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>🧪</span>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10, fontWeight: 700,
            color: "rgba(255,255,255,0.7)", letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginRight: 8,
          }}>
            Development Mode
          </span>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>
            モックデータを表示中。{MOCK_MEETINGS.length}件の申込サンプル。
          </span>
        </div>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10, fontWeight: 700,
          padding: "3px 10px", borderRadius: 100,
          background: "rgba(255,255,255,0.15)",
          color: "#fff", whiteSpace: "nowrap",
        }}>
          NEXT_PUBLIC_BIZ_MOCK_MODE=true
        </span>
      </div>

      <MeetingsClient
        meetings={MOCK_MEETINGS}
        tenantName={ctx.tenantName}
        currentUser={{
          owUserId: ctx.currentOwnId,
          name: ctx.userName,
          initial: ctx.userName.charAt(0),
          gradient: ctx.currentOwnerGradient,
        }}
      />
    </BusinessLayout>
  );
}

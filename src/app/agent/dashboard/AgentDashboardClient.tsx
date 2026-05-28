"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgentJobPreview, AgentCandidate } from "@/lib/business/agents";

type Props = {
  agencyName: string;
  assignedJobs: AgentJobPreview[];
  candidates: AgentCandidate[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "書類選考", color: "#D97706", bg: "#FEF3C7" },
  reviewing: { label: "書類選考中", color: "#3B5FD9", bg: "#EFF3FC" },
  interview: { label: "面接", color: "#7C3AED", bg: "#F3E8FF" },
  offer: { label: "内定", color: "#059669", bg: "#ECFDF5" },
  rejected: { label: "不採用", color: "#64748B", bg: "#F1F5F9" },
};

function StatusBadge({ stageId }: { stageId: string | null }) {
  if (!stageId) return <span style={{ fontSize: 11, color: "#94A3B8" }}>未設定</span>;
  const cfg = STATUS_CONFIG.pending; // Default badge
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

export function AgentDashboardClient({ agencyName, assignedJobs, candidates }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/agent/auth");
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      {/* Welcome header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 16, marginBottom: 32, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{
            margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#0F172A",
            fontFamily: "'Noto Serif JP', serif",
          }}>
            こんにちは、{agencyName}さん。
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", fontFamily: "Inter, sans-serif" }}>
            Agent Portal Dashboard
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 18px", borderRadius: 8,
            border: "1px solid #E2E8F0", background: "#fff",
            color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          ログアウト
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "担当求人", value: assignedJobs.length, color: "#002366", bg: "#EFF3FC" },
          { label: "推薦候補者", value: candidates.length, color: "#7C3AED", bg: "#F3E8FF" },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: stat.bg, borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, fontFamily: "Inter, sans-serif" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: stat.color, fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Assigned jobs */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{
          fontSize: 16, fontWeight: 800, color: "#0F172A",
          margin: "0 0 14px", fontFamily: "'Noto Serif JP', serif",
        }}>
          担当求人 ({assignedJobs.length}件)
        </h2>

        {assignedJobs.length === 0 ? (
          <div style={{
            padding: "40px 24px", background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: 12, textAlign: "center", color: "#94A3B8", fontSize: 14,
          }}>
            担当求人がまだ割り当てられていません
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {assignedJobs.map((job) => {
              const submitted = candidates.filter((c) => c.jobTitle === job.title).length;
              return (
                <div
                  key={job.id}
                  style={{
                    background: "#fff", border: "1px solid #E2E8F0",
                    borderRadius: 12, padding: "20px",
                    display: "flex", flexDirection: "column", gap: 10,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      {job.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{job.company.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>
                      推薦: {submitted}名
                    </span>
                    <Link
                      href={`/agent/recommend/${job.id}`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "7px 14px", borderRadius: 7,
                        background: "linear-gradient(135deg, #002366, #3B5FD9)",
                        color: "#fff", textDecoration: "none",
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      推薦する →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Submitted candidates */}
      <section>
        <h2 style={{
          fontSize: 16, fontWeight: 800, color: "#0F172A",
          margin: "0 0 14px", fontFamily: "'Noto Serif JP', serif",
        }}>
          推薦した候補者 ({candidates.length}名)
        </h2>

        {candidates.length === 0 ? (
          <div style={{
            padding: "40px 24px", background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: 12, textAlign: "center", color: "#94A3B8", fontSize: 14,
          }}>
            まだ候補者を推薦していません
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["候補者名", "対象求人", "ステータス", "推薦日"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#94A3B8",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      fontFamily: "Inter, sans-serif",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, color: "#0F172A" }}>
                      {c.name}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>
                      {c.jobTitle}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge stageId={c.pipelineStageId} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#94A3B8", fontFamily: "Inter, sans-serif" }}>
                      {c.appliedAtLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

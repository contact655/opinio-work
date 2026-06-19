"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { PipelineStage, PipelineCandidate, PipelineMeeting } from "@/lib/business/pipeline";

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; star?: boolean }> = {
  opinio:   { label: "OPINIO",     color: "var(--royal)", bg: "#EFF3FC", star: true },
  bizreach: { label: "ビズリーチ",  color: "#E55A00", bg: "#FFF3ED" },
  green:    { label: "Green",      color: "#00A55E", bg: "#E8F8F0" },
  wantedly: { label: "Wantedly",   color: "#00A9A9", bg: "#E8F8F8" },
  agent:    { label: "エージェント", color: "#7C3AED", bg: "#F3E8FF" },
  direct:   { label: "直接応募",    color: "#6b7280", bg: "#F1F5F9" },
  referral: { label: "リファラル",  color: "#D97706", bg: "#FEF3C7" },
};

const ALL_SOURCES = ["opinio", "bizreach", "green", "wantedly", "agent", "direct", "referral"];

const PRESET_COLORS = [
  "#6b7280", "#3B5FD9", "#7C3AED", "#D97706",
  "var(--success)", "#DC2626", "#0EA5E9", "#F59E0B",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ source, agentCompany }: { source: string; agentCompany: string | null }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.direct;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, fontFamily: "Inter, sans-serif",
    }}>
      {cfg.star && <span>★</span>}
      {cfg.label}
      {source === "agent" && agentCompany && ` / ${agentCompany}`}
    </span>
  );
}

function StageDot({ color }: { color: string }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8,
      borderRadius: "50%", background: color, flexShrink: 0,
    }} />
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type AgencyOption = { id: string; agencyName: string };

type Props = {
  initialStages: PipelineStage[];
  initialCandidates: PipelineCandidate[];
  jobs: { id: string; title: string }[];
  agencies?: AgencyOption[];
  meetings?: PipelineMeeting[];
};

// ─── Main component ───────────────────────────────────────────────────────────

export function PipelineClient({ initialStages, initialCandidates, jobs, agencies = [], meetings: initialMeetings = [] }: Props) {
  const router = useRouter();

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [candidates, setCandidates] = useState<PipelineCandidate[]>(initialCandidates);
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [rejectedExpanded, setRejectedExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<PipelineMeeting[]>(initialMeetings);
  const [meetingDeclinedExpanded, setMeetingDeclinedExpanded] = useState(false);

  // Which sources actually have candidates (for filter bar)
  const activeSources = useMemo(() => {
    const s = new Set(candidates.map((c) => c.source));
    return ALL_SOURCES.filter((src) => s.has(src));
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (sourceFilter === "all") return candidates;
    return candidates.filter((c) => c.source === sourceFilter);
  }, [candidates, sourceFilter]);

  // ── Move candidate stage ────────────────────────────────────────────────────

  async function moveCandidate(candidateId: string, newStageId: string | null) {
    const prev = candidates.find((c) => c.id === candidateId);
    if (!prev) return;

    // Optimistic update
    setCandidates((cs) =>
      cs.map((c) => c.id === candidateId ? { ...c, pipelineStageId: newStageId } : c)
    );
    setMovingId(null);
    setError(null);

    const res = await fetch(`/api/biz/pipeline/applications/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_stage_id: newStageId }),
    });

    if (!res.ok) {
      // Revert
      setCandidates((cs) =>
        cs.map((c) => c.id === candidateId ? { ...c, pipelineStageId: prev.pipelineStageId } : c)
      );
      setError("ステージの更新に失敗しました。再度お試しください。");
    } else {
      router.refresh();
    }
  }

  // ── Update meeting status ───────────────────────────────────────────────────

  async function updateMeetingStatus(meetingId: string, newStatus: string) {
    const prev = meetings.find((m) => m.id === meetingId);
    if (!prev) return;
    setMeetings((ms) => ms.map((m) => m.id === meetingId ? { ...m, status: newStatus as PipelineMeeting["status"] } : m));
    const res = await fetch(`/api/biz/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", value: newStatus }),
    });
    if (!res.ok) {
      setMeetings((ms) => ms.map((m) => m.id === meetingId ? prev : m));
      setError("面談ステータスの更新に失敗しました。");
    } else {
      router.refresh();
    }
  }

  // ── Meeting column data ────────────────────────────────────────────────────

  const meetingActive = meetings.filter((m) => ["pending", "company_contacted", "scheduled"].includes(m.status));
  const meetingDone = meetings.filter((m) => m.status === "completed");
  const meetingDeclined = meetings.filter((m) => m.status === "declined");

  // ── Kanban ─────────────────────────────────────────────────────────────────

  const kanbanStages = stages.filter((s) => !s.isRejected);
  const rejectedStage = stages.find((s) => s.isRejected);

  // ── Meeting card + column ──────────────────────────────────────────────────

  function MeetingKanbanCard({ m }: { m: PipelineMeeting }) {
    const NEXT: Record<string, { label: string; value: string }> = {
      pending:           { label: "確認する →",  value: "company_contacted" },
      company_contacted: { label: "日程調整へ →", value: "scheduled" },
      scheduled:         { label: "面談完了 ✓",  value: "completed" },
    };
    const next = NEXT[m.status];
    return (
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 10, padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 7,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: m.gradient, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>{m.initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.currentCompany}
            </div>
          </div>
        </div>
        {/* Job title if any */}
        {m.jobTitle && (
          <div style={{ fontSize: 11, color: "var(--ink-soft)", padding: "3px 8px", background: "var(--royal-50)", borderRadius: 6 }}>
            {m.jobTitle}
          </div>
        )}
        {/* Intent */}
        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{m.intent}</div>
        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>{m.submittedAt}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {next && (
              <button
                onClick={() => updateMeetingStatus(m.id, next.value)}
                style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  border: "1px solid var(--royal-100)", background: "var(--royal-50)",
                  color: "var(--royal)", cursor: "pointer",
                }}
              >
                {next.label}
              </button>
            )}
            <button
              onClick={() => updateMeetingStatus(m.id, "declined")}
              style={{
                fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                border: "1px solid var(--line)", background: "#fff",
                color: "var(--ink-mute)", cursor: "pointer",
              }}
            >
              見送り
            </button>
          </div>
        </div>
      </div>
    );
  }

  function MeetingKanbanColumn({ title, color, bgColor, items }: {
    title: string; color: string; bgColor: string; items: PipelineMeeting[];
  }) {
    return (
      <div style={{ minWidth: 240, maxWidth: 270, flex: "0 0 250px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: bgColor,
          borderRadius: 10, border: `1px solid ${color}22`,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", flex: 1 }}>{title}</span>
          <span style={{
            background: "rgba(255,255,255,0.6)", color, fontSize: 11, fontWeight: 700,
            borderRadius: 100, padding: "1px 8px", fontFamily: "Inter, sans-serif",
          }}>{items.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((m) => <MeetingKanbanCard key={m.id} m={m} />)}
          {items.length === 0 && (
            <div style={{
              padding: "20px 12px", textAlign: "center", color: "var(--ink-mute)", fontSize: 12,
              border: "1.5px dashed var(--line)", borderRadius: 10,
            }}>申込なし</div>
          )}
        </div>
      </div>
    );
  }

  function KanbanColumn({ stage }: { stage: PipelineStage }) {
    const colCandidates = filteredCandidates.filter(
      (c) => c.pipelineStageId === stage.id
    );
    const unassigned = stage.orderIndex === 0 && filteredCandidates.filter((c) => !c.pipelineStageId);
    const displayCandidates =
      stage.orderIndex === 0
        ? [...(unassigned || []), ...colCandidates]
        : colCandidates;

    return (
      <div style={{
        minWidth: 260, maxWidth: 300, flex: "0 0 270px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {/* Column header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px",
          background: "#fff", borderRadius: 10,
          border: "1px solid var(--line)",
        }}>
          <StageDot color={stage.color} />
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", flex: 1 }}>
            {stage.name}
          </span>
          <span style={{
            background: "var(--line-soft)", color: "var(--ink-mute)",
            fontSize: 11, fontWeight: 700, borderRadius: 100,
            padding: "1px 8px", fontFamily: "Inter, sans-serif",
          }}>
            {displayCandidates.length}
          </span>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayCandidates.map((c) => (
            <KanbanCard key={c.id} candidate={c} />
          ))}
          {displayCandidates.length === 0 && (
            <div style={{
              padding: "20px 12px", textAlign: "center",
              color: "var(--ink-mute)", fontSize: 12,
              border: "1.5px dashed var(--line)", borderRadius: 10,
            }}>
              候補者なし
            </div>
          )}
        </div>
      </div>
    );
  }

  function KanbanCard({ candidate }: { candidate: PipelineCandidate }) {
    const isMoving = movingId === candidate.id;

    return (
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 10, padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        position: "relative",
      }}>
        {/* Name + source */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.3 }}>
            {candidate.name}
          </span>
          <SourceBadge source={candidate.source} agentCompany={candidate.agentCompany} />
        </div>

        {/* Job title */}
        <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.4 }}>
          {candidate.jobTitle}
        </div>

        {/* Date */}
        <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
          {candidate.appliedAtLabel}
        </div>

        {/* Stage move button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMovingId(isMoving ? null : candidate.id)}
            style={{
              fontSize: 12, color: "var(--accent)", fontWeight: 600,
              background: "var(--royal-50)", border: "none",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
              width: "100%", textAlign: "left",
            }}
          >
            → ステージを変更
          </button>
          {isMoving && (
            <StageDropdown
              currentStageId={candidate.pipelineStageId}
              onSelect={(stageId) => moveCandidate(candidate.id, stageId)}
              onClose={() => setMovingId(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  function ListRow({ candidate }: { candidate: PipelineCandidate }) {
    const isMoving = movingId === candidate.id;
    const stage = stages.find((s) => s.id === candidate.pipelineStageId);

    return (
      <tr style={{ borderBottom: "1px solid var(--line-soft)" }}>
        <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
          {candidate.name}
        </td>
        <td style={{ padding: "12px 16px" }}>
          <SourceBadge source={candidate.source} agentCompany={candidate.agentCompany} />
        </td>
        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink-soft)" }}>
          {candidate.jobTitle}
        </td>
        <td style={{ padding: "12px 16px" }}>
          {stage ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, color: "var(--ink)",
            }}>
              <StageDot color={stage.color} />
              {stage.name}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>未設定</span>
          )}
        </td>
        <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
          {candidate.appliedAtLabel}
        </td>
        <td style={{ padding: "12px 16px", position: "relative" }}>
          <button
            onClick={() => setMovingId(isMoving ? null : candidate.id)}
            style={{
              fontSize: 12, color: "var(--accent)", fontWeight: 600,
              background: "var(--royal-50)", border: "none",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
            }}
          >
            変更
          </button>
          {isMoving && (
            <StageDropdown
              currentStageId={candidate.pipelineStageId}
              onSelect={(stageId) => moveCandidate(candidate.id, stageId)}
              onClose={() => setMovingId(null)}
            />
          )}
        </td>
      </tr>
    );
  }

  // ── Stage dropdown ──────────────────────────────────────────────────────────

  function StageDropdown({
    currentStageId,
    onSelect,
    onClose,
  }: {
    currentStageId: string | null;
    onSelect: (id: string) => void;
    onClose: () => void;
  }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          onClose();
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    return (
      <div
        ref={ref}
        style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100,
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 200, marginTop: 4, overflow: "hidden",
        }}
      >
        {stages.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", width: "100%", textAlign: "left",
              background: s.id === currentStageId ? "var(--line-soft)" : "transparent",
              border: "none", cursor: "pointer", fontSize: 13,
              color: "var(--ink)", fontWeight: s.id === currentStageId ? 700 : 400,
            }}
          >
            <StageDot color={s.color} />
            {s.name}
          </button>
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0, fontFamily: "'Noto Serif JP', serif" }}>
            パイプライン
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            Pipeline
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowStageModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)",
            background: "#fff", color: "var(--ink)", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⚙ ステージ管理
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + 外部候補者を追加
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "10px 16px", background: "var(--error-soft)",
          border: "1px solid #FECACA", borderRadius: 8,
          color: "var(--error)", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={16} color="var(--error)" style={{ flexShrink: 0 }} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* View switcher */}
      <div style={{ display: "flex", gap: 0, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
        {(["kanban", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "7px 18px", fontSize: 13, fontWeight: 600,
              background: view === v ? "var(--royal)" : "#fff",
              color: view === v ? "#fff" : "var(--ink-soft)",
              border: "none", cursor: "pointer",
              borderRight: v === "kanban" ? "1px solid var(--line)" : "none",
            }}
          >
            {v === "kanban" ? "カンバン" : "リスト"}
          </button>
        ))}
      </div>

      {/* Source filter row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => setSourceFilter("all")}
          style={{
            padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
            background: sourceFilter === "all" ? "var(--royal)" : "#fff",
            color: sourceFilter === "all" ? "#fff" : "var(--ink-soft)",
            border: sourceFilter === "all" ? "none" : "1px solid var(--line)",
            cursor: "pointer",
          }}
        >
          すべて ({candidates.length})
        </button>
        {["opinio", ...activeSources.filter((s) => s !== "opinio")].map((src) => {
          const cfg = SOURCE_CONFIG[src] ?? SOURCE_CONFIG.direct;
          const count = candidates.filter((c) => c.source === src).length;
          const isActive = sourceFilter === src;
          return (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              style={{
                padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                background: isActive ? cfg.color : "#fff",
                color: isActive ? "#fff" : cfg.color,
                border: `1px solid ${isActive ? cfg.color : cfg.bg}`,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {cfg.star && <span>★</span>}
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Empty state — only show when no meetings AND no candidates */}
      {candidates.length === 0 && meetings.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 20px", gap: 16,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--royal-50)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>まだ候補者がいません</div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)", textAlign: "center" }}>
            OPINIOからの応募者、または外部からの候補者を追加してパイプラインを管理しましょう
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", marginTop: 4,
            }}
          >
            + 外部候補者を追加
          </button>
        </div>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <div style={{ overflowX: "auto", paddingBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, minWidth: "max-content", alignItems: "flex-start" }}>
            {/* ── Meeting columns ──────────────────────────── */}
            <MeetingKanbanColumn
              title="面談"
              color="var(--warm)"
              bgColor="var(--warm-soft)"
              items={meetingActive}
            />
            <MeetingKanbanColumn
              title="面談済"
              color="var(--ink-soft)"
              bgColor="var(--bg-tint)"
              items={meetingDone}
            />
            {/* Separator arrow */}
            <div style={{
              display: "flex", alignItems: "flex-start", paddingTop: 14, color: "var(--line)",
              fontSize: 22, flexShrink: 0, userSelect: "none",
            }}>→</div>
            {/* ── Application pipeline stages ──────────────── */}
            {kanbanStages.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} />
            ))}
          </div>

          {/* Rejected column (collapsible) */}
          {rejectedStage && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => setRejectedExpanded((e) => !e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, marginBottom: 8,
                }}
              >
                <StageDot color={rejectedStage.color} />
                {rejectedStage.name}
                <span style={{ color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                  ({filteredCandidates.filter((c) => c.pipelineStageId === rejectedStage.id).length})
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {rejectedExpanded ? "▲ 折りたたむ" : "▼ 展開する"}
                </span>
              </button>
              {rejectedExpanded && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {filteredCandidates
                    .filter((c) => c.pipelineStageId === rejectedStage.id)
                    .map((c) => (
                      <div key={c.id} style={{
                        background: "#fff", border: "1px solid var(--line)",
                        borderRadius: 10, padding: "12px 14px", width: 270, opacity: 0.7,
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{c.jobTitle}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Declined meetings (collapsible) */}
          {meetingDeclined.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setMeetingDeclinedExpanded((e) => !e)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, marginBottom: 8,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--error)", display: "inline-block" }} />
                面談見送り
                <span style={{ color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                  ({meetingDeclined.length})
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {meetingDeclinedExpanded ? "▲" : "▼"}
                </span>
              </button>
              {meetingDeclinedExpanded && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {meetingDeclined.map((m) => (
                    <div key={m.id} style={{
                      background: "#fff", border: "1px solid var(--line)",
                      borderRadius: 10, padding: "12px 14px", width: 240, opacity: 0.6,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", marginBottom: 2 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{m.currentCompany}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && candidates.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
                {["氏名", "ソース", "求人", "ステージ", "登録日", "アクション"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    fontFamily: "Inter, sans-serif",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c) => (
                <ListRow key={c.id} candidate={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add candidate modal */}
      {showAddModal && (
        <AddCandidateModal
          stages={stages}
          jobs={jobs}
          agencies={agencies}
          onClose={() => setShowAddModal(false)}
          onAdded={(newCandidate) => {
            setCandidates((cs) => [newCandidate, ...cs]);
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}

      {/* Stage management modal */}
      {showStageModal && (
        <StageManagementModal
          stages={stages}
          onClose={() => setShowStageModal(false)}
          onStagesChanged={(updated) => setStages(updated)}
        />
      )}
    </div>
  );
}

// ─── Add Candidate Modal ──────────────────────────────────────────────────────

function AddCandidateModal({
  stages,
  jobs,
  agencies = [],
  onClose,
  onAdded,
}: {
  stages: PipelineStage[];
  jobs: { id: string; title: string }[];
  agencies?: AgencyOption[];
  onClose: () => void;
  onAdded: (candidate: PipelineCandidate) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("direct");
  const [agentCompany, setAgentCompany] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("氏名は必須です"); return; }
    if (!jobId) { setError("対象求人を選択してください"); return; }
    if (!stageId) { setError("選考ステージを選択してください"); return; }

    setSubmitting(true);
    setError(null);

    // Resolve agent company display name
    const resolvedAgentCompany = source === "agent"
      ? (agencyId ? agencies.find((a) => a.id === agencyId)?.agencyName : agentCompany.trim()) || undefined
      : undefined;

    const res = await fetch("/api/biz/pipeline/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_name: name.trim(),
        external_email: email.trim() || undefined,
        source,
        agent_company: resolvedAgentCompany,
        agency_id: source === "agent" && agencyId ? agencyId : undefined,
        job_id: jobId,
        pipeline_stage_id: stageId,
        memo: memo.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "登録に失敗しました");
      return;
    }

    const { application } = await res.json();
    const _stage = stages.find((s) => s.id === stageId); void _stage;
    const job = jobs.find((j) => j.id === jobId);

    onAdded({
      id: application.id,
      jobId,
      jobTitle: job?.title ?? "—",
      userId: null,
      name: name.trim(),
      email: email.trim() || null,
      source,
      agentCompany: source === "agent"
        ? (agencyId ? agencies.find((a) => a.id === agencyId)?.agencyName ?? null : agentCompany.trim() || null)
        : null,
      pipelineStageId: stageId,
      memo: memo.trim() || null,
      createdAt: application.created_at ?? new Date().toISOString(),
      appliedAtLabel: "今日",
    });
  }

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
          外部候補者を追加
        </h2>

        {error && (
          <div style={{ padding: "8px 12px", background: "var(--error-soft)", color: "var(--error)", borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label style={labelStyle}>氏名 <span style={{ color: "var(--error)" }}>*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田 太郎"
            style={inputStyle}
            required
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="taro@example.com"
            style={inputStyle}
          />
        </div>

        {/* Source */}
        <div>
          <label style={labelStyle}>応募経路 <span style={{ color: "var(--error)" }}>*</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSource(key)}
                style={{
                  padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                  background: source === key ? cfg.color : "#fff",
                  color: source === key ? "#fff" : cfg.color,
                  border: `1.5px solid ${source === key ? cfg.color : cfg.bg}`,
                  cursor: "pointer",
                }}
              >
                {cfg.star && "★ "}{cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent company (only when agent) */}
        {source === "agent" && (
          <div>
            <label style={labelStyle}>エージェント会社</label>
            {agencies.length > 0 ? (
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                style={selectStyle}
              >
                <option value="">— 選択してください —</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.agencyName}</option>
                ))}
                <option value="__other__">その他（手入力）</option>
              </select>
            ) : null}
            {(agencies.length === 0 || agencyId === "__other__") && (
              <input
                value={agentCompany}
                onChange={(e) => setAgentCompany(e.target.value)}
                placeholder="株式会社○○エージェンシー"
                style={{ ...inputStyle, marginTop: agencyId === "__other__" ? 8 : 0 }}
              />
            )}
          </div>
        )}

        {/* Job */}
        <div>
          <label style={labelStyle}>対象求人 <span style={{ color: "var(--error)" }}>*</span></label>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={selectStyle}>
            {jobs.length === 0 && <option value="">公開中の求人がありません</option>}
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>

        {/* Stage */}
        <div>
          <label style={labelStyle}>選考ステージ <span style={{ color: "var(--error)" }}>*</span></label>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={selectStyle}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Memo */}
        <div>
          <label style={labelStyle}>メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="候補者に関する備考など..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "'Noto Sans JP', sans-serif" }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>キャンセル</button>
          <button type="submit" disabled={submitting} style={submitBtnStyle}>
            {submitting ? "登録中..." : "追加する"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Stage Management Modal ───────────────────────────────────────────────────

function StageManagementModal({
  stages: initialStages,
  onClose,
  onStagesChanged,
}: {
  stages: PipelineStage[];
  onClose: () => void;
  onStagesChanged: (stages: PipelineStage[]) => void;
}) {
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState(PRESET_COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function startEdit(stage: PipelineStage) {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
    setError(null);
  }

  async function saveEdit(stageId: string) {
    const res = await fetch("/api/biz/pipeline/stages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stageId, name: editName, color: editColor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "更新に失敗しました");
      return;
    }
    const updated = stages.map((s) =>
      s.id === stageId ? { ...s, name: editName, color: editColor } : s
    );
    setStages(updated);
    onStagesChanged(updated);
    setEditingId(null);
  }

  async function deleteStage(stageId: string) {
    const res = await fetch("/api/biz/pipeline/stages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stageId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "削除に失敗しました");
      return;
    }
    const updated = stages.filter((s) => s.id !== stageId);
    setStages(updated);
    onStagesChanged(updated);
    setConfirmDeleteId(null);
  }

  async function addStage() {
    if (!addName.trim()) { setError("ステージ名を入力してください"); return; }
    const res = await fetch("/api/biz/pipeline/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: addName.trim(), color: addColor }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "追加に失敗しました");
      return;
    }
    const { stage } = await res.json();
    const newStage: PipelineStage = {
      id: stage.id,
      companyId: stage.company_id,
      name: stage.name,
      color: stage.color,
      orderIndex: stage.order_index,
      isHired: stage.is_hired ?? false,
      isRejected: stage.is_rejected ?? false,
    };
    const updated = [...stages, newStage];
    setStages(updated);
    onStagesChanged(updated);
    setAddName("");
    setAddColor(PRESET_COLORS[0]);
    setError(null);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
        ステージ管理
      </h2>

      {error && (
        <div style={{ padding: "8px 12px", background: "var(--error-soft)", color: "var(--error)", borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {stages.map((stage) => (
          <div key={stage.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", border: "1px solid var(--line)",
            borderRadius: 8, background: "#fff",
          }}>
            {editingId === stage.id ? (
              <>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      style={{
                        width: 18, height: 18, borderRadius: "50%", background: c,
                        border: editColor === c ? "2.5px solid var(--ink)" : "2px solid transparent",
                        cursor: "pointer", padding: 0,
                      }}
                    />
                  ))}
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: "5px 10px", fontSize: 13 }}
                  autoFocus
                />
                <button onClick={() => saveEdit(stage.id)} style={{ ...submitBtnStyle, padding: "5px 12px", fontSize: 12 }}>保存</button>
                <button onClick={() => setEditingId(null)} style={{ ...cancelBtnStyle, padding: "5px 12px", fontSize: 12 }}>キャンセル</button>
              </>
            ) : (
              <>
                <span style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: stage.color, display: "inline-block", flexShrink: 0,
                }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{stage.name}</span>
                {(stage.isHired || stage.isRejected) && (
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", fontStyle: "italic" }}>
                    {stage.isHired ? "採用" : "不採用"}ステージ（固定）
                  </span>
                )}
                {!stage.isHired && !stage.isRejected && (
                  <>
                    <button onClick={() => startEdit(stage)} style={{ ...cancelBtnStyle, padding: "3px 10px", fontSize: 12 }}>編集</button>
                    {confirmDeleteId === stage.id ? (
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--error)" }}>削除しますか？</span>
                        <button onClick={() => deleteStage(stage.id)} style={{ background: "var(--error)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>削除</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ ...cancelBtnStyle, padding: "3px 10px", fontSize: 12 }}>いいえ</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(stage.id)}
                        style={{ background: "none", border: "none", color: "var(--ink-mute)", fontSize: 12, cursor: "pointer", padding: "3px 6px" }}
                      >
                        削除
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add stage */}
      <div style={{
        border: "1.5px dashed var(--line)", borderRadius: 8,
        padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>+ ステージを追加</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAddColor(c)}
              style={{
                width: 22, height: 22, borderRadius: "50%", background: c,
                border: addColor === c ? "2.5px solid var(--ink)" : "2px solid transparent",
                cursor: "pointer", padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="ステージ名（例: コーディングテスト）"
            style={{ ...inputStyle, flex: 1, fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
          />
          <button onClick={addStage} style={{ ...submitBtnStyle, whiteSpace: "nowrap" }}>追加</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onClose} style={cancelBtnStyle}>閉じる</button>
      </div>
    </ModalOverlay>
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, padding: 28,
        maxWidth: 540, width: "100%", maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

import type { CSSProperties } from "react";

const labelStyle: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: "var(--ink-soft)", marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "9px 12px",
  border: "1px solid var(--line)", borderRadius: 8,
  fontSize: 14, color: "var(--ink)",
  background: "#fff", outline: "none",
  boxSizing: "border-box",
  fontFamily: "'Noto Sans JP', sans-serif",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const cancelBtnStyle: CSSProperties = {
  padding: "8px 18px", borderRadius: 8,
  border: "1px solid var(--line)", background: "#fff",
  color: "var(--ink)", fontSize: 13, fontWeight: 600,
  cursor: "pointer",
};

const submitBtnStyle: CSSProperties = {
  padding: "8px 20px", borderRadius: 8,
  border: "none", background: "var(--royal)",
  color: "#fff", fontSize: 13, fontWeight: 700,
  cursor: "pointer",
};

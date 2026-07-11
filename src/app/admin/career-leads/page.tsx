"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  name: string;
  email: string;
  current_job: string;
  timeline: string;
  message: string | null;
  status: string;
  admin_note: string | null;
  assigned_to: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  new:               { label: "新規",         color: "#DC2626", bg: "#FEE2E2" },
  contacted:         { label: "連絡済み",     color: "#D97706", bg: "#FEF3C7" },
  meeting_scheduled: { label: "面談確定",     color: "#7C3AED", bg: "#F3E8FF" },
  in_progress:       { label: "対応中",       color: "#002366", bg: "#EFF3FC" },
  closed:            { label: "完了",         color: "#059669", bg: "#ECFDF5" },
  rejected:          { label: "見送り",       color: "#94A3B8", bg: "#F1F5F9" },
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label }));

export default function CareerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState<Record<string, string>>({});

  const supabase = createClient();

  async function fetchLeads() {
    let query = supabase
      .from("ow_career_agent_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    const { data } = await query;
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => { fetchLeads(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    await supabase.from("ow_career_agent_leads").update({ status }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    setSaving(null);
  }

  async function saveNote(id: string) {
    setSaving(id);
    const note = noteEdit[id] ?? "";
    await supabase.from("ow_career_agent_leads").update({ admin_note: note }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, admin_note: note } : l));
    setSaving(null);
  }

  const counts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: "32px 24px", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            キャリア相談リード管理
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>
            /career-agent フォームの申込一覧
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => counts[k] ? (
            <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: v.bg, color: v.color }}>
              {v.label} {counts[k]}
            </span>
          ) : null)}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ value: "all", label: "すべて" }, ...STATUS_OPTIONS].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            style={{
              padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
              border: filterStatus === value ? "1.5px solid var(--royal)" : "1.5px solid var(--line)",
              background: filterStatus === value ? "var(--royal-50)" : "#fff",
              color: filterStatus === value ? "var(--royal)" : "var(--ink-soft)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-mute)", fontSize: 14 }}>読み込み中...</p>
      ) : leads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15 }}>申込はまだありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {leads.map((lead) => {
            const st = STATUS_LABELS[lead.status] ?? STATUS_LABELS.new;
            const isExpanded = expandedId === lead.id;
            return (
              <div
                key={lead.id}
                style={{
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: isExpanded ? "0 2px 12px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {/* Header row */}
                <div
                  style={{ padding: "16px 20px", display: "flex", gap: 16, alignItems: "center", cursor: "pointer" }}
                  onClick={() => {
                    setExpandedId(isExpanded ? null : lead.id);
                    if (!noteEdit[lead.id]) setNoteEdit((p) => ({ ...p, [lead.id]: lead.admin_note ?? "" }));
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: st.bg, color: st.color, flexShrink: 0 }}>
                    {st.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{lead.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                      {lead.current_job} · {lead.timeline}
                    </div>
                  </div>
                  <a
                    href={`mailto:${lead.email}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
                  >
                    {lead.email}
                  </a>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", flexShrink: 0 }}>
                    {new Date(lead.created_at).toLocaleDateString("ja-JP")}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--ink-mute)", flexShrink: 0 }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--line-soft)" }}>
                    {lead.message && (
                      <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--bg-tint)", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>相談内容</div>
                        <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{lead.message}</p>
                      </div>
                    )}

                    <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                      {/* Status change */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>ステータス変更</div>
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          disabled={saving === lead.id}
                          style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                        >
                          {STATUS_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Admin note */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>管理者メモ</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <textarea
                            value={noteEdit[lead.id] ?? lead.admin_note ?? ""}
                            onChange={(e) => setNoteEdit((p) => ({ ...p, [lead.id]: e.target.value }))}
                            rows={2}
                            placeholder="対応状況メモ..."
                            style={{ flex: 1, fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", resize: "vertical" }}
                          />
                          <button
                            onClick={() => saveNote(lead.id)}
                            disabled={saving === lead.id}
                            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "var(--royal)", color: "#fff", border: "none", cursor: "pointer", alignSelf: "flex-start" }}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

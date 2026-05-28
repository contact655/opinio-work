"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AgentAgency, AgentContact } from "@/lib/business/agents";

type Job = { id: string; title: string };

type Props = {
  initialAgencies: AgentAgency[];
  jobs: Job[];
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-soft)",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--ink)",
  fontFamily: "'Noto Sans JP', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: 8,
  border: "none",
  background: "var(--royal)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "#fff",
  color: "var(--ink-soft)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

// ─── Modal Overlay ────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(15,23,42,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: "32px", width: "100%", maxWidth: 480,
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Add Agency Modal ─────────────────────────────────────────────────────────

function AddAgencyModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (agency: AgentAgency) => void;
}) {
  const [agencyName, setAgencyName] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agencyName.trim()) { setError("エージェント会社名を入力してください"); return; }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/biz/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName: agencyName.trim(), memo: memo.trim() || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "登録に失敗しました");
      return;
    }
    const { agency } = await res.json();
    onAdded({
      id: agency.id,
      companyId: agency.company_id,
      agencyName: agency.agency_name,
      memo: agency.memo,
      isActive: agency.is_active,
      contacts: [],
      assignedJobIds: [],
      candidateCount: 0,
    });
  }

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
          エージェントを追加
        </h2>
        {error && (
          <div style={{ padding: "8px 12px", background: "var(--error-soft)", color: "var(--error)", borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}
        <div>
          <label style={labelStyle}>会社名 <span style={{ color: "var(--error)" }}>*</span></label>
          <input
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="株式会社○○エージェンシー"
            style={inputStyle}
            autoFocus
          />
        </div>
        <div>
          <label style={labelStyle}>内部メモ</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="担当窓口や商流など社内向けのメモ..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnSecondary}>キャンセル</button>
          <button type="submit" disabled={submitting} style={btnPrimary}>
            {submitting ? "追加中..." : "追加する"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ─── Agency Card ──────────────────────────────────────────────────────────────

function AgencyCard({
  agency,
  jobs,
  onUpdate,
  onDelete,
}: {
  agency: AgentAgency;
  jobs: Job[];
  onUpdate: (updated: AgentAgency) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(agency.agencyName);
  const [editMemo, setEditMemo] = useState(agency.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<AgentContact[]>(agency.contacts);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [assignedJobIds, setAssignedJobIds] = useState<string[]>(agency.assignedJobIds);
  const [jobsSaving, setJobsSaving] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsDirty, setJobsDirty] = useState(false);

  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveEdit() {
    if (!editName.trim()) { setEditError("会社名は必須です"); return; }
    setSaving(true); setEditError(null);
    const res = await fetch(`/api/biz/agents/${agency.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agencyName: editName.trim(), memo: editMemo.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setEditError(d.error ?? "更新失敗"); return; }
    onUpdate({ ...agency, agencyName: editName.trim(), memo: editMemo.trim() || null, contacts, assignedJobIds });
    setEditing(false);
  }

  async function toggleActive() {
    const res = await fetch(`/api/biz/agents/${agency.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !agency.isActive }),
    });
    if (res.ok) onUpdate({ ...agency, isActive: !agency.isActive, contacts, assignedJobIds });
  }

  async function addContact() {
    if (!newContactName.trim()) { setContactError("担当者名を入力してください"); return; }
    if (!newContactEmail.trim()) { setContactError("メールアドレスを入力してください"); return; }
    setAddingContact(true); setContactError(null);
    const res = await fetch(`/api/biz/agents/${agency.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newContactName.trim(), email: newContactEmail.trim(), isPrimary: contacts.length === 0 }),
    });
    setAddingContact(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setContactError(d.error ?? "追加失敗"); return; }
    const { contact } = await res.json();
    const newContact: AgentContact = {
      id: contact.id, agencyId: contact.agency_id, name: contact.name,
      email: contact.email, isPrimary: contact.is_primary ?? false,
    };
    setContacts((c) => [...c, newContact]);
    setNewContactName(""); setNewContactEmail("");
    onUpdate({ ...agency, contacts: [...contacts, newContact], assignedJobIds });
  }

  async function removeContact(contactId: string) {
    const res = await fetch(`/api/biz/agents/${agency.id}/contacts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    if (!res.ok) return;
    setContacts((c) => c.filter((x) => x.id !== contactId));
    onUpdate({ ...agency, contacts: contacts.filter((x) => x.id !== contactId), assignedJobIds });
  }

  function toggleJob(jobId: string) {
    setAssignedJobIds((ids) =>
      ids.includes(jobId) ? ids.filter((id) => id !== jobId) : [...ids, jobId]
    );
    setJobsDirty(true);
  }

  async function saveJobs() {
    setJobsSaving(true); setJobsError(null);
    const res = await fetch(`/api/biz/agents/${agency.id}/jobs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobIds: assignedJobIds }),
    });
    setJobsSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setJobsError(d.error ?? "保存失敗"); return; }
    setJobsDirty(false);
    onUpdate({ ...agency, contacts, assignedJobIds });
  }

  async function sendInvite() {
    if (contacts.length === 0) { setInviteError("担当者を先に追加してください"); return; }
    setInviting(true); setInviteError(null); setInviteSuccess(false);
    const res = await fetch(`/api/biz/agents/${agency.id}/invite`, { method: "POST" });
    setInviting(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setInviteError(d.error ?? "送信失敗"); return; }
    setInviteSuccess(true);
    setTimeout(() => setInviteSuccess(false), 4000);
  }

  async function deleteAgency() {
    setDeleting(true);
    const res = await fetch(`/api/biz/agents/${agency.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) return;
    onDelete(agency.id);
  }

  const assignedJobTitles = jobs.filter((j) => assignedJobIds.includes(j.id)).map((j) => j.title);
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0];

  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Agency icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, var(--purple), #9333ea)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ ...inputStyle, fontSize: 15, fontWeight: 700 }}
                autoFocus
              />
              <textarea
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                placeholder="内部メモ..."
                rows={2}
                style={{ ...inputStyle, resize: "vertical", fontSize: 13 }}
              />
              {editError && <p style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>{editError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdit} disabled={saving} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }}>
                  {saving ? "保存中..." : "保存"}
                </button>
                <button onClick={() => { setEditing(false); setEditName(agency.agencyName); setEditMemo(agency.memo ?? ""); }} style={{ ...btnSecondary, padding: "6px 14px", fontSize: 12 }}>キャンセル</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
                  {agency.agencyName}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                  background: agency.isActive ? "var(--success-soft)" : "var(--line-soft)",
                  color: agency.isActive ? "var(--success)" : "var(--ink-mute)",
                }}>
                  {agency.isActive ? "アクティブ" : "停止中"}
                </span>
              </div>
              {agency.memo && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>{agency.memo}</p>
              )}
              {primaryContact && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
                  担当者: {contacts.map((c) => c.name + (c.isPrimary ? "（主）" : "")).join("、")}
                </p>
              )}
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
                担当求人: {assignedJobTitles.length > 0 ? assignedJobTitles.join("、") + `（${assignedJobTitles.length}件）` : "なし"}
                {" "}・ 推薦候補者: {agency.candidateCount}名
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button
              onClick={() => setEditing(true)}
              style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
            >
              編集
            </button>
            <button
              onClick={sendInvite}
              disabled={inviting}
              style={{
                ...btnPrimary, padding: "7px 14px", fontSize: 12,
                background: "linear-gradient(135deg, var(--purple), #9333ea)",
              }}
            >
              {inviting ? "送信中..." : "招待を送る"}
            </button>
          </div>
        )}
      </div>

      {/* Invite feedback */}
      {inviteSuccess && (
        <div style={{ margin: "0 24px", padding: "8px 12px", background: "var(--success-soft)", borderRadius: 8, fontSize: 13, color: "var(--success)", marginBottom: 12 }}>
          ✓ 招待メールを送信しました
        </div>
      )}
      {inviteError && (
        <div style={{ margin: "0 24px", padding: "8px 12px", background: "var(--error-soft)", borderRadius: 8, fontSize: 13, color: "var(--error)", marginBottom: 12 }}>
          {inviteError}
        </div>
      )}

      {/* Expand toggle */}
      <div style={{ padding: "0 24px 16px" }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--accent)", fontWeight: 600, padding: 0,
          }}
        >
          {expanded ? "▲ 折りたたむ" : "▼ 詳細を見る（担当者・求人設定）"}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--line-soft)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Contacts section */}
          <div>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              担当者管理
            </h4>
            {contacts.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 12px" }}>担当者がいません</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {contacts.map((c) => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", border: "1px solid var(--line)",
                  borderRadius: 8, background: "var(--bg-tint)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--royal), var(--accent))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {c.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                      {c.isPrimary && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 100, background: "var(--royal-50)", color: "var(--royal)" }}>
                          主担当
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{c.email}</div>
                  </div>
                  <button
                    onClick={() => removeContact(c.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, padding: "2px 6px" }}
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Add contact inline form */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ ...labelStyle, fontSize: 11 }}>担当者名</label>
                <input
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="田中さん"
                  style={{ ...inputStyle, fontSize: 13 }}
                />
              </div>
              <div style={{ flex: "2 1 200px" }}>
                <label style={{ ...labelStyle, fontSize: 11 }}>メールアドレス</label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="tanaka@agency.co.jp"
                  style={{ ...inputStyle, fontSize: 13 }}
                />
              </div>
              <button
                onClick={addContact}
                disabled={addingContact}
                style={{ ...btnPrimary, padding: "9px 16px", fontSize: 12, flexShrink: 0 }}
              >
                {addingContact ? "追加中..." : "+ 追加"}
              </button>
            </div>
            {contactError && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--error)" }}>{contactError}</p>}
          </div>

          {/* Jobs section */}
          <div>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              担当求人
            </h4>
            {jobs.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>公開中の求人がありません</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {jobs.map((job) => {
                  const checked = assignedJobIds.includes(job.id);
                  return (
                    <label
                      key={job.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", border: `1px solid ${checked ? "var(--accent)" : "var(--line)"}`,
                        borderRadius: 8, cursor: "pointer",
                        background: checked ? "var(--royal-50)" : "#fff",
                        transition: "all 0.15s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleJob(job.id)}
                        style={{ accentColor: "var(--royal)", width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 13, color: checked ? "var(--royal)" : "var(--ink)", fontWeight: checked ? 600 : 400 }}>
                        {job.title}
                      </span>
                    </label>
                  );
                })}
                {jobsError && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--error)" }}>{jobsError}</p>}
                {jobsDirty && (
                  <button onClick={saveJobs} disabled={jobsSaving} style={{ ...btnPrimary, alignSelf: "flex-start", padding: "8px 18px", fontSize: 12 }}>
                    {jobsSaving ? "保存中..." : "求人設定を保存"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 16 }}>
            {!confirmDelete ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <button onClick={toggleActive} style={{ ...btnSecondary, fontSize: 12 }}>
                  {agency.isActive ? "停止する" : "再開する"}
                </button>
                <button onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, fontSize: 12, color: "var(--error)", borderColor: "#FECACA" }}>
                  エージェントを削除
                </button>
              </div>
            ) : (
              <div style={{
                padding: "14px 16px", background: "var(--error-soft)",
                border: "1px solid #FECACA", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 13, color: "var(--error)", flex: 1 }}>
                  本当に削除しますか？この操作は取り消せません。
                </span>
                <button onClick={deleteAgency} disabled={deleting} style={{ ...btnPrimary, background: "var(--error)", fontSize: 12 }}>
                  {deleting ? "削除中..." : "削除する"}
                </button>
                <button onClick={() => setConfirmDelete(false)} style={{ ...btnSecondary, fontSize: 12 }}>キャンセル</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentsClient({ initialAgencies, jobs }: Props) {
  const router = useRouter();
  const [agencies, setAgencies] = useState<AgentAgency[]>(initialAgencies);
  const [showAddModal, setShowAddModal] = useState(false);

  function handleUpdate(updated: AgentAgency) {
    setAgencies((as) => as.map((a) => (a.id === updated.id ? updated : a)));
    router.refresh();
  }

  function handleDelete(id: string) {
    setAgencies((as) => as.filter((a) => a.id !== id));
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0, fontFamily: "'Noto Serif JP', serif" }}>
            エージェント管理
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            Agents
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowAddModal(true)}
          style={btnPrimary}
        >
          + エージェントを追加
        </button>
      </div>

      {/* Empty state */}
      {agencies.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "80px 20px", gap: 16,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#F3E8FF",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            まだエージェントが登録されていません
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-mute)", textAlign: "center", maxWidth: 360 }}>
            連携するエージェント会社を追加すると、専用のポータルURLを発行して候補者の推薦を受け付けられます。
          </div>
          <button onClick={() => setShowAddModal(true)} style={btnPrimary}>
            + エージェントを追加
          </button>
        </div>
      )}

      {/* Agency cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {agencies.map((agency) => (
          <AgencyCard
            key={agency.id}
            agency={agency}
            jobs={jobs}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AddAgencyModal
          onClose={() => setShowAddModal(false)}
          onAdded={(agency) => {
            setAgencies((as) => [...as, agency]);
            setShowAddModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

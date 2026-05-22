"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ─── 型 ──────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  industry: string | null;
  employee_count: string | null;
  is_published: boolean;
};

type Job = {
  id: string;
  title: string | null;
  job_category: string | null;
  employment_type: string | null;
  department: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_note: string | null;
  location: string | null;
  remote_work_status: string | null;
  work_style: string | null;
  description_markdown: string | null;
  description: string | null;
  required_skills: string[] | null;
  requirements: string | null;
  preferred_skills: string[] | null;
  preferred: string | null;
  culture_fit: string | null;
  selection_steps: string[] | null;
  selection_process: unknown;
  message_to_candidates: string | null;
  catch_copy: string | null;
  one_liner: string | null;
  probation_period: string | null;
  selection_duration: string | null;
  start_date_preference: string | null;
  status: string | null;
  submitted_at: string | null;
  published_at: string | null;
  updated_at: string;
  rejection_reason: string | null;
  rejection_date: string | null;
  rejection_reviewer: string | null;
  company_id: string;
  ow_companies: Company | null;
};

// ─── 定数 ────────────────────────────────────────────────────────────────────

const WORK_STYLE_LABELS: Record<string, string> = {
  full_remote: "フルリモート可",
  hybrid: "ハイブリッド",
  on_site: "原則出社",
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_review: { label: "審査待ち",   color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  published:      { label: "公開中",     color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  active:         { label: "公開中(旧)", color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  draft:          { label: "下書き",     color: "#475569", bg: "#F1F5F9", border: "#E2E8F0" },
  rejected:       { label: "差し戻し",   color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  private:        { label: "非公開",     color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
};

function normalizedStatus(s: string | null) {
  return s === "active" ? "published" : (s ?? "draft");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\//g, ".");
}

// ─── Parts ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        color: "#94A3B8", textTransform: "uppercase" as const,
        marginBottom: 12, paddingBottom: 8,
        borderBottom: "1px solid #F1F5F9",
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: "#64748B", paddingTop: 1 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: "#0F172A", lineHeight: 1.7 }}>{value || "—"}</div>
    </div>
  );
}

function TextBlock({ text }: { text: string | null }) {
  if (!text) return <p style={{ fontSize: 13, color: "#94A3B8" }}>（未入力）</p>;
  return (
    <p style={{
      fontSize: 13, color: "#0F172A", lineHeight: 1.9,
      whiteSpace: "pre-wrap", background: "#F8FAFC",
      border: "1px solid #E2E8F0", borderRadius: 8,
      padding: "12px 16px", margin: 0,
    }}>
      {text}
    </p>
  );
}

function TagList({ items }: { items: string[] }) {
  if (!items.length) return <p style={{ fontSize: 13, color: "#94A3B8" }}>（未入力）</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
      {items.map((item, i) => (
        <span key={i} style={{
          fontSize: 12, padding: "3px 10px", borderRadius: 100,
          background: "#EFF3FC", color: "#002366", border: "1px solid #DCE5F7",
        }}>
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JobDetailClient({ job }: { job: Job }) {
  const [status, setStatus] = useState(job.status);
  const [actionLoading, setActionLoading] = useState(false);

  // 差し戻しモーダル
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(job.rejection_reason ?? "");
  const [rejectionReviewer, setRejectionReviewer] = useState("Opinio編集部");

  const ns = normalizedStatus(status);
  const badge = STATUS_BADGE[status ?? "draft"] ?? STATUS_BADGE.draft;
  const company = job.ow_companies;

  // ── actions ────────────────────────────────────────────────────────────────
  async function handleApprove() {
    setActionLoading(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from("ow_jobs").update({
      status: "published", published_at: now, updated_at: now,
      rejection_reason: null, rejection_reviewer: null, rejection_date: null,
    }).eq("id", job.id);
    setStatus("published");
    setActionLoading(false);
  }

  async function handleRejectConfirm() {
    if (!rejectionReason.trim()) return;
    setActionLoading(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    const dateLabel = new Date().toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric",
    });
    await supabase.from("ow_jobs").update({
      status: "rejected",
      rejection_reason: rejectionReason.trim(),
      rejection_reviewer: rejectionReviewer.trim() || "Opinio編集部",
      rejection_date: dateLabel,
      updated_at: now,
    }).eq("id", job.id);
    setStatus("rejected");
    setShowRejectModal(false);
    setActionLoading(false);
  }

  async function handlePrivate() {
    setActionLoading(true);
    const supabase = createClient();
    await supabase.from("ow_jobs").update({
      status: "private", updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    setStatus("private");
    setActionLoading(false);
  }

  async function handleRepublish() {
    setActionLoading(true);
    const supabase = createClient();
    await supabase.from("ow_jobs").update({
      status: "published", updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    setStatus("published");
    setActionLoading(false);
  }

  // ── derived values ─────────────────────────────────────────────────────────
  const description = job.description_markdown || job.description;
  const requiredSkills = job.required_skills?.length
    ? job.required_skills
    : job.requirements
    ? [job.requirements]
    : [];
  const preferredSkills = job.preferred_skills?.length
    ? job.preferred_skills
    : job.preferred
    ? [job.preferred]
    : [];
  const selectionSteps = job.selection_steps?.length ? job.selection_steps : [];
  const salary =
    job.salary_min != null && job.salary_max != null
      ? `¥${job.salary_min}〜${job.salary_max}万円${job.salary_note ? ` (${job.salary_note})` : ""}`
      : job.salary_note || "—";

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/admin/jobs" style={{
          fontSize: 12, color: "#64748B", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16,
        }}>
          ← 求人管理一覧
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                {job.title || "(タイトル未設定)"}
              </h1>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
              }}>
                {badge.label}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748B" }}>
              {company && (
                <Link href={`/admin/companies/${company.id}`} style={{ color: "#002366", textDecoration: "none", fontWeight: 600 }}>
                  {company.name}
                </Link>
              )}
              {job.submitted_at && (
                <span>提出日: {formatDate(job.submitted_at)}</span>
              )}
              {job.published_at && ns === "published" && (
                <span>公開日: {formatDate(job.published_at)}</span>
              )}
              <span>更新: {formatDate(job.updated_at)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {ns === "pending_review" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  style={{
                    padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1px solid #A7F3D0",
                    background: "#ECFDF5", color: "#065F46",
                    opacity: actionLoading ? 0.5 : 1,
                  }}
                >
                  ✓ 承認・公開
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  style={{
                    padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1px solid #FCA5A5",
                    background: "#FEE2E2", color: "#DC2626",
                    opacity: actionLoading ? 0.5 : 1,
                  }}
                >
                  差し戻し
                </button>
              </>
            )}
            {ns === "published" && (
              <button
                onClick={handlePrivate}
                disabled={actionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #FCA5A5",
                  background: "#FEE2E2", color: "#DC2626",
                  opacity: actionLoading ? 0.5 : 1,
                }}
              >
                非公開にする
              </button>
            )}
            {ns === "private" && (
              <button
                onClick={handleRepublish}
                disabled={actionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #B2C4F0",
                  background: "#EFF3FC", color: "#002366",
                  opacity: actionLoading ? 0.5 : 1,
                }}
              >
                再公開する
              </button>
            )}
            {ns === "rejected" && (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #A7F3D0",
                  background: "#ECFDF5", color: "#065F46",
                  opacity: actionLoading ? 0.5 : 1,
                }}
              >
                承認して公開
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

        {/* ── Left: job content ──────────────────────────────────────────── */}
        <div>

          {/* 差し戻し情報 */}
          {ns === "rejected" && job.rejection_reason && (
            <div style={{
              background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10,
              padding: "16px 20px", marginBottom: 28,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
                差し戻し理由（{job.rejection_date}・{job.rejection_reviewer}）
              </div>
              <p style={{ fontSize: 13, color: "#7F1D1D", lineHeight: 1.8, margin: 0 }}>
                {job.rejection_reason}
              </p>
            </div>
          )}

          {/* キャッチコピー */}
          {(job.catch_copy || job.one_liner) && (
            <Section title="キャッチコピー">
              {job.catch_copy && (
                <p style={{
                  fontSize: 16, fontWeight: 600, color: "#0F172A",
                  lineHeight: 1.6, marginBottom: job.one_liner ? 8 : 0,
                }}>
                  {job.catch_copy}
                </p>
              )}
              {job.one_liner && (
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>
                  {job.one_liner}
                </p>
              )}
            </Section>
          )}

          {/* 仕事内容 */}
          <Section title="仕事内容">
            <TextBlock text={description} />
          </Section>

          {/* 必須スキル */}
          <Section title="必須スキル・経験">
            {requiredSkills.length > 0 ? (
              requiredSkills.length === 1 && !job.required_skills?.length
                ? <TextBlock text={requiredSkills[0]} />
                : <TagList items={requiredSkills} />
            ) : (
              <p style={{ fontSize: 13, color: "#94A3B8" }}>（未入力）</p>
            )}
          </Section>

          {/* 歓迎スキル */}
          <Section title="歓迎スキル・経験">
            {preferredSkills.length > 0 ? (
              preferredSkills.length === 1 && !job.preferred_skills?.length
                ? <TextBlock text={preferredSkills[0]} />
                : <TagList items={preferredSkills} />
            ) : (
              <p style={{ fontSize: 13, color: "#94A3B8" }}>（未入力）</p>
            )}
          </Section>

          {/* 求める人物像 */}
          {job.culture_fit && (
            <Section title="求める人物像">
              <TextBlock text={job.culture_fit} />
            </Section>
          )}

          {/* 選考ステップ */}
          {selectionSteps.length > 0 && (
            <Section title="選考フロー">
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {selectionSteps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      background: "#002366", color: "#fff",
                      fontSize: 10, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: "#0F172A", paddingTop: 1 }}>{step}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 候補者へのメッセージ */}
          {job.message_to_candidates && (
            <Section title="候補者へのメッセージ">
              <TextBlock text={job.message_to_candidates} />
            </Section>
          )}
        </div>

        {/* ── Right: metadata sidebar ────────────────────────────────────── */}
        <div>
          <div style={{
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 12, padding: "20px 20px",
          }}>
            <Section title="企業情報">
              <Field label="企業名" value={
                company ? (
                  <Link href={`/admin/companies/${company.id}`} style={{ color: "#002366", textDecoration: "none" }}>
                    {company.name}
                  </Link>
                ) : "—"
              } />
              <Field label="業界" value={company?.industry} />
              <Field label="従業員数" value={company?.employee_count} />
              <Field label="公開状態" value={
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                  background: company?.is_published ? "#ECFDF5" : "#F1F5F9",
                  color: company?.is_published ? "#059669" : "#94A3B8",
                }}>
                  {company?.is_published ? "公開中" : "非公開"}
                </span>
              } />
            </Section>

            <Section title="求人基本情報">
              <Field label="職種カテゴリ" value={job.job_category} />
              <Field label="雇用形態" value={job.employment_type} />
              <Field label="部署" value={job.department} />
              <Field label="勤務地" value={job.location} />
              <Field label="勤務形態" value={
                job.remote_work_status
                  ? WORK_STYLE_LABELS[job.remote_work_status] ?? job.remote_work_status
                  : job.work_style
                  ? WORK_STYLE_LABELS[job.work_style] ?? job.work_style
                  : null
              } />
              <Field label="給与" value={salary} />
              <Field label="試用期間" value={job.probation_period} />
              <Field label="選考期間" value={job.selection_duration} />
              <Field label="入社希望時期" value={job.start_date_preference} />
            </Section>

            <Section title="タイムライン">
              <Field label="提出日時" value={formatDate(job.submitted_at)} />
              <Field label="公開日時" value={formatDate(job.published_at)} />
              <Field label="最終更新" value={formatDate(job.updated_at)} />
            </Section>
          </div>
        </div>
      </div>

      {/* ── 差し戻しモーダル ────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRejectModal(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, padding: 32,
            width: 480, maxWidth: "90vw",
            boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
              差し戻し理由を入力
            </h2>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16, lineHeight: 1.6 }}>
              企業担当者に通知されます。修正してほしい箇所を具体的に記載してください。
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="例: 給与レンジが記入されていません。必須スキルをより具体的に記載してください。"
              rows={5}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                border: "1px solid #E2E8F0", outline: "none", resize: "vertical" as const,
                lineHeight: 1.7, boxSizing: "border-box" as const,
                marginBottom: 12,
              }}
            />

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#64748B", display: "block", marginBottom: 4 }}>
                担当者名（表示用）
              </label>
              <input
                type="text"
                value={rejectionReviewer}
                onChange={(e) => setRejectionReviewer(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  border: "1px solid #E2E8F0", outline: "none",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #E2E8F0",
                  background: "#F8FAFC", color: "#475569",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectionReason.trim() || actionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: !rejectionReason.trim() || actionLoading ? "not-allowed" : "pointer",
                  border: "1px solid #FCA5A5", background: "#FEE2E2", color: "#DC2626",
                  opacity: !rejectionReason.trim() || actionLoading ? 0.5 : 1,
                }}
              >
                差し戻す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

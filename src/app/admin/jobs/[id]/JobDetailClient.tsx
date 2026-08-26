"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import type { RoleItem } from "@/components/business/JobEditForm";
import {
  updateJobRoles,
  updateJobSource,
  approveJob,
  rejectJob,
  privateJob,
  republishJob,
  type ActionResult,
} from "../actions";
import { WORK_STYLE_LABELS } from "@/lib/constants/workStyle";
import { fmtMan } from "@/lib/utils/salary";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";

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
  /** ⚠️ 運営面の職種表示はこちら（標準職種名）。会社呼称は使わない。
   *  ⚠️ ow_roles は多対一なので実行時はオブジェクトだが、生成型では配列になる。両方受ける */
  ow_job_roles?: { is_primary: boolean; ow_roles: { name: string } | { name: string }[] | null }[] | null;
  employment_type: string | null;
  department: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_note: string | null;
  location: string | null;
  remote_work_status: string | null;
  work_style: string | null;
  /** 求人原文のURL。運営の管理用で、公開ページには出さない */
  source_url: string | null;
  /** 最後に原文と突き合わせた日時 */
  source_verified_at: string | null;
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


const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending_review: { label: "審査待ち",   color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  published:      { label: "公開中",     color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  active:         { label: "公開中(旧)", color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  draft:          { label: "下書き",     color: "#475569", bg: "#F1F5F9", border: "#E2E8F0" },
  rejected:       { label: "差し戻し",   color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  private:        { label: "非公開",     color: "#6b7280", bg: "#F8FAFC", border: "#E2E8F0" },
};

function normalizedStatus(s: string | null) {
  return s ?? "draft";
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
      <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: "#6b7280", paddingTop: 1 }}>{label}</div>
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
          background: "#EFF3FC", color: "var(--royal)", border: "1px solid #DCE5F7",
        }}>
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JobDetailClient({
  job, roles = [], roleAliases = {}, initialJobRoles = [],
}: {
  job: Job;
  roles?: RoleItem[];
  roleAliases?: Record<string, string[]>;
  initialJobRoles?: { roleId: string; isPrimary: boolean }[];
}) {
  const [status, setStatus] = useState(job.status);
  // 職種タグの編集
  const [jobRoles, setJobRoles] = useState(initialJobRoles);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const roleDirty =
    jobRoles.length !== initialJobRoles.length ||
    jobRoles.some((r) => {
      const o = initialJobRoles.find((x) => x.roleId === r.roleId);
      return !o || o.isPrimary !== r.isPrimary;
    });

  const addRole = (id: string) => {
    if (!id || jobRoles.some((r) => r.roleId === id)) return;
    setJobRoles((prev) => [...prev, { roleId: id, isPrimary: prev.length === 0 }]);
  };
  const removeRole = (id: string) => {
    setJobRoles((prev) => {
      const next = prev.filter((r) => r.roleId !== id);
      if (next.length > 0 && !next.some((r) => r.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };
  const setPrimary = (id: string) =>
    setJobRoles((prev) => prev.map((r) => ({ ...r, isPrimary: r.roleId === id })));

  const saveRoles = async () => {
    setRoleSaving(true);
    setRoleMsg(null);
    const res = await updateJobRoles(job.id, jobRoles);
    setRoleSaving(false);
    setRoleMsg(res.ok ? "保存しました" : `保存できませんでした: ${res.error}`);
    if (res.ok) setTimeout(() => window.location.reload(), 600);
  };
  const [actionLoading, setActionLoading] = useState(false);

  // 差し戻しモーダル
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState(job.rejection_reason ?? "");
  const [rejectionReviewer, setRejectionReviewer] = useState("OPINIO編集部");

  const ns = normalizedStatus(status);
  const badge = STATUS_BADGE[status ?? "draft"] ?? STATUS_BADGE.draft;
  const company = job.ow_companies;

  // ── actions ────────────────────────────────────────────────────────────────
  /* ⚠️ **ブラウザ側の Supabase クライアントで書き込まないこと（2026-08-11 修正）。**
        ここは 4つとも `createClient()` で直接 ow_jobs を UPDATE していた。
        `ow_jobs` には運営ポリシー（auth_is_admin）が無く、
        `ow_jobs_company_admin_manage` は自社の求人しか許さないため、
        **他社の求人では常に0行更新**だった。しかも戻り値を捨てていたので
        画面は成功したように振る舞い、誰も気づけなかった。
        書き込みは Server Action（admin クライアント＋ ActionResult）に寄せる。 */

  /** 4つのアクションで共通の後処理。**error を必ず画面に出す。** */
  async function run(fn: () => Promise<ActionResult>, nextStatus: string) {
    setActionLoading(true);
    setActionError(null);
    const res = await fn();
    if (!res.ok) {
      setActionError(res.error);
    } else {
      setStatus(nextStatus);
    }
    setActionLoading(false);
    return res.ok;
  }

  async function handleApprove() {
    await run(() => approveJob(job.id), "published");
  }

  async function handleRejectConfirm() {
    if (!rejectionReason.trim()) return;
    const ok = await run(
      () => rejectJob(job.id, rejectionReason.trim(), rejectionReviewer.trim()),
      "rejected",
    );
    if (ok) setShowRejectModal(false);
  }

  async function handlePrivate() {
    await run(() => privateJob(job.id), "private");
  }

  async function handleRepublish() {
    await run(() => republishJob(job.id), "published");
  }

  // ── derived values ─────────────────────────────────────────────────────────
  /* ⚠️ `description_markdown` は 2026-08-26 に description へ統合（廃止）。読まない。 */
  const description = job.description;
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
      ? `¥${fmtMan(job.salary_min)}〜${fmtMan(job.salary_max)}万円${job.salary_note ? ` (${job.salary_note})` : ""}`
      : job.salary_note || "—";

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <Link href="/admin/jobs" style={{
          fontSize: 12, color: "#6b7280", textDecoration: "none",
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
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
              {company && (
                <Link href={`/admin/companies/${company.id}`} style={{ color: "var(--royal)", textDecoration: "none", fontWeight: 600 }}>
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
                  type="button"
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
                  type="button"
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
                type="button"
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
                type="button"
                onClick={handleRepublish}
                disabled={actionLoading}
                style={{
                  padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid #B2C4F0",
                  background: "#EFF3FC", color: "var(--royal)",
                  opacity: actionLoading ? 0.5 : 1,
                }}
              >
                再公開する
              </button>
            )}
            {ns === "rejected" && (
              <button
                type="button"
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

          {/* ⚠️ 操作が失敗したら必ずここに出す。黙って成功に見せない */}
          {actionError && (
            <div role="alert" style={{
              background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 10,
              padding: "12px 16px", marginBottom: 20,
              fontSize: 13, color: "#991B1B", lineHeight: 1.7,
            }}>
              操作に失敗しました: {actionError}
            </div>
          )}

          {/* 出典（運営用・公開ページには出さない） */}
          <SourcePanel job={job} />

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
                      background: "var(--royal)", color: "#fff",
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
                  <Link href={`/admin/companies/${company.id}`} style={{ color: "var(--royal)", textDecoration: "none" }}>
                    {company.name}
                  </Link>
                ) : "—"
              } />
              <Field label="業界" value={company?.industry} />
              <Field label="従業員数" value={formatEmployeeCount(company?.employee_count)} />
              <Field label="公開状態" value={
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                  background: company?.is_published ? "#ECFDF5" : "#F1F5F9",
                  color: company?.is_published ? "var(--success)" : "#94A3B8",
                }}>
                  {company?.is_published ? "公開中" : "非公開"}
                </span>
              } />
            </Section>

            <Section title="求人基本情報">
              {/*
                職種タグの編集。運営が直せる唯一の導線。
                ⚠️ 会社呼称（company_job_role_id）はここでは編集しない。
                   呼称は企業のものなので、運営が代わりに付けると出どころが分からなくなる。
                ⚠️ 大分類も選べる（selectableParent）。企業向けの JobEditForm は false のまま。
                   運営用の画面なので、外した大分類を戻せる必要がある。
                   2026-08-06 に false で運用してみたところ、検証で外した大分類を
                   画面から戻せず DB から復元する羽目になった。
              */}
              <div style={{ padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                  職種（求職者に出る職種名の元）
                </div>
                {roles.length > 0 ? (
                  <>
                    <div style={{ maxWidth: 440, marginBottom: 8 }}>
                      <RoleSearchSelect
                        roles={roles}
                        aliases={roleAliases}
                        value=""
                        clearOnSelect
                        selectableParent
                        onSelect={addRole}
                        ariaLabel="職種を検索して追加"
                        placeholder="職種名で検索して追加（例: 法人営業、AE）"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 440 }}>
                      {jobRoles.map((r) => {
                        const role = roles.find((x) => x.id === r.roleId);
                        return (
                          <div key={r.roleId} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8,
                            background: r.isPrimary ? "#eff3fc" : "#f8fafc",
                            border: `1px solid ${r.isPrimary ? "#dce5f7" : "#e2e8f0"}`,
                          }}>
                            <input type="radio" name="admin-primary-role" checked={r.isPrimary}
                              onChange={() => setPrimary(r.roleId)} style={{ accentColor: "#002366", cursor: "pointer" }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: r.isPrimary ? 700 : 400, color: r.isPrimary ? "#002366" : "#0f172a" }}>
                              {role?.name ?? r.roleId}
                              {r.isPrimary && <span style={{ marginLeft: 6, fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>（代表）</span>}
                            </span>
                            <button type="button" onClick={() => removeRole(r.roleId)}
                              style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>解除</button>
                          </div>
                        );
                      })}
                      {jobRoles.length === 0 && (
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>職種が設定されていません</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                      <button type="button" onClick={saveRoles} disabled={!roleDirty || roleSaving || jobRoles.length === 0}
                        style={{
                          fontSize: 13, fontWeight: 700, padding: "7px 18px", borderRadius: 8, border: "none",
                          cursor: !roleDirty || roleSaving || jobRoles.length === 0 ? "default" : "pointer",
                          background: !roleDirty || roleSaving || jobRoles.length === 0 ? "#e2e8f0" : "#002366",
                          color: !roleDirty || roleSaving || jobRoles.length === 0 ? "#94a3b8" : "#fff",
                        }}>
                        {roleSaving ? "保存中..." : "職種を保存"}
                      </button>
                      {roleMsg && <span style={{ fontSize: 12, color: roleMsg.startsWith("保存しました") ? "#059669" : "#dc2626" }}>{roleMsg}</span>}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>職種マスタを読み込めませんでした</div>
                )}
              </div>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            style={{
              background: "#fff", borderRadius: 16, padding: 32,
              width: 480, maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(15,23,42,0.18)",
            }}>
            <h2 id="reject-modal-title" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
              差し戻し理由を入力
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
              企業担当者に通知されます。修正してほしい箇所を具体的に記載してください。
            </p>

            <label htmlFor="jd-rejection-reason" style={{ display: "none" }}>差し戻し理由</label>
            <textarea
              id="jd-rejection-reason"
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
              <label htmlFor="jd-reviewer" style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                担当者名（表示用）
              </label>
              <input
                id="jd-reviewer"
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
                type="button"
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
                type="button"
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

/**
 * 求人の出典（原文URL）を記録するパネル。**運営用で、公開ページには出さない。**
 *
 * ⚠️ ここが空のまま公開している求人は `/admin/jobs` の「出典なし（公開中）」タブに出る。
 *    埋められない求人は公開しないこと（CLAUDE.md）。
 */
function SourcePanel({ job }: { job: Job }) {
  const [url, setUrl] = useState(job.source_url ?? "");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(job.source_verified_at);
  const [markVerified, setMarkVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = url.trim() !== (job.source_url ?? "").trim() || markVerified;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await updateJobSource(job.id, url, markVerified);
    if (!res.ok) {
      setError(res.error ?? "保存に失敗しました");
    } else {
      setVerifiedAt(res.verifiedAt ?? null);
      setMarkVerified(false);
      setSaved(true);
    }
    setSaving(false);
  }

  const missing = !url.trim();

  return (
    <div style={{
      background: missing ? "#FFFBEB" : "#F8FAFC",
      border: `1px solid ${missing ? "#FCD34D" : "#E2E8F0"}`,
      borderRadius: 10, padding: "16px 20px", marginBottom: 28,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: missing ? "#92400E" : "#334155" }}>
          出典（運営用）
        </span>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>公開ページには出ません</span>
      </div>
      <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 10px", lineHeight: 1.7 }}>
        求人原文の URL を入れてください。埋められない求人は公開しないこと。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          placeholder="https://..."
          aria-label="求人原文のURL"
          style={{
            flex: "1 1 320px", minWidth: 0,
            padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 6,
            fontSize: 13, color: "#0F172A", background: "#fff",
            outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={markVerified}
            onChange={(e) => { setMarkVerified(e.target.checked); setSaved(false); }}
            disabled={!url.trim()}
          />
          今日、原文と突き合わせた
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--royal)", background: "var(--royal)", color: "#fff",
            cursor: saving || !dirty ? "not-allowed" : "pointer",
            opacity: saving || !dirty ? 0.5 : 1, flexShrink: 0,
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, minHeight: 18 }}>
        {error && <span style={{ color: "#DC2626" }}>{error}</span>}
        {!error && saved && <span style={{ color: "#059669" }}>✓ 保存しました</span>}
        {!error && !saved && (
          verifiedAt
            ? <span style={{ color: "#64748B" }}>最終突合: {formatDate(verifiedAt)}</span>
            : <span style={{ color: missing ? "#92400E" : "#64748B" }}>
                {missing ? "出典が未記録です" : "原文との突合はまだ記録されていません"}
              </span>
        )}
      </div>
    </div>
  );
}

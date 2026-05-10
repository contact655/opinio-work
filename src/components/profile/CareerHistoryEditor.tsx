"use client";

import { useState, useEffect, useCallback } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import StoryAccordion from "./StoryAccordion";

// ── Role options (seeded in ow_roles) ──────────────────────────────────────────

const ROLE_OPTIONS: { slug: string; label: string }[] = [
  { slug: "product_manager", label: "プロダクトマネージャー" },
  { slug: "product_owner", label: "プロダクトオーナー" },
  { slug: "pmm", label: "PMM" },
  { slug: "pm", label: "PdM / PM" },
  { slug: "sales", label: "営業" },
  { slug: "field_sales", label: "フィールドセールス" },
  { slug: "enterprise_sales", label: "エンタープライズ営業" },
  { slug: "inside_sales", label: "インサイドセールス" },
  { slug: "sdr_bdr", label: "SDR / BDR" },
  { slug: "cs", label: "カスタマーサクセス" },
  { slug: "marketing", label: "マーケティング" },
  { slug: "engineer", label: "エンジニア" },
  { slug: "backend", label: "バックエンド" },
  { slug: "frontend", label: "フロントエンド" },
  { slug: "fullstack", label: "フルスタック" },
  { slug: "sre", label: "SRE / インフラ" },
  { slug: "ios_android", label: "iOS / Android" },
  { slug: "data_scientist", label: "データサイエンティスト" },
  { slug: "designer", label: "デザイナー" },
  { slug: "biz_dev", label: "事業開発" },
  { slug: "hrbp", label: "HRBP" },
  { slug: "corporate", label: "コーポレート" },
  { slug: "exec", label: "経営・CxO" },
  { slug: "ceo", label: "CEO" },
  { slug: "coo", label: "COO" },
  { slug: "cpo", label: "CPO" },
  { slug: "cto", label: "CTO" },
  { slug: "cfo", label: "CFO" },
  { slug: "other", label: "その他" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.slug, r.label])
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Stint = {
  id: string;
  displayCompanyName: string;
  companyType: "master" | "custom" | "anon";
  companyId?: string;
  companyText?: string;
  companyAnonymized?: string;
  roleCategoryId: string;
  roleLabel: string;
  roleTitle?: string;
  startedAt: string;   // YYYY-MM
  endedAt?: string;    // YYYY-MM
  isCurrent: boolean;
  description?: string;
  why?: string;
};

type StintDraft = {
  companyName: string;
  isAnon: boolean;
  roleCategoryId: string;
  roleTitle: string;
  startedAt: string;
  endedAt: string;
  isCurrent: boolean;
  why: string;
  description: string;
};

const EMPTY_DRAFT: StintDraft = {
  companyName: "",
  isAnon: false,
  roleCategoryId: "",
  roleTitle: "",
  startedAt: "",
  endedAt: "",
  isCurrent: false,
  why: "",
  description: "",
};

// ── Sort helper: isCurrent first, then startedAt DESC ────────────────────────

function sortStints(arr: Stint[]): Stint[] {
  return [...arr].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return b.startedAt.localeCompare(a.startedAt);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeriod(startedAt: string, endedAt?: string, isCurrent?: boolean): string {
  const fmt = (ym: string) => ym.replace("-", ".");
  if (isCurrent) return `${fmt(startedAt)} 〜 現在`;
  if (endedAt) return `${fmt(startedAt)} 〜 ${fmt(endedAt)}`;
  return `${fmt(startedAt)} 〜`;
}

function fieldStyle(): React.CSSProperties {
  return {
    width: "100%",
    border: "1.5px solid var(--line)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    color: "var(--ink)",
    background: "#fff",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--ink-mute)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  };
}

// ── IconButton ────────────────────────────────────────────────────────────────

function IconButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: hovered
          ? danger ? "var(--error-soft)" : "var(--line-soft)"
          : "transparent",
        borderRadius: 5,
        fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer",
        transition: "background 0.12s",
        padding: 0,
        fontFamily: "inherit",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── StintForm ─────────────────────────────────────────────────────────────────

function StintForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
}: {
  draft: StintDraft;
  onDraftChange: (d: StintDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = useCallback(
    (key: keyof StintDraft, val: string | boolean) =>
      onDraftChange({ ...draft, [key]: val }),
    [draft, onDraftChange]
  );

  const descLen = draft.description.length;
  const descOver = descLen > 500;
  const whyLen = draft.why.length;
  const whyOver = whyLen > 500;
  // 期間バリデーション: ended_at が入力済みかつ現職フラグなし の場合のみ started_at <= ended_at を検証
  // YYYY-MM 文字列の辞書順比較で正しく動作（例: "2024-04" > "2023-04"）
  const periodInvalid = !draft.isCurrent && !!draft.endedAt && draft.startedAt > draft.endedAt;
  const isValid = !!draft.companyName.trim() && !!draft.roleCategoryId && !!draft.startedAt;
  const canSave = isValid && !descOver && !whyOver && !periodInvalid && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  return (
    <div
      style={{
        background: "var(--bg-tint)",
        border: "1.5px solid var(--royal)",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
      }}
    >
      {/* Company name + anon toggle */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={labelStyle()}>会社名 *</label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--ink-soft)", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={draft.isAnon}
              onChange={(e) => set("isAnon", e.target.checked)}
              style={{ accentColor: "var(--royal)" }}
            />
            非公開にする
          </label>
        </div>
        <input
          type="text"
          value={draft.companyName}
          onChange={(e) => set("companyName", e.target.value)}
          placeholder={draft.isAnon ? "非公開企業（任意）" : "株式会社〇〇"}
          disabled={isSaving}
          style={fieldStyle()}
        />
      </div>

      {/* Role category */}
      <div>
        <label style={labelStyle()}>役職カテゴリ *</label>
        <select
          value={draft.roleCategoryId}
          onChange={(e) => set("roleCategoryId", e.target.value)}
          disabled={isSaving}
          style={fieldStyle()}
        >
          <option value="">選択してください</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.slug} value={r.slug}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Role title (optional) */}
      <div>
        <label style={labelStyle()}>役職タイトル（任意）</label>
        <input
          type="text"
          value={draft.roleTitle}
          onChange={(e) => set("roleTitle", e.target.value)}
          placeholder="例: プロダクトマネージャー（Bakuraku事業）"
          disabled={isSaving}
          style={fieldStyle()}
        />
      </div>

      {/* Period */}
      <div>
        <label style={labelStyle()}>期間 *</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            type="month"
            value={draft.startedAt}
            onChange={(e) => set("startedAt", e.target.value)}
            disabled={isSaving}
            style={{ ...fieldStyle(), width: "auto", flex: "1 1 130px" }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-mute)", flexShrink: 0 }}>〜</span>
          <input
            type="month"
            value={draft.isCurrent ? "" : draft.endedAt}
            onChange={(e) => set("endedAt", e.target.value)}
            disabled={isSaving || draft.isCurrent}
            style={{ ...fieldStyle(), width: "auto", flex: "1 1 130px", opacity: draft.isCurrent ? 0.4 : 1 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-soft)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={draft.isCurrent}
              onChange={(e) => set("isCurrent", e.target.checked)}
              style={{ accentColor: "var(--royal)" }}
            />
            現在も在籍中
          </label>
        </div>
        {periodInvalid && (
          <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4, fontFamily: "Inter, sans-serif" }}>
            終了年月は開始年月以降に設定してください
          </div>
        )}
      </div>

      {/* Description (業務内容) */}
      <div>
        <label style={labelStyle()}>業務内容（任意）</label>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="業務内容や成果、チームの規模など"
          disabled={isSaving}
          rows={3}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ fontSize: 11, color: descOver ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {descOver ? `${descLen - 500} 文字超過` : `残り ${500 - descLen} 文字`}
        </div>
      </div>

      {/* Why (narrative field) */}
      <div>
        <label style={labelStyle()}>この時期に目指していたこと（任意）</label>
        <textarea
          value={draft.why}
          onChange={(e) => set("why", e.target.value)}
          placeholder="どんな気持ちでその仕事をしていたか、何を目指していたか…"
          disabled={isSaving}
          rows={3}
          style={{ ...fieldStyle(), resize: "vertical", lineHeight: 1.7 }}
        />
        <div style={{ fontSize: 11, color: whyOver ? "var(--error)" : "var(--ink-mute)", textAlign: "right", marginTop: 2, fontFamily: "Inter, sans-serif" }}>
          {whyOver ? `${whyLen - 500} 文字超過` : `残り ${500 - whyLen} 文字`}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{ padding: "7px 16px", background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: isSaving ? "default" : "pointer", fontFamily: "inherit", opacity: isSaving ? 0.5 : 1 }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px", minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ── StintCard ─────────────────────────────────────────────────────────────────

function StintCard({
  stint,
  onEdit,
  onDelete,
}: {
  stint: Stint;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 0", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Company name + "現在" badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              {stint.displayCompanyName}
            </span>
            {stint.isCurrent && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", flexShrink: 0 }}>
                現在
              </span>
            )}
          </div>

          {/* Role */}
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 1 }}>
            {stint.roleTitle || stint.roleLabel}
          </div>

          {/* Period */}
          <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
            {formatPeriod(stint.startedAt, stint.endedAt, stint.isCurrent)}
          </div>

          {/* Description snippet (業務内容) */}
          {stint.description && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                marginTop: 6,
                paddingLeft: 8,
                borderLeft: "2px solid var(--line)",
                lineHeight: 1.65,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {stint.description}
            </div>
          )}

          {/* Why snippet (narrative) */}
          {stint.why && (
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                marginTop: 4,
                paddingLeft: 8,
                borderLeft: "2px solid var(--line)",
                lineHeight: 1.65,
                fontStyle: "italic",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {stint.why}
            </div>
          )}
        </div>

        {/* Controls: ✎ and × only (hover reveal) */}
        <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
          <IconButton onClick={onEdit} title="編集">✎</IconButton>
          <IconButton onClick={onDelete} title="削除" danger>×</IconButton>
        </div>
      </div>

      {/* ストーリーアコーディオン */}
      <StoryAccordion experienceId={stint.id} />
    </div>
  );
}

// ── Main: CareerHistoryEditor ─────────────────────────────────────────────────

export default function CareerHistoryEditor() {
  const [stints, setStints] = useState<Stint[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<StintDraft>(EMPTY_DRAFT);
  const [editSaving,   setEditSaving]   = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);

  // Add state
  const [adding,       setAdding]       = useState(false);
  const [addDraft,     setAddDraft]     = useState<StintDraft>(EMPTY_DRAFT);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addJustSaved, setAddJustSaved] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Stint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/jobseeker/experiences")
      .then((r) => r.json())
      .then((data: { experiences?: Record<string, unknown>[] }) => {
        const rows = data.experiences ?? [];
        const mapped: Stint[] = rows.map((e) => ({
          id: e.id as string,
          displayCompanyName: e.displayCompanyName as string,
          companyType: (e.companyType ?? "custom") as Stint["companyType"],
          companyId: e.companyId as string | undefined,
          companyText: e.companyText as string | undefined,
          companyAnonymized: e.companyAnonymized as string | undefined,
          roleCategoryId: e.roleCategoryId as string,
          roleLabel: ROLE_LABEL[e.roleCategoryId as string] ?? (e.roleCategoryId as string),
          roleTitle: e.roleTitle as string | undefined,
          startedAt: e.startedAt as string,
          endedAt: e.endedAt as string | undefined,
          isCurrent: e.isCurrent as boolean,
          description: e.description as string | undefined,
          why: e.why as string | undefined,
        }));
        setStints(sortStints(mapped));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback(
    (msg: string, variant: "default" | "error" = "default") => {
      setToastVariant(variant);
      setToastMsg(msg);
    },
    []
  );

  // ── Draft from stint ─────────────────────────────────────────────────────────
  const draftFromStint = useCallback((s: Stint): StintDraft => ({
    companyName: s.companyType === "anon" ? (s.companyAnonymized ?? "非公開企業") : s.displayCompanyName,
    isAnon: s.companyType === "anon",
    roleCategoryId: s.roleCategoryId,
    roleTitle: s.roleTitle ?? "",
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? "",
    isCurrent: s.isCurrent,
    why: s.why ?? "",
    description: s.description ?? "",
  }), []);

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const startEdit = useCallback((s: Stint) => {
    setEditingId(s.id);
    setEditDraft(draftFromStint(s));
  }, [draftFromStint]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: editDraft.roleCategoryId,
        role_title: editDraft.roleTitle || undefined,
        started_at: editDraft.startedAt,
        ended_at: editDraft.isCurrent ? undefined : editDraft.endedAt || undefined,
        is_current: editDraft.isCurrent,
        why: editDraft.why || undefined,
        description: editDraft.description || undefined,
      };
      if (editDraft.isAnon) {
        body.company_anonymized = editDraft.companyName || "非公開企業";
      } else {
        body.company_text = editDraft.companyName;
      }

      const res = await fetch(`/api/jobseeker/experiences/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      // Optimistic update + re-sort
      setStints((prev) =>
        sortStints(prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                displayCompanyName: editDraft.isAnon
                  ? editDraft.companyName || "非公開企業"
                  : editDraft.companyName,
                companyType: editDraft.isAnon ? "anon" : "custom",
                companyText: editDraft.isAnon ? undefined : editDraft.companyName,
                companyAnonymized: editDraft.isAnon
                  ? editDraft.companyName || "非公開企業"
                  : undefined,
                roleCategoryId: editDraft.roleCategoryId,
                roleLabel: ROLE_LABEL[editDraft.roleCategoryId] ?? editDraft.roleCategoryId,
                roleTitle: editDraft.roleTitle || undefined,
                startedAt: editDraft.startedAt,
                endedAt: editDraft.isCurrent ? undefined : editDraft.endedAt || undefined,
                isCurrent: editDraft.isCurrent,
                why: editDraft.why || undefined,
                description: editDraft.description || undefined,
              }
            : s
        ))
      );
      showToast("職歴を更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelEdit();
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, cancelEdit, showToast]);

  // ── Add handlers ─────────────────────────────────────────────────────────────
  const cancelAdd = useCallback(() => {
    setAdding(false);
    setAddDraft(EMPTY_DRAFT);
  }, []);

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const body: Record<string, unknown> = {
        role_category_id: addDraft.roleCategoryId,
        role_title: addDraft.roleTitle || undefined,
        started_at: addDraft.startedAt,
        ended_at: addDraft.isCurrent ? undefined : addDraft.endedAt || undefined,
        is_current: addDraft.isCurrent,
        why: addDraft.why || undefined,
        description: addDraft.description || undefined,
        display_order: stints.length,
      };
      if (addDraft.isAnon) {
        body.company_anonymized = addDraft.companyName || "非公開企業";
      } else {
        body.company_text = addDraft.companyName;
      }

      const res = await fetch("/api/jobseeker/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { id } = (await res.json()) as { id: string };

      const newStint: Stint = {
        id,
        displayCompanyName: addDraft.isAnon
          ? addDraft.companyName || "非公開企業"
          : addDraft.companyName,
        companyType: addDraft.isAnon ? "anon" : "custom",
        companyText: addDraft.isAnon ? undefined : addDraft.companyName,
        companyAnonymized: addDraft.isAnon
          ? addDraft.companyName || "非公開企業"
          : undefined,
        roleCategoryId: addDraft.roleCategoryId,
        roleLabel: ROLE_LABEL[addDraft.roleCategoryId] ?? addDraft.roleCategoryId,
        roleTitle: addDraft.roleTitle || undefined,
        startedAt: addDraft.startedAt,
        endedAt: addDraft.isCurrent ? undefined : addDraft.endedAt || undefined,
        isCurrent: addDraft.isCurrent,
        why: addDraft.why || undefined,
        description: addDraft.description || undefined,
      };

      setStints((prev) => sortStints([...prev, newStint]));
      showToast("職歴を追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      cancelAdd();
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, stints.length, cancelAdd, showToast]);

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/experiences/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStints((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("職歴を削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: "6px 0" }}>
        読み込み中…
      </div>
    );
  }

  return (
    <div>
      {/* Stint list */}
      {stints.map((s, idx) => (
        <div key={s.id}>
          {editingId === s.id ? (
            <StintForm
              draft={editDraft}
              onDraftChange={setEditDraft}
              isSaving={editSaving}
              justSaved={editJustSaved}
              onSave={() => { void saveEdit(); }}
              onCancel={cancelEdit}
            />
          ) : (
            <StintCard
              stint={s}
              onEdit={() => startEdit(s)}
              onDelete={() => setDeleteTarget(s)}
            />
          )}
          {/* Divider */}
          {idx < stints.length - 1 && editingId !== s.id && (
            <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
          )}
        </div>
      ))}

      {/* Empty state */}
      {stints.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", fontStyle: "italic", padding: "2px 0 6px" }}>
          職歴はまだ登録されていません
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ marginTop: stints.length > 0 ? 12 : 0 }}>
          <StintForm
            draft={addDraft}
            onDraftChange={setAddDraft}
            isSaving={addSaving}
            justSaved={addJustSaved}
            onSave={() => { void saveAdd(); }}
            onCancel={cancelAdd}
          />
        </div>
      )}

      {/* "+ 経歴を追加" button */}
      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            marginTop: stints.length > 0 ? 10 : 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            padding: "8px 14px",
            width: "100%",
            background: "transparent",
            border: "1px dashed var(--line)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "border-color 0.15s, color 0.15s",
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
          経歴を追加
        </button>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="職歴を削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.displayCompanyName}」での職歴を削除します。この操作は取り消せません。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

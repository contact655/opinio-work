"use client";

import { useState, useEffect, useCallback } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type StoryType = "image" | "video" | "card" | "link";

type Story = {
  id: string;
  experience_id: string;
  type: StoryType;
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  sort_order: number;
};

type StoryDraft = {
  type: StoryType;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  link_url: string;
};

const EMPTY_DRAFT: StoryDraft = {
  type: "card",
  title: "",
  description: "",
  image_url: "",
  video_url: "",
  link_url: "",
};

function draftFromStory(s: Story): StoryDraft {
  return {
    type: s.type,
    title: s.title ?? "",
    description: s.description ?? "",
    image_url: s.image_url ?? "",
    video_url: s.video_url ?? "",
    link_url: s.link_url ?? "",
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

// API と同じ簡易マッチ(文字列含有チェック、完全な URL 構造バリデーションではない)。
// 今後厳密化する場合は API 側(/api/jobseeker/experience-stories/route.ts)と同期して変更すること。
const looksLikeYouTubeUrl = (url: string): boolean => /youtube\.com|youtu\.be/.test(url);

function canSaveDraft(draft: StoryDraft): boolean {
  if (draft.type === "image") return !!draft.image_url.trim();
  if (draft.type === "video") {
    const url = draft.video_url.trim();
    return !!url && looksLikeYouTubeUrl(url);
  }
  if (draft.type === "link") return !!draft.link_url.trim();
  // card: title か description どちらか必須
  return !!(draft.title.trim() || draft.description.trim());
}

function makeBody(draft: StoryDraft, experienceId?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: draft.type,
    title: draft.title.trim() || null,
    description: draft.description.trim() || null,
    image_url: draft.image_url.trim() || null,
    video_url: draft.video_url.trim() || null,
    link_url: draft.link_url.trim() || null,
  };
  if (experienceId) body.experience_id = experienceId;
  return body;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const formBoxStyle: React.CSSProperties = {
  background: "var(--bg-tint)",
  border: "1.5px solid var(--royal)",
  borderRadius: 10,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
};

function inputStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: "1.5px solid var(--line)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    color: "var(--ink)",
    background: disabled ? "var(--bg-tint)" : "#fff",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    opacity: disabled ? 0.6 : 1,
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

// ─── Type badge config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<StoryType, { label: string; bg: string; color: string }> = {
  image: { label: "image", bg: "var(--warm-soft)",   color: "var(--warm)"     },
  video: { label: "video", bg: "var(--purple-soft)", color: "var(--purple)"   },
  card:  { label: "card",  bg: "var(--royal-50)",    color: "var(--royal)"    },
  link:  { label: "link",  bg: "var(--line-soft)",   color: "var(--ink-mute)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: StoryType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "Inter, sans-serif",
        letterSpacing: "0.06em",
        padding: "2px 6px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        flexShrink: 0,
        lineHeight: 1.6,
      }}
    >
      {cfg.label}
    </span>
  );
}

function IconBtn({
  onClick, title, danger, children,
}: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: 26,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none",
        background: hovered ? (danger ? "var(--error-soft)" : "var(--line-soft)") : "transparent",
        borderRadius: 5, fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer", transition: "background 0.12s",
        padding: 0, fontFamily: "inherit", flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** URL を最大 N 文字で省略表示 */
function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

function StoryCard({
  story, onEdit, onDelete,
}: { story: Story; onEdit: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);

  const primaryUrl = story.image_url ?? story.video_url ?? story.link_url ?? null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "8px 0", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {/* Left: badge + content */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
          <TypeBadge type={story.type} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title */}
            {story.title && (
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                {story.title}
              </div>
            )}

            {/* Type-specific secondary line */}
            {story.type === "card" && story.description && (
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                {story.description.length > 80 ? story.description.slice(0, 80) + "…" : story.description}
              </div>
            )}

            {story.type === "link" && story.link_url && (
              <a
                href={story.link_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline", wordBreak: "break-all" }}
              >
                {truncateUrl(story.link_url)}
              </a>
            )}

            {(story.type === "image" || story.type === "video") && primaryUrl && (
              <div style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", wordBreak: "break-all" }}>
                {truncateUrl(primaryUrl)}
              </div>
            )}
          </div>
        </div>

        {/* Controls (hover reveal) */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 1,
            opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0,
          }}
        >
          <IconBtn onClick={onEdit} title="編集">✎</IconBtn>
          <IconBtn onClick={onDelete} title="削除" danger>×</IconBtn>
        </div>
      </div>
    </div>
  );
}

// ─── TypeSelector ─────────────────────────────────────────────────────────────

function TypeSelector({
  value, onChange, disabled,
}: { value: StoryType; onChange: (t: StoryType) => void; disabled?: boolean }) {
  const types: StoryType[] = ["image", "video", "card", "link"];
  return (
    <div>
      <label style={labelStyle()}>タイプ *</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {types.map((t) => {
          const cfg = TYPE_CONFIG[t];
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t)}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "0.05em",
                borderRadius: 6,
                border: selected ? `1.5px solid ${cfg.color}` : "1.5px solid var(--line)",
                background: selected ? cfg.bg : "#fff",
                color: selected ? cfg.color : "var(--ink-mute)",
                cursor: disabled ? "default" : "pointer",
                transition: "background 0.12s, border-color 0.12s, color 0.12s",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── StoryForm ────────────────────────────────────────────────────────────────

function StoryForm({
  draft,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
}: {
  draft: StoryDraft;
  onDraftChange: (d: StoryDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = useCallback(
    (k: keyof StoryDraft, v: string) => onDraftChange({ ...draft, [k]: v }),
    [draft, onDraftChange]
  );

  const canSave = canSaveDraft(draft) && !isSaving;
  const effectivelyDisabled = !canSave || !!justSaved;

  return (
    <div style={formBoxStyle}>
      {/* Type selector */}
      <TypeSelector
        value={draft.type}
        onChange={(t) => onDraftChange({ ...draft, type: t })}
        disabled={isSaving}
      />

      {/* Title — all types */}
      <div>
        <label style={labelStyle()}>
          タイトル {draft.type === "card" ? "（任意）" : "（任意）"}
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例：四半期最優秀賞を受賞した取り組み"
          maxLength={100}
          disabled={isSaving}
          style={inputStyle(isSaving)}
        />
      </div>

      {/* Type-specific URL field */}
      {draft.type === "image" && (
        <div>
          <label style={labelStyle()}>画像 URL *</label>
          <input
            type="url"
            value={draft.image_url}
            onChange={(e) => set("image_url", e.target.value)}
            placeholder="https://example.com/image.png"
            maxLength={1000}
            disabled={isSaving}
            style={inputStyle(isSaving)}
          />
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
            ※ 画像アップロードは次フェーズで対応。現在は URL 直貼りで保存できます。
          </div>
        </div>
      )}

      {draft.type === "video" && (() => {
        const url = draft.video_url.trim();
        const hasInput = url.length > 0;
        const isValidYouTube = looksLikeYouTubeUrl(url);
        const showError = hasInput && !isValidYouTube;
        return (
          <div>
            <label style={labelStyle()}>YouTube URL *</label>
            <input
              type="url"
              value={draft.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              maxLength={1000}
              disabled={isSaving}
              style={{
                ...inputStyle(isSaving),
                borderColor: showError ? "var(--error)" : undefined,
              }}
            />
            {showError ? (
              <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4 }}>
                YouTube の URL を入力してください（youtube.com または youtu.be）
              </div>
            ) : !hasInput ? (
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                youtube.com または youtu.be の URL を入力してください。
              </div>
            ) : null}
          </div>
        );
      })()}

      {draft.type === "link" && (
        <div>
          <label style={labelStyle()}>リンク URL *</label>
          <input
            type="url"
            value={draft.link_url}
            onChange={(e) => set("link_url", e.target.value)}
            placeholder="https://example.com/article"
            maxLength={1000}
            disabled={isSaving}
            style={inputStyle(isSaving)}
          />
        </div>
      )}

      {/* Description — all types */}
      <div>
        <label style={labelStyle()}>
          説明 {draft.type === "card" ? "（title か description どちらか必須）" : "（任意）"}
        </label>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={
            draft.type === "card"
              ? "例：チームで取り組んだ課題と、その成果を書いてください。"
              : "補足説明や文脈など"
          }
          maxLength={500}
          rows={3}
          disabled={isSaving}
          style={{ ...inputStyle(isSaving), resize: "vertical", minHeight: 72 }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{
            padding: "7px 16px",
            background: "#fff",
            color: "var(--ink-soft)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: isSaving ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px",
            minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── Main: StoryAccordion ─────────────────────────────────────────────────────

interface StoryAccordionProps {
  /** ow_experiences.id */
  experienceId: string;
}

export default function StoryAccordion({ experienceId }: StoryAccordionProps) {
  const [isOpen,   setIsOpen]   = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [stories,  setStories]  = useState<Story[]>([]);

  // Edit state
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editDraft,     setEditDraft]     = useState<StoryDraft>(EMPTY_DRAFT);
  const [editSaving,    setEditSaving]    = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);

  // Add state
  const [adding,        setAdding]        = useState(false);
  const [addDraft,      setAddDraft]      = useState<StoryDraft>(EMPTY_DRAFT);
  const [addSaving,     setAddSaving]     = useState(false);
  const [addJustSaved,  setAddJustSaved]  = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Toast
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant);
    setToastMsg(msg);
  }, []);

  // ── Lazy load on first expand ────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen || loaded) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/jobseeker/experience-stories?experience_id=${experienceId}`)
      .then((res) => res.json())
      .then((json: { stories?: Story[] }) => {
        if (!cancelled) {
          setStories(json.stories ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) showToast("ストーリーの取得に失敗しました。", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, loaded, experienceId, showToast]);

  // ── Save edit ────────────────────────────────────────────────────────────────

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/jobseeker/experience-stories/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(editDraft)),
      });
      if (!res.ok) throw new Error();
      const updated: Story = await res.json();
      setStories((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)));
      showToast("ストーリーを更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null);
      setEditDraft(EMPTY_DRAFT);
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save add ─────────────────────────────────────────────────────────────────

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      const res = await fetch("/api/jobseeker/experience-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeBody(addDraft, experienceId)),
      });
      if (!res.ok) throw new Error();
      const inserted: Story = await res.json();
      setStories((prev) => [...prev, inserted]);
      showToast("ストーリーを追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false);
      setAddDraft(EMPTY_DRAFT);
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, experienceId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Confirm delete ───────────────────────────────────────────────────────────

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/experience-stories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStories((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("ストーリーを削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast]);

  // ── Cancel helpers ───────────────────────────────────────────────────────────

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const cancelAdd = useCallback(() => {
    setAdding(false);
    setAddDraft(EMPTY_DRAFT);
  }, []);

  // ── Accordion count label ────────────────────────────────────────────────────

  const countLabel = loaded
    ? stories.length > 0
      ? `ストーリー（${stories.length}件）`
      : "ストーリー"
    : "ストーリー";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        marginTop: 8,
        borderTop: "1px solid var(--line-soft)",
      }}
    >
      {/* Accordion header toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-mute)",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-mute)",
            letterSpacing: "0.04em",
          }}
        >
          {countLabel}
        </span>
        {loading && (
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontStyle: "italic" }}>
            読み込み中…
          </span>
        )}
      </button>

      {/* Accordion body */}
      {isOpen && loaded && (
        <div style={{ paddingBottom: 8 }}>
          {/* Story list */}
          {stories.map((s, idx) => (
            <div key={s.id}>
              {editingId === s.id ? (
                <StoryForm
                  draft={editDraft}
                  onDraftChange={setEditDraft}
                  isSaving={editSaving}
                  justSaved={editJustSaved}
                  onSave={() => { void saveEdit(); }}
                  onCancel={cancelEdit}
                />
              ) : (
                <StoryCard
                  story={s}
                  onEdit={() => {
                    setEditingId(s.id);
                    setEditDraft(draftFromStory(s));
                  }}
                  onDelete={() => setDeleteTarget(s)}
                />
              )}
              {idx < stories.length - 1 && editingId !== s.id && (
                <div style={{ height: 1, background: "var(--line-soft)", margin: "2px 0" }} />
              )}
            </div>
          ))}

          {/* Empty state */}
          {stories.length === 0 && !adding && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                fontStyle: "italic",
                padding: "2px 0 6px",
              }}
            >
              ストーリーはまだ登録されていません
            </div>
          )}

          {/* Add form */}
          {adding && (
            <div style={{ marginTop: stories.length > 0 ? 12 : 0 }}>
              <StoryForm
                draft={addDraft}
                onDraftChange={setAddDraft}
                isSaving={addSaving}
                justSaved={addJustSaved}
                onSave={() => { void saveAdd(); }}
                onCancel={cancelAdd}
              />
            </div>
          )}

          {/* "+ ストーリーを追加" button */}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{
                marginTop: stories.length > 0 ? 8 : 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "7px 14px",
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
              ストーリーを追加
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="ストーリーを削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.title ?? deleteTarget.type}」のストーリーを削除します。この操作は取り消せません。`
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

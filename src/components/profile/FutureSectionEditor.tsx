"use client";

import { useState, useCallback, useRef } from "react";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FutureSectionEditorProps {
  /** ow_users.future_aspirations の初期値。null = 未記入。 */
  initialText: string | null;
  /** プロフィールオーナー本人が閲覧中かどうか（CTA・編集ボタン表示制御） */
  viewerIsOwner: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_LENGTH = 500;
const JUST_SAVED_MS = 800;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FutureSectionEditor({
  initialText,
  viewerIsOwner,
}: FutureSectionEditorProps) {
  const [savedText,  setSavedText]  = useState<string | null>(initialText);
  const [editText,   setEditText]   = useState<string>(initialText ?? "");
  const [isEditing,  setIsEditing]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [justSaved,  setJustSaved]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  const justSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasText = !!savedText?.trim();

  // ── Enter edit mode ──────────────────────────────────────────────────────────

  const handleStartEdit = useCallback(() => {
    setEditText(savedText ?? "");
    setErrorMsg(null);
    setIsEditing(true);
  }, [savedText]);

  // ── Cancel ───────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    setEditText(savedText ?? "");
    setErrorMsg(null);
    setIsEditing(false);
  }, [savedText]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (isSaving || justSaved) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ future_aspirations: editText.trim() || null }),
      });
      if (!res.ok) throw new Error();

      const newText = editText.trim() || null;
      setSavedText(newText);
      setJustSaved(true);
      setIsEditing(false);

      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), JUST_SAVED_MS);
    } catch {
      setErrorMsg("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }, [editText, isSaving, justSaved]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isDirty = editText.trim() !== (savedText ?? "").trim();
  const overLimit = editText.length > MAX_LENGTH;

  return (
    <div style={{ paddingTop: 8, paddingBottom: 24, paddingLeft: 12 }}>
      {/* Section title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--warm)",
          }}
        >
          目指す姿・ありたい未来
        </span>

        {/* ✎ 編集 button — visible to owner when text exists and not editing */}
        {viewerIsOwner && hasText && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-mute)",
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "2px 10px",
              cursor: "pointer",
              fontFamily: "'Noto Sans JP', sans-serif",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            ✎ 編集
          </button>
        )}

        {/* justSaved indicator */}
        {justSaved && (
          <span
            style={{
              fontSize: 12,
              color: "var(--success)",
              fontWeight: 600,
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            ✓ 保存しました
          </span>
        )}
      </div>

      {/* ── Edit mode ──────────────────────────────────────────────────────────── */}
      {isEditing ? (
        <div>
          <textarea
            aria-label="将来やりたいこと"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={6}
            placeholder="例：プロダクトの企画段階から関わり、ユーザーインタビューを起点にして機能をゼロから作る経験をしてみたいです。将来的には自分でプロダクトを立ち上げることも視野に入れています。"
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              fontSize: 13,
              lineHeight: 1.75,
              color: "var(--ink)",
              background: "#fff",
              border: `1px solid ${overLimit ? "var(--error)" : "var(--line)"}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontFamily: "'Noto Sans JP', sans-serif",
              outline: "none",
            }}
          />

          {/* Character count */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 4,
              marginBottom: 10,
              fontSize: 11,
              color: overLimit ? "var(--error)" : "var(--ink-mute)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {editText.length} / {MAX_LENGTH}
          </div>

          {/* Error */}
          {errorMsg && (
            <p
              style={{
                fontSize: 12,
                color: "var(--error)",
                margin: "0 0 8px",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              {errorMsg}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: "#fff",
                color: "var(--ink-soft)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                cursor: isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || justSaved || overLimit}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                minWidth: 120,
                background: justSaved
                  ? "var(--success)"
                  : !isDirty || isSaving || overLimit
                  ? "var(--ink-mute)"
                  : "var(--warm)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor:
                  !isDirty || isSaving || justSaved || overLimit
                    ? "default"
                    : "pointer",
                transition: "background 0.2s",
                fontFamily: "inherit",
              }}
            >
              {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存する"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Display / CTA mode ──────────────────────────────────────────────── */
        <>
          {hasText ? (
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                lineHeight: 1.85,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {savedText}
            </p>
          ) : viewerIsOwner ? (
            /* Empty state CTA — click to enter edit mode */
            <button
              type="button"
              onClick={handleStartEdit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--warm)",
                background: "var(--warm-soft)",
                border: "1px dashed #fde68a",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              ✦ 目指す姿を書いてみる
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

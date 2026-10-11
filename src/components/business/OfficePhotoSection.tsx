"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import {
  MAX_PHOTOS_TOTAL,
  PHOTO_CATEGORIES,
  buildStoragePath,
  type OfficePhoto,
  type PhotoCategory,
} from "@/lib/business/photos";
import type { CompanyMember } from "@/lib/business/photos";

/*
 * ★企業ページの写真（2026-10-12 に作り直した / 柴さんの指示）。
 *   ・カテゴリごとの4つの枠をやめ、**1つの枠にまとめて追加し、写真ごとにカテゴリを選ぶ**
 *   ・上限は**合計20枚**（MAX_PHOTOS_TOTAL）
 *   ・追加した写真は**未公開**（is_draft）。「公開する」（lib/companies/applyDraft.ts）を押すまで求職者に見えない
 * ⚠️ 削除・キャプション・カテゴリの変更は今までどおりその場で保存される（公開済みの写真にもすぐ効く）。
 */

type Props = {
  companyId: string;
  photos: OfficePhoto[];
  onPhotosChange: (photos: OfficePhoto[]) => void;
};

// ─── 写真カード ──────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  isDragging,
  taggedUserId,
  taggedUserName,
  members,
  membersLoading,
  onCaptionChange,
  onDelete,
  onDragStart,
  onDragEnter,
  onTagChange,
  onLoadMembers,
  onCategoryChange,
}: {
  photo: OfficePhoto;
  isDragging: boolean;
  taggedUserId: string | null;
  taggedUserName: string | null;
  members: CompanyMember[];
  membersLoading: boolean;
  onCaptionChange: (caption: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onTagChange: (userId: string | null) => void;
  onLoadMembers: () => void;
  onCategoryChange: (category: PhotoCategory) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* 画像エリア（4:3） */}
      <div style={{
        width: "100%",
        paddingBottom: "75%",
        position: "relative",
        background: "var(--line-soft)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
        {photo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.caption || "office photo"}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!photo.url && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
          }}>
            📷
          </div>
        )}

        {/* ホバー時のアクションボタン */}
        {hovered && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            display: "flex", gap: 4,
          }}>
            {/* ドラッグハンドル */}
            <button
              type="button"
              title="並び替え"
              aria-label="並び替え"
              style={{
                width: 24, height: 24,
                background: "rgba(255,255,255,0.9)",
                border: "none", borderRadius: 5,
                cursor: "grab",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-soft)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {/* 削除 */}
            <button
              type="button"
              title="削除"
              aria-label="写真を削除"
              onClick={onDelete}
              style={{
                width: 24, height: 24,
                background: "rgba(255,255,255,0.9)",
                border: "none", borderRadius: 5,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-soft)",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)";
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ★カテゴリは写真ごとに選ぶ（2026-10-12）。⚠️ 語彙は PHOTO_CATEGORIES（DB の CHECK と同じ4つ） */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 0" }}>
        <select
          aria-label="写真のカテゴリ"
          value={photo.category}
          onChange={(e) => onCategoryChange(e.target.value as PhotoCategory)}
          style={{
            flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, padding: "4px 6px",
            border: "1px solid var(--line)", borderRadius: 6, color: "var(--ink)", background: "#fff",
            fontFamily: "inherit",
          }}
        >
          {PHOTO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {/* ⚠️ バッジにしない（灰色の文字）。「公開する」を押すまで求職者には見えない */}
        {photo.isDraft && (
          <span data-state="photo-draft" style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>未公開</span>
        )}
      </div>

      {/* キャプション入力 */}
      <div style={{ padding: "8px 10px" }}>
        <input
          type="text"
          value={photo.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="キャプションを入力..."
          style={{
            width: "100%",
            padding: "4px 6px",
            border: "1px solid transparent",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 12, fontWeight: 500,
            color: "var(--ink)",
            borderRadius: 4,
            outline: "none",
            transition: "all 0.15s",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.background = "#fff";
            (e.target as HTMLInputElement).style.borderColor = "var(--royal)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.background = "transparent";
            (e.target as HTMLInputElement).style.borderColor = "transparent";
          }}
          onMouseEnter={(e) => {
            const el = e.target as HTMLInputElement;
            if (document.activeElement !== el) {
              el.style.background = "#fff";
              el.style.borderColor = "var(--line)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.target as HTMLInputElement;
            if (document.activeElement !== el) {
              el.style.background = "transparent";
              el.style.borderColor = "transparent";
            }
          }}
        />
      </div>

      {/* タグ付け */}
      <div style={{ padding: "4px 10px 8px", borderTop: "1px solid var(--line-soft)" }}>
        {taggedUserId ? (
          /* Tagged state: show chip with × */
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              background: "var(--royal-50)", color: "var(--royal)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800,
            }}>
              {taggedUserName?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {taggedUserName}
            </span>
            <button
              type="button"
              onClick={() => onTagChange(null)}
              title="タグを外す"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
            >×</button>
          </div>
        ) : showSelector ? (
          /* Selector state: show inline select + cancel */
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {membersLoading ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>読み込み中…</span>
            ) : (
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onTagChange(e.target.value);
                    setShowSelector(false);
                  }
                }}
                style={{
                  flex: 1, fontSize: 12, fontWeight: 500, padding: "3px 6px",
                  border: "1px solid var(--royal)", borderRadius: 5,
                  color: "var(--ink)", background: "#fff", outline: "none",
                }}
              >
                <option value="" disabled>メンバーを選択…</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}{m.roleTitle ? ` · ${m.roleTitle}` : ""}
                  </option>
                ))}
                {members.length === 0 && (
                  <option value="" disabled>メンバーが見つかりません</option>
                )}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowSelector(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", padding: "2px 4px" }}
            >×</button>
          </div>
        ) : (
          /* Default state: show tag button */
          <button
            type="button"
            onClick={() => { onLoadMembers(); setShowSelector(true); }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mute)"; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            写っているメンバーをタグ付け
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 追加カード ──────────────────────────────────────────────────────────────

function PhotoAddCard({
  disabled,
  uploading,
  onAdd,
}: {
  disabled: boolean;
  uploading: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled || uploading ? undefined : onAdd}
      style={{
        background: disabled ? "var(--bg-tint)" : "#fff",
        border: "1.5px dashed var(--line)",
        borderRadius: 10,
        paddingBottom: "75%",
        position: "relative",
        width: "100%",
        cursor: disabled || uploading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.2s",
        display: "block",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !uploading) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !uploading) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mute)";
        }
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 6,
        color: "var(--ink-mute)",
        fontSize: 12, fontWeight: 600,
      }}>
        {uploading ? (
          <>
            <div style={{
              width: 18, height: 18,
              border: "2px solid var(--line)",
              borderTop: "2px solid var(--royal)",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
            アップロード中…
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            写真を追加
          </>
        )}
      </div>
    </button>
  );
}


// ─── メインコンポーネント ────────────────────────────────────────────────────

export function OfficePhotoSection({ companyId, photos, onPhotosChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const membersLoadedRef = useRef(false);
  const dragOverIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingRef = useRef(false);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const full = photos.length >= MAX_PHOTOS_TOTAL;

  function showErr(msg: string, ms = 5000) {
    setPhotoError(msg);
    setTimeout(() => setPhotoError(null), ms);
  }

  async function loadMembers() {
    if (membersLoadedRef.current || membersLoading) return;
    setMembersLoading(true);
    try {
      const res = await fetch("/api/biz/company/members");
      if (res.ok) {
        const { members: data } = await res.json();
        setMembers(data ?? []);
        membersLoadedRef.current = true;
      }
    } catch (err) {
      console.error("[OfficePhotoSection] load members failed:", err);
    } finally {
      setMembersLoading(false);
    }
  }

  async function patchPhoto(id: string, body: Record<string, unknown>, label: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/biz/company/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      return true;
    } catch (err) {
      console.error(`[OfficePhotoSection] ${label} PATCH failed:`, err);
      showErr("保存に失敗しました。もう一度お試しください。");
      return false;
    }
  }

  async function handleTagChange(photoId: string, userId: string | null) {
    onPhotosChange(photos.map((p) => (p.id === photoId ? { ...p, tagged_user_id: userId } : p)));
    await patchPhoto(photoId, { tagged_user_id: userId }, "tag");
  }

  async function handleCategoryChange(photoId: string, category: PhotoCategory) {
    const before = photos;
    onPhotosChange(photos.map((p) => (p.id === photoId ? { ...p, category } : p)));
    /* ⚠️ 失敗したら戻す（選んだように見えて保存されていない、を作らない） */
    if (!(await patchPhoto(photoId, { category }, "category"))) onPhotosChange(before);
  }

  function handleAdd() {
    if (isUploadingRef.current || full) return;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showErr("JPG・PNG・WebP のみ対応しています", 4000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showErr("5MB 以内のファイルを選択してください", 4000);
      return;
    }
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploading(true);

    try {
      const supabase = createClient();
      const path = buildStoragePath(companyId, file.name);
      const { error: uploadError } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("ow-uploads").getPublicUrl(path);

      /* ⚠️ カテゴリの初期値は「オフィス」。追加したあと写真ごとに選び直せる */
      const res = await fetch("/api/biz/company/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "workspace", image_url: publicUrl, caption: "", display_order: photos.length }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Upload failed");
      }
      const { data } = await res.json();
      onPhotosChange([...photos, {
        id: data.id,
        url: data.image_url,
        caption: data.caption ?? "",
        category: data.category,
        tagged_user_id: data.tagged_user_id ?? null,
        isDraft: data.is_draft === true,
      }]);
    } catch (err) {
      console.error("[OfficePhotoSection] upload failed:", err);
      showErr(err instanceof Error && err.message.includes("枚まで") ? err.message : "アップロードに失敗しました。もう一度お試しください。");
    } finally {
      isUploadingRef.current = false;
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/biz/company/photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Delete failed");
      }
      onPhotosChange(photos.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[OfficePhotoSection] delete failed:", err);
      showErr("削除に失敗しました。もう一度お試しください。");
    }
  }

  function handleCaptionChange(id: string, caption: string) {
    onPhotosChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));
    if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    captionTimerRef.current = setTimeout(() => { void patchPhoto(id, { caption }, "caption"); }, 700);
  }

  function handleDragEnd() {
    if (!draggingId || !dragOverIdRef.current || draggingId === dragOverIdRef.current) {
      setDraggingId(null);
      dragOverIdRef.current = null;
      return;
    }
    const from = photos.findIndex((p) => p.id === draggingId);
    const to = photos.findIndex((p) => p.id === dragOverIdRef.current);
    if (from === -1 || to === -1) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onPhotosChange(next);
    setDraggingId(null);
    dragOverIdRef.current = null;
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleFileSelected} />

      {photoError && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", marginBottom: 14, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
        }} role="alert">
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /><span style={{ flex: 1 }}>{photoError}</span>
          <button type="button" onClick={() => setPhotoError(null)} aria-label="閉じる" style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: 0 }}>
          写真ごとにカテゴリを選べます。新しい写真は「公開する」で反映されます。削除や説明の変更はすぐ反映されます。
        </p>
        <span style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
          <strong style={{ color: "var(--ink)" }}>{photos.length}</strong> / {MAX_PHOTOS_TOTAL}枚
        </span>
      </div>

      <div
        className="ops-grid"
        style={{ display: "grid", gap: 12 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDragEnd}
      >
        {photos.map((photo) => {
          const taggedMember = photo.tagged_user_id ? members.find((m) => m.userId === photo.tagged_user_id) ?? null : null;
          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isDragging={draggingId === photo.id}
              taggedUserId={photo.tagged_user_id ?? null}
              taggedUserName={taggedMember?.name ?? null}
              members={members}
              membersLoading={membersLoading}
              onCaptionChange={(caption) => handleCaptionChange(photo.id, caption)}
              onDelete={() => handleDelete(photo.id)}
              onDragStart={() => setDraggingId(photo.id)}
              onDragEnter={() => { dragOverIdRef.current = photo.id; }}
              onTagChange={(userId) => handleTagChange(photo.id, userId)}
              onLoadMembers={loadMembers}
              onCategoryChange={(c) => handleCategoryChange(photo.id, c)}
            />
          );
        })}
        {!full && <PhotoAddCard disabled={full} uploading={uploading} onAdd={handleAdd} />}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ops-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 720px) { .ops-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
    </div>
  );
}

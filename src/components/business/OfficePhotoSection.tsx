"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";
import {
  MAX_PHOTOS_PER_CATEGORY,
  buildStoragePath,
  type OfficePhoto,
  type PhotoCategory,
} from "@/lib/business/photos";
import type { CompanyMember } from "@/lib/business/photos";

// ─── 定数 ───────────────────────────────────────────────────────────────────

const CATEGORY_DEFS: {
  id: PhotoCategory;
  label: string;
  iconColor: string;
  iconBg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "workspace",
    label: "オフィス",
    iconColor: "var(--royal)",
    iconBg: "var(--royal-50)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "meeting",
    label: "働く様子",
    iconColor: "var(--purple)",
    iconBg: "var(--purple-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: "welfare",
    label: "休憩・食事スペース",
    iconColor: "var(--success)",
    iconBg: "var(--success-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    ),
  },
  {
    id: "event",
    label: "チーム・イベント",
    iconColor: "#B45309",
    iconBg: "var(--warm-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

// ─── 型 ─────────────────────────────────────────────────────────────────────

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

// ─── カテゴリセクション ──────────────────────────────────────────────────────

function PhotoCategorySection({
  def,
  photos,
  draggingId,
  uploadingCategory,
  members,
  membersLoading,
  onAdd,
  onDelete,
  onCaptionChange,
  onTagChange,
  onLoadMembers,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  def: typeof CATEGORY_DEFS[number];
  photos: OfficePhoto[];
  draggingId: string | null;
  uploadingCategory: PhotoCategory | null;
  members: CompanyMember[];
  membersLoading: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onTagChange: (id: string, userId: string | null) => void;
  onLoadMembers: () => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
}) {
  const remaining = MAX_PHOTOS_PER_CATEGORY - photos.length;
  const addSlots = Math.min(remaining, remaining > 0 ? 1 : 0);
  const isUploading = uploadingCategory === def.id;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* カテゴリヘッド */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: def.iconBg, color: def.iconColor,
          }}>
            {def.icon}
          </div>
          {def.label}
        </div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12, fontWeight: 600, color: "var(--ink-mute)",
        }}>
          <strong style={{ color: "var(--ink)" }}>{photos.length}</strong> / {MAX_PHOTOS_PER_CATEGORY}枚
        </div>
      </div>

      {/* 写真グリッド（3列） */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDragEnd}
      >
        {photos.map((photo) => {
          const taggedMember = photo.tagged_user_id
            ? members.find(m => m.userId === photo.tagged_user_id) ?? null
            : null;
          return (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isDragging={draggingId === photo.id}
              taggedUserId={photo.tagged_user_id ?? null}
              taggedUserName={taggedMember?.name ?? null}
              members={members}
              membersLoading={membersLoading}
              onCaptionChange={(caption) => onCaptionChange(photo.id, caption)}
              onDelete={() => onDelete(photo.id)}
              onDragStart={() => onDragStart(photo.id)}
              onDragEnter={() => onDragEnter(photo.id)}
              onTagChange={(userId) => onTagChange(photo.id, userId)}
              onLoadMembers={onLoadMembers}
            />
          );
        })}
        {/* 追加スロット */}
        {addSlots > 0 && (
          <PhotoAddCard
            key="add"
            disabled={photos.length >= MAX_PHOTOS_PER_CATEGORY}
            uploading={isUploading}
            onAdd={onAdd}
          />
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

export function OfficePhotoSection({ companyId, photos, onPhotosChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<PhotoCategory | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const membersLoadedRef = useRef(false);
  const dragOverIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCategoryRef = useRef<PhotoCategory | null>(null);
  const isUploadingRef = useRef(false);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function byCategory(cat: PhotoCategory) {
    return photos.filter((p) => p.category === cat);
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

  async function handleTagChange(photoId: string, userId: string | null) {
    // Optimistic update
    onPhotosChange(photos.map((p) => (p.id === photoId ? { ...p, tagged_user_id: userId } : p)));
    // Persist to DB
    try {
      await fetch(`/api/biz/company/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagged_user_id: userId }),
      });
    } catch (err) {
      console.error("[OfficePhotoSection] tag PATCH failed:", err);
    }
  }

  function handleAdd(category: PhotoCategory) {
    if (isUploadingRef.current) return;
    pendingCategoryRef.current = category;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pendingCategoryRef.current) return;

    const category = pendingCategoryRef.current;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("JPG・PNG・WebP のみ対応しています");
      setTimeout(() => setPhotoError(null), 4000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("5MB 以内のファイルを選択してください");
      setTimeout(() => setPhotoError(null), 4000);
      return;
    }

    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    setUploadingCategory(category);

    try {
      const supabase = createClient();
      const path = buildStoragePath(companyId, file.name);

      const { error: uploadError } = await supabase.storage
        .from("ow-uploads")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("ow-uploads")
        .getPublicUrl(path);

      const catPhotos = byCategory(category);
      const res = await fetch("/api/biz/company/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          image_url: publicUrl,
          caption: "",
          display_order: catPhotos.length,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const { data } = await res.json();
      const newPhoto: OfficePhoto = {
        id: data.id,
        url: data.image_url,
        caption: data.caption ?? "",
        category: data.category,
        tagged_user_id: data.tagged_user_id ?? null,
      };
      onPhotosChange([...photos, newPhoto]);
    } catch (err) {
      console.error("[OfficePhotoSection] upload failed:", err);
      setPhotoError("アップロードに失敗しました。もう一度お試しください。");
      setTimeout(() => setPhotoError(null), 5000);
    } finally {
      isUploadingRef.current = false;
      setUploadingCategory(null);
      pendingCategoryRef.current = null;
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/biz/company/photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Delete failed");
      }
      onPhotosChange(photos.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[OfficePhotoSection] delete failed:", err);
      setPhotoError("削除に失敗しました。もう一度お試しください。");
      setTimeout(() => setPhotoError(null), 5000);
    }
  }

  function handleCaptionChange(id: string, caption: string) {
    onPhotosChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));

    if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
    captionTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/biz/company/photos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption }),
        });
      } catch (err) {
        console.error("[OfficePhotoSection] caption PATCH failed:", err);
      }
    }, 700);
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragEnter(id: string) {
    dragOverIdRef.current = id;
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
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      {/* Photo error banner */}
      {photoError && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", marginBottom: 14, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error)", fontWeight: 600,
        }} role="alert">
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /><span>{photoError}</span>
          <button type="button" onClick={() => setPhotoError(null)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}>×</button>
        </div>
      )}

      {/* ガイドラインバナー */}
      <div style={{
        background: "linear-gradient(135deg, var(--royal-50) 0%, #fff 100%)",
        border: "1px solid var(--royal-100)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 22,
        display: "flex",
        gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, background: "var(--royal)", color: "#fff",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", marginBottom: 6 }}>
            写真選びのポイント
          </div>
          <ul style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.8, listStyle: "none", padding: 0 }}>
            {[
              "各カテゴリ、無理に枚数を埋める必要はありません",
              "「この写真で何が伝わるか」を意識して選んでください",
              "古くなった写真は定期的に見直しましょう",
            ].map((tip) => (
              <li key={tip} style={{ paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 4, color: "var(--royal)", fontWeight: 700 }}>•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* カテゴリ別グリッド */}
      {CATEGORY_DEFS.map((def) => (
        <PhotoCategorySection
          key={def.id}
          def={def}
          photos={byCategory(def.id)}
          draggingId={draggingId}
          uploadingCategory={uploadingCategory}
          members={members}
          membersLoading={membersLoading}
          onAdd={() => handleAdd(def.id)}
          onDelete={handleDelete}
          onCaptionChange={handleCaptionChange}
          onTagChange={handleTagChange}
          onLoadMembers={loadMembers}
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
        />
      ))}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

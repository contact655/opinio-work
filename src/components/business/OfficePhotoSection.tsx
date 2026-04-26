"use client";

import { useRef, useState } from "react";
import type { OfficePhoto, PhotoCategory } from "@/lib/business/mockCompany";

// ─── 定数 ───────────────────────────────────────────────────────────────────

const MAX_PHOTOS_PER_CATEGORY = 5;

// Unsplash Source プレースホルダー用のキーワードリスト
const UNSPLASH_KEYWORDS: Record<PhotoCategory, string[]> = {
  workspace: ["office,desk", "office,modern", "workspace,laptop", "coworking"],
  meeting:   ["meeting,room", "conference,room", "office,meeting", "boardroom"],
  welfare:   ["office,lounge", "cafe,interior", "office,kitchen", "relax,space"],
  event:     ["office,party", "team,work", "office,celebration", "company,event"],
};

const CATEGORY_DEFS: {
  id: PhotoCategory;
  label: string;
  iconColor: string;
  iconBg: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "workspace",
    label: "執務エリア",
    iconColor: "var(--royal)",
    iconBg: "var(--royal-50)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    id: "meeting",
    label: "会議室・コラボエリア",
    iconColor: "var(--purple)",
    iconBg: "var(--purple-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    id: "welfare",
    label: "福利厚生・施設",
    iconColor: "var(--success)",
    iconBg: "var(--success-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    id: "event",
    label: "イベント・社内交流",
    iconColor: "#B45309",
    iconBg: "var(--warm-soft)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
];

// ─── 型 ─────────────────────────────────────────────────────────────────────

type Props = {
  photos: OfficePhoto[];
  onPhotosChange: (photos: OfficePhoto[]) => void;
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function generateId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getUnsplashUrl(category: PhotoCategory): string {
  const keywords = UNSPLASH_KEYWORDS[category];
  const kw = keywords[Math.floor(Math.random() * keywords.length)];
  // Unsplash Source API — ランダム画像（800×600）
  return `https://source.unsplash.com/800x600/?${kw}&sig=${Math.random().toString(36).slice(2)}`;
}

// ─── 写真カード ──────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  isDragging,
  onCaptionChange,
  onDelete,
  onDragStart,
  onDragEnter,
}: {
  photo: OfficePhoto;
  isDragging: boolean;
  onCaptionChange: (caption: string) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
}) {
  const [hovered, setHovered] = useState(false);

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
        paddingBottom: "75%",  // 4:3
        position: "relative",
        background: photo.url ? undefined : photo.gradient,
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
            fontSize: 11,
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
    </div>
  );
}

// ─── 追加カード ──────────────────────────────────────────────────────────────

function PhotoAddCard({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onAdd}
      style={{
        background: disabled ? "var(--bg-tint)" : "#fff",
        border: "1.5px dashed var(--line)",
        borderRadius: 10,
        paddingBottom: "75%",  // 4:3 — height via padding trick
        position: "relative",
        width: "100%",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.2s",
        display: "block",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
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
        fontSize: 11, fontWeight: 600,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        写真を追加
      </div>
    </button>
  );
}

// ─── カテゴリセクション ──────────────────────────────────────────────────────

function PhotoCategory({
  def,
  photos,
  draggingId,
  onAdd,
  onDelete,
  onCaptionChange,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  def: typeof CATEGORY_DEFS[number];
  photos: OfficePhoto[];
  draggingId: string | null;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
}) {
  const remaining = MAX_PHOTOS_PER_CATEGORY - photos.length;
  const addSlots = Math.min(remaining, remaining > 0 ? 1 : 0);

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
          fontSize: 11, fontWeight: 600, color: "var(--ink-mute)",
        }}>
          <strong style={{ color: "var(--ink)" }}>{photos.length}</strong> / {MAX_PHOTOS_PER_CATEGORY}枚
        </div>
      </div>

      {/* 写真グリッド（3列） */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDragEnd}
      >
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            isDragging={draggingId === photo.id}
            onCaptionChange={(caption) => onCaptionChange(photo.id, caption)}
            onDelete={() => onDelete(photo.id)}
            onDragStart={() => onDragStart(photo.id)}
            onDragEnter={() => onDragEnter(photo.id)}
          />
        ))}
        {/* 追加スロット */}
        {addSlots > 0 && (
          <PhotoAddCard
            key="add"
            disabled={photos.length >= MAX_PHOTOS_PER_CATEGORY}
            onAdd={onAdd}
          />
        )}
      </div>
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────────────────────────

export function OfficePhotoSection({ photos, onPhotosChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  function byCategory(cat: PhotoCategory) {
    return photos.filter((p) => p.category === cat);
  }

  function handleAdd(category: PhotoCategory) {
    const catPhotos = byCategory(category);
    if (catPhotos.length >= MAX_PHOTOS_PER_CATEGORY) return;
    const newPhoto: OfficePhoto = {
      id: generateId(),
      category,
      url: getUnsplashUrl(category),
      caption: "",
      gradient: "",
    };
    onPhotosChange([...photos, newPhoto]);
  }

  function handleDelete(id: string) {
    onPhotosChange(photos.filter((p) => p.id !== id));
  }

  function handleCaptionChange(id: string, caption: string) {
    onPhotosChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));
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
          <ul style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.8, listStyle: "none", padding: 0 }}>
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
        <PhotoCategory
          key={def.id}
          def={def}
          photos={byCategory(def.id)}
          draggingId={draggingId}
          onAdd={() => handleAdd(def.id)}
          onDelete={handleDelete}
          onCaptionChange={handleCaptionChange}
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}

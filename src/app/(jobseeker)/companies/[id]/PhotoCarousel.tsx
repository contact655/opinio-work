"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// ─── Caption overlay (bottom gradient) ───────────────────────────────────────

function CaptionOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "24px 12px 10px",
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.65) 100%)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

// ─── Full-screen lightbox ──────────────────────────────────────────────────────

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: CompanyPhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(photos.length - 1, i + 1));
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, photos.length]);

  const photo = photos[idx];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.15)",
          border: "none",
          borderRadius: "50%",
          width: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <X size={20} />
      </button>

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: "90vw",
          maxHeight: "85vh",
          width: "100%",
          height: "100%",
        }}
      >
        <Image
          src={photo.image_url}
          alt={photo.caption ?? ""}
          fill
          sizes="90vw"
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Caption */}
      {photo.caption && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 13,
            padding: "6px 16px",
            borderRadius: 100,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          {photo.caption}
        </div>
      )}

      {/* Counter */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.6)",
          fontSize: 13,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {idx + 1} / {photos.length}
      </div>

      {/* Prev */}
      {idx > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIdx(idx - 1);
          }}
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Next */}
      {idx < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIdx(idx + 1);
          }}
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}

// ─── Uniform 16:9 photo grid ───────────────────────────────────────────────────
//
// 1 photo  → full-width 16:9
// 2 photos → 2-column, each 16:9
// 3 photos → 2-column top row + 1 full-width bottom
// 4 photos → 2×2 grid, all 16:9
// 5+ photos → 2×2 grid (3 clear + 1 overlay showing "+N more")

const MAX_SLOTS = 4; // max cells shown in the grid

function PhotoGrid({
  photos,
  onOpen,
}: {
  photos: CompanyPhoto[];
  onOpen: (i: number) => void;
}) {
  const hasOverflow = photos.length > MAX_SLOTS;
  // Number of photos shown in the grid
  const gridPhotos = photos.slice(0, MAX_SLOTS);
  // How many are "hidden" behind the overlay (+N)
  const hiddenCount = hasOverflow ? photos.length - MAX_SLOTS + 1 : 0;
  // If overflow, 4th slot becomes the overlay (background = photo[3], text = "+hiddenCount")
  const clearCount = hasOverflow ? MAX_SLOTS - 1 : photos.length; // slots shown without overlay

  // Compute gridColumn span per index
  function colSpan(index: number): string | undefined {
    const total = gridPhotos.length;
    if (total === 1) return "1 / -1";
    if (total === 3 && index === 2) return "1 / -1"; // 3rd photo spans full width
    return undefined;
  }

  return (
    <>
      <style>{`
        .pg-cell-img { transition: transform 0.3s ease; }
        .pg-cell:hover .pg-cell-img { transform: scale(1.04); }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: photos.length === 1 ? "1fr" : "1fr 1fr",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {gridPhotos.map((photo, i) => {
          const isOverlaySlot = hasOverflow && i === MAX_SLOTS - 1;
          const isClear = i < clearCount;

          return (
            <div
              key={photo.id}
              className="pg-cell"
              onClick={() => onOpen(i)}
              style={{
                aspectRatio: "16 / 9",
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
                gridColumn: colSpan(i),
                background: "var(--bg-tint)",
                flexShrink: 0,
              }}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption ?? "オフィス写真"}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                className="pg-cell-img"
              />

              {isOverlaySlot ? (
                /* "+N" overlay on last slot */
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 24,
                      fontWeight: 700,
                      fontFamily: "Inter, sans-serif",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    +{hiddenCount}
                  </span>
                </div>
              ) : (
                isClear && photo.caption && <CaptionOverlay text={photo.caption} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function PhotoCarousel({ photos }: { photos: CompanyPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <PhotoGrid photos={photos} onOpen={setLightboxIndex} />

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

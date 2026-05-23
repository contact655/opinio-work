"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// ─── Shared constants ──────────────────────────────────────────────────────────

/** すべての写真カードを同じ固定サイズで表示（4:3） */
const CARD_H = 220; // px — 全カード共通の高さ
const CARD_W = 293; // px — 4:3 比率 (220 × 4/3 ≒ 293)
const GAP = 10;     // px — カード間隔

// ─── Caption overlay ───────────────────────────────────────────────────────────

function CaptionOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "28px 12px 10px",
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
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.15)", border: "none",
          borderRadius: "50%", width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#fff",
        }}
      >
        <X size={20} />
      </button>

      {/* Counter */}
      <div
        style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter, sans-serif",
        }}
      >
        {idx + 1} / {photos.length}
      </div>

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh", width: "100%", height: "100%" }}
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
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)", color: "#fff",
            fontSize: 13, padding: "6px 16px", borderRadius: 100,
            backdropFilter: "blur(8px)", whiteSpace: "nowrap",
          }}
        >
          {photo.caption}
        </div>
      )}

      {/* Prev */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Next */}
      {idx < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}

// ─── Horizontal photo strip ────────────────────────────────────────────────────
// 全写真を同じサイズ（CARD_W × CARD_H）の横スクロール列で表示

function PhotoStrip({
  photos,
  onOpen,
}: {
  photos: CompanyPhoto[];
  onOpen: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? CARD_W + GAP : -(CARD_W + GAP), behavior: "smooth" });
  }

  const arrowStyle = (visible: boolean, side: "left" | "right"): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: -14,
    zIndex: 10,
    width: 32, height: 32,
    borderRadius: "50%",
    background: "#fff",
    border: "1px solid var(--line)",
    boxShadow: "0 1px 6px rgba(0,0,0,0.14)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 0.15s",
    padding: 0,
  });

  return (
    <>
      <style>{`
        .ps-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .ps-card:hover { transform: scale(1.025); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
        .ps-strip::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ position: "relative", marginBottom: 20 }}>
        {/* 左矢印 */}
        <button
          style={arrowStyle(canLeft, "left")}
          onClick={() => scroll("left")}
          aria-label="前の写真へ"
        >
          <ChevronLeft size={16} color="var(--ink)" />
        </button>

        {/* スクロール本体 */}
        <div
          ref={scrollRef}
          className="ps-strip"
          onScroll={updateArrows}
          style={{
            display: "flex",
            gap: GAP,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            paddingBottom: 2, // スクロールバー非表示でも少し余白
          }}
        >
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="ps-card"
              onClick={() => onOpen(i)}
              style={{
                width: CARD_W,
                height: CARD_H,
                flexShrink: 0,
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                cursor: "pointer",
                scrollSnapAlign: "start",
                background: "var(--bg-tint)",
              }}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption ?? "オフィス写真"}
                fill
                sizes="320px"
                style={{ objectFit: "cover" }}
              />
              {photo.caption && <CaptionOverlay text={photo.caption} />}
            </div>
          ))}
        </div>

        {/* 右矢印 */}
        <button
          style={arrowStyle(canRight, "right")}
          onClick={() => scroll("right")}
          aria-label="次の写真へ"
        >
          <ChevronRight size={16} color="var(--ink)" />
        </button>
      </div>

      {/* 枚数インジケーター */}
      <div
        style={{
          textAlign: "right",
          fontSize: 11,
          color: "var(--ink-mute)",
          fontFamily: "Inter, sans-serif",
          marginTop: -14,
          marginBottom: 16,
        }}
      >
        {photos.length}枚の写真
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
      <PhotoStrip photos={photos} onOpen={setLightboxIndex} />

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

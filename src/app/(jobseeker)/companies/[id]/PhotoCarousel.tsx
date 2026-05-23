"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const GAP = 8;

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
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
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
        <div style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.6)", color: "#fff",
          fontSize: 13, padding: "6px 16px", borderRadius: 100,
          backdropFilter: "blur(8px)", whiteSpace: "nowrap",
        }}>
          {photo.caption}
        </div>
      )}

      {/* Prev / Next */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
          style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: "50%", width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
          style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: "50%", width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Counter */}
      <div style={{
        position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,0.6)", fontSize: 13,
        fontFamily: "Inter, sans-serif",
      }}>
        {idx + 1} / {photos.length}
      </div>
    </div>
  );
}

// ─── Mosaic grid layout (3+ photos) ───────────────────────────────────────────

function MosaicGallery({
  photos,
  onOpen,
}: {
  photos: CompanyPhoto[];
  onOpen: (i: number) => void;
}) {
  // Left: first photo (60%). Right: next 2 photos stacked (40%).
  const main = photos[0];
  const subs = photos.slice(1, 3);
  const remainCount = photos.length - 3; // photos beyond the first 3

  return (
    <div style={{ display: "flex", gap: GAP, marginBottom: 20, height: 280 }}>
      {/* Main photo */}
      <div
        onClick={() => onOpen(0)}
        style={{
          flex: "0 0 60%", borderRadius: 12, overflow: "hidden",
          cursor: "pointer", position: "relative",
        }}
      >
        <Image
          src={main.image_url}
          alt={main.caption ?? "オフィス写真"}
          fill
          sizes="60vw"
          style={{ objectFit: "cover", transition: "transform 0.3s" }}
          className="mosaic-img"
        />
      </div>

      {/* Sub photos */}
      <div style={{ flex: "0 0 calc(40% - 8px)", display: "flex", flexDirection: "column", gap: GAP }}>
        {subs.map((p, i) => {
          const isLast = i === subs.length - 1;
          const hasMore = isLast && remainCount > 0;
          return (
            <div
              key={p.id}
              onClick={() => onOpen(i + 1)}
              style={{
                flex: 1, borderRadius: 12, overflow: "hidden",
                cursor: "pointer", position: "relative",
              }}
            >
              <Image
                src={p.image_url}
                alt={p.caption ?? ""}
                fill
                sizes="40vw"
                style={{ objectFit: "cover", transition: "transform 0.3s" }}
                className="mosaic-img"
              />
              {hasMore && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.52)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 12,
                }}>
                  <span style={{
                    color: "#fff", fontSize: 22, fontWeight: 700,
                    fontFamily: "Inter, sans-serif",
                  }}>
                    +{remainCount + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Simple carousel (1-2 photos) ─────────────────────────────────────────────

function SimpleCarousel({
  photos,
  onOpen,
}: {
  photos: CompanyPhoto[];
  onOpen: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(2);

  useEffect(() => {
    const update = () => {
      const count = window.innerWidth >= 640 ? Math.min(photos.length, 2) : 1;
      setVisibleCount(count);
      setCurrentIndex(0);
      scrollRef.current?.scrollTo({ left: 0 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [photos.length]);

  const maxIndex = Math.max(0, photos.length - visibleCount);
  const showControls = photos.length > visibleCount;

  const scrollToIndex = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const firstSlide = container.firstElementChild as HTMLElement | null;
    if (!firstSlide) return;
    const slideWidth = firstSlide.offsetWidth + GAP;
    container.scrollTo({ left: slideWidth * index, behavior: "smooth" });
    setCurrentIndex(index);
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const firstSlide = container.firstElementChild as HTMLElement | null;
    if (!firstSlide || firstSlide.offsetWidth === 0) return;
    const slideWidth = firstSlide.offsetWidth + GAP;
    const idx = Math.round(container.scrollLeft / slideWidth);
    setCurrentIndex(Math.min(Math.max(idx, 0), maxIndex));
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: "flex", gap: GAP,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
          }}
        >
          {photos.map((p, i) => (
            <div
              key={p.id}
              onClick={() => onOpen(i)}
              style={{
                flexShrink: 0, scrollSnapAlign: "start",
                width: visibleCount === 1 ? "100%" : `calc(50% - ${GAP / 2}px)`,
                borderRadius: 12, overflow: "hidden",
                position: "relative", aspectRatio: "4/3",
                cursor: "pointer",
              }}
            >
              <Image
                src={p.image_url}
                alt={p.caption ?? ""}
                fill
                sizes="(max-width:640px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
              />
              {p.caption && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  padding: "8px 12px",
                  background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.65) 100%)",
                  color: "#fff", fontSize: 11, fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.caption}
                </div>
              )}
            </div>
          ))}
        </div>

        {showControls && (
          <>
            <button
              onClick={() => scrollToIndex(currentIndex - 1)}
              disabled={currentIndex === 0}
              style={{
                position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "#fff", border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: currentIndex === 0 ? "default" : "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                opacity: currentIndex === 0 ? 0.4 : 1,
                transition: "opacity 0.15s", padding: 0,
              }}
            >
              <ChevronLeft size={16} color="var(--ink)" />
            </button>
            <button
              onClick={() => scrollToIndex(currentIndex + 1)}
              disabled={currentIndex >= maxIndex}
              style={{
                position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "#fff", border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: currentIndex >= maxIndex ? "default" : "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                opacity: currentIndex >= maxIndex ? 0.4 : 1,
                transition: "opacity 0.15s", padding: 0,
              }}
            >
              <ChevronRight size={16} color="var(--ink)" />
            </button>
          </>
        )}
      </div>

      {showControls && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              style={{
                width: i === currentIndex ? 16 : 6, height: 6, borderRadius: 3,
                background: i === currentIndex ? "var(--royal)" : "var(--line)",
                border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function PhotoCarousel({ photos }: { photos: CompanyPhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <style>{`
        .mosaic-img:hover { transform: scale(1.03); }
      `}</style>

      {photos.length >= 3 ? (
        <MosaicGallery photos={photos} onOpen={setLightboxIndex} />
      ) : (
        <SimpleCarousel photos={photos} onOpen={setLightboxIndex} />
      )}

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

"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { ChevronLeft, ChevronRight } from "lucide-react";

const GAP = 10;

function getVisibleCount(): number {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth >= 1024) return 3;
  if (window.innerWidth >= 640) return 2;
  return 1;
}

function PhotoCard({ photo }: { photo: CompanyPhoto }) {
  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        aspectRatio: "4/3",
      }}
    >
      <Image
        src={photo.image_url}
        alt={photo.caption ?? "オフィス写真"}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        style={{ objectFit: "cover" }}
      />
      {photo.caption && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "8px 12px",
            background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.65) 100%)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 500,
            borderRadius: "0 0 12px 12px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {photo.caption}
        </div>
      )}
    </div>
  );
}

export function PhotoCarousel({ photos }: { photos: CompanyPhoto[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    const update = () => {
      setVisibleCount(getVisibleCount());
      setCurrentIndex(0);
      scrollRef.current?.scrollTo({ left: 0 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (photos.length === 0) return null;

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
      {/* Scroll track + arrows */}
      <div style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="[&::-webkit-scrollbar]:hidden"
          style={{
            display: "flex",
            gap: GAP,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
          }}
        >
          {photos.map((p) => (
            <div
              key={p.id}
              className="w-full sm:w-[calc(50%-5px)] lg:w-[calc(33.333%-6.667px)]"
              style={{ flexShrink: 0, scrollSnapAlign: "start" }}
            >
              <PhotoCard photo={p} />
            </div>
          ))}
        </div>

        {showControls && (
          <>
            <button
              onClick={() => scrollToIndex(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="前へ"
              style={{
                position: "absolute",
                left: -14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#fff",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: currentIndex === 0 ? "default" : "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                opacity: currentIndex === 0 ? 0.4 : 1,
                transition: "opacity 0.15s",
                padding: 0,
              }}
            >
              <ChevronLeft size={16} color="var(--ink)" />
            </button>
            <button
              onClick={() => scrollToIndex(currentIndex + 1)}
              disabled={currentIndex >= maxIndex}
              aria-label="次へ"
              style={{
                position: "absolute",
                right: -14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#fff",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: currentIndex >= maxIndex ? "default" : "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                opacity: currentIndex >= maxIndex ? 0.4 : 1,
                transition: "opacity 0.15s",
                padding: 0,
              }}
            >
              <ChevronRight size={16} color="var(--ink)" />
            </button>
          </>
        )}
      </div>

      {/* Indicator dots */}
      {showControls && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              aria-label={`スライド ${i + 1}`}
              style={{
                width: i === currentIndex ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentIndex ? "var(--royal)" : "var(--line)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

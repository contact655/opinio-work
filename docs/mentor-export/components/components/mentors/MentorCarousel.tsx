"use client";

// src/components/mentors/MentorCarousel.tsx
// メンターカード横スクロールカルーセル（GenreCarousel と同構造）

import { useRef, useState, useEffect, useCallback } from "react";
import { MentorCardCompact } from "./MentorCardCompact";
import type { MentorData } from "@/lib/supabase/queries";

type Props = {
  mentors: MentorData[];
};

export function MentorCarousel({ mentors }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  function handleScroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.children[0] as HTMLElement | undefined;
    const cardWidth = firstCard ? firstCard.offsetWidth + 14 : 260;
    el.scrollBy({ left: direction === "right" ? cardWidth : -cardWidth, behavior: "smooth" });
  }

  if (mentors.length === 0) return null;

  return (
    <>
      <style>{`
        .mentor-carousel {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: calc((100% - 14px * 3) / 4);
          gap: 14px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-bottom: 8px;
          scrollbar-width: thin;
          scrollbar-color: #e6e9ef transparent;
        }
        .mentor-carousel::-webkit-scrollbar { height: 6px; }
        .mentor-carousel::-webkit-scrollbar-thumb {
          background: #e6e9ef;
          border-radius: 3px;
        }
        .mentor-carousel > * { scroll-snap-align: start; }

        @media (max-width: 640px) {
          .mentor-carousel {
            grid-auto-columns: calc((100% - 14px) / 1.2);
            padding-right: 24px;
          }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .mentor-carousel { grid-auto-columns: calc((100% - 14px) / 2); }
        }
        @media (min-width: 1025px) and (max-width: 1280px) {
          .mentor-carousel { grid-auto-columns: calc((100% - 14px * 2) / 3); }
        }
        @media (min-width: 1281px) {
          .mentor-carousel { grid-auto-columns: calc((100% - 14px * 3) / 4); }
        }

        .mentor-card-compact {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.06);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.22s cubic-bezier(0.34,1.56,0.64,1), transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          cursor: pointer;
          height: 100%;
          will-change: transform;
        }
        .mentor-card-compact:hover {
          box-shadow: 0 20px 40px rgba(15,23,42,0.22), 0 0 0 1px rgba(15,23,42,0.12);
          transform: translateY(-10px) scale(1.01);
        }
        .mentor-card-compact:active {
          box-shadow: 0 4px 10px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.08);
          transform: translateY(-2px) scale(0.98);
          transition-duration: 0.06s;
        }
      `}</style>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          className={`carousel-arrow carousel-arrow-left${canScrollLeft ? "" : " carousel-arrow-hidden"}`}
          onClick={() => handleScroll("left")}
          aria-label="前のカードへ"
          tabIndex={canScrollLeft ? 0 : -1}
        >
          ‹
        </button>

        <div className="mentor-carousel" ref={scrollRef} onScroll={updateArrows}>
          {mentors.map((mentor) => (
            <MentorCardCompact key={mentor.id} mentor={mentor} />
          ))}
        </div>

        <button
          type="button"
          className={`carousel-arrow carousel-arrow-right${canScrollRight ? "" : " carousel-arrow-hidden"}`}
          onClick={() => handleScroll("right")}
          aria-label="次のカードへ"
          tabIndex={canScrollRight ? 0 : -1}
        >
          ›
        </button>
      </div>
    </>
  );
}

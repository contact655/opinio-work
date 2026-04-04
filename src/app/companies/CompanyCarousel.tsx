"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useCallback } from "react";

const LOGO_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

function CompanyCard({ company }: { company: any }) {
  const jobCount = company.ow_jobs?.length || 0;
  const color = LOGO_COLORS[company.name.charCodeAt(0) % LOGO_COLORS.length];

  return (
    <Link
      href={`/companies/${company.id}`}
      className="block bg-white rounded-xl border border-card-border p-4 hover:shadow-lg transition-shadow cursor-pointer h-full"
    >
      {/* Logo + Name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full ${color} flex items-center justify-center text-white text-lg font-bold`}
            >
              {company.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate">
            {company.name}
          </h3>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {company.industry && (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded">
            {company.industry}
          </span>
        )}
        {company.phase && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] rounded">
            {company.phase}
          </span>
        )}
      </div>

      {/* Location & Job count */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        {company.location ? (
          <span className="flex items-center gap-1">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {company.location}
          </span>
        ) : (
          <span />
        )}
        {jobCount > 0 && (
          <span className="text-primary font-medium text-[11px] bg-primary/10 px-2 py-0.5 rounded-full">
            求人 {jobCount}件
          </span>
        )}
      </div>
    </Link>
  );
}

export default function CompanyCarousel({
  companies,
}: {
  companies: any[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, companies]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    // 1カードの幅（gap込み）× 3枚分
    const cardWidth = el.querySelector<HTMLElement>(":scope > div")?.offsetWidth || 220;
    const gap = 16;
    const distance = (cardWidth + gap) * 3;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="前へ"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="次へ"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Cards container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {companies.map((c: any) => (
          <div
            key={c.id}
            className="flex-shrink-0 w-[calc((100%-2rem)/3)] min-w-[220px] snap-start"
          >
            <CompanyCard company={c} />
          </div>
        ))}
      </div>
    </div>
  );
}

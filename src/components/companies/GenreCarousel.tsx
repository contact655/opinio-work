'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CompanyCardCompact } from './CompanyCardCompact';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  companies: CompanyForCarousel[];
};

export function GenreCarousel({ companies }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [companies]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (companies.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-500">このジャンルの企業は準備中です</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* 左矢印（カードの外側） */}
      <button
        onClick={() => scroll('left')}
        disabled={!canScrollLeft}
        className="flex-shrink-0 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="前へ"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* スクロール領域 */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide flex-1 min-w-0"
      >
        {companies.map((company) => (
          <div key={company.id} className="flex-shrink-0 w-[220px] snap-start">
            <CompanyCardCompact company={company} />
          </div>
        ))}
      </div>

      {/* 右矢印（カードの外側） */}
      <button
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
        className="flex-shrink-0 w-9 h-9 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="次へ"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

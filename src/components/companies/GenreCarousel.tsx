"use client";

// CSS grid + scroll-snap カルーセル（矢印ナビゲーション付き）
// Client Component: 矢印ボタンの enabled/disabled 状態管理のため

import { useRef, useState, useEffect, useCallback } from 'react';
import { CompanyCardCompact } from './CompanyCardCompact';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  companies: CompanyForCarousel[];
};

export function GenreCarousel({ companies }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // スクロール位置に応じて矢印の有効/無効を更新
  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  // マウント時 & リサイズ時に初期状態を設定
  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  // カード1枚分（幅 + gap 14px）スクロール
  function handleScroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.children[0] as HTMLElement | undefined;
    const cardWidth = firstCard ? firstCard.offsetWidth + 14 : 280;
    el.scrollBy({ left: direction === 'right' ? cardWidth : -cardWidth, behavior: 'smooth' });
  }

  if (companies.length === 0) {
    return (
      <div style={{
        background: '#f8fafc',
        borderRadius: 8,
        padding: '12px 16px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>このジャンルの企業は準備中です</p>
      </div>
    );
  }

  return (
    <>

      {/* カルーセルラッパー（矢印の基準となる position:relative） */}
      <div style={{ position: 'relative' }}>

        {/* 左矢印 */}
        <button
          type="button"
          className={`carousel-arrow carousel-arrow-left${canScrollLeft ? '' : ' carousel-arrow-hidden'}`}
          onClick={() => handleScroll('left')}
          aria-label="前のカードへ"
          tabIndex={canScrollLeft ? 0 : -1}
        >
          ‹
        </button>

        {/* スクロール本体 */}
        <div
          className="genre-carousel"
          ref={scrollRef}
          onScroll={updateArrows}
        >
          {companies.map((company) => (
            <CompanyCardCompact key={company.id} company={company} />
          ))}
        </div>

        {/* 右矢印 */}
        <button
          type="button"
          className={`carousel-arrow carousel-arrow-right${canScrollRight ? '' : ' carousel-arrow-hidden'}`}
          onClick={() => handleScroll('right')}
          aria-label="次のカードへ"
          tabIndex={canScrollRight ? 0 : -1}
        >
          ›
        </button>
      </div>
    </>
  );
}

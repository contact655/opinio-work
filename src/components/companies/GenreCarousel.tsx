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
      <style>{`
        /* ── カルーセル本体 ─────────────────────────────────────── */
        .genre-carousel {
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
        .genre-carousel::-webkit-scrollbar { height: 6px; }
        .genre-carousel::-webkit-scrollbar-thumb {
          background: #e6e9ef;
          border-radius: 3px;
        }
        .genre-carousel > * { scroll-snap-align: start; }

        @media (max-width: 640px) {
          /* モバイル: 1.2列 + 右peek でスワイプ感を出す */
          .genre-carousel {
            grid-auto-columns: calc((100% - 14px) / 1.2);
            padding-right: 24px;
          }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .genre-carousel { grid-auto-columns: calc((100% - 14px) / 2); }
        }
        @media (min-width: 1025px) and (max-width: 1280px) {
          .genre-carousel { grid-auto-columns: calc((100% - 14px * 2) / 3); }
        }
        @media (min-width: 1281px) {
          .genre-carousel { grid-auto-columns: calc((100% - 14px * 3) / 4); }
        }

        /* ── カードスタイル ──────────────────────────────────────── */
        .genre-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
          height: 100%;
          will-change: transform;
        }
        .genre-card:hover {
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.12);
          transform: translateY(-10px) scale(1.01);
        }
        .genre-card:active {
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.08);
          transform: translateY(-2px) scale(0.98);
          transition-duration: 0.06s;
        }

        /* ── 矢印ボタン ─────────────────────────────────────────── */
        .carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(calc(-50% - 4px)); /* スクロールバー分だけ上に補正 */
          z-index: 10;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1a1d24;
          font-size: 18px;
          line-height: 1;
          padding: 0;
          transition: opacity 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          pointer-events: auto;
          user-select: none;
        }
        .carousel-arrow:hover {
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
          border-color: #cbd5e1;
        }
        .carousel-arrow:active {
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.10);
          transform: translateY(calc(-50% - 4px)) scale(0.94);
        }
        .carousel-arrow-left  { left: 8px; }
        .carousel-arrow-right { right: 8px; }
        .carousel-arrow-hidden {
          opacity: 0;
          pointer-events: none;
        }
        /* モバイルでは矢印を非表示（スワイプで代替） */
        @media (max-width: 640px) {
          .carousel-arrow { display: none; }
        }
      `}</style>

      {/* カルーセルラッパー（矢印の基準となる position:relative） */}
      <div style={{ position: 'relative' }}>

        {/* 左矢印 */}
        <button
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

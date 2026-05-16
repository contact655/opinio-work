// CSS grid + scroll-snap カルーセル（矢印ボタン廃止、peek デザイン）
// 状態管理不要のため Server Component として実装

import { CompanyCardCompact } from './CompanyCardCompact';
import type { CompanyForCarousel } from '@/types/genre';

type Props = {
  companies: CompanyForCarousel[];
};

export function GenreCarousel({ companies }: Props) {
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
      {/*
        .genre-carousel: CSS grid によるカルーセル
          - grid-auto-flow: column で横並びアイテムを grid で管理
          - grid-auto-columns: 5列分の幅計算（gap 14px × 4 + peek 32px を除いた残りの 1/5）
          - padding-right: 32px → 右端で次カードが覗く「peek」効果
          - scroll-snap-type: x mandatory で 1 カードずつスナップ

        .genre-card: カード全体にホバーアニメーション
          - transform: translateY(-2px) + shadow 強調
          - GenreCarousel 内で定義し、CompanyCardCompact から className="genre-card" で参照

        レスポンシブ (media query):
          - < 640px:        1.2 列（次のカードを少し覗かせる）
          - 641–1024px:     2.5 列
          - 1025–1280px:    3 列
          - ≥ 1281px:       5 列（デスクトップ基準）
      */}
      <style>{`
        .genre-carousel {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: calc((100% - 14px * 3 - 32px) / 4);
          gap: 14px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-right: 32px;
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
          .genre-carousel {
            grid-auto-columns: calc((100% - 14px - 32px) / 1.2);
          }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .genre-carousel {
            grid-auto-columns: calc((100% - 14px * 2 - 32px) / 2.5);
          }
        }
        @media (min-width: 1025px) and (max-width: 1280px) {
          .genre-carousel {
            grid-auto-columns: calc((100% - 14px * 2 - 32px) / 3);
          }
        }
        @media (min-width: 1281px) {
          .genre-carousel {
            grid-auto-columns: calc((100% - 14px * 3 - 32px) / 4);
          }
        }

        /* カードスタイル（CompanyCardCompact から className="genre-card" で参照） */
        .genre-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04);
          text-decoration: none;
          color: inherit;
          transition: box-shadow 0.18s ease, transform 0.18s ease;
          cursor: pointer;
          height: 100%;
        }
        .genre-card:hover {
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06);
          transform: translateY(-2px);
        }
      `}</style>

      <div className="genre-carousel">
        {companies.map((company) => (
          <CompanyCardCompact key={company.id} company={company} />
        ))}
      </div>
    </>
  );
}

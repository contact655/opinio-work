"use client";

/**
 * LogoWall — 掲載企業ロゴを正方形カードで一覧表示
 *
 * 特徴:
 * - 全カードを同一サイズの正方形（aspect-ratio: 1/1）に統一
 * - 白背景 + 薄いボーダー（Databricksカードスタイル）
 * - ロゴは object-fit: contain で原色表示、最大幅 62% / 最大高さ 42%
 * - 画像読み込み失敗はグラデーション + イニシャルにフォールバック
 * - 空要素 (id/name なし) は自動除外
 * - PC: 6列 / タブレット: 4列 / モバイル: 3列 / 小モバイル: 2列
 */

import { useState } from "react";
import Link from "next/link";

export type LogoWallCompany = {
  id: string;
  slug?: string | null;
  name: string;
  logoUrl: string | null;
  letter: string;
  gradient: string;
};

type Props = {
  companies: LogoWallCompany[];
};

export function LogoWall({ companies }: Props) {
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const handleError = (id: string) => {
    setErrors((prev) => new Set(Array.from(prev).concat(id)));
  };

  // 空要素（id/name 欠損）を除外
  const valid = companies.filter((c) => c.id && c.name);

  return (
    <>
      <div className="logo-wall-grid">
        {valid.map((c) => {
          const showLogo = c.logoUrl && !errors.has(c.id);
          return (
            <Link
              key={c.id}
              href={`/companies/${c.slug ?? c.id}`}
              className="logo-wall-card"
              title={c.name}
            >
              {showLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logoUrl!}
                  alt={c.name}
                  className="logo-wall-img"
                  onError={() => handleError(c.id)}
                />
              ) : (
                // グラデーションは動的データのため inline style を使用
                <div
                  className="logo-wall-fallback"
                  style={{ background: c.gradient }}
                >
                  {c.letter}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <style>{`
        /* ── Grid ── */
        .logo-wall-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }
        @media (max-width: 1023px) {
          .logo-wall-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 639px) {
          .logo-wall-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 399px) {
          .logo-wall-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* ── Card ── */
        .logo-wall-card {
          aspect-ratio: 1 / 1;
          background: #ffffff;
          border: 1px solid #ececec;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          overflow: hidden;
          transition: box-shadow 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
        }
        .logo-wall-card:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.09);
          border-color: var(--royal-100, #dce5f7);
          transform: translateY(-2px);
        }

        /* ── Logo image ── */
        .logo-wall-img {
          display: block;
          object-fit: contain;
          max-width: 62%;
          max-height: 42%;
          width: auto;
          height: auto;
        }

        /* ── Fallback (no logo) ── */
        .logo-wall-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
          border-radius: 13px;
          font-family: var(--font-inter, Inter, sans-serif);
        }
      `}</style>
    </>
  );
}

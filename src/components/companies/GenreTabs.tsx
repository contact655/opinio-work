"use client";

// ジャンルタブ — クリックで切り替え表示
// Server から genresWithCompanies を受け取り、Client でタブ状態を管理

import { useState } from "react";
import Link from "next/link";
import { GenreCarousel } from "./GenreCarousel";
import type { GenreWithCompanies } from "@/types/genre";

type Props = {
  genres: GenreWithCompanies[];
};

// ジャンルごとのアイコン・カラー設定（slugはDBの ow_genres.slug に対応）
const GENRE_CONFIG: Record<string, { icon: string; color: string; bg: string; activeBg: string }> = {
  // 既存8ジャンル
  "foreign-capital":  { icon: "🌍", color: "#0D9488", bg: "#F0FDFA",  activeBg: "linear-gradient(135deg, #0F766E, #0D9488)" },
  "horizontal-saas":  { icon: "🔗", color: "#4F46E5", bg: "#EEF2FF",  activeBg: "linear-gradient(135deg, #3730A3, #4F46E5)" },
  "vertical-saas":    { icon: "🏗️", color: "#002366", bg: "#EFF3FC",  activeBg: "linear-gradient(135deg, #002366, #3B5FD9)" },
  "mega-venture":     { icon: "🚀", color: "#DC2626", bg: "#FEE2E2",  activeBg: "linear-gradient(135deg, #B91C1C, #DC2626)" },
  "early-stage":      { icon: "🌱", color: "#059669", bg: "#ECFDF5",  activeBg: "linear-gradient(135deg, #047857, #059669)" },
  "ai-llm":           { icon: "🤖", color: "#0891B2", bg: "#ECFEFF",  activeBg: "linear-gradient(135deg, #0E7490, #0891B2)" },
  "dx-consulting":    { icon: "📊", color: "#7C3AED", bg: "#F3E8FF",  activeBg: "linear-gradient(135deg, #6D28D9, #7C3AED)" },
  "ipo-ready":        { icon: "📈", color: "#D97706", bg: "#FEF3C7",  activeBg: "linear-gradient(135deg, #B45309, #D97706)" },
  // Migration 122 で追加する4ジャンル
  "hrtech":           { icon: "👥", color: "#059669", bg: "#ECFDF5",  activeBg: "linear-gradient(135deg, #047857, #059669)" },
  "fintech":          { icon: "💰", color: "#D97706", bg: "#FEF3C7",  activeBg: "linear-gradient(135deg, #B45309, #D97706)" },
  "edtech":           { icon: "📚", color: "#0284C7", bg: "#E0F2FE",  activeBg: "linear-gradient(135deg, #0369A1, #0284C7)" },
  "ma-investment":    { icon: "🤝", color: "#9333EA", bg: "#FAF5FF",  activeBg: "linear-gradient(135deg, #7E22CE, #9333EA)" },
};

function getGenreConfig(slug: string) {
  return GENRE_CONFIG[slug] ?? { icon: "🏢", color: "#002366", bg: "#EFF3FC", activeBg: "linear-gradient(135deg, #002366, #3B5FD9)" };
}

function GenreSectionHeader({ genre }: { genre: GenreWithCompanies }) {
  const cfg = getGenreConfig(genre.slug);
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* アイコン付きカラーバー */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: cfg.bg,
          border: `1px solid ${cfg.color}22`,
          fontSize: 16,
        }}>
          {cfg.icon}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
          {genre.name}
        </span>
        {(genre.description || genre.total_count > 0) && (
          <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 400 }}>
            {genre.description && genre.description}
            {genre.description && genre.total_count > 0 && " ・ "}
            {genre.total_count > 0 && `${genre.total_count}社`}
          </span>
        )}
      </div>
      {genre.total_count > 0 && (
        <Link
          href={`/companies?genre=${genre.slug}`}
          style={{ fontSize: 13, color: cfg.color, textDecoration: "none", flexShrink: 0, fontWeight: 500 }}
        >
          すべて見る →
        </Link>
      )}
    </div>
  );
}

export function GenreTabs({ genres }: Props) {
  // 複数選択対応: string[] で管理。空配列 = 全表示
  const [activeIds, setActiveIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    setActiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearAll = () => setActiveIds([]);

  const selectedGenres = activeIds.length > 0
    ? genres.filter((g) => activeIds.includes(g.id))
    : genres;

  const contentKey = [...activeIds].sort().join(",") || "all";

  if (!genres.length) return null;

  return (
    <>
      <style>{`
        /* タブバー */
        .genre-tab-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .genre-tab-bar::-webkit-scrollbar { display: none; }

        /* タブボタン */
        .genre-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.12s;
          flex-shrink: 0;
        }
        .genre-tab-btn:active { transform: scale(0.97); }

        /* タブカウントバッジ */
        .genre-tab-count {
          font-size: 11px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          padding: 1px 6px;
          border-radius: 100px;
        }
        .genre-tab-btn[data-active="false"] .genre-tab-count {
          background: var(--bg-tint);
          color: var(--ink-mute);
        }
        .genre-tab-btn[data-active="true"] .genre-tab-count {
          background: rgba(255,255,255,0.22);
          color: rgba(255,255,255,0.9);
        }

        /* コンテンツ切り替えアニメーション */
        @keyframes genreFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .genre-tab-content {
          animation: genreFadeIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* クリアボタン */
        .genre-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
          background: var(--error-soft);
          border: 1px solid var(--error);
          color: var(--error);
          transition: opacity 0.15s;
        }
        .genre-clear-btn:hover { opacity: 0.8; }
      `}</style>

      {/* タブバー */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="genre-tab-bar" role="tablist" aria-label="ジャンルで絞る" style={{ flex: 1 }}>
          {genres.map((genre) => {
            const isActive = activeIds.includes(genre.id);
            const cfg = getGenreConfig(genre.slug);
            return (
              <button
                key={genre.id}
                role="tab"
                aria-selected={isActive}
                data-active={String(isActive)}
                className="genre-tab-btn"
                onClick={() => toggle(genre.id)}
                style={isActive ? {
                  background: cfg.activeBg,
                  border: "1px solid transparent",
                  color: "#fff",
                  boxShadow: `0 4px 14px ${cfg.color}44`,
                } : {
                  background: cfg.bg,
                  border: `1px solid ${cfg.color}33`,
                  color: cfg.color,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{cfg.icon}</span>
                {genre.name}
                <span className="genre-tab-count">{genre.total_count}</span>
              </button>
            );
          })}
        </div>

        {/* 選択中のとき「クリア」ボタンを表示 */}
        {activeIds.length > 0 && (
          <button className="genre-clear-btn" onClick={clearAll} title="選択を解除">
            ✕ {activeIds.length}件選択中
          </button>
        )}
      </div>

      {/* コンテンツ */}
      <div key={contentKey} className="genre-tab-content" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 40 }}>
        {selectedGenres.map((genre) => (
          <div key={genre.id}>
            <GenreSectionHeader genre={genre} />
            <GenreCarousel companies={genre.companies} />
          </div>
        ))}
      </div>
    </>
  );
}

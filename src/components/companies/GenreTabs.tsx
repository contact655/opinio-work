"use client";

// ジャンルタブ — 特徴 / 業種 2段レイアウト
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
  // 特徴タブ
  "foreign-capital":  { icon: "🌍", color: "#0D9488", bg: "#F0FDFA",  activeBg: "linear-gradient(135deg, #0F766E, #0D9488)" },
  "startup":          { icon: "🦄", color: "#7C3AED", bg: "#F3E8FF",  activeBg: "linear-gradient(135deg, #6D28D9, #7C3AED)" },
  "mega-venture":     { icon: "🏢", color: "#DC2626", bg: "#FEE2E2",  activeBg: "linear-gradient(135deg, #B91C1C, #DC2626)" },
  "public-company":   { icon: "🏛", color: "#002366", bg: "#EFF3FC",  activeBg: "linear-gradient(135deg, #001233, #002366)" },
  // 業種タブ
  "hrtech":           { icon: "👥", color: "#059669", bg: "#ECFDF5",  activeBg: "linear-gradient(135deg, #047857, #059669)" },
  "fintech":          { icon: "💰", color: "#D97706", bg: "#FEF3C7",  activeBg: "linear-gradient(135deg, #B45309, #D97706)" },
  "edtech":           { icon: "📚", color: "#0284C7", bg: "#E0F2FE",  activeBg: "linear-gradient(135deg, #0369A1, #0284C7)" },
  "ai-llm":           { icon: "🤖", color: "#0891B2", bg: "#ECFEFF",  activeBg: "linear-gradient(135deg, #0E7490, #0891B2)" },
  "healthtech":       { icon: "🏥", color: "#059669", bg: "#ECFDF5",  activeBg: "linear-gradient(135deg, #047857, #059669)" },
  "martech":          { icon: "📣", color: "#EA580C", bg: "#FFF7ED",  activeBg: "linear-gradient(135deg, #C2410C, #EA580C)" },
  "proptech":         { icon: "🏠", color: "#D97706", bg: "#FEF3C7",  activeBg: "linear-gradient(135deg, #B45309, #D97706)" },
  "legaltech":        { icon: "⚖️", color: "#475569", bg: "#F1F5F9",  activeBg: "linear-gradient(135deg, #334155, #475569)" },
  "data-analytics":   { icon: "📊", color: "#7C3AED", bg: "#F3E8FF",  activeBg: "linear-gradient(135deg, #6D28D9, #7C3AED)" },
  "ec-distribution":  { icon: "🛒", color: "#0369A1", bg: "#E0F2FE",  activeBg: "linear-gradient(135deg, #0C4A6E, #0369A1)" },
  "ma-investment":    { icon: "📈", color: "#9333EA", bg: "#FAF5FF",  activeBg: "linear-gradient(135deg, #7E22CE, #9333EA)" },
  "business-dx":      { icon: "🔧", color: "#0891B2", bg: "#ECFEFF",  activeBg: "linear-gradient(135deg, #0E7490, #0891B2)" },
  // レガシー（表示はしないが config として残す）
  "horizontal-saas":  { icon: "🔗", color: "#4F46E5", bg: "#EEF2FF",  activeBg: "linear-gradient(135deg, #3730A3, #4F46E5)" },
  "vertical-saas":    { icon: "🏗️", color: "#002366", bg: "#EFF3FC",  activeBg: "linear-gradient(135deg, #002366, #3B5FD9)" },
  "early-stage":      { icon: "🌱", color: "#059669", bg: "#ECFDF5",  activeBg: "linear-gradient(135deg, #047857, #059669)" },
  "dx-consulting":    { icon: "📊", color: "#7C3AED", bg: "#F3E8FF",  activeBg: "linear-gradient(135deg, #6D28D9, #7C3AED)" },
  "ipo-ready":        { icon: "📈", color: "#D97706", bg: "#FEF3C7",  activeBg: "linear-gradient(135deg, #B45309, #D97706)" },
};

function getGenreConfig(slug: string) {
  return GENRE_CONFIG[slug] ?? { icon: "🏢", color: "#002366", bg: "#EFF3FC", activeBg: "linear-gradient(135deg, #002366, #3B5FD9)" };
}

// 特徴タブに表示するslug（表示順）
const FEATURE_SLUGS = ["foreign-capital", "startup", "mega-venture", "public-company"];


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
        {/* カラーアクセントバー */}
        <div style={{
          width: 4, height: 22, borderRadius: 2, flexShrink: 0,
          background: cfg.activeBg,
        }} />
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

  const contentKey = [...activeIds].sort().join(",") || "all";

  if (!genres.length) return null;

  // slugでindexしたマップ
  const genreBySlug = new Map(genres.map((g) => [g.slug, g]));

  // 特徴タブ: FEATURE_SLUGS 順でDBに存在するもの
  const featureGenres = FEATURE_SLUGS
    .map((slug) => genreBySlug.get(slug))
    .filter((g): g is GenreWithCompanies => g !== undefined);

  // コンテンツ表示用: 特徴ジャンルのみ（業種は除外）
  const allDisplayGenres = [...featureGenres];

  const selectedGenres = activeIds.length > 0
    ? allDisplayGenres.filter((g) => activeIds.includes(g.id))
    : allDisplayGenres;

  // 特徴ジャンルが存在するかチェック
  const hasFeature = featureGenres.length > 0;

  const renderTabRow = (rowGenres: GenreWithCompanies[]) =>
    rowGenres.map((genre) => {
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
          {genre.name}
          <span className="genre-tab-count">{genre.total_count}</span>
        </button>
      );
    });

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

        /* セクションラベル */
        .genre-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--ink-mute);
          text-transform: uppercase;
          margin-bottom: 6px;
          padding-left: 2px;
        }
      `}</style>

      {/* タブ2段 + クリアボタン */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* 特徴タブ行 */}
        {hasFeature && (
          <div style={{ marginBottom: 10 }}>
            <div className="genre-section-label">特徴</div>
            <div className="genre-tab-bar" role="tablist" aria-label="特徴で絞る">
              {renderTabRow(featureGenres)}
            </div>
          </div>
        )}

        {/* 選択中のとき「クリア」ボタン */}
        {activeIds.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button className="genre-clear-btn" onClick={clearAll} title="選択を解除">
              ✕ {activeIds.length}件選択中
            </button>
          </div>
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

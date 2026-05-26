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

export function GenreTabs({ genres }: Props) {
  const [activeId, setActiveId] = useState(genres[0]?.id ?? "");
  const active = genres.find((g) => g.id === activeId) ?? genres[0];

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
          padding: 8px 18px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, color 0.18s, border-color 0.18s, box-shadow 0.18s;
          flex-shrink: 0;
        }
        .genre-tab-btn[data-active="false"] {
          background: #fff;
          border: 1px solid var(--line);
          color: var(--ink);
        }
        .genre-tab-btn[data-active="false"]:hover {
          border-color: var(--royal-100);
          background: var(--royal-50);
          color: var(--royal);
        }
        .genre-tab-btn[data-active="true"] {
          background: linear-gradient(135deg, #002366, #3B5FD9);
          border: 1px solid transparent;
          color: #fff;
          box-shadow: 0 4px 14px rgba(0, 35, 102, 0.28);
        }

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
          background: rgba(255,255,255,0.2);
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
      `}</style>

      {/* タブバー */}
      <div className="genre-tab-bar" role="tablist" aria-label="ジャンルで絞る">
        {genres.map((genre) => (
          <button
            key={genre.id}
            role="tab"
            aria-selected={genre.id === activeId}
            data-active={String(genre.id === activeId)}
            className="genre-tab-btn"
            onClick={() => setActiveId(genre.id)}
          >
            {genre.name}
            <span className="genre-tab-count">{genre.total_count}</span>
          </button>
        ))}
      </div>

      {/* アクティブジャンルのコンテンツ */}
      {active && (
        <div key={activeId} className="genre-tab-content" style={{ marginTop: 24 }}>
          {/* セクションヘッダー */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 4, height: 20, borderRadius: 2, flexShrink: 0,
                background: "linear-gradient(180deg, var(--royal) 0%, var(--accent) 100%)",
              }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                {active.name}
              </span>
              {(active.description || active.total_count > 0) && (
                <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 400 }}>
                  {active.description && active.description}
                  {active.description && active.total_count > 0 && " ・ "}
                  {active.total_count > 0 && `${active.total_count}社`}
                </span>
              )}
            </div>
            {active.total_count > 0 && (
              <Link
                href={`/companies?genre=${active.slug}`}
                style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", flexShrink: 0 }}
              >
                すべて見る →
              </Link>
            )}
          </div>

          {/* カルーセル */}
          <GenreCarousel companies={active.companies} />
        </div>
      )}
    </>
  );
}

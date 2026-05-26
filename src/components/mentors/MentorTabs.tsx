"use client";

// カテゴリタブ切り替えメンターリスト（GenreTabs と同構造）

import { useState } from "react";
import { MentorCarousel } from "./MentorCarousel";
import type { CategoryWithMentors } from "@/lib/mentors";

type Props = {
  categories: CategoryWithMentors[];
};

export function MentorTabs({ categories }: Props) {
  // メンターが1名以上いるカテゴリのみ
  const active_categories = categories.filter((c) => c.mentors.length > 0);
  const [activeId, setActiveId] = useState(active_categories[0]?.id ?? "");
  const active = active_categories.find((c) => c.id === activeId) ?? active_categories[0];

  if (!active_categories.length) return null;

  return (
    <>
      <style>{`
        .mentor-tab-bar {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .mentor-tab-bar::-webkit-scrollbar { display: none; }

        .mentor-tab-btn {
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
        .mentor-tab-btn[data-active="false"] {
          background: #fff;
          border: 1px solid var(--line);
          color: var(--ink);
        }
        .mentor-tab-btn[data-active="false"]:hover {
          border-color: var(--royal-100);
          background: var(--royal-50);
          color: var(--royal);
        }
        .mentor-tab-btn[data-active="true"] {
          background: linear-gradient(135deg, #002366, #3B5FD9);
          border: 1px solid transparent;
          color: #fff;
          box-shadow: 0 4px 14px rgba(0, 35, 102, 0.28);
        }
        .mentor-tab-count {
          font-size: 11px;
          font-weight: 700;
          font-family: Inter, sans-serif;
          padding: 1px 6px;
          border-radius: 100px;
        }
        .mentor-tab-btn[data-active="false"] .mentor-tab-count {
          background: var(--bg-tint);
          color: var(--ink-mute);
        }
        .mentor-tab-btn[data-active="true"] .mentor-tab-count {
          background: rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.9);
        }
        @keyframes mentorFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mentor-tab-content {
          animation: mentorFadeIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>

      {/* タブバー */}
      <div className="mentor-tab-bar" role="tablist" aria-label="相談カテゴリで絞る">
        {active_categories.map((cat) => (
          <button
            key={cat.id}
            role="tab"
            aria-selected={cat.id === activeId}
            data-active={String(cat.id === activeId)}
            className="mentor-tab-btn"
            onClick={() => setActiveId(cat.id)}
          >
            {cat.name}
            <span className="mentor-tab-count">{cat.mentors.length}</span>
          </button>
        ))}
      </div>

      {/* アクティブカテゴリのコンテンツ */}
      {active && (
        <div key={activeId} className="mentor-tab-content" style={{ marginTop: 24 }}>
          {/* セクションヘッダー */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 4, height: 20, borderRadius: 2, flexShrink: 0,
                background: "linear-gradient(180deg, var(--royal) 0%, var(--accent) 100%)",
              }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                {active.name}
              </span>
              {active.description && (
                <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 400 }}>
                  {active.description}
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                · {active.mentors.length}名
              </span>
            </div>
          </div>

          {/* カルーセル */}
          <MentorCarousel mentors={active.mentors} />
        </div>
      )}
    </>
  );
}

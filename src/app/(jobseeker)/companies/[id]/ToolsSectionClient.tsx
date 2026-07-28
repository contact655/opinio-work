"use client";

import { useState } from "react";
import type { CompanyTool } from "@/lib/supabase/queries";
import {
  TOOL_CATEGORY_ORDER,
  TOOL_CATEGORY_ICONS,
  TOOL_CATEGORY_LABELS,
} from "@/lib/utils/toolCfg";
import { InfoCard } from "./InfoCard";

const VISIBLE_MAX = 10;

type Props = { tools: CompanyTool[] };

export default function ToolsSectionClient({ tools }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;


  // カテゴリ順 → カテゴリ内 master_sort_order → sort_order でフラット並び替え
  const catRank = new Map(TOOL_CATEGORY_ORDER.map((c, i) => [c, i]));
  const sorted = [...tools].sort((a, b) => {
    const catDiff = (catRank.get(a.category) ?? 99) - (catRank.get(b.category) ?? 99);
    if (catDiff !== 0) return catDiff;
    return a.master_sort_order - b.master_sort_order || a.sort_order - b.sort_order;
  });

  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_MAX);
  const hiddenCount = sorted.length - VISIBLE_MAX;

  return (
    <>
      <style>{`
        .tools-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
      `}</style>
      <div className="tools-card-grid">
        {visible.map((tool) => {
          const iconDef = TOOL_CATEGORY_ICONS[tool.category as keyof typeof TOOL_CATEGORY_ICONS];
          const categoryLabel = TOOL_CATEGORY_LABELS[tool.category as keyof typeof TOOL_CATEGORY_LABELS];
          if (!iconDef) return null;

          const icon = (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: iconDef.svgContent }}
            />
          );

          return (
            <InfoCard
              key={tool.id}
              icon={icon}
              label={tool.name}
              sublabel={tool.note || categoryLabel}
              color={iconDef.color}
              bg={iconDef.bg}
              border={iconDef.border}
            />
          );
        })}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          すべてのツールを見る（残り {hiddenCount} 件）
        </button>
      )}
    </>
  );
}

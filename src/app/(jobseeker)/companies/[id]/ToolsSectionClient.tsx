"use client";

import { useState } from "react";
import type { CompanyTool } from "@/lib/supabase/queries";
import {
  TOOL_CATEGORY_ICONS,
  TOOL_CATEGORY_LABELS,
  CATEGORY_TO_GROUP,
  GROUP_ORDER,
  GROUP_DEFS,
  type GroupSlug,
  type CategorySlug,
} from "@/lib/utils/toolCfg";
import { InfoCard } from "./InfoCard";
import { ShowMoreButton } from "./ShowMoreButton";

const GROUP_MAX = 6;

type Props = { tools: CompanyTool[] };

/* 最初に表示するグループ数。
   ⚠️ 2026-08-13 に 3 → 2。取材の進んだ1社だけ全グループが展開され、
      ページ長の差が「情報量の差」に見えていた。畳むだけで内容は減らさない。 */
const VISIBLE_GROUPS = 2;

export default function ToolsSectionClient({ tools }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<GroupSlug>>(new Set());
  const [showAllGroups, setShowAllGroups] = useState(false);

  if (tools.length === 0) return null;

  const toggleGroup = (slug: GroupSlug) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // グループ別にツールを振り分け（master_sort_order → sort_order 順）
  const grouped = new Map<GroupSlug, CompanyTool[]>();
  for (const slug of GROUP_ORDER) grouped.set(slug, []);

  const sorted = [...tools].sort(
    (a, b) => a.master_sort_order - b.master_sort_order || a.sort_order - b.sort_order
  );
  for (const tool of sorted) {
    const groupSlug = CATEGORY_TO_GROUP[tool.category as CategorySlug];
    if (groupSlug) grouped.get(groupSlug)?.push(tool);
  }

  // 実際にツールがあるグループだけ抽出
  const activeGroups = GROUP_ORDER.filter((slug) => (grouped.get(slug)?.length ?? 0) > 0);
  const visibleGroups = showAllGroups ? activeGroups : activeGroups.slice(0, VISIBLE_GROUPS);
  const hiddenGroupCount = activeGroups.length - VISIBLE_GROUPS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {visibleGroups.map((groupSlug) => {
        const groupTools = grouped.get(groupSlug) ?? [];
        if (groupTools.length === 0) return null;

        const def = GROUP_DEFS[groupSlug];
        const isExpanded = expandedGroups.has(groupSlug);
        const visible = isExpanded ? groupTools : groupTools.slice(0, GROUP_MAX);
        const hiddenCount = groupTools.length - GROUP_MAX;
        const showSublabel = def.categories.length > 1;

        return (
          <div
            key={groupSlug}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* グループヘッダー */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                background: "var(--bg-tint)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: def.iconDef.bg,
                  border: `1px solid ${def.iconDef.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: def.iconDef.color,
                  flexShrink: 0,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dangerouslySetInnerHTML={{ __html: def.iconDef.svgContent }}
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                {def.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  marginLeft: "auto",
                }}
              >
                {groupTools.length}件
              </span>
            </div>

            {/* カード群 */}
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {visible.map((tool) => {
                const iconDef = TOOL_CATEGORY_ICONS[tool.category as CategorySlug];
                const categoryLabel = TOOL_CATEGORY_LABELS[tool.category as CategorySlug];
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
                  <div key={tool.id} style={{ minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
                    <InfoCard
                      icon={icon}
                      label={tool.name}
                      sublabel={showSublabel ? (tool.note || categoryLabel) : (tool.note || undefined)}
                      color={iconDef.color}
                      bg={iconDef.bg}
                      border={iconDef.border}
                    />
                  </div>
                );
              })}
            </div>

            {!isExpanded && hiddenCount > 0 && (
              <ShowMoreButton
                variant="expand"
                label={`+${hiddenCount}件を見る`}
                expanded={false}
                onClick={() => toggleGroup(groupSlug)}
                wrapperStyle={{ padding: "0 16px 14px" }}
              />
            )}
          </div>
        );
      })}

      {!showAllGroups && hiddenGroupCount > 0 && (
        <ShowMoreButton
          variant="expand"
          label={`すべて見る（残り ${hiddenGroupCount}）`}
          expanded={false}
          onClick={() => setShowAllGroups(true)}
          wrapperStyle={{ marginTop: 4 }}
        />
      )}
      {showAllGroups && activeGroups.length > VISIBLE_GROUPS && (
        <ShowMoreButton
          variant="expand"
          label="折りたたむ"
          expanded={true}
          onClick={() => setShowAllGroups(false)}
          wrapperStyle={{ marginTop: 4 }}
        />
      )}
    </div>
  );
}

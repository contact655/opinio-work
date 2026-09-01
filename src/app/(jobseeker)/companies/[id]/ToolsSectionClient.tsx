"use client";

import { useState } from "react";
import type { CompanyTool } from "@/lib/supabase/queries";
import {
  TOOL_CATEGORY_ICONS,
  CATEGORY_TO_GROUP,
  GROUP_ORDER,
  GROUP_DEFS,
  type GroupSlug,
  type CategorySlug,
} from "@/lib/utils/toolCfg";
import { HoverNoteCard } from "@/components/companies/HoverNoteCard";
import { CHIP_STYLES } from "@/lib/utils/chipVariant";
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

        return (
          <div
            key={groupSlug}
            /* ⚠️★**`overflow: hidden` を戻さないこと**（2026-09-02 に外した）。
                  角丸のためにヘッダー背景を切る目的だったが、**note のふきだしが
                  カードの下にはみ出す形なので、下端で切り取られていた**（実測で
                  高さ61pxのうち見えていたのは一部）。角丸はヘッダー側に
                  `borderRadius: "11px 11px 0 0"` を指定して保つ（枠線1px のぶん内側なので 11）。 */
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
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
                /* ⚠️ 親の `overflow: hidden` を外したので、ここで角を丸める。
                      外枠 12px の内側なので 11px。 */
                borderRadius: "11px 11px 0 0",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: CHIP_STYLES.neutral.bg,
                  border: `1px solid ${CHIP_STYLES.neutral.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: CHIP_STYLES.neutral.color,
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
                    {/* ⚠️★**カテゴリ名を2行目に落とさないこと**（2026-09-02 に `|| categoryLabel` を削除）。
                           グループ見出しがすぐ上にあるので、「開発」「コミュニケーション」を
                           カードにも出すと**同じことを2回言うだけ**になる。しかも本物の `note` と
                           同じ見た目で並ぶので、全体が「読まなくていい行」に見えていた。
                           実測（2026-09-02 / 本番14件）: note があるのは **4件**だけ。

                        ⚠️★**note は常時表示にしないこと**（2026-09-02 / 柴さん）。
                           note を持つカードだけ背が高くなり、行の中で **82 / 61 / 52px** と
                           凸凹していた（実測）。畳めば全カードが1行になり高さが揃う。
                           ⚠️ **福利厚生（`BenefitCard`）と同じにしないこと。** あちらの括弧内は
                              「月1万円まで」のような**判断に効く値**で59%が持っているので
                              常時表示のまま。**性質が違うので扱いが違う。**

                        ⚠️ 色はカテゴリで出し分けない（2026-08-23）。ツールは金銭条件ではないので
                           neutral 固定。以前は緑・黄・紫が意味なく付いていた。 */}
                    <HoverNoteCard
                      icon={icon}
                      label={tool.name}
                      note={tool.note}
                      variant="neutral"
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

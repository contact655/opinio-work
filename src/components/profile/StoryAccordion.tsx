"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type StoryType = "image" | "video" | "card" | "link";

// A-3 Commit C: セクション型
type StorySection = {
  id: string;
  experience_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type Story = {
  id: string;
  experience_id: string;
  section_id: string | null;   // A-3 Commit C: セクション帰属（null = 未分類）
  type: StoryType;
  title: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  og_image_url: string | null;  // 段階6-5: link type OGP プレビュー用
  og_title: string | null;      // 段階6-5: link type OGP プレビュー用
  period_start: string | null;  // "YYYY-MM-DD" from DB
  period_end: string | null;    // "YYYY-MM-DD" from DB
  sort_order: number;
};

type StoryDraft = {
  section_id: string | null;   // A-3 Commit C: null = 未分類
  type: StoryType;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  link_url: string;
  period_start: string;  // "YYYY-MM" for <input type="month">
  period_end: string;    // "YYYY-MM" for <input type="month">
};

const EMPTY_DRAFT: StoryDraft = {
  section_id: null,
  type: "card",
  title: "",
  description: "",
  image_url: "",
  video_url: "",
  link_url: "",
  period_start: "",
  period_end: "",
};

function draftFromStory(s: Story): StoryDraft {
  return {
    section_id: s.section_id ?? null,
    type: s.type,
    title: s.title ?? "",
    description: s.description ?? "",
    image_url: s.image_url ?? "",
    video_url: s.video_url ?? "",
    link_url: s.link_url ?? "",
    // "YYYY-MM-DD" → "YYYY-MM" (slice 7 chars)
    period_start: s.period_start?.slice(0, 7) ?? "",
    period_end: s.period_end?.slice(0, 7) ?? "",
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

// API と同じ簡易マッチ(文字列含有チェック、完全な URL 構造バリデーションではない)。
// 今後厳密化する場合は API 側(/api/jobseeker/experience-stories/route.ts)と同期して変更すること。
const looksLikeYouTubeUrl = (url: string): boolean => /youtube\.com|youtu\.be/.test(url);

/** YouTube 動画 ID を URL から抽出。4 パターン対応: ?v= / youtu.be/ / shorts/ / embed/
 *  戻り値 null = 非 YouTube or 解析不能 → iframe 生成禁止（三層防御の第三層）
 */
function extractYouTubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([^&#]+)/) ??
    url.match(/youtu\.be\/([^?&#]+)/) ??
    url.match(/\/shorts\/([^?&#]+)/) ??
    url.match(/\/embed\/([^?&#]+)/);
  return m?.[1] ?? null;
}

function canSaveDraft(draft: StoryDraft): boolean {
  if (draft.type === "image") return !!draft.image_url.trim();
  if (draft.type === "video") {
    const url = draft.video_url.trim();
    return !!url && looksLikeYouTubeUrl(url);
  }
  if (draft.type === "link") return !!draft.link_url.trim();
  // card: title か description どちらか必須
  return !!(draft.title.trim() || draft.description.trim());
}

function makeBody(draft: StoryDraft, experienceId?: string): Record<string, unknown> {
  // "YYYY-MM" → "YYYY-MM-01" (project-wide convention; same as AchievementEditor / CareerHistoryEditor)
  const monthToDate = (s: string): string | null => (s ? `${s}-01` : null);
  const body: Record<string, unknown> = {
    type: draft.type,
    // A-3 Commit C: section_id を常に含める → PUT handler の hasSectionId=true が保証される
    // null = 未分類への移動、uuid = 指定セクションへの移動
    section_id: draft.section_id,
    title: draft.title.trim() || null,
    description: draft.description.trim() || null,
    image_url: draft.image_url.trim() || null,
    video_url: draft.video_url.trim() || null,
    link_url: draft.link_url.trim() || null,
    period_start: monthToDate(draft.period_start),
    period_end: monthToDate(draft.period_end),
  };
  if (experienceId) body.experience_id = experienceId;
  return body;
}

// ─── OGP fetch helper ─────────────────────────────────────────────────────────
// link type ストーリー保存時に呼ばれる。失敗は null で継続（段階6-5 判断点 2: 案 α）。

async function fetchOgp(url: string): Promise<{ og_image_url: string | null; og_title: string | null }> {
  try {
    const res = await fetch("/api/jobseeker/ogp-fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json() as { og_image_url?: string | null; og_title?: string | null };
      return {
        og_image_url: data.og_image_url ?? null,
        og_title: data.og_title ?? null,
      };
    }
    // 400 / 500 等の場合も null で継続（保存はブロックしない）
  } catch {
    // ネットワークエラー等も null で継続
  }
  return { og_image_url: null, og_title: null };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const formBoxStyle: React.CSSProperties = {
  background: "var(--bg-tint)",
  border: "1.5px solid var(--royal)",
  borderRadius: 10,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxShadow: "0 0 0 3px rgba(0,35,102,0.06)",
};

function inputStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: "1.5px solid var(--line)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 13,
    color: "var(--ink)",
    background: disabled ? "var(--bg-tint)" : "#fff",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
    opacity: disabled ? 0.6 : 1,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--ink-mute)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  };
}

// ─── DnD helper: GripHandle ──────────────────────────────────────────────────

function GripHandle(props: React.HTMLAttributes<HTMLSpanElement> & { visible: boolean }) {
  const { visible, ...rest } = props;
  return (
    <span
      {...rest}
      title="ドラッグして並べ替え"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        flexShrink: 0,
        cursor: "grab",
        color: "var(--ink-mute)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.15s",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* 6-dot grip (2×3) */}
      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
        <circle cx="2" cy="2" r="1.3" /><circle cx="6" cy="2" r="1.3" />
        <circle cx="2" cy="6" r="1.3" /><circle cx="6" cy="6" r="1.3" />
        <circle cx="2" cy="10" r="1.3" /><circle cx="6" cy="10" r="1.3" />
      </svg>
    </span>
  );
}

// ─── DnD helper: buildNewStoriesAfterDrag ─────────────────────────────────────
//
// onDragOver が active story の section_id を更新済みの前提で呼ばれる。
// activeContainerId = active story の現在のコンテナ（onDragOver 後）
// overId           = drop 先のストーリー ID（コンテナ ID の場合は末尾扱い）
// sections         = 現在のセクション配列（sort_order 順）
//
// 戻り値: 全ストーリーに clean sort_order（1,2,3…）を振り直した新配列

function buildNewStoriesAfterDrag(
  currentStories: Story[],
  sections: StorySection[],
  activeId: string,
  overId: string,
  activeContainerId: string,  // section UUID or "uncategorized"
): Story[] {
  // コンテナ → ID 配列（sort_order 順）マップを構築
  const containers: Record<string, string[]> = {};
  for (const sec of sections) {
    containers[sec.id] = currentStories
      .filter(s => s.section_id === sec.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => s.id);
  }
  containers["uncategorized"] = currentStories
    .filter(s => s.section_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(s => s.id);

  // コンテナ内 arrayMove（overId が story ID の場合）
  const container = containers[activeContainerId] ?? [];
  const oldIdx = container.indexOf(activeId);
  const newIdx = container.indexOf(overId);
  if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
    containers[activeContainerId] = arrayMove(container, oldIdx, newIdx);
  }
  // overId がコンテナ ID など story 以外の場合 → 末尾に残す（onDragOver で既に末尾）

  // 全ストーリーを視覚順で再採番 (1, 2, 3 …)
  const storyMap = new Map(currentStories.map(s => [s.id, s]));
  const result: Story[] = [];
  let order = 1;

  for (const sec of sections) {
    for (const id of (containers[sec.id] ?? [])) {
      const s = storyMap.get(id);
      if (s) result.push({ ...s, sort_order: order++, section_id: sec.id });
    }
  }
  for (const id of (containers["uncategorized"] ?? [])) {
    const s = storyMap.get(id);
    if (s) result.push({ ...s, sort_order: order++, section_id: null });
  }
  return result;
}

// ─── Type badge config ────────────────────────────────────────────────────────

/* ⚠️ **タイプごとに色を変えない**（2026-09-02 に4色 → 1色）。
      ラベルに "image" / "video" と**そのまま書いてある**ので、色は意味を足していない。
      足していないのに、黄色（＝注意・未完了）と紫（＝求職者側では使わない色）を
      借りていた。凡例の無い色分けは増やさない、という ui-conventions の原則どおり
      neutral に寄せる。TypeSelector の「選択中」は tint と枠と文字色で示すので、
      4色が1色になっても選択状態は見分けられる。 */
const TYPE_CONFIG: Record<StoryType, { label: string; bg: string; color: string }> = {
  image: { label: "image", bg: "var(--royal-50)", color: "var(--royal)" },
  video: { label: "video", bg: "var(--royal-50)", color: "var(--royal)" },
  card:  { label: "card",  bg: "var(--royal-50)", color: "var(--royal)" },
  link:  { label: "link",  bg: "var(--royal-50)", color: "var(--royal)" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: StoryType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-inter), var(--font-noto)",
        letterSpacing: "0.06em",
        padding: "2px 6px",
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        flexShrink: 0,
        lineHeight: 1.6,
      }}
    >
      {cfg.label}
    </span>
  );
}

function IconBtn({
  onClick, title, danger, children,
}: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: 26,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none",
        background: hovered ? (danger ? "var(--error-soft)" : "var(--line-soft)") : "transparent",
        borderRadius: 5, fontSize: 13,
        color: danger ? "var(--error)" : "var(--ink-mute)",
        cursor: "pointer", transition: "background 0.12s",
        padding: 0, fontFamily: "inherit", flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** "YYYY-MM-DD" → "YYYY年M月" */
function formatYearMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}年${parseInt(m)}月`;
}

/** period_start / period_end をまとめて "YYYY年M月 〜 YYYY年M月" 形式で返す。両方 null なら null */
function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatYearMonth(start)} 〜 ${formatYearMonth(end)}`;
  if (start) return `${formatYearMonth(start)} 〜`;
  return `〜 ${formatYearMonth(end!)}`;
}

/** URL を最大 N 文字で省略表示 */
function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

/** URL からドメイン名を取得（www. を除去）。パース失敗時は null。 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function StoryCard({
  story, onEdit, onDelete, dragHandle,
}: {
  story: Story;
  onEdit: () => void;
  onDelete: () => void;
  dragHandle?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const [hovered, setHovered] = useState(false);
  // image type: onError でフォールバック表示に切り替え
  const [imgBroken, setImgBroken] = useState(false);
  // link type: OGP 画像の読み込み失敗フォールバック（段階6-5 Phase 4）
  const [ogImgBroken, setOgImgBroken] = useState(false);

  // video の三層防御:
  //   1. 編集時: looksLikeYouTubeUrl でバリデーション済み(StoryForm)
  //   2. 表示時: looksLikeYouTubeUrl で再チェック
  //   3. extractYouTubeId の戻り値 null チェック → null なら iframe 生成禁止
  const youtubeId =
    story.type === "video" && story.video_url && looksLikeYouTubeUrl(story.video_url)
      ? extractYouTubeId(story.video_url)
      : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "8px 0", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>

        {/* Drag handle (hover reveal) */}
        {dragHandle && <GripHandle visible={hovered} {...dragHandle} />}

        {/* Left: full content column (TypeBadge+period → media → title/desc) */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header row: TypeBadge + period (inline) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <TypeBadge type={story.type} />
            {formatPeriod(story.period_start, story.period_end) && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                {formatPeriod(story.period_start, story.period_end)}
              </span>
            )}
          </div>

          {/* ── image type ───────────────────────────────────────────────── */}
          {story.type === "image" && (
            <>
              {/* 画像本体(title の上に配置 = Wantedly 的ビジュアルファースト) */}
              {story.image_url && !imgBroken && (
                <img
                  src={story.image_url}
                  alt={story.title ?? ""}
                  loading="lazy"
                  onError={() => setImgBroken(true)}
                  style={{
                    width: "100%", maxHeight: 200, objectFit: "cover",
                    borderRadius: 8, display: "block", marginBottom: 6,
                  }}
                />
              )}
              {story.title && (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                  {story.title}
                </div>
              )}
              {story.description && (
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {story.description}
                </div>
              )}
            </>
          )}

          {/* ── video type ───────────────────────────────────────────────── */}
          {story.type === "video" && (
            <>
              {youtubeId ? (
                /* 16:9 レスポンシブ iframe — YouTube のみ(三層防御クリア時) */
                <div
                  style={{
                    position: "relative", paddingTop: "56.25%",
                    marginBottom: 6, borderRadius: 8, overflow: "hidden", background: "#000",
                  }}
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={story.title ?? "動画"}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                /* 非 YouTube or ID 抽出失敗 → URL truncate テキストにフォールバック */
                story.video_url && (
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", wordBreak: "break-all", marginBottom: 4 }}>
                    {truncateUrl(story.video_url)}
                  </div>
                )
              )}
              {story.title && (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                  {story.title}
                </div>
              )}
              {story.description && (
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {story.description}
                </div>
              )}
            </>
          )}

          {/* ── card type ────────────────────────────────────────────────── */}
          {/* royal-50 背景のリッチカード。description は全文表示(truncate しない) */}
          {/* ※ card_color は DB フィールドなし → 固定色。技術的負債として handover 記録 */}
          {story.type === "card" && (
            <div
              style={{
                background: "var(--royal-50)",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {story.title && (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: story.description ? 4 : 0 }}>
                  {story.title}
                </div>
              )}
              {story.description && (
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                  {story.description}
                </div>
              )}
            </div>
          )}

          {/* ── link type ────────────────────────────────────────────────── */}
          {/* 段階6-5 Phase 4: OGP リッチカード表示。og_image_url / og_title が                         */}
          {/* null の既存ストーリーは displayTitle + domain のみ表示（漸進的移行 / 判断点 6）           */}
          {story.type === "link" && (() => {
            const ogImg = story.og_image_url;
            const showOgImg = !!ogImg && !ogImgBroken;
            // タイトル優先順: og_title → 手動タイトル → ドメイン名 → URL そのまま
            const displayTitle =
              story.og_title ||
              story.title ||
              extractDomain(story.link_url ?? "") ||
              story.link_url;
            const domain = extractDomain(story.link_url ?? "");

            return (
              <a
                href={story.link_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* OGP 画像（あれば表示。読み込み失敗で非表示に切り替え） */}
                {showOgImg && (
                  <img
                    src={ogImg}
                    alt=""
                    loading="lazy"
                    onError={() => setOgImgBroken(true)}
                    style={{
                      width: "100%",
                      maxHeight: 180,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                )}
                <div style={{ padding: "8px 10px" }}>
                  {/* タイトル（2 行まで。超過は省略表示） */}
                  {displayTitle && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                        marginBottom: domain ? 4 : 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {displayTitle}
                    </div>
                  )}
                  {/* ドメイン名（www. 除去済み） */}
                  {domain && (
                    <div
                      style={{
                        fontSize: 12, fontWeight: 500,
                        color: "var(--ink-mute)",
                        fontFamily: "var(--font-inter), var(--font-noto)",
                      }}
                    >
                      {domain}
                    </div>
                  )}
                </div>
              </a>
            );
          })()}
        </div>

        {/* Controls (hover reveal) — flexShrink: 0 でレイアウト崩れなし */}
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 1,
            opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0,
          }}
        >
          <IconBtn onClick={onEdit} title="編集">✎</IconBtn>
          <IconBtn onClick={onDelete} title="削除" danger>×</IconBtn>
        </div>
      </div>
    </div>
  );
}

// ─── TypeSelector ─────────────────────────────────────────────────────────────

function TypeSelector({
  value, onChange, disabled,
}: { value: StoryType; onChange: (t: StoryType) => void; disabled?: boolean }) {
  const types: StoryType[] = ["image", "video", "card", "link"];
  return (
    <div>
      <label style={labelStyle()}>タイプ *</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {types.map((t) => {
          const cfg = TYPE_CONFIG[t];
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => onChange(t)}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--font-inter), var(--font-noto)",
                letterSpacing: "0.05em",
                borderRadius: 6,
                border: selected ? `1.5px solid ${cfg.color}` : "1.5px solid var(--line)",
                background: selected ? cfg.bg : "#fff",
                color: selected ? cfg.color : "var(--ink-mute)",
                cursor: disabled ? "default" : "pointer",
                transition: "background 0.12s, border-color 0.12s, color 0.12s",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────
// セクション名のインライン編集 + 削除ボタン（justSaved パターン）。
// セクション削除は ConfirmDialog を経由（onDelete → 親がダイアログ表示）。
// ストーリー削除と異なり、セクション削除は配下ストーリーを全て「未分類」に移動させる
// インパクトが大きい操作のため、確認ダイアログが必要。

function SectionHeader({
  section,
  onSave,
  onDelete,
  dragHandle,
}: {
  section: StorySection;
  onSave: (id: string, name: string) => Promise<void>;
  onDelete: (section: StorySection) => void;
  dragHandle?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    // 変更なしの場合はそのまま閉じる
    if (!trimmed || trimmed === section.name) {
      setEditing(false);
      setName(section.name);
      return;
    }
    setSaving(true);
    try {
      await onSave(section.id, trimmed);
      setJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditing(false);
      setJustSaved(false);
    } catch {
      // toast は親コンポーネント(updateSectionName)が表示する
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 0 4px",
        borderBottom: "1.5px solid var(--line)",
        marginTop: 12,
        marginBottom: 4,
      }}
    >
      {editing ? (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { void handleSave(); }
              if (e.key === "Escape") { setEditing(false); setName(section.name); }
            }}
            maxLength={50}
            disabled={saving}
            autoFocus
            style={{
              flex: 1,
              border: "1.5px solid var(--royal)",
              borderRadius: 5,
              padding: "2px 7px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink)",
              background: "#fff",
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => { void handleSave(); }}
            style={{
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              background: justSaved ? "var(--success)" : !name.trim() ? "var(--ink-mute)" : "var(--royal)",
              color: "#fff",
              border: "none",
              borderRadius: 5,
              cursor: saving || !name.trim() ? "default" : "pointer",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            {saving ? "…" : justSaved ? "✓" : "保存"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setName(section.name); }}
            disabled={saving}
            style={{
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "transparent",
              color: "var(--ink-mute)",
              border: "1px solid var(--line)",
              borderRadius: 5,
              cursor: saving ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            取消
          </button>
        </>
      ) : (
        <>
          {/* Drag handle (hover reveal) */}
          {dragHandle && <GripHandle visible={hovered} {...dragHandle} />}
          <span
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-soft)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {section.name}
          </span>
          <div
            style={{
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.15s",
              display: "flex",
              gap: 1,
            }}
          >
            <IconBtn onClick={() => setEditing(true)} title="セクション名を編集">✎</IconBtn>
            <IconBtn onClick={() => onDelete(section)} title="セクションを削除" danger>×</IconBtn>
          </div>
        </>
      )}
    </div>
  );
}

// ─── StoryForm ────────────────────────────────────────────────────────────────

function StoryForm({
  draft,
  sections,
  onDraftChange,
  isSaving,
  justSaved,
  onSave,
  onCancel,
}: {
  draft: StoryDraft;
  sections: StorySection[];
  onDraftChange: (d: StoryDraft) => void;
  isSaving: boolean;
  justSaved?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = useCallback(
    (k: keyof StoryDraft, v: string | null) => onDraftChange({ ...draft, [k]: v }),
    [draft, onDraftChange]
  );

  // ── Image upload ─────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-selected after an error
      e.target.value = "";
      setFileErr(null);

      // Client-side MIME validation (matches policy in 093 migration)
      const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!ALLOWED_MIMES.includes(file.type)) {
        setFileErr("JPEG / PNG / WebP / GIF のみ対応しています");
        return;
      }
      // 5 MB limit (matches frontend spec in 093 migration comment)
      if (file.size > 5 * 1024 * 1024) {
        setFileErr("ファイルサイズは 5MB 以下にしてください");
        return;
      }

      setIsUploading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("認証が必要です。ページをリロードしてください。");

        const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        // Normalise extension so it aligns with actual MIME
        const EXT_MAP: Record<string, string> = {
          jpeg: "jpg", jpg: "jpg", png: "png", webp: "webp", gif: "gif",
        };
        const ext = EXT_MAP[rawExt] ?? rawExt;
        // Path: {auth_uid}/experience-stories/{uuid}.{ext}
        // auth_uid as 1st segment → existing ow_uploads_owner_delete/update policies cover this path
        const path = `${user.id}/experience-stories/${crypto.randomUUID()}.${ext}`;

        const { error: storageErr } = await supabase.storage
          .from("ow-uploads")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (storageErr) throw storageErr;

        const { data: { publicUrl } } = supabase.storage
          .from("ow-uploads")
          .getPublicUrl(path);
        set("image_url", publicUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "アップロードに失敗しました。もう一度お試しください。";
        setFileErr(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [set]
  );

  // 終了年月 < 開始年月 のとき invalid（両方入力されている場合のみチェック）
  const periodInvalid =
    !!draft.period_start && !!draft.period_end && draft.period_start > draft.period_end;

  const canSave = canSaveDraft(draft) && !isSaving && !isUploading && !periodInvalid;
  const effectivelyDisabled = !canSave || !!justSaved;

  return (
    <div style={formBoxStyle}>
      {/* Title — all types */}
      <div>
        <label style={labelStyle()}>
          タイトル（任意）
        </label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例：四半期最優秀賞を受賞した取り組み"
          maxLength={100}
          disabled={isSaving}
          style={inputStyle(isSaving)}
        />
      </div>

      {/* Period — all types */}
      <div>
        <label style={labelStyle()}>期間（任意）</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="month"
            value={draft.period_start}
            onChange={(e) => set("period_start", e.target.value)}
            disabled={isSaving}
            style={{ ...inputStyle(isSaving), flex: 1 }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", flexShrink: 0 }}>〜</span>
          <input
            type="month"
            value={draft.period_end}
            onChange={(e) => set("period_end", e.target.value)}
            disabled={isSaving}
            style={{ ...inputStyle(isSaving), flex: 1 }}
          />
        </div>
        {periodInvalid && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4 }}>
            終了年月は開始年月以降に設定してください
          </div>
        )}
      </div>

      {/* Type selector */}
      <TypeSelector
        value={draft.type}
        onChange={(t) => onDraftChange({ ...draft, type: t })}
        disabled={isSaving}
      />

      {/* Type-specific URL field */}
      {draft.type === "image" && (
        <div>
          <label style={labelStyle()}>画像 *</label>

          {/* 48px thumbnail preview — shown once image_url is set */}
          {draft.image_url && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={draft.image_url}
                alt=""
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                style={{
                  width: 48, height: 48,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1.5px solid var(--line)",
                  display: "block",
                }}
              />
            </div>
          )}

          {/* Upload button + hidden file input */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              disabled={isSaving || isUploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                border: "1.5px solid var(--line)",
                borderRadius: 7,
                background: "#fff",
                color: isUploading ? "var(--ink-mute)" : "var(--ink-soft)",
                cursor: isSaving || isUploading ? "default" : "pointer",
                opacity: isSaving ? 0.5 : 1,
                transition: "background 0.12s",
                flexShrink: 0,
              }}
            >
              {isUploading ? "アップロード中…" : "📎 ファイルを選択"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={(e) => { void handleFileChange(e); }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
              JPEG / PNG / WebP / GIF、5MB 以下
            </span>
          </div>

          {/* Upload error */}
          {fileErr && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginBottom: 6 }}>
              {fileErr}
            </div>
          )}

          {/* URL fallback input */}
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 6 }}>
            または URL を直接入力
          </div>
          <input
            type="url"
            value={draft.image_url}
            onChange={(e) => { setFileErr(null); set("image_url", e.target.value); }}
            placeholder="https://example.com/image.png"
            maxLength={1000}
            disabled={isSaving || isUploading}
            style={inputStyle(isSaving || isUploading)}
          />
        </div>
      )}

      {draft.type === "video" && (() => {
        const url = draft.video_url.trim();
        const hasInput = url.length > 0;
        const isValidYouTube = looksLikeYouTubeUrl(url);
        const showError = hasInput && !isValidYouTube;
        return (
          <div>
            <label style={labelStyle()}>YouTube URL *</label>
            <input
              type="url"
              value={draft.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              maxLength={1000}
              disabled={isSaving}
              style={{
                ...inputStyle(isSaving),
                borderColor: showError ? "var(--error)" : undefined,
              }}
            />
            {showError ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--error)", marginTop: 4 }}>
                YouTube の URL を入力してください（youtube.com または youtu.be）
              </div>
            ) : !hasInput ? (
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 4 }}>
                youtube.com または youtu.be の URL を入力してください。
              </div>
            ) : null}
          </div>
        );
      })()}

      {draft.type === "link" && (
        <div>
          <label style={labelStyle()}>リンク URL *</label>
          <input
            type="url"
            value={draft.link_url}
            onChange={(e) => set("link_url", e.target.value)}
            placeholder="https://example.com/article"
            maxLength={1000}
            disabled={isSaving}
            style={inputStyle(isSaving)}
          />
        </div>
      )}

      {/* Description — all types */}
      <div>
        <label style={labelStyle()}>
          説明 {draft.type === "card" ? "（title か description どちらか必須）" : "（任意）"}
        </label>
        <textarea
          aria-label="説明"
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder={
            draft.type === "card"
              ? "例：チームで取り組んだ課題と、その成果を書いてください。"
              : "補足説明や文脈など"
          }
          maxLength={500}
          rows={3}
          disabled={isSaving}
          style={{ ...inputStyle(isSaving), resize: "vertical", minHeight: 72 }}
        />
      </div>

      {/* Section selector (A-3 Commit C) — セクションが1件以上あるときのみ表示 */}
      {sections.length > 0 && (
        <div>
          <label style={labelStyle()}>セクション（任意）</label>
          <select
            aria-label="セクション（任意）"
            value={draft.section_id ?? ""}
            onChange={(e) =>
              onDraftChange({ ...draft, section_id: e.target.value || null })
            }
            disabled={isSaving}
            style={{
              ...inputStyle(isSaving),
              cursor: isSaving ? "default" : "pointer",
            }}
          >
            <option value="">未分類</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{
            padding: "7px 16px",
            background: "#fff",
            color: "var(--ink-soft)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: isSaving ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isSaving ? 0.5 : 1,
          }}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={effectivelyDisabled ? undefined : onSave}
          disabled={effectivelyDisabled}
          style={{
            padding: "7px 18px",
            minWidth: 130,
            background: justSaved ? "var(--success)" : canSave ? "var(--royal)" : "var(--ink-mute)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: effectivelyDisabled ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "background 0.2s",
          }}
        >
          {isSaving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
        </button>
      </div>
    </div>
  );
}

// ─── Main: StoryAccordion ─────────────────────────────────────────────────────

// ─── DnD wrapper components ───────────────────────────────────────────────────

/** セクション並べ替え用 useSortable ラッパー */
function SortableSectionWrapper({
  section, onSave, onDelete, disabled,
}: {
  section: StorySection;
  onSave: (id: string, name: string) => Promise<void>;
  onDelete: (section: StorySection) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "section" },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <SectionHeader
        section={section}
        onSave={onSave}
        onDelete={onDelete}
        dragHandle={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/** ストーリー並べ替え用 useSortable ラッパー（表示 / 編集フォームを内包） */
function SortableStoryWrapper({
  story, editingId, editDraft, sections, editSaving, editJustSaved,
  onSaveEdit, onCancelEdit, onEdit, onDelete, onDraftChange, disabled,
}: {
  story: Story;
  editingId: string | null;
  editDraft: StoryDraft;
  sections: StorySection[];
  editSaving: boolean;
  editJustSaved: boolean;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEdit: (id: string) => void;
  onDelete: (story: Story) => void;
  onDraftChange: (d: StoryDraft) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
    data: { type: "story" },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      {editingId === story.id ? (
        <StoryForm
          draft={editDraft}
          sections={sections}
          onDraftChange={onDraftChange}
          isSaving={editSaving}
          justSaved={editJustSaved}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <StoryCard
          story={story}
          onEdit={() => onEdit(story.id)}
          onDelete={() => onDelete(story)}
          dragHandle={disabled ? undefined : { ...attributes, ...listeners }}
        />
      )}
    </div>
  );
}

/** ドロップ対象コンテナ（空セクションへのドロップ受け付け用） */
function DroppableContainer({
  id, sectionId, children,
}: {
  id: string;
  sectionId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id,
    data: { type: "container", sectionId },
  });
  return <div ref={setNodeRef}>{children}</div>;
}

// ─── Main: StoryAccordion ─────────────────────────────────────────────────────

interface StoryAccordionProps {
  /** ow_experiences.id */
  experienceId: string;
}

export default function StoryAccordion({ experienceId }: StoryAccordionProps) {
  const [isOpen,   setIsOpen]   = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [stories,  setStories]  = useState<Story[]>([]);

  // A-3 Commit C: sections state
  const [sections, setSections] = useState<StorySection[]>([]);
  // 新規セクション追加インライン UI
  const [addingSection,    setAddingSection]    = useState(false);
  const [newSectionName,   setNewSectionName]   = useState("");
  const [sectionCreating,  setSectionCreating]  = useState(false);
  // セクション削除
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<StorySection | null>(null);
  const [deletingSection,     setDeletingSection]     = useState(false);

  // B-1 Commit B: DnD state
  const [dndActiveId,   setDndActiveId]   = useState<string | null>(null);
  const [dndActiveType, setDndActiveType] = useState<"section" | "story" | null>(null);
  // ロールバック用スナップショット
  const prevStoriesRef  = useRef<Story[]>([]);
  const prevSectionsRef = useRef<StorySection[]>([]);

  // B-1: dnd-kit sensors (PointerSensor = mouse + touch, KeyboardSensor = a11y)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Edit state
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editDraft,     setEditDraft]     = useState<StoryDraft>(EMPTY_DRAFT);
  const [editSaving,    setEditSaving]    = useState(false);
  const [editJustSaved, setEditJustSaved] = useState(false);

  // Add state
  const [adding,        setAdding]        = useState(false);
  const [addDraft,      setAddDraft]      = useState<StoryDraft>(EMPTY_DRAFT);
  const [addSaving,     setAddSaving]     = useState(false);
  const [addJustSaved,  setAddJustSaved]  = useState(false);

  // Delete state (story)
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Toast
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "error">("default");

  const showToast = useCallback((msg: string, variant: "default" | "error" = "default") => {
    setToastVariant(variant);
    setToastMsg(msg);
  }, []);

  // ── Lazy load on first expand (stories + sections を並列取得) ─────────────────

  useEffect(() => {
    if (!isOpen || loaded) return;

    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch(`/api/jobseeker/experience-stories?experience_id=${experienceId}`)
        .then((res) => res.json() as Promise<{ stories?: Story[] }>),
      fetch(`/api/jobseeker/experience-story-sections?experience_id=${experienceId}`)
        .then((res) => res.json() as Promise<{ sections?: StorySection[] }>),
    ])
      .then(([storiesJson, sectionsJson]) => {
        if (!cancelled) {
          setStories(storiesJson.stories ?? []);
          setSections(sectionsJson.sections ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) showToast("データの取得に失敗しました。", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, loaded, experienceId, showToast]);

  // ── Section CRUD ─────────────────────────────────────────────────────────────

  /** セクション名を更新。SectionHeader から呼ばれる(Promise を返す → justSaved パターン) */
  const updateSectionName = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/jobseeker/experience-story-sections/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error();
    const updated: StorySection = await res.json();
    setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
    showToast("セクション名を更新しました");
  }, [showToast]);

  /** 新規セクション作成 */
  const createSection = useCallback(async () => {
    if (!newSectionName.trim()) return;
    setSectionCreating(true);
    try {
      const res = await fetch("/api/jobseeker/experience-story-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId, name: newSectionName.trim() }),
      });
      if (!res.ok) throw new Error();
      const inserted: StorySection = await res.json();
      setSections((prev) => [...prev, inserted]);
      setNewSectionName("");
      setAddingSection(false);
      showToast("セクションを追加しました");
    } catch {
      showToast("セクションの追加に失敗しました。", "error");
    } finally {
      setSectionCreating(false);
    }
  }, [newSectionName, experienceId, showToast]);

  /** セクション削除の確定 */
  const confirmDeleteSection = useCallback(async () => {
    if (!deleteSectionTarget) return;
    setDeletingSection(true);
    try {
      const res = await fetch(
        `/api/jobseeker/experience-story-sections/${deleteSectionTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setSections((prev) => prev.filter((s) => s.id !== deleteSectionTarget.id));
      // DB: ON DELETE SET NULL → ストーリーの section_id は DB 側で自動 NULL になる
      // ローカル state も同期して更新（再フェッチ不要）
      setStories((prev) =>
        prev.map((s) =>
          s.section_id === deleteSectionTarget.id ? { ...s, section_id: null } : s
        )
      );
      setDeleteSectionTarget(null);
      showToast("セクションを削除しました（ストーリーは未分類に移動しました）");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeletingSection(false);
    }
  }, [deleteSectionTarget, showToast]);

  // ── Story CRUD ───────────────────────────────────────────────────────────────

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setEditSaving(true);
    try {
      // link type のみ OGP fetch（判断点 1: 同期取得）。失敗は null で保存（判断点 2）。
      const ogpFields =
        editDraft.type === "link" && editDraft.link_url.trim()
          ? await fetchOgp(editDraft.link_url.trim())
          : { og_image_url: null, og_title: null };
      const res = await fetch(`/api/jobseeker/experience-stories/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...makeBody(editDraft), ...ogpFields }),
      });
      if (!res.ok) throw new Error();
      const updated: Story = await res.json();
      setStories((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)));
      showToast("ストーリーを更新しました");
      setEditJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setEditingId(null);
      setEditDraft(EMPTY_DRAFT);
      setEditJustSaved(false);
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setEditSaving(false);
    }
  }, [editingId, editDraft, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAdd = useCallback(async () => {
    setAddSaving(true);
    try {
      // link type のみ OGP fetch（判断点 1: 同期取得）。失敗は null で保存（判断点 2）。
      const ogpFields =
        addDraft.type === "link" && addDraft.link_url.trim()
          ? await fetchOgp(addDraft.link_url.trim())
          : { og_image_url: null, og_title: null };
      const res = await fetch("/api/jobseeker/experience-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...makeBody(addDraft, experienceId), ...ogpFields }),
      });
      if (!res.ok) throw new Error();
      const inserted: Story = await res.json();
      setStories((prev) => [...prev, inserted]);
      showToast("ストーリーを追加しました");
      setAddJustSaved(true);
      await new Promise((r) => setTimeout(r, 800));
      setAdding(false);
      setAddDraft(EMPTY_DRAFT);
      setAddJustSaved(false);
    } catch {
      showToast("追加に失敗しました。もう一度お試しください。", "error");
    } finally {
      setAddSaving(false);
    }
  }, [addDraft, experienceId, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/jobseeker/experience-stories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setStories((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("ストーリーを削除しました");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, showToast]);

  // ── Cancel helpers ───────────────────────────────────────────────────────────

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }, []);

  const cancelAdd = useCallback(() => {
    setAdding(false);
    setAddDraft(EMPTY_DRAFT);
  }, []);

  // ── B-1: DnD handlers ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    prevStoriesRef.current  = stories;
    prevSectionsRef.current = sections;
    setDndActiveId(event.active.id as string);
    setDndActiveType(event.active.data.current?.type as "section" | "story" ?? null);
  }, [stories, sections]);

  // cross-section 移動: ドラッグ中に story の section_id を更新し視覚フィードバックを提供
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "story") return;

    const activeStory = stories.find(s => s.id === active.id);
    if (!activeStory) return;

    let targetSectionId: string | null;
    if (over.data.current?.type === "container") {
      targetSectionId = over.data.current?.sectionId ?? null;
    } else if (over.data.current?.type === "story") {
      targetSectionId = stories.find(s => s.id === over.id)?.section_id ?? null;
    } else if (over.data.current?.type === "section") {
      targetSectionId = over.id as string;
    } else {
      return;
    }

    if (activeStory.section_id === targetSectionId) return; // 同一コンテナ → 不要

    setStories(prev => prev.map(s =>
      s.id === active.id ? { ...s, section_id: targetSectionId } : s
    ));
  }, [stories]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDndActiveId(null);
    setDndActiveType(null);

    if (!over) {
      // ドロップ先なし → ロールバック
      setStories(prevStoriesRef.current);
      setSections(prevSectionsRef.current);
      return;
    }

    if (dndActiveType === "section") {
      // セクションは section header 同士の drop のみ受け付け
      if (over.data.current?.type !== "section") return;
      const oldIdx = sections.findIndex(s => s.id === active.id);
      const newIdx = sections.findIndex(s => s.id === over.id);
      if (oldIdx === newIdx || oldIdx === -1 || newIdx === -1) return;

      const newSections = arrayMove(sections, oldIdx, newIdx);
      setSections(newSections);

      // API: /experience-story-sections/reorder (楽観 UI + 失敗時ロールバック)
      void (async () => {
        try {
          const res = await fetch("/api/jobseeker/experience-story-sections/reorder", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderedIds: newSections.map(s => s.id) }),
          });
          if (!res.ok) throw new Error();
        } catch {
          setSections(prevSectionsRef.current);
          showToast("セクションの並べ替えに失敗しました。", "error");
        }
      })();

    } else if (dndActiveType === "story") {
      // onDragOver で section_id は更新済み。activeContainerId = 現在のコンテナ
      const activeStory = stories.find(s => s.id === active.id);
      const activeContainerId = activeStory?.section_id ?? "uncategorized";
      const overId = over.id as string;

      // 新ストーリー配列を計算（sort_order 再採番 + section_id 確定）
      const newStories = buildNewStoriesAfterDrag(
        stories, sections, active.id as string, overId, activeContainerId
      );
      setStories(newStories);

      // API: /experience-stories/reorder
      const items = newStories.map(s => ({
        id: s.id, sort_order: s.sort_order, section_id: s.section_id,
      }));
      void (async () => {
        try {
          const res = await fetch("/api/jobseeker/experience-stories/reorder", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) throw new Error();
        } catch {
          setStories(prevStoriesRef.current);
          showToast("ストーリーの並べ替えに失敗しました。", "error");
        }
      })();
    }
  }, [dndActiveType, sections, stories, showToast]);

  const handleDragCancel = useCallback(() => {
    setStories(prevStoriesRef.current);
    setSections(prevSectionsRef.current);
    setDndActiveId(null);
    setDndActiveType(null);
  }, []);

  // ── Accordion count label ────────────────────────────────────────────────────

  const countLabel = loaded
    ? stories.length > 0
      ? `ストーリー（${stories.length}件）`
      : "ストーリー"
    : "ストーリー";

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasAnySections = sections.length > 0;
  const uncategorized = stories.filter((s) => s.section_id === null);
  const hasAnyContent = stories.length > 0 || hasAnySections;

  return (
    <div
      style={{
        marginTop: 8,
        borderTop: "1px solid var(--line-soft)",
      }}
    >
      {/* Accordion header toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 0",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            fontSize: 12, fontWeight: 500,
            color: "var(--ink-mute)",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
            lineHeight: 1,
            marginTop: 1,
          }}
        >
          ▶
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-mute)",
            letterSpacing: "0.04em",
          }}
        >
          {countLabel}
        </span>
        {loading && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontStyle: "italic" }}>
            読み込み中…
          </span>
        )}
      </button>

      {/* Accordion body */}
      {isOpen && loaded && (
        <div style={{ paddingBottom: 8 }}>

          {/* ── Sectioned story list (B-1: DnD) ─────────────────────────────── */}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {/* B-1: セクション並べ替え SortableContext */}
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => {
                const sectionStories = stories
                  .filter((s) => s.section_id === section.id)
                  .sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <div key={section.id}>
                    {/* B-1: セクションヘッダーを並べ替え可能ラッパーで包む */}
                    <SortableSectionWrapper
                      section={section}
                      onSave={updateSectionName}
                      onDelete={setDeleteSectionTarget}
                      disabled={!!editingId || adding}
                    />
                    {/* B-1: セクション内ストーリーの SortableContext + ドロップ対象コンテナ */}
                    <DroppableContainer id={`container-${section.id}`} sectionId={section.id}>
                      <SortableContext
                        items={sectionStories.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {sectionStories.map((s) => (
                          <SortableStoryWrapper
                            key={s.id}
                            story={s}
                            editingId={editingId}
                            editDraft={editDraft}
                            sections={sections}
                            editSaving={editSaving}
                            editJustSaved={editJustSaved}
                            onSaveEdit={() => { void saveEdit(); }}
                            onCancelEdit={cancelEdit}
                            onEdit={(id) => { setEditingId(id); setEditDraft(draftFromStory(s)); }}
                            onDelete={setDeleteTarget}
                            onDraftChange={setEditDraft}
                            disabled={!!editingId || adding}
                          />
                        ))}
                        {sectionStories.length === 0 && (
                          <div
                            style={{
                              fontSize: 12, fontWeight: 500,
                              color: "var(--ink-mute)",
                              fontStyle: "italic",
                              padding: "4px 0 4px 4px",
                            }}
                          >
                            このセクションにはまだストーリーがありません
                          </div>
                        )}
                      </SortableContext>
                    </DroppableContainer>
                  </div>
                );
              })}
            </SortableContext>

            {/* 未分類エリア: セクションがある場合は「未分類」ヘッダーを表示 */}
            {(uncategorized.length > 0 || !hasAnySections) && (
              <div>
                {hasAnySections && uncategorized.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-mute)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "6px 0 4px",
                      borderBottom: "1.5px solid var(--line)",
                      marginTop: 12,
                      marginBottom: 4,
                    }}
                  >
                    未分類
                  </div>
                )}
                <DroppableContainer id="container-uncategorized" sectionId={null}>
                  <SortableContext
                    items={uncategorized.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {uncategorized.map((s) => (
                      <SortableStoryWrapper
                        key={s.id}
                        story={s}
                        editingId={editingId}
                        editDraft={editDraft}
                        sections={sections}
                        editSaving={editSaving}
                        editJustSaved={editJustSaved}
                        onSaveEdit={() => { void saveEdit(); }}
                        onCancelEdit={cancelEdit}
                        onEdit={(id) => { setEditingId(id); setEditDraft(draftFromStory(s)); }}
                        onDelete={setDeleteTarget}
                        onDraftChange={setEditDraft}
                        disabled={!!editingId || adding}
                      />
                    ))}
                    {/* グローバル空状態: セクションも stories もない場合のみ表示 */}
                    {!hasAnySections && uncategorized.length === 0 && !adding && (
                      <div
                        style={{
                          fontSize: 12, fontWeight: 500,
                          color: "var(--ink-mute)",
                          fontStyle: "italic",
                          padding: "2px 0 6px",
                        }}
                      >
                        ストーリーはまだ登録されていません
                      </div>
                    )}
                  </SortableContext>
                </DroppableContainer>
              </div>
            )}

            {/* B-1: DragOverlay — ドラッグ中のフローティングプレビュー */}
            <DragOverlay>
              {dndActiveId && dndActiveType === "section" && (() => {
                const sec = sections.find((s) => s.id === dndActiveId);
                return sec ? (
                  <div
                    style={{
                      background: "#fff",
                      border: "1.5px solid var(--royal)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      boxShadow: "0 4px 12px rgba(0,35,102,0.15)",
                      cursor: "grabbing",
                    }}
                  >
                    {sec.name}
                  </div>
                ) : null;
              })()}
              {dndActiveId && dndActiveType === "story" && (() => {
                const st = stories.find((s) => s.id === dndActiveId);
                return st ? (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      boxShadow: "0 4px 12px rgba(0,35,102,0.15)",
                      cursor: "grabbing",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <TypeBadge type={st.type} />
                    <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>
                      {st.title ?? st.type}
                    </span>
                  </div>
                ) : null;
              })()}
            </DragOverlay>
          </DndContext>

          {/* ── Add story form ──────────────────────────────────────────────── */}
          {adding && (
            <div style={{ marginTop: hasAnyContent ? 12 : 0 }}>
              <StoryForm
                draft={addDraft}
                sections={sections}
                onDraftChange={setAddDraft}
                isSaving={addSaving}
                justSaved={addJustSaved}
                onSave={() => { void saveAdd(); }}
                onCancel={cancelAdd}
              />
            </div>
          )}

          {/* ── Action buttons ──────────────────────────────────────────────── */}
          {!adding && (
            <div style={{ marginTop: hasAnyContent ? 8 : 4, display: "flex", flexDirection: "column", gap: 6 }}>

              {/* "+ ストーリーを追加" — プライマリ */}
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "7px 14px",
                  width: "100%",
                  background: "transparent",
                  border: "1px dashed var(--line)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, color 0.15s",
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
                ストーリーを追加
              </button>

              {/* "+ セクションを追加" / セクション名入力 — セカンダリ */}
              {!addingSection ? (
                <button
                  type="button"
                  onClick={() => setAddingSection(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "5px 14px",
                    width: "100%",
                    background: "transparent",
                    border: "1px dashed var(--line-soft)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ink-mute)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
                  セクションを追加
                </button>
              ) : (
                /* セクション名インライン入力フォーム */
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--bg-tint)",
                  }}
                >
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="例：プロジェクト・表彰・外部発信"
                    maxLength={50}
                    disabled={sectionCreating}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { void createSection(); }
                      if (e.key === "Escape") { setAddingSection(false); setNewSectionName(""); }
                    }}
                    style={{
                      flex: 1,
                      border: "1.5px solid var(--royal)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 12, fontWeight: 500,
                      color: "var(--ink)",
                      background: "#fff",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      opacity: sectionCreating ? 0.6 : 1,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newSectionName.trim() || sectionCreating}
                    onClick={() => { void createSection(); }}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "inherit",
                      background: !newSectionName.trim() || sectionCreating ? "var(--ink-mute)" : "var(--royal)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: !newSectionName.trim() || sectionCreating ? "default" : "pointer",
                      flexShrink: 0,
                      transition: "background 0.12s",
                    }}
                  >
                    {sectionCreating ? "…" : "追加"}
                  </button>
                  <button
                    type="button"
                    disabled={sectionCreating}
                    onClick={() => { setAddingSection(false); setNewSectionName(""); }}
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      background: "transparent",
                      color: "var(--ink-mute)",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      cursor: sectionCreating ? "default" : "pointer",
                      flexShrink: 0,
                    }}
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Story 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="ストーリーを削除しますか？"
        message={
          deleteTarget
            ? `「${deleteTarget.title ?? deleteTarget.type}」のストーリーを削除します。この操作は取り消せません。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deleting}
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* セクション削除確認ダイアログ (A-3 Commit C)
          セクション削除のみ ConfirmDialog を導入している理由:
          段階6-3-1.5 では「× ボタン即削除(確認ダイアログなし)」が確定パターンだが、
          セクション削除は ON DELETE SET NULL により配下ストーリー全件の section_id が NULL になる。
          「意図せずストーリーを全部バラバラにしてしまった」という後悔度が高く、
          ストーリー1件削除より実質的な影響範囲が大きいため、このケースのみ例外とした。
          ストーリー削除は段階6-3-1.5 の原則どおり即削除を維持する。 */}
      <ConfirmDialog
        isOpen={!!deleteSectionTarget}
        title="セクションを削除しますか？"
        message={
          deleteSectionTarget
            ? `「${deleteSectionTarget.name}」を削除します。このセクションに属するストーリーは「未分類」に移動します。`
            : ""
        }
        confirmLabel="削除する"
        confirmVariant="danger"
        isSubmitting={deletingSection}
        onConfirm={() => { void confirmDeleteSection(); }}
        onCancel={() => setDeleteSectionTarget(null)}
      />

      {/* Toast */}
      {toastMsg && (
        <Toast message={toastMsg} variant={toastVariant} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

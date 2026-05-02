"use client";

import { Newspaper, Video, Mic, Share2, Calendar, Globe, type LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { Database } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";

type Post = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

type TypeInfo = {
  label: string;
  icon: LucideIcon;
  emoji: string;
};

const TYPE_MAP: Record<string, TypeInfo> = {
  article: { label: "記事",      icon: Newspaper, emoji: "📰" },
  video:   { label: "動画",      icon: Video,     emoji: "🎬" },
  audio:   { label: "音声",      icon: Mic,       emoji: "🎙️" },
  social:  { label: "SNS",       icon: Share2,    emoji: "💬" },
  event:   { label: "イベント",  icon: Calendar,  emoji: "📅" },
  other:   { label: "その他",    icon: Globe,     emoji: "🔗" },
};

type Props = {
  post: Post;
  /** 企業横断一覧 (/posts) で企業名を表示するための追加 props */
  companyName?: string;
  companyId?: string;
  /** "with-company": 縦並び (上サムネ + 下本体)、企業名表示。default: 既存横並び */
  variant?: "default" | "with-company";
};

// ─── 公開日フォーマット ─────────────────────────────────────────────────────────

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso)
    .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\//g, ".");
}

// ─── バッジ共通部品 ───────────────────────────────────────────────────────────

function BadgeRow({ isEditor, TypeIcon, typeLabel }: {
  isEditor: boolean;
  TypeIcon: LucideIcon;
  typeLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px",
        borderRadius: "var(--radius-sm)", border: "1px solid",
        ...(isEditor
          ? { background: "var(--royal-50)", color: "var(--royal)", borderColor: "var(--royal-100)" }
          : { background: "var(--bg-tint)", color: "var(--ink-soft)", borderColor: "var(--line)" }),
      }}>
        {isEditor ? "Opinio 編集部選" : "企業発信"}
      </span>
      <span style={{
        fontSize: 11, color: "var(--ink-mute)", padding: "2px 6px",
        background: "var(--line-soft)", borderRadius: "var(--radius-sm)",
        display: "inline-flex", alignItems: "center", gap: 3,
      }}>
        <TypeIcon size={10} strokeWidth={2} />
        {typeLabel}
      </span>
    </div>
  );
}

// ─── 中点 ────────────────────────────────────────────────────────────────────

function Dot() {
  return (
    <span style={{
      width: 3, height: 3, borderRadius: "50%",
      background: "var(--ink-mute)", flexShrink: 0,
      display: "inline-block",
    }} />
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

export default function PostCard({ post, companyName, companyId, variant = "default" }: Props) {
  const router = useRouter();
  const typeInfo = TYPE_MAP[post.type] ?? TYPE_MAP.other;
  const TypeIcon = typeInfo.icon;
  const isEditor = post.created_by_role === "editor";
  const publishedDate = formatDate(post.published_at);

  // 企業名クリック: ネスト <a> を避けて router.push で内部遷移
  function handleCompanyClick(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (companyId) router.push(`/companies/${companyId}`);
  }

  // ─── with-company variant: 縦並び (上サムネ 16:9 + 下本体) ─────────────────

  if (variant === "with-company") {
    return (
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="post-card-link"
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          textDecoration: "none",
          transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
          height: "100%",
        }}
      >
        {/* サムネイル 16:9 */}
        <div style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: post.thumbnail_url
            ? `url(${JSON.stringify(post.thumbnail_url)}) center / cover`
            : "var(--line-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          flexShrink: 0,
        }}>
          {!post.thumbnail_url && typeInfo.emoji}
        </div>

        {/* 本体 */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px 16px",
          gap: "var(--space-2)",
        }}>
          {/* バッジ行 */}
          <BadgeRow isEditor={isEditor} TypeIcon={TypeIcon} typeLabel={typeInfo.label} />

          {/* タイトル */}
          <p style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.6,
            margin: 0,
            flex: 1,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {post.title}
          </p>

          {/* 企業名 · 出典 · 公開日 */}
          <div style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexWrap: "wrap",
          }}>
            {companyName && companyId && (
              <>
                {/* stopPropagation で親 <a> へのバブリングを防ぎ内部遷移 */}
                <span
                  role="link"
                  tabIndex={0}
                  onClick={handleCompanyClick}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCompanyClick(e); }}
                  style={{ color: "var(--ink-soft)", cursor: "pointer", fontWeight: 500 }}
                >
                  {companyName}
                </span>
                {(post.source_name || publishedDate) && <Dot />}
              </>
            )}
            {post.source_name && <span>{post.source_name}</span>}
            {post.source_name && publishedDate && <Dot />}
            {publishedDate && <span>{publishedDate}</span>}
          </div>
        </div>
      </a>
    );
  }

  // ─── default variant: 横並び (左サムネ 120×80 + 右本体) — 既存互換 ─────────

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="post-card-link"
      style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
    >
      {/* サムネイル */}
      <div style={{
        flexShrink: 0,
        width: 120,
        height: 80,
        borderRadius: "var(--radius-md)",
        background: post.thumbnail_url
          ? `url(${JSON.stringify(post.thumbnail_url)}) center / cover`
          : "var(--line-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        overflow: "hidden",
      }}>
        {!post.thumbnail_url && typeInfo.emoji}
      </div>

      {/* 本体 */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        justifyContent: "center",
      }}>
        {/* バッジ行 */}
        <div style={{ marginBottom: "var(--space-2)" }}>
          <BadgeRow isEditor={isEditor} TypeIcon={TypeIcon} typeLabel={typeInfo.label} />
        </div>

        {/* タイトル */}
        <p style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--ink)",
          lineHeight: 1.5,
          margin: "0 0 var(--space-2)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        } as React.CSSProperties}>
          {post.title}
        </p>

        {/* 出典 + 公開日 */}
        <div style={{
          fontSize: 12,
          color: "var(--ink-mute)",
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
        }}>
          {post.source_name && <span>{post.source_name}</span>}
          {post.source_name && publishedDate && <Dot />}
          {publishedDate && <span>{publishedDate}</span>}
        </div>
      </div>
    </a>
  );
}

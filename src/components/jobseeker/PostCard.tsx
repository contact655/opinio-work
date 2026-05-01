"use client";

import { Newspaper, Video, Mic, Share2, Calendar, Globe, type LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { Database } from "@/lib/supabase/types";

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
};

export default function PostCard({ post }: Props) {
  const typeInfo = TYPE_MAP[post.type] ?? TYPE_MAP.other;
  const TypeIcon = typeInfo.icon;
  const isEditor = post.created_by_role === "editor";

  // 公開日フォーマット (YYYY.MM.DD)
  const publishedDate = post.published_at
    ? new Date(post.published_at)
        .toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, ".")
    : null;

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
      <div
        style={{
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
        }}
      >
        {!post.thumbnail_url && typeInfo.emoji}
      </div>

      {/* 本体 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          justifyContent: "center",
        }}
      >
        {/* バッジ + type */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            marginBottom: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          {/* 登録元バッジ */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid",
              ...(isEditor
                ? {
                    background: "var(--royal-50)",
                    color: "var(--royal)",
                    borderColor: "var(--royal-100)",
                  }
                : {
                    background: "var(--bg-tint)",
                    color: "var(--ink-soft)",
                    borderColor: "var(--line)",
                  }),
            }}
          >
            {isEditor ? "Opinio 編集部選" : "企業発信"}
          </span>

          {/* type タグ */}
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              padding: "2px 6px",
              background: "var(--line-soft)",
              borderRadius: "var(--radius-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <TypeIcon size={10} strokeWidth={2} />
            {typeInfo.label}
          </span>
        </div>

        {/* タイトル */}
        <p
          style={{
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
          }}
        >
          {post.title}
        </p>

        {/* 出典 + 公開日 */}
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            display: "flex",
            gap: "var(--space-2)",
            alignItems: "center",
          }}
        >
          {post.source_name && <span>{post.source_name}</span>}
          {post.source_name && publishedDate && (
            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "var(--ink-mute)",
                flexShrink: 0,
              }}
            />
          )}
          {publishedDate && <span>{publishedDate}</span>}
        </div>
      </div>
    </a>
  );
}

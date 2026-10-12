import { Markdown } from "@/components/common/Markdown";
import { ExpandableStoryBody } from "@/components/companies/ExpandableStoryBody";
import { storyCategoryLabel } from "@/lib/companyStories/shared";

/**
 * ★企業ページの「企業からの投稿」の1枚（2026-10-12 に CompanyDetailPage から切り出した）。
 *
 * ⚠️★**`/biz/posts` の編集画面のプレビューも同じ部品を使う。** 片方だけ見た目を変えないこと
 *    （「プレビューと実際の表示が違う」になる）。
 * ⚠️ サーバーでもブラウザでも描ける（"use client" を付けない。中の ExpandableStoryBody だけがクライアント）。
 * ⚠️ 種類名は shared の1か所（storyCategoryLabel）。それまで企業ページ側の表に interview と hiring が無く、
 *    社員インタビューが「interview」と英語のまま出ていた（2026-10-12 に直した）。
 */
export function CompanyStoryCard({ title, body, category, coverImageUrl, publishedAt }: {
  title: string;
  body: string | null;
  category: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}) {
  const catLabel = category ? storyCategoryLabel(category) : null;
  /* ★全文を出す（2026-09-22）。⚠️ 長いものだけ畳む。目安は120字・改行5つ */
  const text = body?.trim() ?? "";
  const long = text.length > 120 || text.split("\n").length > 5;
  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
      background: "#fff", display: "flex", flexDirection: "column", gap: 0,
    }}>
      {coverImageUrl && (
        <div style={{ position: "relative", height: 160, background: "var(--bg-tint)", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {catLabel && (
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: 100,
            background: "var(--royal-50)", color: "var(--royal)",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", width: "fit-content",
          }}>
            {catLabel}
          </span>
        )}
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.5, fontFamily: "var(--font-noto-serif)" }}>
          {title}
        </h3>
        {text && (long ? (
          <ExpandableStoryBody title={title}><Markdown>{text}</Markdown></ExpandableStoryBody>
        ) : (
          <Markdown>{text}</Markdown>
        ))}
        {publishedAt && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
            {new Date(publishedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" })}
          </span>
        )}
      </div>
    </div>
  );
}

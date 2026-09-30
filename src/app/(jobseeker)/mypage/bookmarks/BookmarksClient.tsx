"use client";

import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

export type Bookmark = {
  id: string;
  type: "company" | "job";
  title: string;
  meta: string;
  badge_label: string;
  /**
   * ★行き先。**`null` は「保存したときはあったが、いま開けない」**（2026-09-27）。
   *
   * ⚠️★**落とさずに残す**（柴さんの判断。B案）。本人が保存したものなので、
   *    黙って一覧から消すと**理由の分からないまま記録が減る。**
   *    ⚠️ フィードは逆に**隠す**側（`ow_posts_visible`）だが、あちらは「他人の投稿」で
   *       ここは「**本人が保存したもの**」。同じ扱いにする必然はない。
   * ⚠️★**空文字にしないこと。** `<Link href="">` は現在地に飛ぶだけで、
   *    「押せるのに何も起きない」になる。**null で受けてリンクごと外す。**
   */
  href: string | null;
  /** ★開けない理由。`href` が null のときだけ出す。⚠️ 推測で書かない（下の注記） */
  gone_label?: string;
};

function BookmarkCard({ bk }: { bk: Bookmark }) {
  const body = (
    <div style={{
      background: "#fff", border: "1px solid var(--line)",
      borderRadius: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "border-color 0.12s, box-shadow 0.12s",
      /* ⚠️ 開けないものは**薄くするだけ**。消さない・畳まない */
      opacity: bk.href ? 1 : 0.72,
    }} className={bk.href ? "bk-card-hover" : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: bk.href ? "var(--royal)" : "var(--ink-mute)",
          background: bk.href ? "var(--royal-50)" : "var(--bg-tint)",
          border: `1px solid ${bk.href ? "var(--royal-100)" : "var(--line)"}`,
          padding: "2px 8px", borderRadius: 100,
        }}>{bk.badge_label}</span>
        {!bk.href && bk.gone_label && (
          /* ⚠️★**色で危険を示さない**（ui-conventions の「色の役割」）。
                 本人の操作が失敗したわけではなく、相手側が下ろしただけ。 */
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)" }}>
            {bk.gone_label}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{bk.title}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{bk.meta}</div>
    </div>
  );
  /* ⚠️★開けないものは `<Link>` で包まない。**押せる見た目のまま 404 へ飛ばさない。** */
  if (!bk.href) return body;
  return <Link href={bk.href} style={{ textDecoration: "none" }}>{body}</Link>;
}

function BookmarkSection({ title, items }: { title: string; items: Bookmark[] }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
        {title}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", marginLeft: 8 }}>
          {items.length}件
        </span>
      </h2>
      {items.length === 0 ? (
        <div style={{
          background: "var(--bg-tint)", borderRadius: 12, padding: "32px 24px",
          textAlign: "center", color: "var(--ink-mute)", fontSize: 13,
        }}>
          まだブックマークがありません
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {items.map((bk) => <BookmarkCard key={bk.id} bk={bk} />)}
        </div>
      )}
    </div>
  );
}

export default function BookmarksClient({
  companyBookmarks,
  jobBookmarks,
}: {
  companyBookmarks: Bookmark[];
  jobBookmarks: Bookmark[];
}) {
  return (
    <MypageLayout activeKey="bookmarks">
      {/* ⚠️ 上の余白はレイアウトが持つ。ここで足すと見出しの高さが他ページとずれる（2026-08-25） */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 28 }}>
          ブックマーク
        </h1>
        <BookmarkSection title="企業" items={companyBookmarks} />
        <BookmarkSection title="募集" items={jobBookmarks} />
      </div>
      <style>{`
        .bk-card-hover:hover {
          border-color: var(--royal-100) !important;
          box-shadow: 0 4px 12px rgba(15,23,42,0.06) !important;
        }
      `}</style>
    </MypageLayout>
  );
}

"use client";

import Link from "next/link";
import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

export type Bookmark = {
  id: string;
  type: "company" | "job";
  title: string;
  meta: string;
  badge_label: string;
  href: string;
};

function BookmarkCard({ bk }: { bk: Bookmark }) {
  return (
    <Link href={bk.href} style={{ textDecoration: "none" }}>
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 12, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 6,
        transition: "border-color 0.12s, box-shadow 0.12s",
      }} className="bk-card-hover">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--royal)",
            background: "var(--royal-50)", border: "1px solid var(--royal-100)",
            padding: "2px 8px", borderRadius: 100,
          }}>{bk.badge_label}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{bk.title}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{bk.meta}</div>
      </div>
    </Link>
  );
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
      <div style={{ padding: "32px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 28 }}>
          ブックマーク
        </h1>
        <BookmarkSection title="企業" items={companyBookmarks} />
        <BookmarkSection title="求人" items={jobBookmarks} />
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

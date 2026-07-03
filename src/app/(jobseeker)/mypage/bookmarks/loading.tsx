import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

export default function BookmarksLoading() {
  return (
    <MypageLayout activeKey="bookmarks">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skeleton-shimmer" style={{ height: 28, width: 140, borderRadius: 6, marginBottom: 8 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{
            height: 80, borderRadius: 12, background: "var(--line-soft)",
            border: "1px solid var(--line)",
          }} />
        ))}
      </div>
    </MypageLayout>
  );
}

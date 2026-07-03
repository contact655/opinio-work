import MypageLayout from "@/app/(jobseeker)/mypage/_components/MypageLayout";

export default function ConversationDetailLoading() {
  return (
    <MypageLayout activeKey="conversations">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
        <div className="skeleton-shimmer" style={{ height: 40, borderRadius: 8, maxWidth: 300 }} />
        <div className="skeleton-shimmer" style={{ height: 56, borderRadius: 12 }} />
        <div className="skeleton-shimmer" style={{ height: 400, borderRadius: 12 }} />
        <div className="skeleton-shimmer" style={{ height: 80, borderRadius: 12 }} />
      </div>
    </MypageLayout>
  );
}

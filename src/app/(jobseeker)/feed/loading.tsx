export default function FeedLoading() {
  const shimmer: React.CSSProperties = {
    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
    backgroundSize: "200% 100%",
    animation: "skeletonShimmer 1.4s ease-in-out infinite",
    borderRadius: 8,
  };

  return (
    <>
      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-tint)",
          padding: "32px 16px 64px",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* タイトル骨格 */}
          <div style={{ ...shimmer, height: 28, width: 120, marginBottom: 24, borderRadius: 6 }} />

          {/* Composer 骨格 */}
          <div
            style={{
              background: "#fff",
              border: "1.5px solid var(--line)",
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...shimmer, width: 40, height: 40, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...shimmer, height: 80, borderRadius: 8, marginBottom: 12 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ ...shimmer, height: 36, width: 100, borderRadius: 8 }} />
                </div>
              </div>
            </div>
          </div>

          {/* PostCard 骨格 × 3 */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "20px 24px",
                marginBottom: 16,
                boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
              }}
            >
              {/* アバター + 名前行 */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <div style={{ ...shimmer, width: 44, height: 44, borderRadius: "50%" }} />
                <div>
                  <div style={{ ...shimmer, height: 16, width: 100, borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ ...shimmer, height: 12, width: 60, borderRadius: 4 }} />
                </div>
              </div>
              {/* 本文行 */}
              <div style={{ ...shimmer, height: 14, width: "100%", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ ...shimmer, height: 14, width: "90%", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ ...shimmer, height: 14, width: "70%", borderRadius: 4, marginBottom: 18 }} />
              {/* ボタン行 */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <div style={{ ...shimmer, height: 32, width: 80, borderRadius: 8 }} />
                <div style={{ ...shimmer, height: 32, width: 80, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

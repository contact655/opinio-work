import { BusinessLayout } from "@/components/business/BusinessLayout";

/**
 * ホームの読み込み中（2026-10-12 に新しい並びへ合わせた）。
 * 左に「対応が必要なもの」「はじめにやること」、右の細い列に3枚。⚠️ 上部の数字タイルは無い（ホームから外した）。
 */
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px" };

function Lines({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton-shimmer" style={{ height: 14, width: `${80 - i * 8}%`, borderRadius: 4, marginTop: 14 }} />
      ))}
    </>
  );
}

export default function Loading() {
  return (
    <BusinessLayout userName="">
      <div className="skeleton-shimmer" style={{ height: 24, width: 96, borderRadius: 6, marginBottom: 16 }} />
      <div className="biz-home-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={CARD}><div className="skeleton-shimmer" style={{ height: 18, width: 180, borderRadius: 4 }} /><Lines n={3} /></div>
          <div style={CARD}><div className="skeleton-shimmer" style={{ height: 18, width: 200, borderRadius: 4 }} /><Lines n={4} /></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {[3, 3, 2].map((n, i) => (
            <div key={i} style={CARD}><div className="skeleton-shimmer" style={{ height: 14, width: 120, borderRadius: 4 }} /><Lines n={n} /></div>
          ))}
        </div>
      </div>
      <style>{`
        .biz-home-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
        @media (min-width: 1024px) { .biz-home-grid { grid-template-columns: minmax(0, 1fr) 280px; } }
      `}</style>
    </BusinessLayout>
  );
}

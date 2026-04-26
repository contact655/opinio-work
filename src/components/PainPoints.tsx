/**
 * Fix 11: 悩み × Opinioの答え 4セット
 */

const items = [
  {
    pain: "SaaSに興味があるけど、営業経験だけで通用するか不安",
    answer: "実はSIer営業・無形商材経験者こそSaaS企業が求める人材。具体的にどの企業が向くか、メンターが整理します。",
  },
  {
    pain: "エンジニアからPdMに転向したいけど、年収が下がりそう",
    answer: "技術バックグラウンドあるPdMは希少。年収維持・アップの事例が複数あります。",
  },
  {
    pain: "転職エージェントに登録したら電話が止まらない",
    answer: "Opinioは一切電話しません。すべてテキスト・オンラインで進められます。",
  },
  {
    pain: "今の会社にいた方がいいのか、転職すべきか分からない",
    answer: "転職しない結論でもOK。まずメンターと話して、市場価値を知ることから。",
  },
];

export function PainPoints() {
  return (
    <section style={{ background: "#f8f9fa", paddingTop: 56, paddingBottom: 56 }}>
      <div className="max-w-5xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
          PAIN POINTS
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 28, letterSpacing: "-0.01em" }}>
          こんな悩み、ありませんか？
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "0.5px solid #e8e4dc",
                padding: 20,
              }}
            >
              {/* 悩み */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: "3px 8px", borderRadius: 6,
                  background: "#fee2e2", color: "#991b1b",
                  flexShrink: 0,
                }}>
                  悩み
                </span>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", lineHeight: 1.6, margin: 0 }}>
                  {item.pain}
                </p>
              </div>
              {/* Opinioの答え */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingTop: 14, borderTop: "0.5px dashed #e8e4dc" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: "3px 8px", borderRadius: 6,
                  background: "#0f172a", color: "#fff",
                  flexShrink: 0,
                }}>
                  Opinio
                </span>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: 0 }}>
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

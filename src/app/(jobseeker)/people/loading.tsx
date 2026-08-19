/**
 * `/people` の待ち画面（2026-08-20）。
 *
 * ── なぜ要るか ─────────────────────────────────────────────────────────────
 * ⚠️ **これが無いと、ナビの「ユーザー」を押しても画面が何も変わらない。**
 *    App Router のクライアント遷移は、遷移先の RSC ペイロードが返るまで
 *    **前のページを表示したまま**待つ。`loading.tsx` が無いと Suspense 境界が
 *    作られないので、**スピナーもスケルトンも出ない**。
 *
 *    実測（2026-08-20 / 本番・ログイン済み）: `/people` の応答は
 *    **初回 3.74秒 / 2回目 1.77秒 / 3回目 0.53秒**。
 *    `export const dynamic = "force-dynamic"` なので毎回サーバーを起こしにいき、
 *    低トラフィックのページでは**利用者にとって毎回が初回**（コールドスタート）。
 *    その3〜4秒のあいだ**押した手応えが一切無い**ため「反応しない」に見えていた。
 *
 * ⚠️ **これは待ち時間そのものの対処ではない。** 遅さの本体は
 *    CLAUDE.md「①コールドスタート（未対処）」。ここは「押したことが伝わる」だけを直す。
 *
 * ⚠️ 骨組みは実際の `/people` に合わせる（見出し → 絞り込み → カードのグリッド）。
 *    合っていないと、切り替わった瞬間にガタつく。
 */
export default function Loading() {
  return (
    <div style={{ background: "var(--bg-tint)", minHeight: "100vh" }}>
      {/* 見出し + 検索バー */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "20px 0 0" }}>
        <div className="ppl-skeleton-wrap" style={{ margin: "0 auto", padding: "0 24px 16px" }}>
          <div className="skeleton-shimmer" style={{ height: 22, width: 200, borderRadius: 4, marginBottom: 14 }} />
          <div className="skeleton-shimmer" style={{ height: 44, width: "100%", borderRadius: 10 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {[96, 80, 72].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ height: 32, width: w, borderRadius: 100 }} />
            ))}
          </div>
        </div>
      </div>

      {/* カードのグリッド。列数は PeopleListClient の .ppl-grid と揃える */}
      <div className="ppl-skeleton-wrap" style={{ margin: "0 auto", padding: "16px 24px 80px" }}>
        <div className="ppl-grid-skeleton">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
                padding: "18px 16px", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 10,
              }}
            >
              <div className="skeleton-shimmer" style={{ width: 56, height: 56, borderRadius: "50%" }} />
              <div className="skeleton-shimmer" style={{ height: 13, width: "70%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 11, width: "85%", borderRadius: 4 }} />
              <div className="skeleton-shimmer" style={{ height: 11, width: "55%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        /* ⚠️ ブレークポイントは PeopleListClient の .ppl-grid と**同じ値**にする。
              ずれると、切り替わった瞬間に列数が変わってガタつく。 */
        .ppl-skeleton-wrap { max-width: 1100px; }
        .ppl-grid-skeleton { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        @media (min-width: 1440px) {
          .ppl-skeleton-wrap { max-width: 1300px; }
          .ppl-grid-skeleton { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }
        @media (max-width: 1024px) { .ppl-grid-skeleton { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
        @media (max-width: 768px)  { .ppl-grid-skeleton { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 560px)  { .ppl-grid-skeleton { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

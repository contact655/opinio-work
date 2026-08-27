"use client";

/**
 * 一覧が0件のときに、横断検索（`/search`）へ送る導線（2026-08-27）。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * `/people` と `/jobs` の窓は**名前・会社・職種の絞り込み**で、業種は対象外。
 * 「IT」と打つと0件になるが、**利用者には壊れて見える**（行き止まりになる）。
 * 0件が正しいことは変えず、**次に行ける場所だけを足す。**
 *
 * ⚠️ **一覧の検索ロジックには触らない。** これは0件表示に足す1行であって、
 *    絞り込みの対象を広げるものではない。
 *
 * ⚠️ **入力語が空なら描かない。** 「条件が何も無いのに0件」のときに
 *    「」をまとめて検索、と出しても意味が無い（`/search` 側も条件0で止まる）。
 *
 * ⚠️ 文言は**ヘッダーの検索窓と同じ「まとめて検索」**に揃えてある。
 *    `components/jobseeker/JobseekerHeader.tsx` にも同じ言い回しの導線がある。
 *    **片方だけ変えないこと**（あちらはドロップダウンの中なので実装は別）。
 */
export function SearchAllLink({ q }: { q: string }) {
  const term = q.trim();
  if (!term) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <a
        href={`/search?q=${encodeURIComponent(term)}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: "var(--text-sm)", fontWeight: 600,
          color: "var(--royal)", textDecoration: "none",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
        </svg>
        {/* ⚠️ 入力語をそのまま出す。JSX なのでエスケープされる */}
        「{term}」をまとめて検索 →
      </a>
    </div>
  );
}

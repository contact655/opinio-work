"use client";

/** ★（気になる）のアイコン。⚠️ 色は塗り（royal）と線だけ。状態を色付きのバッジにしない */
export function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

/**
 * ★カードと右欄（詳細の名前の横）の★ボタン（2026-10-28 に CandidatesClient から切り出した。詳細でも同じ形・同じ動きにするため）。
 * ⚠️ 押しても候補者本人には何も届かない（会社の中だけ）。⚠️ aria-pressed で押した状態を伝える
 * ⚠️ 大きさと当たり判定は CSS（.cand-star。CandidatesClient の style）。--star-size で渡す
 */
export function StarButton({ starred, onToggle, size = 28 }: { starred: boolean; onToggle: () => void; size?: number }) {
  return (
    <button type="button" aria-pressed={starred} aria-label={starred ? "気になるから外す" : "気になるに保存"} title={starred ? "気になるから外す" : "気になる（社内で共有・本人には通知されません）"}
      data-state={starred ? "star-on" : "star-off"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className="btn-fixed-size cand-star"
      style={{ ["--star-size" as string]: `${size}px`, borderRadius: "50%", border: "none", background: "none", padding: 0, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", color: starred ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0 } as React.CSSProperties}>
      <StarIcon filled={starred} size={Math.round(size * 0.6)} />
    </button>
  );
}

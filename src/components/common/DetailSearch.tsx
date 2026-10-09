"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 一覧の「詳細検索」まわりの共通部品（2026-10-09）。
 *
 * ⚠️★ /companies・/jobs・/people の3つが使う。ページ側に同じボタンを書き直さないこと。
 *    それまで3ページに別々の実装があり、active の色・チェブロンの字形・バッジの余白・
 *    選択中のチップの大きさがページごとに少しずつ違っていた（docs/list-filters-20261009.md）。
 * ⚠️ 見た目は globals.css の `.csb-filter-toggle` / `.csb-active-chips` / `.csb-active-chip`
 *    （/companies のもの）に揃えた。クラス名は /companies 由来のまま。
 * ⚠️ 軸（何で絞るか）はページごとに違うので、ここには持たない。
 */

export type ActiveFilter = { key: string; label: string; clear: () => void };

/** 「詳細検索」ボタン。⚠️ 768px 未満はラベルが消える（`.tb-collapse-label`）ので、
 *  アイコンとバッジを外さないこと。 */
export function DetailSearchToggle({
  open,
  count,
  onToggle,
}: {
  open: boolean;
  /** いま効いている条件の数。0 ならバッジを出さない */
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`csb-filter-toggle tb-collapse-label${open || count > 0 ? " active" : ""}`}
      aria-label="詳細検索"
      aria-expanded={open}
      onClick={onToggle}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="11" y1="18" x2="13" y2="18" />
      </svg>
      <span className="tb-label">詳細検索</span>
      {count > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "1px 7px", borderRadius: 100,
          background: "var(--royal)", color: "#fff",
          fontFamily: "var(--font-inter), var(--font-noto)",
        }}>{count}</span>
      )}
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
        style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }}>
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * 選択中の条件のチップ。
 *
 * ⚠️★**詳細検索を閉じているときだけ出す**（呼び出し側で `!open` を渡す）。開いているときは
 *    ピル自身が選択状態を持っているので同じ語が2回並ぶ（/jobs 2026-09-09 の判断）。
 * ⚠️★**閉じているときに消さないこと。** 消すと絞り込んだ理由が画面から消える。
 * ⚠️ 行は `flex-basis: 100%` で必ず折る（同じ行だと開閉のたびに「詳細検索」が左右に動く）。
 */
export function ActiveFilterChips({ chips }: { chips: ActiveFilter[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="csb-active-chips">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="csb-active-chip"
          onClick={c.clear}
          aria-label={`${c.label} の絞り込みを外す`}
        >
          {c.label}
          <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.75 }}>✕</span>
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   詳細検索の中身の入れ物（2026-10-09 / docs/list-filters-20261009.md）
   ════════════════════════════════════════════════════════════════════════
   ★幅で開き方を変える。
     1024px 以上 … ページ内のパネル（結果が見えたままなので件数は要らない）
     1024px 未満 … 右から出るドロワー。結果が隠れるので下に「N件を表示」を出す
   ⚠️★件数を取れなかったときは 0 ではなく「—」。0 は「該当なし」と読まれる。
   ⚠️ 選んだ条件はその場で URL に入る（ドロワーの裏で一覧も変わる）。
      「N件を表示」はドロワーを閉じるだけ。
   ⚠️★ドロワーは body 直下に出す（ヘッダーの z-index 100 より上に出すため）。
      各ページの「外を押したらメニューを閉じる」は DOM の包含で判定しているので、
      ドロワーの中の mousedown はここで止める（止めないと、メニューの項目を押した瞬間に
      メニューが閉じて選べない）。 */


/** ドロワーにする幅（これ未満）。⚠️ globals.css の .ds-* の @media と合わせてある */
export const DETAIL_SEARCH_DRAWER_MAX = 1023;

function useIsDrawer(): boolean {
  const [isDrawer, setIsDrawer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DETAIL_SEARCH_DRAWER_MAX}px)`);
    const on = () => setIsDrawer(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return isDrawer;
}

/** 件数（ドロワーの「N件を表示」）。`countUrl` を渡すと少し待ってから取り直す */
function useDrawerCount(active: boolean, count: number | null | undefined, countUrl: string | undefined) {
  const [fetched, setFetched] = useState<{ url: string; n: number | null } | null>(null);
  useEffect(() => {
    if (!active || !countUrl) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(countUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { count?: unknown };
        if (alive) setFetched({ url: countUrl, n: typeof j.count === "number" ? j.count : null });
      } catch (e) {
        console.error("[DetailSearch] 件数を取れなかった:", e);
        if (alive) setFetched({ url: countUrl, n: null });
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [active, countUrl]);
  if (!countUrl) return { n: count ?? null, pending: false };
  /* ⚠️ 取り直している間は前の値を薄く出す（「—」にすると一瞬ごとに点滅する） */
  return { n: fetched ? fetched.n : null, pending: !fetched || fetched.url !== countUrl };
}

export function DetailSearchPanel({
  open,
  onClose,
  children,
  count,
  countUrl,
  unit = "件",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** その場で分かる件数（/jobs・/people はクライアントで絞るので同期で出せる） */
  count?: number | null;
  /** 件数を取りに行く URL（/companies）。`{ count: number }` を返すこと */
  countUrl?: string;
  unit?: string;
}) {
  const isDrawer = useIsDrawer();
  const { n, pending } = useDrawerCount(open && isDrawer, count, countUrl);

  useEffect(() => {
    if (!open || !isDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, isDrawer, onClose]);

  if (!open) return null;
  if (!isDrawer) return <div className="ds-panel">{children}</div>;

  return createPortal(
    <div data-detail-search-drawer onMouseDown={(e) => e.nativeEvent.stopPropagation()}>
      <div className="ds-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ds-drawer" role="dialog" aria-modal="true" aria-label="詳細検索">
        <div className="ds-drawer-head">
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>詳細検索</span>
          <button type="button" className="ds-drawer-close btn-fixed-size" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="ds-drawer-body">{children}</div>
        <div className="ds-drawer-foot">
          <button type="button" className="ds-show-btn" onClick={onClose} data-state={n === null && !pending ? "error" : pending ? "pending" : "ok"}>
            <span style={{ opacity: pending ? 0.5 : 1, fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {n === null ? "—" : n.toLocaleString("ja-JP")}
            </span>
            {unit}を表示
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import type React from "react";
/**
 * ★ホームの「新着の募集」と「記事」の枠（2026-10-20 / 柴さんの要望）。
 *   それまで募集と記事は1件ずつ投稿のカードとして流れ、「新しく掲載された企業」だけ見出し付きの枠だった。
 *   見出し・外枠・「すべて見る」を企業の枠（NewCompaniesCarousel の .ncc）にそろえる。
 * ⚠️ 描くだけ。DB を読まない（中身は FeedClient がシステム投稿 job_posted / article_published から組む）。
 * ⚠️ CSS は NEW_COMPANIES_CSS（.ncc / .ncc-head / .ncc-row）を前提にしている。同じ画面で一緒に出すこと。
 */
export type FeedJobItem = {
  id: string;
  href: string;
  title: string;
  companyName: string;
  logoUrl: string | null;
  logoLetter: string;
  /** 「800〜1,300万円」。無ければ出さない */
  salary: string | null;
};

export type FeedArticleItem = {
  id: string;
  href: string;
  title: string;
  /** 記事の種類（「取材記事」など）と日付。無ければ出さない */
  meta: string | null;
  /** アイキャッチの背景（グラデーション） */
  gradient: string | null;
  initial: string;
};

export const FEED_BLOCKS_CSS = `
  .fjc-card { flex: 0 0 200px; scroll-snap-align: start; border: 1px solid var(--line); border-radius: 12px; padding: 12px;
    display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: var(--ink); background: #fff; }
  .fjc-card:hover { border-color: var(--royal-100, #c7d2fe); }
  .fjc-co { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .fjc-logo { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line); flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #fff; font-weight: 800; font-size: 14px; color: #fff; }
  .fjc-logo img { width: 100%; height: 100%; object-fit: contain; }
  .fjc-coname { font-size: 12px; color: var(--ink-soft); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fjc-title { font-size: 13.5px; font-weight: 700; line-height: 1.45; min-height: 2.9em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .fjc-salary { font-size: 12.5px; font-weight: 700; color: var(--success-ink); min-height: 1.4em; }
  .fac-list { list-style: none; margin: 0; padding: 0 16px; display: grid; gap: 10px; }
  .fac-row { display: flex; gap: 12px; align-items: center; text-decoration: none; color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
  .fac-row:hover { border-color: var(--royal-100, #c7d2fe); }
  .fac-thumb { width: 72px; height: 54px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.9); font-weight: 800; font-size: 18px; background: linear-gradient(135deg,#001233,#002366); }
  .fac-title { font-size: 13.5px; font-weight: 700; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .fac-meta { font-size: 11.5px; color: var(--ink-mute); margin-top: 2px; }
`;

const LOGO_BG = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#db2777", "#ea580c"];

export function NewJobsCarousel({ items, totalCount, moreHref }: { items: FeedJobItem[]; totalCount: number; moreHref: string }) {
  if (items.length === 0) return null;
  return (
    <section className="ncc" data-state="new-jobs">
      <div className="ncc-head">
        <h3 className="ncc-title">新着の募集</h3>
        <a className="ncc-more" href={moreHref}>{totalCount}件すべて見る</a>
      </div>
      <div className="ncc-row">
        {items.map((j, i) => (
          <a key={j.id} href={j.href} className="fjc-card" title={j.title}>
            <span className="fjc-co">
              <span className="fjc-logo" style={j.logoUrl ? undefined : { background: LOGO_BG[i % LOGO_BG.length] }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {j.logoUrl ? <img src={j.logoUrl} alt="" /> : j.logoLetter}
              </span>
              <span className="fjc-coname">{j.companyName}</span>
            </span>
            <span className="fjc-title">{j.title}</span>
            <span className="fjc-salary">{j.salary ?? ""}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function ArticlesBlock({ items, moreHref }: { items: FeedArticleItem[]; moreHref: string }) {
  if (items.length === 0) return null;
  return (
    <section className="ncc" data-state="feed-articles">
      <div className="ncc-head">
        <h3 className="ncc-title">記事</h3>
        <a className="ncc-more" href={moreHref}>すべて見る</a>
      </div>
      <ul className="fac-list">
        {items.slice(0, 3).map((a) => (
          <li key={a.id}>
            <a href={a.href} className="fac-row">
              <span className="fac-thumb" style={a.gradient ? { background: a.gradient } as React.CSSProperties : undefined}>{a.initial}</span>
              <span style={{ minWidth: 0 }}>
                <span className="fac-title">{a.title}</span>
                {a.meta && <span className="fac-meta" style={{ display: "block" }}>{a.meta}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

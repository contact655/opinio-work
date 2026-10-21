import type React from "react";
/**
 * ★ホームの「新しく掲載された企業」（2026-10-19 / 見本。/dev/preview/feed-redesign）。
 *   それまでは「新規掲載」の企業カードが1社ずつ縦に並び、同じ形が延々と続いていた。1枚にまとめて横に送る。
 * ⚠️ 見本の段階。本物のホームにはまだ入れていない（OK をもらってから配線する）。
 * ⚠️ 描くだけ。DB を読まない。
 */
export type NewCompanyItem = {
  id: string;
  href: string;
  name: string;
  logoUrl: string | null;
  logoLetter: string;
  /** 主の事業領域 */
  domain: string | null;
  tagline: string | null;
};

export const NEW_COMPANIES_CSS = `
  .ncc { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px 0 12px; }
  .ncc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 16px 10px; }
  .ncc-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ncc-more { font-size: 12.5px; font-weight: 600; color: var(--royal); text-decoration: none; white-space: nowrap; }
  .ncc-row { display: flex; gap: 10px; overflow-x: auto; padding: 2px 16px 4px; scroll-snap-type: x mandatory; scrollbar-width: none; scroll-padding-inline: 16px; }
  .ncc-row::-webkit-scrollbar { display: none; }
  .ncc-card { flex: 0 0 132px; scroll-snap-align: start; border: 1px solid var(--line); border-radius: 12px; padding: 14px 12px 12px;
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; text-decoration: none; color: var(--ink); background: #fff; }
  .ncc-link { display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; color: var(--ink); width: 100%; }
  .ncc-logo { width: 56px; height: 56px; border-radius: 12px; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center;
    overflow: hidden; background: #fff; font-weight: 800; font-size: 22px; color: #fff; }
  .ncc-logo img { width: 100%; height: 100%; object-fit: contain; }
  .ncc-name { font-size: 13px; font-weight: 700; line-height: 1.4; min-height: 2.8em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .ncc-domain { font-size: 11.5px; color: var(--ink-mute); line-height: 1.4; min-height: 1.4em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .ncc-act { margin-top: 4px; width: 100%; display: flex; justify-content: center; }
  .ncc-follow { margin-top: 4px; width: 100%; padding: 6px 0; border-radius: 999px; border: 1.5px solid var(--royal); color: var(--royal);
    background: #fff; font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; }
`;

const LOGO_BG = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#db2777", "#ea580c"];

export function NewCompaniesCarousel({ items, totalCount, moreHref, renderFollow }: {
  items: NewCompanyItem[]; totalCount: number; moreHref: string;
  /** ★本物のフォローボタン（ホームでは企業のフォロー）。無ければ見本の飾りのボタン */
  renderFollow?: (c: NewCompanyItem) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="ncc" data-state="new-companies">
      <div className="ncc-head">
        <h3 className="ncc-title">新しく掲載された企業</h3>
        <a className="ncc-more" href={moreHref}>{totalCount}社すべて見る</a>
      </div>
      <div className="ncc-row">
        {items.map((c, i) => (
          <div key={c.id} className="ncc-card">
            {/* ⚠️ ボタンを a の中に入れない（押したら企業ページへ飛んでしまう）。リンクはロゴと社名だけ */}
            <a href={c.href} className="ncc-link" title={c.tagline ?? c.name}>
              <span className="ncc-logo" style={c.logoUrl ? undefined : { background: LOGO_BG[i % LOGO_BG.length] }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.logoLetter}
              </span>
              <span className="ncc-name">{c.name}</span>
            </a>
            <span className="ncc-domain">{c.domain ?? ""}</span>
            {renderFollow ? <div className="ncc-act">{renderFollow(c)}</div> : <button type="button" className="ncc-follow btn-fixed-size">＋ フォロー</button>}
          </div>
        ))}
      </div>
    </section>
  );
}

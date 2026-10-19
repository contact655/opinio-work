import type React from "react";
/**
 * ★「◯◯から次に進んだ人」（2026-10-19 / 見本。/dev/preview/feed-redesign）。
 *   **キャリアの移り変わり**が主役（LinkedIn の「つながりの提案」との違い）。
 *   形は縦長のカード（2列）。柴さんの判断「ユーザーや企業情報は縦型の方が見やすい」。
 *   カード: 色帯 ／ 顔（帯に重ねる） ／ 名前 ／ いまの職種 ／ 移り変わり（前の会社のロゴ → 次の会社のロゴ、次の会社名・年） ／ メッセージで聞く
 * ⚠️ 見本の段階。本物のホームにはまだ入れていない。描くだけで DB を読まない。
 * ⚠️ 「話を聞ける」「面談OK」とは書かない（2026-10-16 に撤去した意味づけ）。ボタンは「メッセージ」（カードの幅で折り返さないよう短くした）
 *    （押すと個人どうしの最初のメッセージ＝聞きたいテーマ＋どんな形で、が開く）。
 * ⚠️ 社名を出すのは、本人が「会社名を出す」にしている職歴だけ（公開プロフィールと同じ範囲）。配線するときに守ること。
 */
export type MoveCompany = { name: string; logoUrl: string | null };
export type CareerMovePerson = {
  id: string;
  href: string;
  name: string;
  avatarUrl: string | null;
  /** いまの職種（例: カスタマーサクセス） */
  role: string | null;
  from: MoveCompany;
  to: MoveCompany;
  /** 移った年 */
  movedYear: number | null;
};

export const CAREER_MOVES_CSS = `
  .cms { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px 12px 4px; }
  .cms-title { margin: 0 4px; font-size: 15px; font-weight: 700; color: var(--ink); }
  .cms-sub { margin: 2px 4px 12px; font-size: 12px; color: var(--ink-mute); line-height: 1.5; }
  .cms-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  @media (min-width: 768px) { .cms-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .cms-card { background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; min-width: 0;
    display: flex; flex-direction: column; align-items: center; text-align: center; padding-bottom: 12px; }
  .cms-band { width: 100%; height: 44px; }
  .cms-avatar { width: 68px; height: 68px; margin-top: -34px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; background: #1e3a8a; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 26px; text-decoration: none; }
  .cms-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cms-name { margin-top: 6px; padding: 0 10px; max-width: 100%; font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: none;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cms-role { padding: 0 10px; max-width: 100%; font-size: 12px; color: var(--ink-mute); min-height: 1.5em; line-height: 1.5;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cms-move { margin: 10px 10px 0; width: calc(100% - 20px); padding: 8px 6px; border-radius: 10px; background: #f6f7f9; min-width: 0; }
  .cms-logos { display: flex; align-items: center; justify-content: center; gap: 6px; }
  .cms-logo { width: 26px; height: 26px; border-radius: 7px; background: #fff; border: 1px solid var(--line); overflow: hidden; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--ink-soft); }
  .cms-logo img { width: 100%; height: 100%; object-fit: contain; }
  .cms-arrow { color: var(--ink-mute); font-size: 13px; }
  .cms-to { margin-top: 5px; font-size: 12.5px; font-weight: 700; color: var(--ink); line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; min-height: 2.8em; }
  .cms-year { font-size: 11.5px; color: var(--ink-mute); min-height: 1.5em; }
  .cms-cta { margin-top: 10px; width: calc(100% - 20px); display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 0;
    border-radius: 999px; border: 1.5px solid var(--royal); color: var(--royal); background: #fff; font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .cms-act { margin-top: 10px; width: calc(100% - 20px); display: flex; justify-content: center; }
  .cms-more { display: block; text-align: center; padding: 12px 0 10px; font-size: 13px; font-weight: 600; color: var(--ink-soft); text-decoration: none; }
`;

const BANDS = ["linear-gradient(135deg,#dbeafe,#bfdbfe)", "linear-gradient(135deg,#e0e7ff,#c7d2fe)", "linear-gradient(135deg,#dcfce7,#bbf7d0)", "linear-gradient(135deg,#fef3c7,#fde68a)"];

function Logo({ c }: { c: MoveCompany }) {
  return (
    <span className="cms-logo" title={c.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name.charAt(0)}
    </span>
  );
}

/**
 * @param hideFrom 移る前の会社のロゴを出さない（見出しが「Salesforce から次に進んだ人」のように、移る前の会社をもう言っているとき）
 */
export function CareerMovesSection<P extends CareerMovePerson>({ title, sub, people, moreHref, hideFrom = false, renderAction }: {
  title: string; sub?: string; people: P[]; moreHref?: string; hideFrom?: boolean;
  /** ★本物のボタン（ホームでは DMButton）。無ければ見本の飾りのボタン */
  renderAction?: (p: P) => React.ReactNode;
}) {
  if (people.length === 0) return null;
  return (
    <section className="cms" data-state="career-moves">
      <h3 className="cms-title">{title}</h3>
      {sub && <p className="cms-sub">{sub}</p>}
      <div className="cms-grid">
        {people.map((p, i) => (
          <div key={p.id} className="cms-card">
            <div className="cms-band" style={{ background: BANDS[i % BANDS.length] }} />
            <a href={p.href} className="cms-avatar" aria-label={p.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
            </a>
            <a href={p.href} className="cms-name" title={p.name}>{p.name}</a>
            <div className="cms-role" title={p.role ?? undefined}>{p.role ?? ""}</div>
            <div className="cms-move" aria-label={`${hideFrom ? "" : `${p.from.name}から`}${p.to.name}へ`}>
              <div className="cms-logos">
                {!hideFrom && <><Logo c={p.from} /><span className="cms-arrow" aria-hidden>→</span></>}
                {hideFrom && <span className="cms-arrow" aria-hidden>次は</span>}
                <Logo c={p.to} />
              </div>
              <div className="cms-to" title={p.to.name}>{p.to.name}</div>
              <div className="cms-year">{p.movedYear ? `${p.movedYear}年` : ""}</div>
            </div>
            {renderAction ? <div className="cms-act">{renderAction(p)}</div> : <button type="button" className="cms-cta btn-fixed-size">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              メッセージ
            </button>}
          </div>
        ))}
      </div>
      {moreHref && <a className="cms-more" href={moreHref}>すべて見る</a>}
    </section>
  );
}

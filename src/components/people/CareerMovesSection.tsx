/**
 * ★「◯◯から次に進んだ人」（2026-10-19 / 見本。/dev/preview/feed-redesign）。
 *   LinkedIn の「つながりの提案」（顔写真のグリッド＋つながる）と同じ形にしないため、**キャリアの移り変わり**を主役にする。
 *   1人1行: 顔 ／ 名前・いまの職種 ／ 「前の会社 → 次の会社・移った年」 ／ 「メッセージで聞く」。
 * ⚠️ 見本の段階。本物のホームにはまだ入れていない。描くだけで DB を読まない。
 * ⚠️ 「話を聞ける」「面談OK」とは書かない（2026-10-16 に撤去した意味づけ）。ボタンは「メッセージで聞く」
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
  .cms { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 14px 14px 4px; }
  .cms-title { margin: 0; font-size: 15px; font-weight: 700; color: var(--ink); }
  .cms-sub { margin: 2px 0 8px; font-size: 12px; color: var(--ink-mute); line-height: 1.5; }
  .cms-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 4px 10px; padding: 12px 0; border-top: 1px solid var(--line); }
  .cms-row:first-of-type { border-top: 0; }
  .cms-avatar { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #1e3a8a; color: #fff; display: flex;
    align-items: center; justify-content: center; font-weight: 700; font-size: 17px; text-decoration: none; grid-row: span 2; }
  .cms-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cms-name { font-size: 14px; font-weight: 700; color: var(--ink); text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cms-role { font-weight: 400; font-size: 12px; color: var(--ink-mute); margin-left: 6px; }
  .cms-move { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; font-size: 12.5px; color: var(--ink); }
  .cms-co { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; padding: 3px 8px 3px 3px; border-radius: 999px;
    background: var(--royal-50, #eef2ff); font-weight: 600; }
  .cms-co span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cms-co-from { background: #f1f3f6; color: var(--ink-soft); }
  .cms-logo { width: 20px; height: 20px; border-radius: 5px; background: #fff; border: 1px solid var(--line); flex-shrink: 0; overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: var(--ink-soft); }
  .cms-logo img { width: 100%; height: 100%; object-fit: contain; }
  .cms-arrow { color: var(--ink-mute); font-size: 13px; }
  .cms-year { font-size: 11.5px; color: var(--ink-mute); white-space: nowrap; }
  .cms-cta { grid-column: 2; justify-self: start; margin-top: 6px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 999px;
    border: 1.5px solid var(--royal); color: var(--royal); background: #fff; font-size: 12.5px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .cms-more { display: block; text-align: center; padding: 10px 0 10px; border-top: 1px solid var(--line); font-size: 13px; font-weight: 600; color: var(--ink-soft); text-decoration: none; }
`;

function Co({ c, from }: { c: MoveCompany; from?: boolean }) {
  return (
    <span className={`cms-co${from ? " cms-co-from" : ""}`} title={c.name}>
      <span className="cms-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name.charAt(0)}
      </span>
      <span>{c.name}</span>
    </span>
  );
}

/**
 * @param hideFrom 移る前の会社を出さない（見出しが「Salesforce から次に進んだ人」のように、移る前の会社をもう言っているとき）
 */
export function CareerMovesSection({ title, sub, people, moreHref, hideFrom = false }: { title: string; sub?: string; people: CareerMovePerson[]; moreHref?: string; hideFrom?: boolean }) {
  if (people.length === 0) return null;
  return (
    <section className="cms" data-state="career-moves">
      <h3 className="cms-title">{title}</h3>
      {sub && <p className="cms-sub">{sub}</p>}
      {people.map((p) => (
        <div key={p.id} className="cms-row">
          <a href={p.href} className="cms-avatar" aria-label={p.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
          </a>
          <a href={p.href} className="cms-name" title={p.name}>
            {p.name}{p.role && <span className="cms-role">{p.role}</span>}
          </a>
          <div className="cms-move" style={{ gridColumn: 2 }}>
            {!hideFrom && <Co c={p.from} from />}
            <span className="cms-arrow" aria-label={hideFrom ? "次の会社" : "から"}>→</span>
            <Co c={p.to} />
            {p.movedYear && <span className="cms-year">{p.movedYear}年{hideFrom ? "に移った" : ""}</span>}
          </div>
          <button type="button" className="cms-cta btn-fixed-size">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            メッセージで聞く
          </button>
        </div>
      ))}
      {moreHref && <a className="cms-more" href={moreHref}>すべて見る</a>}
    </section>
  );
}

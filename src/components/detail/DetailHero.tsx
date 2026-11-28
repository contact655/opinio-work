import type React from "react";

/**
 * ★企業詳細・募集詳細の冒頭のカード（2026-11-26 / 柴さんの指示。2ページ共通）。
 *   白いカードの中に、ロゴ → カテゴリ → 名前 → 正式社名（企業のみ）→ タグライン → 要点チップ → メタ行 → ボタン。
 *
 * ★1024px 以上は横3列（2026-11-28 / 柴さんの指示。右側の空きをなくす）:
 *     [ロゴ 88px] [本文（残りの幅をすべて・min-width 0）] [ボタン類（右上・最大36%・入らなければ折り返す）]
 *   1023px 以下は縦並び（ロゴ 72px → 本文 → ボタン）のまま。
 *   ⚠️ ロゴは呼び出し側が size 88 で渡し、1023px 以下はここで 72px に縮める（CompanyLogo の幅はインライン指定のため）。
 *   ⚠️ 一番目立つボタンを actions の先頭に置くこと（企業＝フォロー、募集＝話を聞いてみたい）。
 *
 * ⚠️ カバー画像は描かない。2026-11-26 時点で独自のカバー画像を持つ会社は0社（オフィス写真0・header_image_url 0）。
 *    入れる会社が出たら、ここに高さ120px以内で足す。
 * ⚠️ 値の無い行は描かない（「未登録」などを出さない）。
 * ⚠️ `data-cd-hero` は企業ページの下の固定バー（CtaReveal）が見ている。外さないこと。
 * ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（ハイドレーションが壊れる）。
 */
export function DetailHero({ logo, category, title, formalName, note, tagline, chips, meta, actions, state }: {
  logo: React.ReactNode;
  /** 名前の上の小さい行（企業＝業種、募集＝会社名のリンク） */
  category?: React.ReactNode;
  title: string;
  /** 正式社名（企業のみ。表示名と違うときだけ渡す） */
  formalName?: string | null;
  /** 運営会社の開示など、名前のすぐ下に出す1行 */
  note?: React.ReactNode;
  tagline?: string | null;
  /** HeroChip を並べる */
  chips?: React.ReactNode;
  meta?: string[];
  actions?: React.ReactNode;
  state: string;
}) {
  return (
    <header className="jd-card dh" data-cd-hero data-state={state}>
      <div className="dh-body">
        <div className="dh-logo"><div className="dh-logo-in">{logo}</div></div>
        <div className="dh-main">
          {category && <div className="dh-cat">{category}</div>}
          {note}
          <h1 className="dh-title">{title}</h1>
          {formalName && <p className="dh-formal">{formalName}</p>}
          {tagline && <p className="dh-tagline">{tagline}</p>}
          {chips && <div className="dh-chips" data-state={`${state}-chips`}>{chips}</div>}
          {meta && meta.length > 0 && (
            <p className="dh-meta" data-state={`${state}-meta`}>
              {meta.map((m, i) => (
                <span key={m}>{i > 0 && <span aria-hidden style={{ margin: "0 8px" }}>・</span>}<span style={{ whiteSpace: "nowrap" }}>{m}</span></span>
              ))}
            </p>
          )}
        </div>
        {actions && <div className="dh-actions" data-state={`${state}-actions`}>{actions}</div>}
      </div>
      <style>{`
        .dh { overflow: hidden; }
        .dh-body { padding: 24px 32px 26px; }
        .dh-logo { width: 72px; height: 72px; }
        .dh-logo-in { width: 88px; height: 88px; transform: scale(0.8182); transform-origin: top left; }
        .dh-main { margin-top: 14px; min-width: 0; }
        .dh-cat { font-size: 14px; font-weight: 700; color: var(--ink-soft); overflow-wrap: anywhere; }
        .dh-title { margin: 4px 0 0; font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1.45; overflow-wrap: anywhere; }
        .dh-formal { margin: 2px 0 0; font-size: 14px; color: var(--ink-mute); overflow-wrap: anywhere; }
        .dh-tagline { margin: 10px 0 0; font-size: 15px; color: var(--ink); line-height: 1.75; max-width: 680px; }
        .dh-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
        .dh-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: var(--bg-tint); border: 1px solid var(--line); font-size: 13px; color: var(--ink); line-height: 1.5; white-space: nowrap; max-width: 100%; }
        .dh-chip--strong { font-weight: 700; }
        .dh-chip svg { flex-shrink: 0; color: var(--ink-mute); }
        .dh-meta { margin: 12px 0 0; font-size: 13px; color: var(--ink-mute); line-height: 1.7; }
        .dh-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; min-width: 0; }
        @media (min-width: 1024px) {
          .dh-body { display: flex; align-items: flex-start; gap: 24px; padding: 22px 28px; }
          .dh-logo { flex: 0 0 88px; width: 88px; height: 88px; }
          .dh-logo-in { transform: none; }
          .dh-main { flex: 1 1 0; margin-top: 0; }
          .dh-chips { margin-top: 12px; }
          .dh-actions { flex: 0 1 auto; max-width: 36%; justify-content: flex-end; margin-top: 0; }
        }
        @media (max-width: 640px) {
          .dh-body { padding: 18px 18px 22px; }
          .dh-title { font-size: 22px; }
          .dh-chip { white-space: normal; }
        }
      `}</style>
    </header>
  );
}

/** 要点チップ。`icon` は 24×24 の SVG の中身（path など） */
export function HeroChip({ icon, strong = false, children }: { icon?: React.ReactNode; strong?: boolean; children: React.ReactNode }) {
  return (
    <span className={strong ? "dh-chip dh-chip--strong" : "dh-chip"}>
      {icon && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icon}</svg>
      )}
      <span>{children}</span>
    </span>
  );
}

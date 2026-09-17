import React from "react";

/*
 * 「提案のしくみ」の左：ある人の職歴年表。
 *
 * ⚠️ ここは SVG ではなく HTML。文字が主役なので、幅に応じて折り返せる
 *    ほうがよい（SVG の <text> は折り返さないので 390px で切れる）。
 *
 * ⚠️★**架空の経歴。** 実在の企業名・個人を入れないこと。
 *    図の下の注記（「※ 本ページの図は仕組みのイメージです」）と対になっている。
 *
 * ⚠️ 点の濃さは 1 → 0.6 → 0.35 で「さかのぼる」ことを示す。上が新しい。
 */

const STEPS = [
  { title: "外資SaaS　法人営業", sub: "2年　現職", dot: 1 },
  { title: "国内SaaS　インサイドセールス", sub: "2年", dot: 0.6 },
  { title: "SIer　システム提案営業", sub: "3年　新卒", dot: 0.35 },
];

export function CareerTimeline() {
  return (
    <div>
      <style>{`
        .lpct-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .lpct-list { position: relative; padding-left: 26px; }
        .lpct-row { position: relative; padding: 12px 0; }
        .lpct-row + .lpct-row { border-top: 1px solid var(--line-soft); }
        .lpct-dot {
          position: absolute; left: -26px; top: 20px;
          width: 11px; height: 11px; border-radius: 50%;
          background: var(--royal);
          box-shadow: 0 0 0 4px #fff;
        }
      `}</style>

      <div className="lpct-head">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="20" cy="20" r="20" fill="var(--royal-50)" />
          <g fill="var(--royal)">
            <circle cx="20" cy="16" r="6" />
            <path d="M 9.5 33 a 10.5 9.5 0 0 1 21 0 z" />
          </g>
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
            SaaS 法人営業　7年
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>
            東京 ／ 在職中
          </div>
        </div>
      </div>

      <div className="lpct-list">
        {/* 縦線。⚠️★`::before` にしないこと —— `content: ""` の引用符は
               style タグのテンプレートリテラルの中でサーバー側だけ実体参照になり、
               style は RAWTEXT なので復号されない（＝CSS が壊れて線が消える）。 */}
        <span aria-hidden="true" style={{
          position: "absolute", left: 5, top: 14, bottom: 14,
          width: 1.5, background: "var(--line)",
        }} />
        {STEPS.map((s) => (
          <div key={s.title} className="lpct-row">
            <span className="lpct-dot" style={{ opacity: s.dot }} aria-hidden="true" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.6 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7, marginTop: 2 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CareerTimeline;

import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * ★一覧の上部（検索・絞り込み・並び替え）の見直し案（2026-10-20 / 柴さんの要望）。/companies・/jobs・/people。
 * ⚠️ 見た目だけの見本（押しても何も起きない）。DB を読まない。
 *
 * 案の考え方（LinkedIn の検索結果の形）:
 *   1行目: 検索欄をそのまま出す（🔍 だけのボタンにしない。何で探せるかを例文で伝える）
 *   2行目: 「絞り込み」＋よく使う条件のチップを横に並べる（3画面で同じ並べ方。アイコンだけのボタンにしない）
 *   3行目: 件数（左）と並び替え（右・文字だけ）。並び替えを大きなボタンにしない
 */
const CSS = `
  .lt { background: #fff; border-bottom: 1px solid var(--line); padding: 12px 16px 10px; display: grid; gap: 10px; }
  .lt-search { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 14px; border-radius: 999px; background: var(--bg-tint, #f4f6fb);
    border: 1px solid transparent; color: var(--ink-mute); font-size: 14.5px; white-space: nowrap; overflow: hidden; }
  .lt-search svg { flex-shrink: 0; }
  .lt-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
  .lt-chips::-webkit-scrollbar { display: none; }
  .lt-chip { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 14px; border-radius: 999px;
    border: 1px solid var(--line); background: #fff; font-size: 13.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
  .lt-chip--main { border-color: var(--royal); color: var(--royal); }
  .lt-chip--on { background: var(--royal); border-color: var(--royal); color: #fff; }
  .lt-badge { min-width: 18px; height: 18px; border-radius: 9px; background: var(--royal); color: #fff; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; }
  .lt-result { display: flex; align-items: baseline; justify-content: space-between; font-size: 13px; color: var(--ink-soft); }
  .lt-result b { color: var(--ink); font-size: 15px; }
  .lt-sort { font-weight: 600; color: var(--ink); display: inline-flex; align-items: center; gap: 2px; }
  .lt-frame { max-width: 420px; margin: 0 auto; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg, #f4f5f7); }
  .lt-body { padding: 12px 16px; font-size: 12px; color: var(--ink-mute); }
`;

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);
const Filter = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
);

function Toolbar({ placeholder, chips, count, unit, on = [], filterCount = 0 }: {
  placeholder: string; chips: string[]; count: number; unit: string; on?: string[]; filterCount?: number;
}) {
  return (
    <div className="lt-frame">
      <div className="lt">
        <div className="lt-search">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          {placeholder}
        </div>
        <div className="lt-chips">
          <span className="lt-chip lt-chip--main"><Filter />絞り込み{filterCount > 0 && <span className="lt-badge">{filterCount}</span>}</span>
          {chips.map((c) => (
            <span key={c} className={`lt-chip${on.includes(c) ? " lt-chip--on" : ""}`}>{c}<Chevron /></span>
          ))}
        </div>
        <div className="lt-result">
          <span><b>{count}</b> {unit}</span>
          <span className="lt-sort">新着順<Chevron /></span>
        </div>
      </div>
      <div className="lt-body">（ここから一覧）</div>
    </div>
  );
}

export default function ListToolbarPreview() {
  devOnly();
  return (
    <div>
      <style>{CSS}</style>
      <PreviewHeader title="一覧の上部の見直し案（企業・募集・ユーザー）">
        <strong>1行目に検索欄</strong>、<strong>2行目に「絞り込み」とよく使う条件</strong>、<strong>3行目に件数と並び替え（文字だけ）</strong>。
        3画面で同じ並べ方にそろえます。ブラウザを 375px にして見てください（条件のチップは横にスクロール）。
      </PreviewHeader>
      <Variant label="企業（/companies）" note="外に出す条件: 事業領域・都道府県・フェーズ。残り（業種・顧客の業界など）は「絞り込み」の中">
        <Toolbar placeholder="企業名・キーワードで検索" chips={["事業領域", "都道府県", "フェーズ"]} count={21} unit="社" />
      </Variant>
      <Variant label="募集（/jobs）" note="外に出す条件: 職種・勤務地・年収・働き方。残りは「絞り込み」の中">
        <Toolbar placeholder="職種・会社名で検索" chips={["職種", "勤務地", "年収", "働き方"]} count={2} unit="件" />
      </Variant>
      <Variant label="ユーザー（/people）" note="外に出す条件: 職種・年代・外資">
        <Toolbar placeholder="名前・会社名・職種で検索" chips={["職種", "年代", "外資"]} count={41} unit="名" />
      </Variant>
      <Variant label="条件を選んでいるとき（例：募集で職種と勤務地）" note="選んだチップは塗りつぶし、「絞り込み」に件数のバッジ">
        <Toolbar placeholder="職種・会社名で検索" chips={["職種：営業", "勤務地：東京都", "年収", "働き方"]} on={["職種：営業", "勤務地：東京都"]} filterCount={2} count={1} unit="件" />
      </Variant>
    </div>
  );
}

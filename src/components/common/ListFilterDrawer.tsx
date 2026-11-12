"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ★一覧の「フィルター」パネル（2026-11-12 / 柴さんの指示「企業と募集もユーザーと同じようにしたい」）。
 *   /people の PeopleFilterDrawer と同じ形（右から出るパネル・767px 以下は下から出るシート）を、
 *   /companies と /jobs で使えるように項目を外から渡す形にしたもの。
 *
 *   ・中で選んだ条件は「結果を表示」を押したときにまとめて当てる（呼び出し側が URL を1回だけ書き換える）
 *   ・条件の意味は呼び出し側の URL のまま（同じ項目の中は OR・項目どうしは AND）。ここで新しい条件を作らない
 *   ・件数は選択肢に添えるだけ（「結果を表示」には付けない。/people と同じ）
 *
 * ⚠️ /people は PeopleFilterDrawer のまま（前の経歴の欄など、項目が専用のため）。見た目を変えるときは両方そろえること。
 */
export type FilterOpt = {
  value: string;
  label: string;
  /** 見出し（同じ group が続くあいだ1回だけ出す） */
  group?: string;
  count?: number;
  /** 薄く出す（該当0件の都道府県など） */
  muted?: boolean;
  /** 説明（事業ステージ・フェーズ） */
  desc?: string;
  /** 一段下げて出す（フェーズの子） */
  indent?: boolean;
  /** 検索したときだけ出す（事業の「search」の分類）。選択中なら常に出す */
  searchOnly?: boolean;
  keywords?: string;
};

export type FilterSection =
  | { key: string; title: string; kind: "multi" | "single"; options: FilterOpt[]; searchable?: boolean; hint?: string; columns?: 1 | 2 }
  | { key: string; title: string; kind: "toggle"; label: string }
  /* ★キーワード（2026-11-12 / 柴さんの指示。一覧の上の検索欄をパネルへ移した）。値は [入力した文字] か [] */
  | { key: string; title: string; kind: "text"; placeholder: string; hint?: string };

/** 項目ごとの選んでいる値。toggle は ["1"] か []。single は [値] か [] */
export type FilterValues = Record<string, string[]>;

export function ListFilterDrawer({
  open, onClose, title, sections, values, onApply, onReset,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: FilterSection[];
  values: FilterValues;
  onApply: (next: FilterValues) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<FilterValues>(values);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  /* 開くたびに、いま効いている条件から始める */
  useEffect(() => { if (open) { setDraft(values); setQueries({}); } }, [open, values]);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;

  const get = (k: string) => draft[k] ?? [];
  const toggleMulti = (k: string, v: string) =>
    setDraft((d) => { const cur = d[k] ?? []; return { ...d, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }; });
  const toggleSingle = (k: string, v: string) =>
    setDraft((d) => ({ ...d, [k]: (d[k] ?? [])[0] === v ? [] : [v] }));

  /* ★body の直下に出す（createPortal）。一覧の上部（貼り付く帯）は z-index を持つので、その中に置くと
        スマホで下のタブバーがパネルの「結果を表示」を覆う（2026-11-12 に /companies・/jobs で実測） */
  return createPortal(
    <div className="lfd-root" data-state="list-filter-drawer">
      <style>{LFD_CSS}</style>
      <button type="button" className="lfd-backdrop" aria-label="閉じる" onClick={onClose} />
      <div ref={panelRef} className="lfd-panel" role="dialog" aria-modal="true" aria-labelledby="lfd-title" tabIndex={-1}>
        <div className="lfd-head">
          <h2 id="lfd-title" className="lfd-title">{title}</h2>
          <button type="button" className="lfd-x" aria-label="閉じる" onClick={onClose}>✕</button>
        </div>
        <div className="lfd-body">
          {sections.map((s) => (
            <section key={s.key} className="lfd-sec" data-state={`lfd-${s.key}`}>
              <h3 className="lfd-sec-title">{s.title}</h3>
              {s.kind === "text" ? (
                <>
                  {s.hint && <p className="lfd-note">{s.hint}</p>}
                  <input type="search" className="lfd-search lfd-keyword" value={get(s.key)[0] ?? ""} placeholder={s.placeholder}
                    aria-label={s.title} enterKeyHint="search"
                    onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, [s.key]: v ? [v] : [] })); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); onApply(trimDraft(draft)); onClose(); } }} />
                </>
              ) : s.kind === "toggle" ? (
                <label className="lfd-opt">
                  <input type="checkbox" checked={get(s.key).length > 0}
                    onChange={() => setDraft((d) => ({ ...d, [s.key]: (d[s.key] ?? []).length > 0 ? [] : ["1"] }))} />
                  <span>{s.label}</span>
                </label>
              ) : (
                <OptionList section={s as Extract<FilterSection, { kind: "multi" | "single" }>} selected={get(s.key)} query={queries[s.key] ?? ""}
                  onQuery={(q) => setQueries((m) => ({ ...m, [s.key]: q }))}
                  onPick={(v) => (s.kind === "multi" ? toggleMulti(s.key, v) : toggleSingle(s.key, v))} />
              )}
            </section>
          ))}
        </div>
        <div className="lfd-foot">
          <button type="button" className="lfd-btn lfd-reset" data-action="lfd-reset" onClick={() => { onReset(); onClose(); }}>リセット</button>
          <button type="button" className="lfd-btn lfd-apply" data-action="lfd-apply" onClick={() => { onApply(trimDraft(draft)); onClose(); }}>結果を表示</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** キーワードの前後の空白を落とし、空になったら外す（URL に空の q を残さない） */
function trimDraft(d: FilterValues): FilterValues {
  const out: FilterValues = {};
  for (const [k, v] of Object.entries(d)) out[k] = v.map((x) => x.trim()).filter(Boolean);
  return out;
}

function OptionList({ section, selected, query, onQuery, onPick }: {
  section: Extract<FilterSection, { kind: "multi" | "single" }>;
  selected: string[];
  query: string;
  onQuery: (q: string) => void;
  onPick: (v: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => section.options.filter((o) => {
    if (selected.includes(o.value)) return true;
    if (!q) return !o.searchOnly;
    return o.label.toLowerCase().includes(q) || (o.keywords ?? "").toLowerCase().includes(q);
  }), [section.options, selected, q]);
  let lastGroup: string | undefined;
  return (
    <>
      {section.hint && <p className="lfd-note">{section.hint}</p>}
      {section.searchable && (
        <input type="search" className="lfd-search" value={query} onChange={(e) => onQuery(e.target.value)}
          placeholder={`${section.title}を探す`} aria-label={`${section.title}を探す`} />
      )}
      <div className={`lfd-grid${section.columns === 1 ? " lfd-grid--one" : ""}`}>
        {visible.map((o) => {
          const head = o.group && o.group !== lastGroup ? o.group : null;
          lastGroup = o.group;
          return (
            <FragmentWithHead key={o.value} head={head}>
              <label className={`lfd-opt${o.muted ? " lfd-opt--muted" : ""}${o.indent ? " lfd-opt--indent" : ""}`}>
                <input type={section.kind === "single" ? "radio" : "checkbox"} name={section.kind === "single" ? `lfd-${section.key}` : undefined}
                  checked={selected.includes(o.value)} onChange={() => onPick(o.value)}
                  onClick={section.kind === "single" && selected.includes(o.value) ? () => onPick(o.value) : undefined} />
                <span className="lfd-opt-text">
                  <span>{o.label}{typeof o.count === "number" && <span className="lfd-count">{o.count}</span>}</span>
                  {o.desc && <span className="lfd-desc">{o.desc}</span>}
                </span>
              </label>
            </FragmentWithHead>
          );
        })}
        {visible.length === 0 && <p className="lfd-note">当てはまるものがありません</p>}
      </div>
    </>
  );
}

function FragmentWithHead({ head, children }: { head: string | null; children: React.ReactNode }) {
  return (
    <>
      {head && <div className="lfd-group">{head}</div>}
      {children}
    </>
  );
}

/**
 * ★選んでいる条件のチップ（2026-11-12）。パネルを閉じていても、いま効いている条件を一覧の上に出す。
 *   ⚠️ 消さないこと。条件をパネルに畳んだので、これが無いと絞り込んだ理由が画面から消える（/people と同じ判断）
 */
export function ActiveFilterRow({ chips }: { chips: { key: string; label: string; onRemove: () => void }[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="list-toolbar lfd-active-row" data-state="list-active-row">
      <style>{LFD_ACTIVE_CSS}</style>
      {chips.map((c) => (
        <button key={c.key} type="button" className="lfd-active-chip" data-state="list-active-chip"
          onClick={c.onRemove} aria-label={`${c.label}の条件を外す`} title={c.label}>
          {c.label}<span aria-hidden style={{ fontSize: 12, opacity: 0.85, marginLeft: 4 }}>✕</span>
        </button>
      ))}
    </div>
  );
}

/** 「フィルター」ボタン（/people の .ppl-all-filters と同じ見た目） */
export function FilterButton({ count, onClick, ariaName = "すべてのフィルター" }: { count: number; onClick: () => void; ariaName?: string }) {
  return (
    <>
    {/* ⚠️ style をボタンの中に置かない（ボタンの文字にスタイルの中身が混ざる） */}
    <style>{LFD_BTN_CSS}</style>
    <button type="button" className="lfd-open-btn" data-action="list-all-filters" onClick={onClick} aria-haspopup="dialog"
      aria-label={count > 0 ? `${ariaName}（${count}件の条件）` : ariaName}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden style={{ marginRight: 6, flexShrink: 0 }}>
        <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2.2" fill="#fff" />
        <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2.2" fill="#fff" />
        <line x1="4" y1="18" x2="20" y2="18" /><circle cx="7" cy="18" r="2.2" fill="#fff" />
      </svg>
      フィルター{count > 0 && <span className="lfd-open-count">{count}</span>}
    </button>
    </>
  );
}

/* ⚠️ style タグの中。バッククォートと不等号を書かないこと */
const LFD_BTN_CSS = `
  .lfd-open-btn { display: inline-flex; align-items: center; height: 40px; min-height: 40px; box-sizing: border-box; padding: 0 14px;
    border-radius: 999px; border: 1.5px solid var(--royal); background: #fff; color: var(--royal); font-size: 13px; font-weight: 600;
    font-family: inherit; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .lfd-open-btn:hover { background: var(--royal-50, #f1f5fb); }
  .lfd-open-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px;
    margin-left: 6px; border-radius: 999px; background: var(--royal); color: #fff; font-size: 11px; font-weight: 700; }
`;

const LFD_ACTIVE_CSS = `
  .lfd-active-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 10px; }
  .lfd-active-chip { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--royal);
    background: var(--royal); color: #fff; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap;
    max-width: 280px; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
  @media (max-width: 767px) { .lfd-active-row { flex-wrap: nowrap; overflow-x: auto; } }
`;

const LFD_CSS = `
  .lfd-root { position: fixed; inset: 0; z-index: 1400; }
  .lfd-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,0.35); border: none; padding: 0; cursor: pointer; }
  .lfd-panel {
    position: absolute; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100%;
    background: #fff; display: flex; flex-direction: column; outline: none;
    box-shadow: -8px 0 24px rgba(15,23,42,0.12); font-family: var(--font-inter), var(--font-noto);
  }
  .lfd-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--line); }
  .lfd-title { margin: 0; font-size: 17px; font-weight: 800; color: var(--ink); }
  .lfd-x { width: 44px; height: 44px; border: none; background: none; font-size: 20px; color: var(--ink-soft); cursor: pointer; border-radius: 8px; }
  .lfd-body { flex: 1; overflow-y: auto; padding: 4px 20px 16px; }
  .lfd-sec { padding: 16px 0; border-bottom: 1px solid var(--line); }
  .lfd-sec:last-child { border-bottom: none; }
  .lfd-sec-title { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--ink); }
  .lfd-search { width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; font-family: inherit; }
  .lfd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; }
  .lfd-grid--one { grid-template-columns: 1fr; }
  .lfd-group { grid-column: 1 / -1; margin: 8px 0 2px; font-size: 12px; font-weight: 700; color: var(--ink-mute); }
  .lfd-opt { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; color: var(--ink); cursor: pointer; min-width: 0; }
  .lfd-opt input { width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--royal); margin: 0; }
  .lfd-opt-text { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .lfd-opt--muted { color: var(--ink-mute); }
  .lfd-opt--indent { padding-left: 18px; }
  .lfd-count { margin-left: 6px; font-size: 12px; color: var(--ink-mute); }
  .lfd-desc { font-size: 12px; color: var(--ink-mute); line-height: 1.5; }
  .lfd-note { margin: 0 0 8px; font-size: 12.5px; color: var(--ink-mute); line-height: 1.7; grid-column: 1 / -1; }
  .lfd-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--line); }
  .lfd-btn { min-height: 44px; padding: 0 20px; border-radius: 999px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .lfd-reset { border: 1.5px solid var(--line); background: #fff; color: var(--ink); }
  .lfd-apply { border: none; background: var(--royal); color: #fff; }
  @media (max-width: 767px) {
    .lfd-panel { top: auto; left: 0; width: auto; max-height: 85vh; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 24px rgba(15,23,42,0.12); }
    .lfd-grid { grid-template-columns: 1fr; }
  }
`;

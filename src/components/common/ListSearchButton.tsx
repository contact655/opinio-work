"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ★一覧ページの「一覧内を検索」（2026-10-01 / 柴さんの指示。ステップ2）
 *
 * 1段目に**ボタン**として置き、押すとその場で入力欄が開く。Enter で確定すると
 * **チップ**になり、✕ で外す。Esc と外側クリックで閉じる。
 *
 * ⚠️★**4ページ（/companies /jobs /people /articles）が共有する唯一の実装。**
 *    コピーして持っていかないこと —— 企業名の表示が3実装に割れた前例がある。
 *
 * ⚠️★**ヘッダーの横断検索とは役割が違う。** あちらは `/search` へ飛ぶ（サイト全体）。
 *    こちらは**その一覧の中だけ**を絞り込む。文言を混ぜないこと。
 *
 * ⚠️★**確定済みの値（`value`）と入力中の値（`draft`）を分けて持つ。**
 *    `draft` をページが持つのは、サジェストの計算にページ側の材料が要るから
 *    （/companies は企業名の一覧、/jobs は職種と企業名）。
 *    ⚠️ 閉じたときは `draft` を `value` に戻す（打ちかけが残ると、次に開いたときに
 *       「確定していない文字」が入っていて、チップと食い違って見える）。
 *
 * ⚠️★**768px 未満はアイコンだけになる**（`.lsb-btn` の `.tb-label` を隠す）。
 *    文字が消えるので `aria-label` を必ず持たせてある。**外さないこと。**
 *    ⚠️ 見た目は 36×36 のままで、**当たり判定だけ `::after` で 44×44 に広げている**
 *       （行の他のボタンが 36px なので、高さを揃えたまま押しやすさを確保する）。
 */
export type ListSearchSuggestion = { key: string; label: string; sub?: string | null };

export function ListSearchButton({
  value,
  draft,
  onDraftChange,
  onCommit,
  onClear,
  placeholder,
  inputAriaLabel,
  label = "一覧内を検索",
  suggestions = [],
  onPickSuggestion,
}: {
  /** 確定済みのキーワード（チップに出る値） */
  value: string;
  /** 入力中の値。⚠️ ページが持つ（サジェストの計算に使うため） */
  draft: string;
  onDraftChange: (v: string) => void;
  /** Enter で確定。⚠️ 空文字のときは「外す」と同じ扱いにすること */
  onCommit: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  inputAriaLabel: string;
  label?: string;
  suggestions?: ListSearchSuggestion[];
  onPickSuggestion?: (s: ListSearchSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        onDraftChange(value);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, value, onDraftChange]);

  function closeWithoutCommit() {
    setOpen(false);
    onDraftChange(value);
  }

  function commit() {
    const next = draft.trim();
    setOpen(false);
    if (next) onCommit(next);
    else onClear();
  }

  return (
    <div ref={wrapRef} className={`lsb${open ? " lsb--open" : ""}`}>
      {open ? (
        <>
          <div role="search" className="search-shell lsb-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              className="lsb-input hdr-search-input"
              aria-label={inputAriaLabel}
              placeholder={placeholder}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); closeWithoutCommit(); }
              }}
              autoComplete="off"
            />
            {draft && (
              <button
                type="button"
                className="btn-fixed-size"
                aria-label="入力を消す"
                onClick={() => { onDraftChange(""); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b95a3", flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {suggestions.length > 0 && onPickSuggestion && (
            <div className="lsb-menu" role="listbox">
              {suggestions.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="lsb-menu-item"
                  /* ⚠️★`onMouseDown` ＋ `preventDefault`。`onClick` だと input の
                        blur が先に走って外側クリック扱いで閉じ、選べない。 */
                  onMouseDown={(e) => { e.preventDefault(); setOpen(false); onPickSuggestion(s); }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <span className="lsb-menu-text">
                    <span className="lsb-menu-label">{s.label}</span>
                    {s.sub && <span className="lsb-menu-sub">{s.sub}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          className="lsb-btn"
          aria-label={label}
          onClick={() => { onDraftChange(value); setOpen(true); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="tb-label">{label}</span>
        </button>
      )}

      {/* 確定済みのキーワード。⚠️ 開いているときは出さない（入力欄と同じ語が2つ並ぶ） */}
      {!open && value && (
        <button
          type="button"
          className="lsb-chip"
          onClick={onClear}
          aria-label={`「${value}」の絞り込みを外す`}
        >
          {value}
          <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.75 }}>✕</span>
        </button>
      )}
    </div>
  );
}

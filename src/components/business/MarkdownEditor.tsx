/* ⚠️ **描画とセットで扱うこと。** 企業説明はこのエディタで書き、
      求職者側は `components/common/Markdown` で解釈する（2026-08-26 に対応）。
      **片方だけ変えないこと。** 過去に描画が plain text のままで、
      `##` が記号のまま出る状態だった。 */
"use client";

import { useRef } from "react";

/* ★2026-10-12: ボタンを日本語にし、記号（H1/H2/H3・B/I・Quote）を見せない（柴さんの指示）。
      人事の方に Markdown の記号は通じないため。保存形式（Markdown）と求職者側の表示は変えていない。
   ⚠️★それまでボタンを押しても**何も起きていなかった。** テキストエリアを
      `closest("[data-md-editor]")` で探していたが、ツールバーはその要素の**外**にあり、毎回 null だった。
      ref で直接持つ形にした。**closest に戻さないこと。** */

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
};

type ToolbarAction = {
  label: string;
  title: string;
  prefix?: string;
  suffix?: string;
  linePrefix?: string;
};

/* ⚠️ 見出しは1段（##）だけ。企業ページの本文の中の見出しなので、大見出し（#）は使わせない */
const TOOLBAR: (ToolbarAction | "divider")[] = [
  { label: "見出し",   title: "選んだ行を見出しにする",   linePrefix: "## " },
  { label: "太字",     title: "選んだ文字を太字にする",   prefix: "**", suffix: "**" },
  { label: "箇条書き", title: "選んだ行を箇条書きにする", linePrefix: "- " },
  { label: "リンク",   title: "選んだ文字をリンクにする", prefix: "[", suffix: "](https://)" },
];

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 240 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  function handleToolbarClick(action: ToolbarAction, textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    let newValue: string;
    let cursorOffset = 0;

    if (action.linePrefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const before = value.slice(0, lineStart);
      const after = value.slice(lineStart);
      newValue = before + action.linePrefix + after;
      cursorOffset = action.linePrefix.length;
    } else if (action.prefix && action.suffix) {
      const wrapped = action.prefix + (selected || "テキスト") + action.suffix;
      newValue = value.slice(0, start) + wrapped + value.slice(end);
      cursorOffset = action.prefix.length;
    } else {
      return;
    }

    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      const pos = start + cursorOffset;
      textarea.setSelectionRange(pos, pos + (selected.length || (action.linePrefix ? 0 : "テキスト".length)));
    }, 0);
  }

  return (
    <div style={{
      border: "1.5px solid var(--line)",
      borderRadius: 8,
      overflow: "hidden",
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}
      onFocus={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--royal)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px var(--royal-50)";
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }
      }}
    >
      {/* ツールバー */}
      <div style={{
        display: "flex",
        gap: 2,
        padding: "6px 8px",
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
      }}>
        {TOOLBAR.map((item, i) => {
          if (item === "divider") {
            return <div key={i} style={{ width: 1, background: "var(--line)", margin: "4px 4px" }} />;
          }
          return (
            <button
              key={item.label}
              type="button"
              title={item.title}
              onClick={() => {
                if (textareaRef.current) handleToolbarClick(item, textareaRef.current);
              }}
              style={{
                padding: "5px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 5,
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink-soft)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#fff";
                (e.currentTarget as HTMLElement).style.color = "var(--royal)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)";
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* エディタ本体 */}
      <div data-md-editor="">
        <textarea
          ref={textareaRef}
          aria-label={placeholder ?? "本文"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "14px 16px",
            border: "none",
            background: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            color: "var(--ink)",
            lineHeight: 1.8,
            resize: "vertical",
            minHeight,
            outline: "none",
            display: "block",
          }}
        />
      </div>

      {/* ★下部の記法ヒントは 2026-09-18 に削除した（柴さんの指示）。
             ⚠️★**戻さないこと。** 上部のツールバー（TOOLBAR）は**実際に記法を挿入する**ので、
                同じことを2通りで案内していた。ヒントは押せないぶん役割が弱い。
             ⚠️ 保存形式（Markdown）は変えていない。求職者側の表示も変わらない。 */}
    </div>
  );
}

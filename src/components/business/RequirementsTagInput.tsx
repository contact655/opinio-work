"use client";

import { useRef } from "react";

type Props = {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
};

export function RequirementsTagInput({
  tags,
  onTagsChange,
  placeholder = "タグを追加して Enter...",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  /* ⚠️ **色を受け取る prop は置かない**（2026-09-02 に `color` を撤去）。
        呼び出し側で色を決められると、凡例の無い色分けが増える
        （ui-conventions「チップに個別の色を渡せる形にしないこと」）。
        実際、渡されていたのは必須スキル=royal / 歓迎スキル=purple の2つで、
        **どちらの入力欄にも見出しが付いている**ので色は意味を足していなかった。
        `success` と `warm` の分岐は一度も呼ばれていない死んだ枝だった。 */
  const pillBg = "var(--royal-50)";
  const pillColor = "var(--royal)";

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const val = e.currentTarget.value.trim();
    if (e.key === "Enter" && val) {
      e.preventDefault();
      if (!tags.includes(val)) {
        onTagsChange([...tags, val]);
      }
      e.currentTarget.value = "";
    } else if (e.key === "Backspace" && !e.currentTarget.value && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag));
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "8px 10px",
        border: "1.5px solid var(--line)",
        borderRadius: 8,
        background: "#fff",
        cursor: "text",
        minHeight: 44,
      }}
      onClick={() => inputRef.current?.focus()}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--royal)")}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          e.currentTarget.style.borderColor = "var(--line)";
        }
      }}
      tabIndex={-1}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            padding: "4px 10px",
            background: pillBg,
            color: pillColor,
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: 0.7,
              padding: 0,
              lineHeight: 1,
              color: "inherit",
              fontSize: 13,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        aria-label={placeholder}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        style={{
          flex: 1,
          minWidth: 100,
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          fontSize: 12,
          color: "var(--ink)",
          background: "transparent",
          padding: "4px",
        }}
      />
    </div>
  );
}

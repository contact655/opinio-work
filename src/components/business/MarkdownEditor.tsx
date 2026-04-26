"use client";

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

const TOOLBAR: (ToolbarAction | "divider")[] = [
  { label: "H1", title: "見出し1",  linePrefix: "# " },
  { label: "H2", title: "見出し2",  linePrefix: "## " },
  { label: "H3", title: "見出し3",  linePrefix: "### " },
  "divider",
  { label: "B",  title: "太字",     prefix: "**", suffix: "**" },
  { label: "I",  title: "斜体",     prefix: "*",  suffix: "*" },
  "divider",
  { label: "List",  title: "リスト",   linePrefix: "- " },
  { label: "Quote", title: "引用",     linePrefix: "> " },
  { label: "Link",  title: "リンク",   prefix: "[", suffix: "](URL)" },
];

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 240 }: Props) {
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
              onClick={(e) => {
                const wrapper = (e.currentTarget as HTMLElement).closest("[data-md-editor]");
                const textarea = wrapper?.querySelector("textarea") as HTMLTextAreaElement | null;
                if (textarea) handleToolbarClick(item, textarea);
              }}
              style={{
                padding: "5px 10px",
                background: "transparent",
                border: "none",
                borderRadius: 5,
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
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

      {/* ヘルプ */}
      <div style={{
        padding: "8px 16px",
        background: "var(--bg-tint)",
        borderTop: "1px solid var(--line)",
        fontSize: 10,
        color: "var(--ink-mute)",
        lineHeight: 1.6,
      }}>
        <code style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--line)", color: "var(--royal)", fontWeight: 600 }}>##</code>{" "}
        見出し2 ·{" "}
        <code style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--line)", color: "var(--royal)", fontWeight: 600 }}>**太字**</code> ·{" "}
        <code style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--line)", color: "var(--royal)", fontWeight: 600 }}>- リスト</code> ·{" "}
        <code style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--line)", color: "var(--royal)", fontWeight: 600 }}>&gt; 引用</code>
      </div>
    </div>
  );
}

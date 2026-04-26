"use client";

type Props = {
  steps: string[];
  onStepsChange: (steps: string[]) => void;
};

export function ProcessStepsEditor({ steps, onStepsChange }: Props) {
  function updateStep(index: number, value: string) {
    onStepsChange(steps.map((s, i) => (i === index ? value : s)));
  }

  function removeStep(index: number) {
    onStepsChange(steps.filter((_, i) => i !== index));
  }

  function addStep() {
    onStepsChange([...steps, ""]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "12px 14px",
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <div style={{
            width: 32, height: 32,
            background: "var(--royal)",
            color: "#fff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <input
            type="text"
            value={step}
            onChange={(e) => updateStep(i, e.target.value)}
            placeholder={`ステップ ${i + 1}`}
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid transparent",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--ink)",
              borderRadius: 5,
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.background = "#fff";
              e.target.style.borderColor = "var(--royal)";
            }}
            onBlur={(e) => {
              e.target.style.background = "transparent";
              e.target.style.borderColor = "transparent";
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.borderColor = "var(--line)";
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.target) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }
            }}
          />
          {steps.length > 1 && (
            <button
              type="button"
              onClick={() => removeStep(i)}
              title="削除"
              style={{
                width: 26, height: 26,
                background: "transparent",
                border: "none",
                color: "var(--ink-mute)",
                cursor: "pointer",
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--error)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--error-soft)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-mute)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        style={{
          padding: 10,
          background: "#fff",
          border: "1.5px dashed var(--line)",
          borderRadius: 8,
          color: "var(--ink-soft)",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 8,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--royal)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--royal)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--royal-50)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-soft)";
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        ステップを追加
      </button>
    </div>
  );
}

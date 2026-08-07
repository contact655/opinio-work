"use client";

/**
 * 複数選択のチェックピル。
 *
 * ── なぜ切り出したか（2026-08-07）────────────────────────────────────────────
 * /profile/edit の「興味のある企業フェーズ」に45行のインライン実装があり、
 * 希望勤務スタイルを複数選択にするときに2箇所へ増えるところだった。
 *
 * ⚠️ 選択肢から外れた値を今持っている場合は、呼び出し側で options に足し戻すこと。
 *    この部品は渡された options をそのまま出すだけ。足し戻さないと
 *    「画面に出ないまま保存され続ける／別項目を保存した拍子に消える」になる。
 */

export type CheckPillOption = {
  value: string;
  label: string;
  /** 選択肢としては非推奨だが、今その値を持っているので出しているもの */
  legacy?: boolean;
};

export function CheckPillGroup({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  options: readonly CheckPillOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              padding: "7px var(--space-3)", borderRadius: 8,
              background: checked ? "var(--royal-50)" : "var(--bg-tint)",
              border: `1.5px solid ${checked ? "var(--accent)" : "var(--line)"}`,
              color: checked ? "var(--royal)" : "var(--ink-soft)",
              fontSize: "var(--text-sm)", fontWeight: checked ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              style={{ display: "none" }}
              onChange={() =>
                onChange(checked ? value.filter((v) => v !== opt.value) : [...value, opt.value])
              }
            />
            <span style={{
              width: 14, height: 14, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${checked ? "var(--accent)" : "var(--line)"}`,
              background: checked ? "var(--accent)" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {checked && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            {opt.label}
            {opt.legacy && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>（現在の設定）</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

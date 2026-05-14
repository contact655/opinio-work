"use client";

// ── GenreChipSelector ──────────────────────────────────────────────────────
//
// ジャンル選択チップ群コンポーネント（PR-β 共通 UI）
//
// 用途:
//   - 企業編集フォーム (CompanyEditClient)
//   - 企業新規作成フォーム (CreateCompanyClient)
//   - 企業登録フロー (biz/auth/page.tsx)
//
// 設計:
//   - 完全な制御コンポーネント（内部 state なし）
//   - selected は slug 配列で管理
//   - display_order 昇順でソート保証（親側でソート済みでも内部でも保証）
// ────────────────────────────────────────────────────────────────────────────

export type Genre = {
  slug: string;
  name: string;
  display_order: number;
};

export type GenreChipSelectorProps = {
  /** 親（Server Component）から渡される ow_genres 全件 */
  genres: Genre[];
  /** 現在選択中の slug 配列 */
  selected: string[];
  /** 選択変更時のコールバック */
  onChange: (newSelected: string[]) => void;
  /** 編集不可状態（オプション） */
  disabled?: boolean;
};

export default function GenreChipSelector({
  genres,
  selected,
  onChange,
  disabled = false,
}: GenreChipSelectorProps) {
  // display_order 昇順でソート（親側でソート済みでも念のため保証）
  const sorted = [...genres].sort((a, b) => a.display_order - b.display_order);

  function toggle(slug: string) {
    if (disabled) return;
    const next = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : [...selected, slug];
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent, slug: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(slug);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {sorted.map((genre) => {
        const isSelected = selected.includes(genre.slug);
        return (
          <button
            key={genre.slug}
            type="button"
            role="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => toggle(genre.slug)}
            onKeyDown={(e) => handleKeyDown(e, genre.slug)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: isSelected ? 600 : 400,
              fontFamily: "inherit",
              cursor: disabled ? "not-allowed" : "pointer",
              border: `1.5px solid ${isSelected ? "var(--royal)" : "var(--line)"}`,
              background: isSelected ? "var(--royal-50)" : "var(--bg-tint)",
              color: isSelected ? "var(--royal)" : "var(--ink-soft)",
              transition: "all 0.15s",
              outline: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (disabled) return;
              const el = e.currentTarget;
              if (!isSelected) {
                el.style.background = "var(--line-soft)";
                el.style.borderColor = "var(--ink-mute)";
                el.style.color = "var(--ink)";
              }
            }}
            onMouseLeave={(e) => {
              if (disabled) return;
              const el = e.currentTarget;
              if (!isSelected) {
                el.style.background = "var(--bg-tint)";
                el.style.borderColor = "var(--line)";
                el.style.color = "var(--ink-soft)";
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--royal-100)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {genre.name}
          </button>
        );
      })}
    </div>
  );
}

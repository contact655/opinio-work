"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 業種ごとのカラー設定
const INDUSTRY_COLORS: Record<string, { color: string; bg: string; dot: string }> = {
  "HR Tech":        { color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  "FinTech/SaaS":   { color: "#065f46", bg: "#d1fae5", dot: "#10b981" },
  "CRM":            { color: "#1e63d8", bg: "#eff3fc", dot: "#3b5fd9" },
  "CRM/SaaS":       { color: "#1e63d8", bg: "#eff3fc", dot: "#3b5fd9" },
  "AI Tech":        { color: "#7c3aed", bg: "#ede9fe", dot: "#8b5cf6" },
  "Sales Tech":     { color: "#0f766e", bg: "#ccfbf1", dot: "#14b8a6" },
  "Med Tech":       { color: "#9a3412", bg: "#ffedd5", dot: "#ea580c" },
  "ConTech":        { color: "#b45309", bg: "#fef3c7", dot: "#f59e0b" },
  "顧客コミュニケーション": { color: "#5b21b6", bg: "#ede9fe", dot: "#8b5cf6" },
};

function getIndustryCfg(industry: string) {
  return INDUSTRY_COLORS[industry] ?? { color: "#4a5260", bg: "#f1f5f9", dot: "#94a3b8" };
}

type Props = {
  locations: string[];
  industries?: string[];
  companySuggestions?: { id: string; name: string }[];
};

type PhaseOption = { value: string; label: string; color: string; bg: string; dot: string; desc: string };

const PHASE_OPTIONS: PhaseOption[] = [
  { value: "プレシード",      label: "プレシード",      color: "#78350f", bg: "#fff7ed", dot: "#fb923c", desc: "創業初期・アイデア段階" },
  { value: "ブートストラップ", label: "ブートストラップ", color: "#92400e", bg: "#fef3c7", dot: "#f59e0b", desc: "自己資金・非資金調達" },
  { value: "シード",          label: "シード",          color: "#713f12", bg: "#fef9e7", dot: "#ca8a04", desc: "PMF検証・プロダクト開発期" },
  { value: "シリーズA",       label: "シリーズA",       color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6", desc: "グロース開始・急成長期" },
  { value: "シリーズB",       label: "シリーズB",       color: "#5b21b6", bg: "#ede9fe", dot: "#8b5cf6", desc: "事業拡大・組織化" },
  { value: "シリーズC",       label: "シリーズC",       color: "#065f46", bg: "#d1fae5", dot: "#10b981", desc: "スケール・上場準備" },
  { value: "シリーズD以降",   label: "シリーズD以降",   color: "#064e3b", bg: "#ccfbf1", dot: "#14b8a6", desc: "レイトステージ・大規模化" },
  { value: "IPO準備中",       label: "IPO準備中",       color: "#9a3412", bg: "#ffedd5", dot: "#ea580c", desc: "上場直前・承認申請段階" },
  { value: "上場",            label: "上場",            color: "#14532d", bg: "#dcfce7", dot: "#16a34a", desc: "東証グロース・スタンダード・プライム" },
];

// ── コンパクトフィルターチップ ────────────────────────────────────────────────
function FilterChip({
  label,
  value,
  options,
  onSelect,
  isOpen,
  onToggle,
  listStyle = false,
  phaseStyle = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string; bg?: string; dot?: string; desc?: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  listStyle?: boolean;
  phaseStyle?: boolean; // フェーズ専用カラー表示
}) {
  const isActive = !!value;
  const activeOpt = options.find((o) => o.value === value);
  const activeLabel = activeOpt?.label;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 14px",
          borderRadius: 999,
          border: `1.5px solid ${isActive && !phaseStyle ? "var(--royal)" : isActive && phaseStyle ? activeOpt?.color ?? "var(--royal)" : "#e2e8f0"}`,
          background: isActive && phaseStyle ? (activeOpt?.bg ?? "var(--royal-50)") : isActive ? "var(--royal)" : "#fff",
          color: isActive && phaseStyle ? (activeOpt?.color ?? "var(--royal)") : isActive ? "#fff" : "var(--ink)",
          fontSize: 13, fontWeight: isActive ? 600 : 500,
          cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.12s",
          fontFamily: "inherit",
        }}
      >
        {isActive && phaseStyle && activeOpt?.dot && (
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: activeOpt.dot, display: "inline-block", flexShrink: 0 }} />
        )}
        {isActive ? activeLabel : label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 10, marginLeft: 1, opacity: 0.75, lineHeight: 1 }}
            aria-label="クリア"
          >
            ✕
          </span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff",
          border: "1.5px solid var(--royal)",
          borderRadius: 12,
          padding: phaseStyle ? "8px" : listStyle ? "8px 0" : "12px 16px",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: phaseStyle ? 268 : listStyle ? 140 : 180,
          maxHeight: phaseStyle ? 420 : listStyle ? 280 : "none",
          overflowY: (phaseStyle || listStyle) ? "auto" : "visible",
        }}>
          {phaseStyle ? (
            // フェーズ専用: カラーバッジ + 説明付きカード
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {options.map((o) => {
                const sel = value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 8,
                      background: sel ? (o.bg ?? "var(--royal-50)") : "transparent",
                      border: `1.5px solid ${sel ? (o.color ?? "var(--royal)") : "transparent"}`,
                      cursor: "pointer", width: "100%", textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                      background: o.dot ?? o.color ?? "#94a3b8",
                      boxShadow: sel ? `0 0 0 3px ${o.bg ?? "#f1f5f9"}` : "none",
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: "block", fontSize: 13.5, fontWeight: sel ? 700 : 600,
                        color: sel ? (o.color ?? "var(--royal)") : "var(--ink)",
                        lineHeight: 1.3,
                      }}>
                        {o.label}
                      </span>
                      {o.desc && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", marginTop: 1 }}>
                          {o.desc}
                        </span>
                      )}
                    </span>
                    {sel && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={o.color ?? "var(--royal)"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ) : listStyle ? (
            // 縦リスト形式（都道府県など）
            options.map((o) => {
              const sel = value === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "9px 16px",
                    background: sel ? "var(--royal-50)" : "none",
                    color: sel ? "var(--royal)" : "var(--ink)",
                    fontSize: 13.5, fontWeight: sel ? 700 : 400,
                    cursor: "pointer", border: "none",
                    fontFamily: "inherit",
                    transition: "background 0.08s",
                  }}
                  onMouseEnter={(e) => { if (!sel) (e.target as HTMLElement).style.background = "var(--bg-tint)"; }}
                  onMouseLeave={(e) => { if (!sel) (e.target as HTMLElement).style.background = "none"; }}
                >
                  {o.label}
                </button>
              );
            })
          ) : (
            // ピル形式（勤務形態など）
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {options.map((o) => {
                const sel = value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                    style={{
                      padding: "6px 14px", borderRadius: 999,
                      border: `1.5px solid ${sel ? "var(--royal)" : "var(--line)"}`,
                      background: sel ? "var(--royal)" : "#fff",
                      color: sel ? "#fff" : "var(--ink)",
                      fontSize: 13, fontWeight: sel ? 700 : 400,
                      cursor: "pointer", whiteSpace: "nowrap",
                      fontFamily: "inherit",
                      transition: "all 0.1s",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────
export function CompanySearchBar({ locations, industries = [], companySuggestions = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [openChip, setOpenChip] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const filtered = inputValue.length >= 1
    ? companySuggestions
        .filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase()))
        .slice(0, 6)
    : [];

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}`);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", val || null);
    }, 300);
  }

  function handleSuggestionClick(name: string) {
    setInputValue(name);
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", name);
  }

  function handleClear() {
    setInputValue("");
    setShowSuggestions(false);
    setOpenChip(null);
    router.push("?");
  }

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
    setShowSuggestions(false);
  }

  const currentPhase     = searchParams.get("phase") ?? "";
  const currentLocation  = searchParams.get("location") ?? "";
  const currentIndustry  = searchParams.get("industry") ?? "";
  const currentHiring    = searchParams.get("hiring") === "1";

  const hasAnyFilter = Boolean(
    searchParams.get("q") || currentPhase || currentHiring || currentLocation || currentIndustry
  );

  const locationOptions = locations.map((l) => ({ value: l, label: l }));

  return (
    <>
      <style>{`
        .csb-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 0 14px;
          flex-wrap: wrap;
        }
        .csb-search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          border: 1.5px solid #e6e9ef;
          border-radius: 999px;
          padding: 0 14px;
          transition: border-color 0.15s, box-shadow 0.15s;
          flex: 1 1 220px;
          min-width: 0;
        }
        .csb-search-wrap:focus-within {
          border-color: var(--royal);
          box-shadow: 0 0 0 3px rgba(0,35,102,0.08);
        }
        .csb-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 13.5px;
          color: var(--ink);
          background: transparent;
          padding: 9px 0;
          min-width: 0;
        }
        .csb-input::placeholder { color: #6b7280; }
        .csb-hiring {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          color: var(--ink);
          cursor: pointer;
          white-space: nowrap;
          border: 1.5px solid #e2e8f0;
          border-radius: 999px;
          padding: 7px 14px;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
          user-select: none;
          font-family: inherit;
          background: #fff;
          flex-shrink: 0;
          font-weight: 500;
        }
        .csb-hiring.active {
          border-color: var(--royal);
          background: var(--royal);
          color: #fff;
          font-weight: 600;
        }
        .csb-hiring input[type="checkbox"] { display: none; }
        .csb-clear {
          font-size: 12.5px;
          color: var(--ink-mute);
          background: none;
          border: none;
          cursor: pointer;
          padding: 5px 4px;
          white-space: nowrap;
          transition: color 0.15s;
          font-family: inherit;
          flex-shrink: 0;
        }
        .csb-clear:hover { color: var(--ink); }
        .csb-suggestions {
          position: absolute;
          top: calc(100% + 4px);
          left: 0; right: 0;
          background: #fff;
          border: 1.5px solid var(--royal);
          border-radius: 10px;
          box-shadow: 0 8px 28px rgba(0,35,102,0.12);
          overflow: hidden;
          z-index: 100;
        }
        .csb-suggestion-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          font-size: 14px;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.1s;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-family: inherit;
        }
        .csb-suggestion-item:hover { background: var(--royal-50); }
        @media (max-width: 640px) {
          .csb-bar { gap: 6px; }
        }
      `}</style>

      <div ref={wrapRef} style={{ marginBottom: 4 }}>
        <div className="csb-bar">

          {/* 検索インプット */}
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
            <div className="csb-search-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                className="csb-input"
                placeholder="企業名・キーワードで検索"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => { setShowSuggestions(true); setOpenChip(null); }}
                aria-label="企業を検索"
                aria-autocomplete="list"
                autoComplete="off"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "#8b95a3", lineHeight: 1, flexShrink: 0 }}
                  aria-label="クリア"
                >
                  ✕
                </button>
              )}
            </div>

            {showSuggestions && filtered.length > 0 && (
              <div className="csb-suggestions" role="listbox">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    role="option"
                    className="csb-suggestion-item"
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(c.name); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* フェーズ */}
          <FilterChip
            label="フェーズ"
            value={currentPhase}
            options={PHASE_OPTIONS}
            onSelect={(v) => { updateParam("phase", v); setOpenChip(null); }}
            isOpen={openChip === "phase"}
            onToggle={() => toggleChip("phase")}
            phaseStyle
          />

          {/* 業種 */}
          {industries.length > 0 && (
            <FilterChip
              label="業種"
              value={currentIndustry}
              options={industries.map((ind) => {
                const cfg = getIndustryCfg(ind);
                return { value: ind, label: ind, color: cfg.color, bg: cfg.bg, dot: cfg.dot };
              })}
              onSelect={(v) => { updateParam("industry", v); setOpenChip(null); }}
              isOpen={openChip === "industry"}
              onToggle={() => toggleChip("industry")}
              phaseStyle
            />
          )}

          {/* 都道府県 */}
          {locations.length > 0 && (
            <FilterChip
              label="都道府県"
              value={currentLocation}
              options={locationOptions}
              onSelect={(v) => { updateParam("location", v); setOpenChip(null); }}
              isOpen={openChip === "location"}
              onToggle={() => toggleChip("location")}
              listStyle
            />
          )}

          {/* 面談受付中 */}
          <label className={`csb-hiring${currentHiring ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={currentHiring}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            {currentHiring ? (
              <>面談受付中 <span style={{ fontSize: 10, opacity: 0.85 }}>✕</span></>
            ) : (
              <>面談受付中</>
            )}
          </label>

          {hasAnyFilter && (
            <button type="button" className="csb-clear" onClick={handleClear}>
              ✕ クリア
            </button>
          )}
        </div>
      </div>
    </>
  );
}

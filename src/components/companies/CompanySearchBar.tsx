"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  locations: string[];
  companySuggestions?: { id: string; name: string }[];
};

const PHASE_PILLS = [
  { value: "シリーズA", label: "シリーズA" },
  { value: "シリーズB", label: "シリーズB" },
  { value: "シリーズC", label: "シリーズC" },
  { value: "上場",      label: "上場" },
] as const;

const WORK_STYLE_PILLS = [
  { value: "on_site",     label: "出社" },
  { value: "hybrid",      label: "ハイブリッド" },
  { value: "full_remote", label: "フルリモート" },
] as const;

/** 単一選択ピル（クリックで on/off トグル） */
function PillGroup({
  options,
  active,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  active: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(isActive ? null : o.value)}
            style={{
              padding: "5px 14px",
              borderRadius: 999,
              border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
              background: isActive ? "var(--royal)" : "#fff",
              color: isActive ? "#fff" : "var(--ink-soft)",
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.12s, border-color 0.12s, color 0.12s",
              fontFamily: "inherit",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function CompanySearchBar({ locations, companySuggestions = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = inputValue.length >= 1
    ? companySuggestions
        .filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "");
  }, [searchParams]);

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
    router.push("?");
  }

  const currentPhase     = searchParams.get("phase") ?? "";
  const currentLocation  = searchParams.get("location") ?? "";
  const currentWorkStyle = searchParams.get("workStyle") ?? "";
  const currentHiring    = searchParams.get("hiring") === "1";

  const hasAnyFilter = Boolean(
    searchParams.get("q") ||
    currentPhase ||
    currentWorkStyle ||
    currentHiring ||
    currentLocation
  );

  return (
    <>
      <style>{`
        .csb-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1.5px solid #e6e9ef;
          border-radius: 10px;
          padding: 0 16px;
          transition: border-color 0.15s;
          width: 100%;
        }
        .csb-input-wrap:focus-within {
          border-color: var(--royal);
          box-shadow: 0 0 0 3px rgba(0,35,102,0.08);
        }
        .csb-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          color: var(--ink);
          background: transparent;
          padding: 13px 0;
          min-width: 0;
        }
        .csb-input::placeholder { color: #8b95a3; }
        .csb-select {
          appearance: none;
          -webkit-appearance: none;
          border: 1.5px solid #e6e9ef;
          border-radius: 8px;
          padding: 6px 28px 6px 12px;
          font-size: 13px;
          color: var(--ink-soft);
          background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .csb-select.active {
          border-color: var(--royal);
          background-color: var(--royal-50);
          color: var(--royal);
          font-weight: 600;
        }
        .csb-select:focus { outline: none; border-color: var(--royal); }
        .csb-hiring {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--ink-soft);
          cursor: pointer;
          white-space: nowrap;
          border: 1.5px solid #e6e9ef;
          border-radius: 999px;
          padding: 5px 12px;
          transition: border-color 0.15s, background-color 0.15s;
          user-select: none;
          font-family: inherit;
          background: #fff;
        }
        .csb-hiring.active {
          border-color: var(--royal);
          background: var(--royal-50);
          color: var(--royal);
          font-weight: 700;
        }
        .csb-hiring input[type="checkbox"] { width: 13px; height: 13px; cursor: pointer; accent-color: var(--royal); }
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
        .csb-divider {
          width: 1px;
          height: 18px;
          background: var(--line);
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .csb-filter-row { flex-wrap: wrap !important; }
          .csb-divider { display: none; }
        }
      `}</style>

      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Row 1: フェーズ */}
        <div className="csb-filter-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-soft)", whiteSpace: "nowrap", fontWeight: 600 }}>
            フェーズ
          </span>
          <PillGroup
            options={PHASE_PILLS}
            active={currentPhase}
            onChange={(v) => updateParam("phase", v)}
          />
        </div>

        {/* Row 2: 勤務形態 + 都道府県 + 募集中 + クリア */}
        <div className="csb-filter-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-soft)", whiteSpace: "nowrap", fontWeight: 600 }}>
            勤務形態
          </span>
          <PillGroup
            options={WORK_STYLE_PILLS}
            active={currentWorkStyle}
            onChange={(v) => updateParam("workStyle", v)}
          />

          <div className="csb-divider" />

          {/* 都道府県 */}
          {locations.length > 0 && (
            <select
              className={`csb-select${currentLocation ? " active" : ""}`}
              value={currentLocation}
              onChange={(e) => updateParam("location", e.target.value || null)}
              aria-label="都道府県フィルタ"
            >
              <option value="">都道府県</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}

          <div className="csb-divider" />

          {/* 募集中のみ */}
          <label className={`csb-hiring${currentHiring ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={currentHiring}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            面談受付中のみ
          </label>

          {hasAnyFilter && (
            <button type="button" className="csb-clear" onClick={handleClear}>
              ✕ クリア
            </button>
          )}
        </div>

        {/* 検索ボックス + オートサジェスト */}
        <div ref={wrapRef} style={{ position: "relative" }}>
          <div className="csb-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              className="csb-input"
              placeholder="キーワードで企業を探す（例: SaaS, セールス, AI）"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setShowSuggestions(true)}
              aria-label="企業を検索"
              aria-autocomplete="list"
              autoComplete="off"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "#8b95a3", lineHeight: 1 }}
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
      </div>
    </>
  );
}

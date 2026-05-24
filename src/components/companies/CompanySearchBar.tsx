"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  industries: string[];
  locations: string[];
};

const SIZE_PILLS = [
  { value: "under-50",  label: "〜50名" },
  { value: "50-200",    label: "50〜200名" },
  { value: "200-1000",  label: "200〜1000名" },
  { value: "1000-plus", label: "1000名〜" },
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

export function CompanySearchBar({ industries, locations }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("q", val || null);
    }, 300);
  }

  function handleClear() {
    setInputValue("");
    router.push("?");
  }

  const currentIndustry  = searchParams.get("industry") ?? "";
  const currentLocation  = searchParams.get("location") ?? "";
  const currentSize      = searchParams.get("size") ?? "";
  const currentWorkStyle = searchParams.get("workStyle") ?? "";
  const currentHiring    = searchParams.get("hiring") === "1";

  const hasAnyFilter = Boolean(
    searchParams.get("q") ||
    currentIndustry ||
    currentSize ||
    currentWorkStyle ||
    currentHiring ||
    currentLocation
  );

  const hasPills = !!(currentSize || currentWorkStyle);

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

        {/* Row 1: ドロップダウン + 募集中トグル + クリア */}
        <div className="csb-filter-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* 業種 */}
          <select
            className={`csb-select${currentIndustry ? " active" : ""}`}
            value={currentIndustry}
            onChange={(e) => updateParam("industry", e.target.value || null)}
            aria-label="業種フィルタ"
          >
            <option value="">業種</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>

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

          {/* 募集中のみトグル（ピル風） */}
          <label className={`csb-hiring${currentHiring ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={currentHiring}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            募集中のみ
          </label>

          {/* クリアボタン */}
          {hasAnyFilter && (
            <button className="csb-clear" onClick={handleClear}>
              ✕ クリア
            </button>
          )}
        </div>

        {/* Row 2: ピルフィルター（勤務形態 + 規模） */}
        <div className="csb-filter-row" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>

          {/* 勤務形態ピル */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500 }}>
              勤務形態
            </span>
            <PillGroup
              options={WORK_STYLE_PILLS}
              active={currentWorkStyle}
              onChange={(v) => updateParam("workStyle", v)}
            />
          </div>

          <div className="csb-divider" />

          {/* 規模ピル */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-mute)", whiteSpace: "nowrap", fontWeight: 500 }}>
              規模
            </span>
            <PillGroup
              options={SIZE_PILLS}
              active={currentSize}
              onChange={(v) => updateParam("size", v)}
            />
          </div>
        </div>

        {/* アクティブなピルのサマリーバッジ（選択中の場合のみ） */}
        {hasPills && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {currentWorkStyle && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, padding: "3px 10px", borderRadius: 999,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)", fontWeight: 600,
              }}>
                {WORK_STYLE_PILLS.find(p => p.value === currentWorkStyle)?.label}
                <button
                  onClick={() => updateParam("workStyle", null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--royal)", lineHeight: 1, fontSize: 13 }}
                  aria-label="勤務形態フィルタを解除"
                >×</button>
              </span>
            )}
            {currentSize && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, padding: "3px 10px", borderRadius: 999,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)", fontWeight: 600,
              }}>
                {SIZE_PILLS.find(p => p.value === currentSize)?.label}
                <button
                  onClick={() => updateParam("size", null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--royal)", lineHeight: 1, fontSize: 13 }}
                  aria-label="規模フィルタを解除"
                >×</button>
              </span>
            )}
          </div>
        )}

        {/* 検索ボックス */}
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
            aria-label="企業を検索"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(""); updateParam("q", null); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "#8b95a3", lineHeight: 1 }}
              aria-label="クリア"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </>
  );
}

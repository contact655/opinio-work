"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  industries: string[];
  locations: string[];
};

const SIZE_OPTIONS = [
  { value: "under-50",  label: "〜50名" },
  { value: "50-200",    label: "50〜200名" },
  { value: "200-1000",  label: "200〜1000名" },
  { value: "1000-plus", label: "1000名〜" },
] as const;

const WORK_STYLE_OPTIONS = [
  { value: "on_site",     label: "出社" },
  { value: "hybrid",      label: "ハイブリッド" },
  { value: "full_remote", label: "フルリモート" },
] as const;

export function CompanySearchBar({ industries, locations }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 現在のクエリから初期値を読む
  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL が外部から変わったとき（戻る/進む）に input を同期
  useEffect(() => {
    setInputValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  // クエリパラメータを更新するヘルパー
  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  // テキスト入力: 300ms デバウンス
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

  const hasAnyFilter = Boolean(
    searchParams.get("q") ||
    searchParams.get("industry") ||
    searchParams.get("size") ||
    searchParams.get("workStyle") ||
    searchParams.get("hiring") ||
    searchParams.get("location")
  );

  const activeSelect: React.CSSProperties = {
    borderColor: "#1e63d8",
    background: "#eaf1fc",
    color: "#1e63d8",
    fontWeight: 600,
  };

  return (
    <>
      <style>{`
        .search-input-wrap {
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
        .search-input-wrap:focus-within {
          border-color: #1e63d8;
          box-shadow: 0 0 0 3px rgba(30, 99, 216, 0.1);
        }
        .search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
          color: #1a1d24;
          background: transparent;
          padding: 13px 0;
          min-width: 0;
        }
        .search-input::placeholder { color: #8b95a3; }
        .filter-select {
          appearance: none;
          -webkit-appearance: none;
          border: 1.5px solid #e6e9ef;
          border-radius: 8px;
          padding: 7px 28px 7px 12px;
          font-size: 13px;
          color: #5b6471;
          background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b95a3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
          cursor: pointer;
          white-space: nowrap;
          transition: border-color 0.15s, background-color 0.15s;
        }
        .filter-select:focus { outline: none; border-color: #1e63d8; }
        .hiring-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #5b6471;
          cursor: pointer;
          white-space: nowrap;
          border: 1.5px solid #e6e9ef;
          border-radius: 8px;
          padding: 7px 12px;
          transition: border-color 0.15s, background-color 0.15s;
          user-select: none;
        }
        .hiring-label.active {
          border-color: #1e63d8;
          background: #eaf1fc;
          color: #1e63d8;
          font-weight: 600;
        }
        .hiring-label input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; accent-color: #1e63d8; }
        .clear-btn {
          font-size: 13px;
          color: #8b95a3;
          background: none;
          border: none;
          cursor: pointer;
          padding: 7px 4px;
          white-space: nowrap;
          transition: color 0.15s;
        }
        .clear-btn:hover { color: #1a1d24; }
        @media (max-width: 640px) {
          .filter-bar { flex-wrap: wrap !important; }
        }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        {/* 検索ボックス */}
        <div className="search-input-wrap" style={{ marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
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

        {/* フィルタバー */}
        <div className="filter-bar" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* 業種 */}
          <select
            className="filter-select"
            style={searchParams.get("industry") ? activeSelect : undefined}
            value={searchParams.get("industry") ?? ""}
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
              className="filter-select"
              style={searchParams.get("location") ? activeSelect : undefined}
              value={searchParams.get("location") ?? ""}
              onChange={(e) => updateParam("location", e.target.value || null)}
              aria-label="都道府県フィルタ"
            >
              <option value="">都道府県</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}

          {/* 従業員規模 */}
          <select
            className="filter-select"
            style={searchParams.get("size") ? activeSelect : undefined}
            value={searchParams.get("size") ?? ""}
            onChange={(e) => updateParam("size", e.target.value || null)}
            aria-label="従業員規模フィルタ"
          >
            <option value="">規模</option>
            {SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 勤務形態 */}
          <select
            className="filter-select"
            style={searchParams.get("workStyle") ? activeSelect : undefined}
            value={searchParams.get("workStyle") ?? ""}
            onChange={(e) => updateParam("workStyle", e.target.value || null)}
            aria-label="勤務形態フィルタ"
          >
            <option value="">勤務形態</option>
            {WORK_STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 募集中フラグ */}
          <label
            className={`hiring-label${searchParams.get("hiring") === "1" ? " active" : ""}`}
          >
            <input
              type="checkbox"
              checked={searchParams.get("hiring") === "1"}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            募集中のみ
          </label>

          {/* クリアボタン（フィルタ適用中のみ表示） */}
          {hasAnyFilter && (
            <button className="clear-btn" onClick={handleClear}>
              ✕ フィルタをクリア
            </button>
          )}
        </div>
      </div>
    </>
  );
}

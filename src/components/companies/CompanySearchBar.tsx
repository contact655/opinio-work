"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BusinessDomainOption } from "@/lib/companies/businessDomains";
import { WORK_STYLE_LABELS, WORK_STYLE_OPTIONS } from "@/lib/constants/workStyle";
import { PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";

/**
 * 勤務形態フィルターを出すか。
 *
 * ⚠️ 2026-08-11 時点で `ow_companies.remote_work_status` に値があるのは
 *    **76社中2社**しかない。出すと「リモート可は2社だけ」と誤読されるので隠している。
 *    充填率が上がったら true に戻す。ロジック側（searchCompanies）は無変更。
 */
const SHOW_WORK_STYLE_FILTER = false;
import type { PhaseOption } from "@/lib/constants/phase";
import { fetchCompanyBookmarks } from "@/lib/bookmarks/companyBookmarks";



type Props = {
  /** ⚠️ 実データに1社でもあるフェーズだけ。サーバ側の fetchAvailablePhases() が絞って渡す。
   *     ここで PHASE_OPTIONS を全部出さないこと（0件の選択肢を出さない） */
  phaseOptions: PhaseOption[];
  /** 事業領域の選択肢。⚠️ **マスタが唯一の出どころ。** ここに値を書かない。
   *  ⚠️ 実データに1社でもあるものだけをサーバ側が渡す（0件の選択肢を出さない）。 */
  industryOptions: BusinessDomainOption[];
  companySuggestions?: { id: string; name: string }[];
};

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
  searchable = false,
}: {
  label: string;
  value: string;
  /** ⚠️ フェーズは2段階。`parent` を持つものが子で、親の直後にインデントして並ぶ。
   *  ⚠️ 都道府県は `group`（「よく選ばれる」/「その他」）で見出しを挟む。
   *     **並び順は渡された順のまま。ここで並べ替えないこと。** */
  options: { value: string; label: string; color?: string; bg?: string; dot?: string; desc?: string; parent?: string; group?: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
  listStyle?: boolean;
  phaseStyle?: boolean; // フェーズ専用カラー表示
  searchable?: boolean;
}) {
  const [q, setQ] = useState("");
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
        {isActive && !phaseStyle && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {isActive ? activeLabel : label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 12, marginLeft: 1, opacity: 0.75, lineHeight: 1 }}
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
          minWidth: phaseStyle ? 268 : listStyle ? 220 : 180,
          maxHeight: phaseStyle ? 420 : listStyle ? 320 : "none",
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
                      /* ⚠️ 子は左に寄せて階層を示す。**インデントを外さないこと** ——
                            外すとバケット（親）と個別の段が同列に見え、2026-09-06 に
                            指摘された「シード〜シリーズC の下にシリーズB」に戻る。 */
                      padding: o.parent ? "7px 12px 7px 30px" : "9px 12px",
                      borderRadius: 8,
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
                      width: o.parent ? 7 : 10, height: o.parent ? 7 : 10, borderRadius: "50%", flexShrink: 0,
                      background: o.dot ?? o.color ?? "#94a3b8",
                      boxShadow: sel ? `0 0 0 3px ${o.bg ?? "#f1f5f9"}` : "none",
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: "block",
                        fontSize: o.parent ? 13 : 13.5,
                        fontWeight: sel ? 700 : o.parent ? 500 : 700,
                        color: sel ? (o.color ?? "var(--royal)") : "var(--ink)",
                        lineHeight: 1.3,
                      }}>
                        {o.label}
                      </span>
                      {o.desc && (
                        <span style={{ display: "block", fontSize: 12, color: "var(--ink-mute)", marginTop: 1 }}>
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
            // 縦リスト形式（都道府県・業種など）
            <div>
              {searchable && (
                <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid var(--line)" }}>
                  <input
                    type="text"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="絞り込む..."
                    autoFocus
                    style={{
                      width: "100%", padding: "5px 10px", borderRadius: 6,
                      border: "1px solid var(--line)", fontSize: 12,
                      outline: "none", background: "#f8fafc", boxSizing: "border-box" as const,
                      fontFamily: "inherit", color: "var(--ink)",
                    }}
                  />
                </div>
              )}
              {options
                .filter(o => !q || o.label.toLowerCase().includes(q.toLowerCase()))
                .map((o, i, shown) => {
                  const sel = value === o.value;
                  /* ⚠️ グループが変わるところにだけ見出しを出す。
                        絞り込み入力で消えた結果、先頭が「その他」になることもあるので
                        **1つ前と比べる**（固定の位置に置かない）。 */
                  const head = o.group && o.group !== shown[i - 1]?.group ? o.group : null;
                  return (
                    <div key={o.value}>
                    {head && (
                      <div style={{
                        padding: "8px 16px 4px", fontSize: 11, fontWeight: 700,
                        color: "var(--ink-mute)", letterSpacing: "0.06em",
                      }}>{head}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => { onSelect(sel ? null : o.value); onToggle(); setQ(""); }}
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
                    </div>
                  );
                })
              }
            </div>
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
export function CompanySearchBar({ phaseOptions, industryOptions, companySuggestions = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 企業カードと同じ一覧。共有キャッシュを通すので追加のリクエストは飛ばない
    fetchCompanyBookmarks().then((c) => setBookmarkCount(c.ids.size));
  }, []);

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

  /**
   * 検索欄の ✕。**検索文字だけ**を消す。
   *
   * ⚠️★2026-09-06 まで、ここが `router.push("?")` で**絞り込みも全部消していた**。
   *    入力欄の中の ✕ が、隣のチップまで解除するのは見た目と合っていない。
   * ⚠️ 「すべてクリア」ボタンは同日に廃止した。いまは**それぞれを個別に外す**:
   *      検索文字 → この ✕ ／ フェーズ・業種・都道府県 → チップの ✕
   *      外資系・募集あり → もう一度押す（元からトグル）
   */
  function clearQuery() {
    setInputValue("");
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("q", null);
  }

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
    setShowSuggestions(false);
  }

  const currentPhase      = searchParams.get("phase") ?? "";
  const currentLocation   = searchParams.get("location") ?? "";
  const currentIndustry   = searchParams.get("industry") ?? "";
  const currentHiring     = searchParams.get("hiring") === "1";
  const currentForeign    = searchParams.get("foreign") === "1";
  const currentWorkStyle  = searchParams.get("workStyle") ?? "";

  /*
    都道府県は **47件すべて**を「よく選ばれる」→「すべての都道府県」の順で出す。
    ⚠️★**分け方も語彙も [lib/utils/location.ts](../../lib/utils/location.ts) の
       `PREFECTURE_FILTER_GROUPS` が唯一の出どころ。** `/jobs` の2箇所も同じものを使う。
       ここで COMMON_PREFECTURES を展開し直さないこと（3箇所で並びが割れる）。
    ⚠️ 該当0件の県も出す（都道府県だけの例外。経緯は location.ts のコメント）。
  */
  const locationOptions = PREFECTURE_FILTER_GROUPS.flatMap((g) =>
    g.prefectures.map((l) => ({ value: l, label: l, group: g.group })),
  );

  // アクティブフィルターのリスト（サマリー行用）
  const activeFilters: { key: string; label: string; color?: string; bg?: string; dot?: string; onRemove: () => void }[] = [];
  if (searchParams.get("q")) {
    activeFilters.push({
      key: "q",
      label: `"${searchParams.get("q")}"`,
      onRemove: () => updateParam("q", null),
    });
  }
  if (currentPhase) {
    const phaseOpt = phaseOptions.find((o) => o.value === currentPhase);
    activeFilters.push({
      key: "phase",
      label: phaseOpt?.label ?? currentPhase,
      color: phaseOpt?.color,
      bg: phaseOpt?.bg,
      dot: phaseOpt?.dot,
      onRemove: () => updateParam("phase", null),
    });
  }
  if (currentIndustry) {
    const industryGroup = industryOptions.find((d) => d.slug === currentIndustry);
    activeFilters.push({
      key: "industry",
      label: industryGroup?.name ?? currentIndustry,
      onRemove: () => updateParam("industry", null),
    });
  }
  if (currentLocation) {
    activeFilters.push({
      key: "location",
      label: `📍 ${currentLocation}`,
      onRemove: () => updateParam("location", null),
    });
  }
  if (currentHiring) {
    activeFilters.push({
      key: "hiring",
      label: "募集あり",
      onRemove: () => updateParam("hiring", null),
    });
  }
  if (currentForeign) {
    activeFilters.push({
      key: "foreign",
      label: "🌐 外資系",
      onRemove: () => updateParam("foreign", null),
    });
  }
  if (currentWorkStyle) {
    activeFilters.push({
      key: "workStyle",
      label: WORK_STYLE_LABELS[currentWorkStyle] ?? currentWorkStyle,
      onRemove: () => updateParam("workStyle", null),
    });
  }

  return (
    <>

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
                  onClick={clearQuery}
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

          {/* モバイル用フィルタートグルボタン */}
          <button
            type="button"
            className={`csb-filter-toggle${filtersExpanded ? " active" : ""}`}
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            aria-expanded={filtersExpanded}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            絞り込む{filtersExpanded ? " ▴" : " ▾"}
          </button>

          {/* フィルターチップ群（モバイルで折りたたみ） */}
          <div className={`csb-filter-chips${filtersExpanded ? " expanded" : ""}`}>

          {/* フェーズ */}
          <FilterChip
            label="フェーズ"
            value={currentPhase}
            options={phaseOptions}
            onSelect={(v) => { updateParam("phase", v); setOpenChip(null); }}
            isOpen={openChip === "phase"}
            onToggle={() => toggleChip("phase")}
            phaseStyle
          />

          {/* 業種 */}
          <FilterChip
            label="業種"
            value={currentIndustry}
            options={industryOptions.map((d) => ({ value: d.slug, label: d.name }))}
            onSelect={(v) => { updateParam("industry", v); setOpenChip(null); }}
            isOpen={openChip === "industry"}
            onToggle={() => toggleChip("industry")}
            listStyle
          />

          {/* 都道府県。⚠️ 47件あるので `searchable`（絞り込み入力）を付ける */}
          <FilterChip
            label="都道府県"
            value={currentLocation}
            options={locationOptions}
            onSelect={(v) => { updateParam("location", v); setOpenChip(null); }}
            isOpen={openChip === "location"}
            onToggle={() => toggleChip("location")}
            listStyle
            searchable
          />

          {/* ③ 勤務形態フィルター
                 ⚠️ **2026-08-11 に UI から外した（ロジックは残してある）。**
                    `ow_companies.remote_work_status` に値があるのは **76社中2社**だけ
                    （残りは migration が一括投入した 'hybrid' を 2026-07-27 に
                     NULL へ戻したため）。この状態で絞り込みを出すと
                    「リモート可の企業は2社しかない」と誤読される。
                 ⚠️ **消していないのは、充填率が上がったら戻すため。**
                    `SHOW_WORK_STYLE_FILTER` を true にすれば元に戻る。
                    URL の `?workStyle=` も引き続き効く（searchCompanies 側は無変更）。 */}
          {SHOW_WORK_STYLE_FILTER && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              className={`csb-filter-pill${currentWorkStyle ? " active" : ""}`}
              onClick={() => currentWorkStyle ? updateParam("workStyle", null) : toggleChip("workStyle")}
            >
              {currentWorkStyle ? (WORK_STYLE_LABELS[currentWorkStyle] ?? currentWorkStyle) : "勤務形態"}
              {currentWorkStyle
                ? <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>
                : <span style={{ fontSize: 12, marginLeft: 2 }}>▾</span>}
            </button>
            {openChip === "workStyle" && (
              <div className="csb-filter-pill-menu">
                {/* ⚠️ ラベルは workStyle.ts の1箇所で決める。ここに直書きしない。
                       アイコンは 2026-08-08 に削除（ラベルだけで意味は通る）。 */}
                {WORK_STYLE_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" className={`csb-filter-pill-item${currentWorkStyle === value ? " selected" : ""}`}
                    onClick={() => { updateParam("workStyle", value); setOpenChip(null); }}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ⚠️ **年収フィルタは 2026-08-25 に外した。戻さないこと。**
                ① 年収はポジションによって違うので、会社単位の1つの数字では表せない
                ② 実データでも成り立っていなかった。掲載79社のうち求人に年収が入って
                   いるのは**1社だけ**（`ow_companies.avg_salary` は0社）で、
                   どの閾値を選んでも**78社が無条件に落ちていた**
                （2026-08-20 に外した年齢フィルタと同じ形。生年月日が未入力の人を
                  無条件に落としていて、法令以前に機能として壊れていた）
             ⚠️ 旧 URL の `?salaryMin=` は無視される。壊れない。 */}
          {/* 外資系 */}
          <button
            type="button"
            className={`foreign-toggle${currentForeign ? " active" : ""}`}
            onClick={() => updateParam("foreign", currentForeign ? null : "1")}
            aria-pressed={currentForeign}
          >
            外資系{currentForeign && <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 3 }}>✕</span>}
          </button>

          {/*
            ⚠️ ラベルは「募集あり」。2026-08-06 まで「面談受付中」と書いていたが、
                 2026-08-08 に「求人あり」→「募集あり」（ナビの「募集」に用語を揃えた）。
               ?hiring=1 が絞っているのは ow_jobs に公開求人があるかどうか
               （lib/search/companies.ts で hiringSet を作る）で、
               面談の可否（accepting_casual_meetings）ではない。
               クエリパラメータ名 hiring と絞り込みロジックは変えていない。
          */}
          <label className={`csb-hiring${currentHiring ? " active" : ""}`}>
            <input
              type="checkbox"
              checked={currentHiring}
              onChange={(e) => updateParam("hiring", e.target.checked ? "1" : null)}
            />
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: currentHiring ? "#fff" : "#ea580c",
              animation: "pulseDot 1.8s ease-in-out infinite",
              display: "inline-block",
            }} />
            {currentHiring ? (
              <>募集あり <span style={{ fontSize: 12, opacity: 0.85 }}>✕</span></>
            ) : (
              <>募集あり</>
            )}
          </label>

          {/* ⚠️★**「すべてクリア」は廃止した**（2026-09-06 / 柴さんの判断）。
                 絞り込みが1つ付くたびに現れて右端の並びが動くうえ、
                 **すべての条件は個別に外せる** —— チップは ✕、
                 外資系と募集ありはもう一度押せば解除される（元からトグル）。
              ⚠️ 戻すなら、検索欄の ✕ と役割が重ならないようにすること
                 （あちらは検索文字だけを消す）。 */}

          </div>{/* /csb-filter-chips */}

          {/* 保存件数 */}
          {bookmarkCount > 0 && (
            <a
              href="/mypage"
              style={{
                marginLeft: "auto", flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 999,
                background: "#fef2f2", border: "1.5px solid #fecaca",
                color: "#dc2626", fontSize: 12, fontWeight: 700,
                textDecoration: "none", whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 13 }}>♥</span>
              {bookmarkCount}件保存中
            </a>
          )}
        </div>

        {/* ── アクティブフィルター サマリー行 ── */}
        {activeFilters.length > 0 && (
          <div
            className="csb-active-filters"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px 9px",
              overflowX: "auto",
              scrollbarWidth: "none",
              background: "var(--royal-50)",
              borderRadius: 8,
              borderLeft: "3px solid var(--royal)",
              marginBottom: 4,
            }}
          >
            <style>{`.csb-active-filters::-webkit-scrollbar { display: none; }`}</style>
            <span style={{ fontSize: 12, color: "var(--royal)", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>
              絞り込み中:
            </span>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.onRemove}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px 3px 8px",
                  borderRadius: 999,
                  background: f.bg ?? "var(--royal-50)",
                  color: f.color ?? "var(--royal)",
                  border: `1px solid ${f.color ? f.color + "40" : "var(--royal-100)"}`,
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "opacity 0.1s",
                  flexShrink: 0,
                }}
              >
                {f.dot && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.dot, flexShrink: 0 }} />
                )}
                {f.label}
                <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 1 }}>✕</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

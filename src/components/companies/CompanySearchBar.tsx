"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BusinessDomainOption } from "@/lib/companies/businessDomains";
import { WORK_STYLE_LABELS, WORK_STYLE_OPTIONS } from "@/lib/constants/workStyle";
import { PREFECTURE_FILTER_GROUPS } from "@/lib/utils/location";
/* ⚠️ フェーズは**マスタ全件**を出す（該当0社の段も出す）。実データから絞らないこと
      —— 段階の梯子が歯抜けに見える。経緯は lib/constants/phase.ts のコメント。 */
import { PHASE_OPTIONS } from "@/lib/constants/phase";

/**
 * 勤務形態フィルターを出すか。
 *
 * ⚠️ 2026-08-11 時点で `ow_companies.remote_work_status` に値があるのは
 *    **76社中2社**しかない。出すと「リモート可は2社だけ」と誤読されるので隠している。
 *    充填率が上がったら true に戻す。ロジック側（searchCompanies）は無変更。
 */
const SHOW_WORK_STYLE_FILTER = false;
import { fetchCompanyBookmarks } from "@/lib/bookmarks/companyBookmarks";



type Props = {
  /** 事業領域の選択肢。⚠️ **マスタが唯一の出どころ。** ここに値を書かない。
   *  ⚠️ 実データに1社でもあるものだけをサーバ側が渡す（0件の選択肢を出さない）。 */
  industryOptions: BusinessDomainOption[];
  /** 対象業界（軸2）の選択肢。⚠️ 事業領域とは**別の軸**（誰に売っているか）。
   *  ⚠️ こちらも実データにあるものだけ。0件の選択肢を出さない。 */
  targetIndustryOptions: { slug: string; name: string }[];
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
  hint,
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
  /** メニューの先頭に出す一言。⚠️ **「事業領域」と「顧客の業界」の判別だけのため**に
   *  足した（2026-09-07）。名前が似ていて、開いて中身を見るまで違いが分からない
   *  という指摘への対処。**全チップに付けないこと** —— 自明なチップに説明が付くと
   *  この2つが持つ「読まないと間違える」という合図が薄まる。 */
  hint?: string;
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
          {/* ⚠️ メニューの外側 padding は形ごとに違う（listStyle は左右0）ので、
                 hint は自分で左右 padding を持つ。上の padding には依存しない。 */}
          {hint && (
            <div style={{
              padding: listStyle ? "2px 16px 8px" : "0 0 8px",
              marginBottom: 6,
              borderBottom: "1px solid var(--line)",
              fontSize: 11.5, lineHeight: 1.4, color: "var(--ink-mute)",
            }}>{hint}</div>
          )}
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
export function CompanySearchBar({ industryOptions, targetIndustryOptions, companySuggestions = [] }: Props) {
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
  const currentTarget     = searchParams.get("target") ?? "";
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

  /* ⚠️ かつてここで `activeFilters`（「絞り込み中」行のチップ）を組み立てていた。
        2026-09-06 に行ごと廃止したので消した。理由はこのファイル下部のコメント。 */

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
            options={PHASE_OPTIONS}
            onSelect={(v) => { updateParam("phase", v); setOpenChip(null); }}
            isOpen={openChip === "phase"}
            onToggle={() => toggleChip("phase")}
            phaseStyle
          />

          {/* 事業領域（何を作っているか）
              ⚠️★**ラベルは「事業領域」。**「業種」に戻さないこと（2026-09-06）。
                 中身は `ow_business_domains` で、`/jobs` も「事業領域」と呼んでいる。
                 「業種」は `ow_industries`（IT・ソフトウェア／製造業…）に使う語で、
                 **すぐ隣の「対象業界」チップがそちらのマスタ**。名前が衝突する。
              ⚠️ URL のキーは `?industry=` のまま。2026-08-26 の移行で被リンクを
                 切らないためで、**キーとラベルが一致していないのは承知のうえ。** */}
          <FilterChip
            label="事業領域"
            value={currentIndustry}
            options={industryOptions.map((d) => ({ value: d.slug, label: d.name }))}
            onSelect={(v) => { updateParam("industry", v); setOpenChip(null); }}
            isOpen={openChip === "industry"}
            onToggle={() => toggleChip("industry")}
            listStyle
            /* ⚠️ 隣の「顧客の業界」の hint と**対で読ませる**。片方だけ変えないこと。 */
            hint="この会社が何を作っているか"
          />

          {/* 顧客の業界（誰に売っているか＝軸2）
              ⚠️★**事業領域と別の軸。** 統合しないこと。
                 例: アンドパッドは 事業領域「プロジェクト管理」× 顧客の業界「建設」。

              ⚠️★**画面のラベルは「顧客の業界」。内部の呼び名は「対象業界」**（2026-09-06）。
                 ずらしてあるのは意図的:
                   ・「対象業界」だと**その会社自身の業界**とも読める。とくに選択肢に
                     「IT・ソフトウェア」があり、実際は「IT企業に売っている会社」の意味なので
                     まず誤読される。「顧客の」を付けるだけで消える。
                   ・「事業領域」と「対象業界」は日常語だとほぼ同義で、
                     **チップを開くまで違いが分からなかった**（柴さんの指摘）。
                 ⚠️ DB（`ow_company_target_industries`）・URL（`?target=`）・
                    CLAUDE.md・`/admin` は「対象業界」のまま。`?industry=` とラベルが
                    一致していないのと同じ形で、**承知のうえ。**
              ⚠️ 実データにあるものだけを出す（サーバ側の `fetchAvailableTargetIndustries`）。
                 該当が無ければチップごと出さない。 */}
          {targetIndustryOptions.length > 0 && (
            <FilterChip
              label="顧客の業界"
              value={currentTarget}
              options={targetIndustryOptions.map((i) => ({ value: i.slug, label: i.name }))}
              onSelect={(v) => { updateParam("target", v); setOpenChip(null); }}
              isOpen={openChip === "target"}
              onToggle={() => toggleChip("target")}
              listStyle
              /* ⚠️ 「その会社自身の業界」と読まれるのを防ぐのがこの一言の目的。
                    選択肢に「IT・ソフトウェア」があるため、無いと必ず誤読される。
                 ⚠️ **隣の hint と同じ言い回しで書く**（「この会社が◯◯」）。
                    揃っていないと2つが同じ軸の言い換えに見え、比べられない。 */
              hint="この会社が誰に売っているか"
            />
          )}

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

        {/* ⚠️★**「絞り込み中」のサマリー行は廃止した**（2026-09-06 / 柴さんの判断）。
               絞り込みはチップ自体が選択状態（濃紺 + ✕）で示すので、
               同じことを2箇所に出していた。「なくても分かる」。
            ⚠️ 復活させるなら、**チップに出ない絞り込みが画面から消えないか**を
               先に確かめること（ここには `workStyle` も入っていた。
               あれは `SHOW_WORK_STYLE_FILTER = false` でチップ自体が出ていない）。 */}
      </div>
    </>
  );
}

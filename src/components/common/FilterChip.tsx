"use client";

import React, { useState } from "react";

/*
 * 絞り込みのチップ（2026-09-18 に `/companies` から切り出した共通部品）。
 *
 * ⚠️★**`/companies` と `/people` が同じものを使う。** それまで**同じ名前の別実装が2つ**あり
 *    （`CompanySearchBar.tsx` と `PeopleListClient.tsx`）、押したときの見た目と
 *    挙動が少しずつ違っていた。**3つ目を作らないこと。**
 *
 * ⚠️★切り出しにあたって `/companies` 側の実装を**そのまま**移した。見た目は変えていない。
 *    `/people` 側の旧実装にあった `:hover` と active の box-shadow は**引き継いでいない**
 *    （`/companies` の見た目を変えないことを優先した）。
 *
 * ⚠️ 複数選択（`values` / `onToggle` を使う形）は 2026-09-18 に足した**追加の口**。
 *    単一選択（`value` / `onSelect`）はそのまま動く。**片方に寄せないこと**——
 *    `/companies` は全チップが単一選択で、複数選択にすると URL の形まで変わる。
 */

export function FilterChip({
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
  values,
  onToggleValue,
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
  /**
   * ★複数選択（2026-09-18 に `/people` のために足した）。
   *
   * ⚠️ **`values` を渡したときだけ複数選択になる。** 渡さなければ従来どおり単一選択。
   *    `/companies` は全チップが単一選択のままで、URL の形も変わっていない。
   * ⚠️ 同じ項目の中は **OR**（企業一覧と同じ約束）。呼び出し側で AND にしないこと。
   */
  values?: string[];
  /** `values` を使うときの切り替え。⚠️ `values` とセットで渡すこと */
  onToggleValue?: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const multi = Array.isArray(values);
  const isActive = multi ? values!.length > 0 : !!value;
  const activeOpt = options.find((o) => o.value === value);
  /* 複数選択のラベル。⚠️ 件数を足す（「職種 2」）。選んだ中身を全部並べると
     チップが行を押し広げる（実測: 職種は最長で 14 文字ある） */
  const activeLabel = multi
    ? (values!.length === 1
        ? options.find((o) => o.value === values![0])?.label ?? label
        : `${label} ${values!.length}`)
    : activeOpt?.label;

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
            onClick={(e) => {
              e.stopPropagation();
              /* ⚠️ 複数選択は**全部外す**。1つずつ外したい人はメニューから外す */
              if (multi) { values!.forEach((v) => onToggleValue?.(v)); } else { onSelect(null); }
            }}
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
                const sel = multi ? values!.includes(o.value) : value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { if (multi) { onToggleValue?.(o.value); } else { onSelect(sel ? null : o.value); onToggle(); } }}
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
                  const sel = multi ? values!.includes(o.value) : value === o.value;
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
                      onClick={() => { if (multi) { onToggleValue?.(o.value); setQ(""); } else { onSelect(sel ? null : o.value); onToggle(); setQ(""); } }}
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
                const sel = multi ? values!.includes(o.value) : value === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { if (multi) { onToggleValue?.(o.value); } else { onSelect(sel ? null : o.value); onToggle(); } }}
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

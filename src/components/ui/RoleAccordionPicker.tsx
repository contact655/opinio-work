"use client";

/**
 * ★職種の「大分類アコーディオン」（2026-09-12 / 柴さんの指示）。
 *
 * ── なぜ作ったか ──────────────────────────────────────────────────────────
 * 「関心のある職種」の選び方が**3通り**縦に並んでいた（いまの職種からのおすすめチップ／
 * 検索ボックス／大分類・小分類のプルダウン＋追加ボタン）。どれを使えばよいか読めない。
 * **大分類を縦に並べて開くだけ**の1つにまとめた。
 *
 * ⚠️★**⑤（関心のある職種・複数）と⑥（職歴の職種・1つ）で同じ部品を使う。**
 *    `mode`（multi / single）と `variant`（inline / dropdown）で切り替える。
 *    **2つ目の実装を書かないこと。** 職種の入力方式が増えるたびに、同じ画面で
 *    挙動が割れる形の不具合が生まれている（2026-09-11 に3通りあったのを1つに畳んだ）。
 *
 * ⚠️ **大分類の並び順と表示名はマスタのまま。** `display_order` は
 *    「親ごとの相対順」なので、親と子を**別々に**並べ替える
 *    （CLAUDE.md「2階層マスタの display_order は親ごとの相対順」）。
 *
 * ⚠️ 候補の配列は呼び出し側が用意する（`is_active` / 統合済みの除外と、
 *    現在選択中の職種の足し戻しは呼び出し側の責任）。この部品は渡された配列をそのまま出す。
 */

import { useEffect, useMemo, useRef, useState } from "react";

export type RoleOption = { id: string; name: string; parent_id: string | null; display_order?: number };

/** 大分類の中で「この分類全般」を選んでいるか、子をいくつ選んでいるか */
type GroupState = { generalSelected: boolean; childIds: string[] };

function buildTree(roles: RoleOption[]) {
  const parents = roles
    .filter((r) => !r.parent_id)
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const childrenOf = new Map<string, RoleOption[]>();
  for (const r of roles) {
    if (!r.parent_id) continue;
    const list = childrenOf.get(r.parent_id) ?? [];
    list.push(r);
    childrenOf.set(r.parent_id, list);
  }
  childrenOf.forEach((list) => {
    list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  });
  return { parents, childrenOf };
}

// ── 見た目の共通部品 ──────────────────────────────────────────────────────────

/** ⚠️ チップの当たり判定は 44px（`ReasonChip` と同じ理由。狭い画面で押し間違える） */
function Chip({
  label, active, disabled, onClick, ariaLabel,
}: { label: string; active: boolean; disabled?: boolean; onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="role-chip"
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: 100,
        border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
        background: active ? "var(--royal-50)" : "#fff",
        color: active ? "var(--royal)" : "var(--ink-soft)",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        fontFamily: "inherit",
        /* ⚠️★**押せないときも `disabled` にして薄くする**（上限に達したとき）。
              押しても何も起きない状態にすると、壊れているのか上限なのか分からない。
              代わりに呼び出し側が案内文を出す。 */
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1.4,
        transition: "border-color 0.12s, background 0.12s, color 0.12s",
      }}
    >
      {label}
    </button>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export function RoleAccordionPicker({
  roles,
  /** 選択中の職種ID。**multi / single のどちらも配列で受ける**（single は0〜1件） */
  values,
  onChange,
  mode,
  /** multi のときの上限。`undefined` なら無制限 */
  max,
  disabled = false,
  /** 上限に達したときに出す案内（呼び出し側が文面を決める） */
  onLimitHit,
  ariaLabelPrefix = "職種",
}: {
  roles: RoleOption[];
  values: string[];
  onChange: (next: string[]) => void;
  mode: "multi" | "single";
  max?: number;
  disabled?: boolean;
  onLimitHit?: () => void;
  ariaLabelPrefix?: string;
}) {
  const { parents, childrenOf } = useMemo(() => buildTree(roles), [roles]);
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  /* 開いている大分類。⚠️★**選択中の大分類は開いた状態で始める**（⑥の要件）。
     multi でも、選び直すときに自分の選択が見えるほうがよい。 */
  const initialOpen = useMemo(() => {
    const set = new Set<string>();
    for (const id of values) {
      const r = byId.get(id);
      if (!r) continue;
      set.add(r.parent_id ?? r.id);
    }
    return set;
  }, [values, byId]);
  const [openIds, setOpenIds] = useState<Set<string>>(initialOpen);
  /* ⚠️ 開いている大分類が変わるのは利用者が押したときだけ。`values` の変化では動かさない
        （小分類を選ぶたびに開閉が変わると、押した場所が動く）。 */
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setOpenIds(initialOpen);
  }, [initialOpen]);

  /** 大分類ごとの状態 */
  function stateOf(parentId: string): GroupState {
    const children = childrenOf.get(parentId) ?? [];
    const childIds = children.filter((c) => values.includes(c.id)).map((c) => c.id);
    return { generalSelected: values.includes(parentId), childIds };
  }

  const atMax = max !== undefined && values.length >= max;

  function toggleGeneral(parentId: string) {
    const st = stateOf(parentId);
    if (mode === "single") {
      onChange(st.generalSelected ? [] : [parentId]);
      return;
    }
    if (st.generalSelected) {
      onChange(values.filter((v) => v !== parentId));
      return;
    }
    /* ⚠️★**全般を選ぶとその分類の小分類は外れる**（同じ分類で二重に数えない）。
          外れるぶん枠が空くので、**上限の判定は入れ替えた後の件数で行う。** */
    const next = values.filter((v) => !st.childIds.includes(v)).concat(parentId);
    if (max !== undefined && next.length > max) { onLimitHit?.(); return; }
    onChange(next);
  }

  function toggleChild(parentId: string, childId: string) {
    const st = stateOf(parentId);
    if (mode === "single") {
      onChange(values.includes(childId) ? [] : [childId]);
      return;
    }
    if (values.includes(childId)) {
      onChange(values.filter((v) => v !== childId));
      return;
    }
    /* ⚠️★**小分類を選ぶと全般は外れる。** 5件ちょうどで全般を選んでいる状態から
          その分類の小分類を1つ押すと、全般が外れて小分類が入り**5件のまま**になる。
          先に上限で弾くと、この入れ替えができなくなる。 */
    const next = (st.generalSelected ? values.filter((v) => v !== parentId) : values).concat(childId);
    if (max !== undefined && next.length > max) { onLimitHit?.(); return; }
    onChange(next);
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      {parents.map((p, i) => {
        const children = childrenOf.get(p.id) ?? [];
        const st = stateOf(p.id);
        const count = st.childIds.length + (st.generalSelected ? 1 : 0);
        const open = openIds.has(p.id);
        const generalDisabled = disabled || (!st.generalSelected && atMax && st.childIds.length === 0);
        return (
          <div key={p.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--line-soft)" }}>
            {/* 大分類の行。⚠️ 行そのものが開閉ボタン。「全般」は右端の別ボタン */}
            <div style={{ display: "flex", alignItems: "stretch", minHeight: 48 }}>
              <button
                type="button"
                onClick={() => setOpenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                  return next;
                })}
                aria-expanded={open}
                aria-label={`${p.name}（${ariaLabelPrefix}の大分類）を${open ? "閉じる" : "開く"}`}
                style={{
                  flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", background: "none", border: "none",
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  color: "var(--ink)", cursor: "pointer", textAlign: "left",
                }}
              >
                <Caret open={open} />
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{p.name}</span>
                {/* ⚠️ 閉じていても選択数が分かるようにする */}
                {count > 0 && (
                  <span style={{
                    flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--royal)",
                    background: "var(--royal-50)", borderRadius: 100, padding: "1px 8px",
                  }}>
                    {count}
                  </span>
                )}
              </button>
              {/* 右端: multi は「この分類全般」、single はチェックの丸 */}
              {mode === "multi" ? (
                <button
                  type="button"
                  onClick={() => (generalDisabled ? onLimitHit?.() : toggleGeneral(p.id))}
                  aria-pressed={st.generalSelected}
                  aria-label={`${p.name} 全般を${st.generalSelected ? "外す" : "選ぶ"}`}
                  className="tap-min-h"
                  style={{
                    flexShrink: 0, alignSelf: "center", marginRight: 10,
                    padding: "7px 12px", borderRadius: 100,
                    border: `1.5px solid ${st.generalSelected ? "var(--royal)" : "var(--line)"}`,
                    background: st.generalSelected ? "var(--royal-50)" : "#fff",
                    color: st.generalSelected ? "var(--royal)" : "var(--ink-soft)",
                    fontSize: 12, fontWeight: st.generalSelected ? 700 : 500,
                    fontFamily: "inherit",
                    cursor: generalDisabled ? "default" : "pointer",
                    opacity: generalDisabled ? 0.4 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  この分類全般
                </button>
              ) : (
                /* ⚠️★**大分類だけでも選べる仕様を残すための丸**（職歴の職種）。
                      これが無いと「営業」のような大分類のままの登録ができなくなる。 */
                <button
                  type="button"
                  onClick={() => toggleGeneral(p.id)}
                  aria-pressed={st.generalSelected}
                  aria-label={`${p.name}（大分類）を選ぶ`}
                  title={`${p.name}（大分類）を選ぶ`}
                  className="tap-min-h"
                  style={{
                    flexShrink: 0, alignSelf: "center", marginRight: 10,
                    width: 28, height: 28, borderRadius: "50%",
                    border: `1.5px solid ${st.generalSelected ? "var(--royal)" : "var(--line)"}`,
                    background: st.generalSelected ? "var(--royal)" : "#fff",
                    color: st.generalSelected ? "#fff" : "var(--line)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", fontFamily: "inherit", padding: 0,
                  }}
                >
                  <CheckIcon />
                </button>
              )}
            </div>

            {open && (
              <div style={{ padding: "2px 12px 12px", background: "var(--bg-tint)" }}>
                {children.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink-mute)", padding: "6px 0" }}>
                    この分類に小分類はありません。
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}>
                    {children.map((c) => {
                      const active = values.includes(c.id);
                      /* ⚠️ 上限に達していても、**その分類で全般を選んでいれば入れ替えられる**
                            （全般が外れて枠が空く）ので押せるままにする。 */
                      const chipDisabled = disabled || (!active && atMax && !st.generalSelected && mode === "multi");
                      return (
                        <Chip
                          key={c.id}
                          label={c.name}
                          active={active}
                          disabled={chipDisabled}
                          onClick={() => (chipDisabled ? onLimitHit?.() : toggleChild(p.id, c.id))}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 選んだものを上にまとめて出すチップ列（multi 用）。
 * ⚠️ 全般は「〇〇（全般）」と出す。小分類と見分けが付かないと外せない。
 */
export function SelectedRoleChips({
  roles, values, onRemove, disabled = false,
}: {
  roles: RoleOption[];
  values: string[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  if (values.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {values.map((id) => {
        const r = byId.get(id);
        const label = r ? (r.parent_id ? r.name : `${r.name}（全般）`) : id;
        return (
          <span
            key={id}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 100,
              border: "1px solid var(--royal)", background: "var(--royal-50)",
              color: "var(--royal)", fontSize: 13, fontWeight: 700,
            }}
          >
            {label}
            <button
              type="button"
              onClick={() => onRemove(id)}
              disabled={disabled}
              aria-label={`${label} を外す`}
              style={{
                background: "none", border: "none", padding: 0, lineHeight: 1,
                color: "inherit", cursor: disabled ? "default" : "pointer", fontSize: 14, fontFamily: "inherit",
              }}
            >×</button>
          </span>
        );
      })}
    </div>
  );
}

/**
 * ★1つだけ選ぶプルダウン（⑥ / 職歴の職種）。
 *
 * ⚠️★**画面下端でモーダルの外へはみ出さないこと。** 入力欄の下に置く余白が足りなければ
 *    **上に開く**。`position: absolute` の親は `position: relative` のこの div。
 * ⚠️ 375px で横にはみ出さないよう `left: 0; right: 0` で入力欄の幅に合わせる。
 */
export function RoleAccordionSelect({
  roles, value, onSelect, disabled = false, ariaLabel = "職種",
}: {
  roles: RoleOption[];
  value: string;
  onSelect: (roleId: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const selected = value ? byId.get(value) : undefined;
  const parentOfSelected = selected?.parent_id ? byId.get(selected.parent_id) : undefined;
  const label = selected
    ? (parentOfSelected ? `${parentOfSelected.name} > ${selected.name}` : selected.name)
    : "";

  /* 外を押したら閉じる */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    /* ⚠️ capture で拾う。モーダル側の Esc（閉じる）より先に受けないと、
          プルダウンだけ閉じたいのにモーダルごと閉じる。 */
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  /* ⚠️★開く向きは**開く直前に測る**。下に 320px 取れなければ上に開く。 */
  function handleOpen() {
    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setDropUp(window.innerHeight - r.bottom < 320 && r.top > 320);
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        style={{
          width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, padding: "10px 12px", borderRadius: 8,
          border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit",
          fontSize: 14, color: label ? "var(--ink)" : "var(--ink-mute)",
          cursor: disabled ? "default" : "pointer", textAlign: "left",
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{label || "職種を選ぶ"}</span>
        <Caret open={open} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", left: 0, right: 0, zIndex: 30,
            ...(dropUp ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
            maxHeight: 320, overflowY: "auto",
            background: "#fff", borderRadius: 10,
            boxShadow: "0 12px 32px rgba(15,23,42,0.18)",
          }}
        >
          <RoleAccordionPicker
            roles={roles}
            values={value ? [value] : []}
            mode="single"
            disabled={disabled}
            ariaLabelPrefix={ariaLabel}
            onChange={(next) => {
              const id = next[0] ?? "";
              onSelect(id);
              /* ⚠️ 選んだら閉じる。外すため（空）に押したときは開いたままにする。 */
              if (id) setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
